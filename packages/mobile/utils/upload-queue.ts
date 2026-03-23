import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import { getPresignedUploadUrl, uploadFileWithPresignedUrl } from "./s3-service";
import { apiService } from "./api-service";
import { API_CONFIG } from "../config/api";
import Constants from "expo-constants";
import { queryClient } from "./query-client";

const QUEUE_FILE_NAME = "upload-queue.json";
const QUEUE_FILE_PATH = (FileSystem.documentDirectory || "") + QUEUE_FILE_NAME;
const QUEUED_AUDIO_DIR = (FileSystem.documentDirectory || "") + "queued_audio/";
const PROCESS_INTERVAL = 30 * 1000; // Check queue every 30 seconds
const MAX_RETRIES = 500;

export interface Metadata {
  studyId: string;
  location: string; // RecordingPosition
  notes: string;
  timestamp: string; // ISO format
  platform: string;
  osVersion: string;
  audioQualityFlags?: {
    wouldHaveBeenFlagged: boolean; // isLowSignal at time of check
    medianPeak: number;
    maxWindowPeak: number;
    artifactRatio: number;
    hasArtifacts: boolean;
    windowPeaks: number[];
  };
}

export interface QueueItem {
  id: string; // Use timestamp as ID for simplicity
  audioPath: string;
  metadata: Metadata;
  attempts: number;
  lastAttempt: number; // timestamp (Date.now())
}

let isProcessing = false;
let intervalId: NodeJS.Timeout | null = null;

// --- Listener Management ---
type QueueChangeListener = (queueSize: number) => void;
let listeners: QueueChangeListener[] = [];

const notifyListeners = async () => {
  const queue = await getQueue();
  listeners.forEach((listener) => listener(queue.length));
};

export const subscribeToQueueChanges = (
  listener: QueueChangeListener
): void => {
  listeners.push(listener);
  // Notify initially
  getQueue().then((queue) => listener(queue.length));
};

export const unsubscribeFromQueueChanges = (
  listener: QueueChangeListener
): void => {
  listeners = listeners.filter((l) => l !== listener);
};

// --- Queue Management ---

export const getQueue = async (): Promise<QueueItem[]> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(QUEUE_FILE_PATH);
    if (!fileInfo.exists) {
      return []; // Return empty array if file doesn't exist
    }
    const jsonValue = await FileSystem.readAsStringAsync(QUEUE_FILE_PATH, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return jsonValue ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error("Failed to load upload queue from file:", e);
    // If reading/parsing fails, attempt to delete the potentially corrupt file
    // to prevent future errors and start fresh.
    try {
      await FileSystem.deleteAsync(QUEUE_FILE_PATH, { idempotent: true });
      console.warn("Deleted potentially corrupt queue file:", QUEUE_FILE_PATH);
    } catch (deleteError) {
      console.error("Failed to delete corrupt queue file:", deleteError);
    }
    return [];
  }
};

const saveQueue = async (queue: QueueItem[]): Promise<void> => {
  if (!FileSystem.documentDirectory) {
    console.error(
      "FileSystem.documentDirectory is null or undefined. Cannot save queue."
    );
    return;
  }
  try {
    const jsonValue = JSON.stringify(queue, null, 2); // Pretty print for easier debugging
    // Ensure the directory exists
    const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory, {
        intermediates: true,
      });
    }
    await FileSystem.writeAsStringAsync(QUEUE_FILE_PATH, jsonValue, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    // Notify listeners after saving
    await notifyListeners();
  } catch (e) {
    console.error("Failed to save upload queue to file:", e);
  }
};

export const addToQueue = async (
  originalAudioPath: string,
  metadata: Metadata
): Promise<void> => {
  // Ensure the target directory exists
  if (!FileSystem.documentDirectory) {
    console.error(
      "FileSystem.documentDirectory is null or undefined. Cannot add to queue."
    );
    return;
  }
  try {
    await FileSystem.makeDirectoryAsync(QUEUED_AUDIO_DIR, {
      intermediates: true,
    });
  } catch (dirError) {
    console.error("Failed to create directory for queued audio:", dirError);
    return; // Don't proceed if directory creation fails
  }

  // Construct the new path
  const filename = originalAudioPath.split("/").pop();
  if (!filename) {
    console.error("Could not extract filename from path:", originalAudioPath);
    return;
  }
  const newAudioPath = QUEUED_AUDIO_DIR + filename;

  try {
    // Copy the file to the new location
    await FileSystem.copyAsync({
      from: originalAudioPath,
      to: newAudioPath,
    });
    console.log(`Copied ${originalAudioPath} to ${newAudioPath}`);

    // Create the queue item with the *new* path
    const newItem: QueueItem = {
      id: metadata.timestamp, // Use timestamp as a unique ID
      audioPath: newAudioPath, // Use the path within our managed directory
      metadata,
      attempts: 0,
      lastAttempt: 0,
    };

    const queue = await getQueue();
    // Avoid adding duplicates
    if (!queue.find((item) => item.id === newItem.id)) {
      queue.push(newItem);
      await saveQueue(queue);
      console.log("Added to upload queue:", newItem.id, newAudioPath);
      triggerProcessQueue();
    } else {
      console.warn("Attempted to add duplicate item to queue:", newItem.id);
      // If a duplicate is attempted, we should probably clean up the copied file
      // as it won't be referenced by the queue.
      try {
        await FileSystem.deleteAsync(newAudioPath, { idempotent: true });
        console.log("Cleaned up unreferenced copied file:", newAudioPath);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up unreferenced copied file:",
          newAudioPath,
          cleanupError
        );
      }
    }
  } catch (copyError) {
    console.error(
      `Failed to copy audio file from ${originalAudioPath} to ${newAudioPath}:`,
      copyError
    );
    // Don't add to queue if copy fails
  }
};

export const clearQueue = async (): Promise<void> => {
  try {
    // Delete all queued audio files
    const dirInfo = await FileSystem.getInfoAsync(QUEUED_AUDIO_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(QUEUED_AUDIO_DIR, { idempotent: true });
    }
    // Reset the queue file
    await saveQueue([]);
    console.log("Queue cleared.");
  } catch (e) {
    console.error("Failed to clear queue:", e);
  }
};

export const removeFromQueue = async (id: string): Promise<void> => {
  let queue = await getQueue();
  const initialLength = queue.length;
  queue = queue.filter((item) => item.id !== id);
  // Only save and notify if something was actually removed
  if (queue.length < initialLength) {
    await saveQueue(queue); // This will call notifyListeners
    console.log("Removed from upload queue:", id);
  }
};

const updateQueueItem = async (updatedItem: QueueItem): Promise<void> => {
  const queue = await getQueue();
  const index = queue.findIndex((item) => item.id === updatedItem.id);
  if (index > -1) {
    queue[index] = updatedItem;
    await saveQueue(queue); // This will call notifyListeners
  }
};

// --- Helper function for safe deletion ---
const deleteLocalFileSafely = async (
  filePath: string,
  reason: "success" | "max_retries"
) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
      if (reason === "success") {
        console.log(`Deleted local file after successful upload: ${filePath}`);
      } else {
        console.warn(`Deleted local file after max retries: ${filePath}`);
      }
    } else {
      if (reason === "success") {
        console.log(
          `Local file already deleted (post-success check): ${filePath}`
        );
      } else {
        console.warn(
          `Local file already deleted (max retries check): ${filePath}`
        );
      }
    }
  } catch (deleteError) {
    console.error(
      `Failed to delete local file ${filePath} (${reason}):`,
      deleteError
    );
  }
};

// --- Queue Processing ---

export const processQueue = async (): Promise<void> => {
  if (isProcessing) {
    // console.log("Queue processing already in progress.");
    return;
  }

  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected || !networkState.isInternetReachable) {
    console.log("No internet connection. Skipping queue processing.");
    return;
  }

  isProcessing = true;
  console.log("Starting queue processing...");

  try {
    const queue = await getQueue();
    if (queue.length === 0) {
      console.log("Upload queue is empty.");
      isProcessing = false; // Reset flag if queue is empty
      return;
    }

    // Process one item at a time to avoid overwhelming network/S3
    const itemToProcess = queue[0]; // Process the oldest item first

    // --- Check if the local file still exists ---
    try {
      const fileInfo = await FileSystem.getInfoAsync(itemToProcess.audioPath);
      if (!fileInfo.exists) {
        console.warn(
          `Audio file for queue item ${itemToProcess.id} not found at ${itemToProcess.audioPath}. Removing from queue.`
        );
        await removeFromQueue(itemToProcess.id); // This also notifies listeners
        isProcessing = false; // Reset flag
        // Trigger next cycle immediately as this one is aborted
        setTimeout(processQueue, 1000);
        return;
      }
    } catch (error) {
      console.error(
        `Error checking file existence for ${itemToProcess.audioPath}:`,
        error
      );
      // Optionally, decide if you want to retry or remove the item on error
      // For now, we'll proceed cautiously and let the backoff handle potential temporary issues
    }
    // --- End File Existence Check ---

    // Basic exponential backoff check
    const backoffDelay = Math.min(
      Math.pow(2, itemToProcess.attempts) * 1000 * 60,
      // 1 minute
      60 * 1000
    ); // 1m, 2m, 4m, 8m, 16m, 1 day
    if (Date.now() - itemToProcess.lastAttempt < backoffDelay) {
      console.log(
        `Queue item ${itemToProcess.id} is in backoff period (attempt ${itemToProcess.attempts}). Waiting.`
      );
      isProcessing = false; // Reset flag
      return; // Respect backoff
    }

    console.log(
      `Attempting upload for queue item: ${itemToProcess.id} (Attempt ${
        itemToProcess.attempts + 1
      })`
    );
    const filename = `${itemToProcess.metadata.timestamp}.wav`;

    try {
      console.log("Getting presigned upload url");
      // Step 1: Get fresh presigned URL
      const { uploadUrl, s3Key } = await getPresignedUploadUrl(filename);
      // Step 2: Upload audio file
      await uploadFileWithPresignedUrl(itemToProcess.audioPath, uploadUrl);
      console.log(`Successfully uploaded queue item to S3: ${itemToProcess.id}`);

      // Step 3: Register recording with metadata
      await apiService.post(
        API_CONFIG.ENDPOINTS.RECORDINGS.CREATE,
        {
          s3Key,
          metadata: {
            ...itemToProcess.metadata,
            device: Constants.deviceName,
          },
        }
      );
      console.log(`Successfully notified API for queue item: ${itemToProcess.id}`);

      await removeFromQueue(itemToProcess.id);
      await deleteLocalFileSafely(itemToProcess.audioPath, "success");
      queryClient.invalidateQueries({ queryKey: ["recordings", itemToProcess.metadata.studyId] });
    } catch (uploadError) {
      console.warn(
        `Failed to upload queue item: ${itemToProcess.id}. Updating attempt count.`,
        uploadError
      );
      itemToProcess.attempts += 1;
      itemToProcess.lastAttempt = Date.now();

      if (itemToProcess.attempts >= MAX_RETRIES) {
        console.error(
          `Max retries (${MAX_RETRIES}) reached for queue item ${itemToProcess.id}. Removing from queue.`
        );
        await removeFromQueue(itemToProcess.id);
        await deleteLocalFileSafely(itemToProcess.audioPath, "max_retries");
      } else {
        await updateQueueItem(itemToProcess);
        console.log(
          `Queue item ${itemToProcess.id} updated. Attempt ${itemToProcess.attempts}/${MAX_RETRIES}. Next attempt possible after backoff.`
        );
      }
    }
  } catch (error) {
    console.error("Error processing upload queue:", error);
  } finally {
    isProcessing = false;
    console.log("Queue processing cycle finished.");
    // Check if more items exist and trigger processing immediately for the next item
    const remainingQueue = await getQueue();
    if (remainingQueue.length > 0) {
      console.log("Queue still contains items, triggering next cycle.");
      // Use setTimeout to avoid potential stack overflow if processing is very fast
      setTimeout(processQueue, 10000);
    }
  }
};

// Trigger processing manually (e.g., when adding an item or on app start)
export const triggerProcessQueue = () => {
  // Avoid starting multiple concurrent processing loops
  if (!isProcessing) {
    console.log("Manual trigger for queue processing.");
    processQueue();
  } else {
    console.log("Manual trigger ignored, processing already active.");
  }
};

// --- Stop Processing ---

export const stopQueueProcessing = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    console.log("Stopped queue processing.");
    intervalId = null;
  }
};

// --- Initialization ---

export const initializeQueueProcessing = (): (() => void) => {
  console.log("Initializing background upload queue processing...");

  // Clear any existing interval before starting a new one
  if (intervalId) {
    clearInterval(intervalId);
    console.log("Cleared existing interval before re-initializing.");
    intervalId = null;
  }

  // Process immediately on init
  triggerProcessQueue();

  // Start interval polling
  intervalId = setInterval(triggerProcessQueue, PROCESS_INTERVAL); // Use trigger to respect isProcessing flag
  console.log(`Queue processing interval started with ID: ${intervalId}`);

  // Return a cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      console.log(
        `Stopped background upload queue processing interval: ${intervalId}`
      );
      intervalId = null;
    }
    // Optionally clear listeners on cleanup if needed, but usually components manage their own subscriptions
    // listeners = [];
    // console.log("Cleared queue change listeners.");
  };
};
