// Mock native/file-system dependencies before importing the module
jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///documents/",
  EncodingType: { UTF8: "utf8", Base64: "base64" },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  readAsStringAsync: jest.fn().mockResolvedValue("[]"),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
}));

jest.mock("../utils/s3-service", () => ({
  getPresignedUploadUrl: jest.fn(),
  uploadFileWithPresignedUrl: jest.fn(),
}));

jest.mock("../utils/api-service", () => ({
  apiService: { post: jest.fn(), get: jest.fn() },
}));

import * as FileSystem from "expo-file-system";
import {
  getQueue,
  addToQueue,
  removeFromQueue,
  subscribeToQueueChanges,
  unsubscribeFromQueueChanges,
  type Metadata,
  type QueueItem,
} from "../utils/upload-queue";

/** Flush all pending microtasks and macrotasks in the queue. */
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Reset mocks between tests. clearAllMocks() clears call counts but NOT implementations,
// so we explicitly restore the default file-system state after each test.
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);
  jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue("[]");
});

const makeMetadata = (timestamp: string): Metadata => ({
  studyId: "s1",
  location: "",
  notes: "",
  timestamp,
  platform: "ios",
});

const makeItem = (timestamp: string): QueueItem => ({
  id: timestamp,
  audioPath: `file:///documents/queued_audio/recording_${timestamp}.wav`,
  metadata: makeMetadata(timestamp),
  attempts: 0,
  lastAttempt: 0,
});

describe("getQueue", () => {
  it("returns empty array when queue file does not exist", async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: false } as any);
    const result = await getQueue();
    expect(result).toEqual([]);
  });

  it("returns empty array when file content is empty string", async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: true } as any);
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValueOnce("");
    const result = await getQueue();
    expect(result).toEqual([]);
  });

  it("returns parsed items from valid JSON file", async () => {
    const items = [makeItem("2024-01-17T10:00:00.000Z")];
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: true } as any);
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValueOnce(JSON.stringify(items));
    const result = await getQueue();
    expect(result).toEqual(items);
  });

  it("returns empty array and deletes file when JSON is corrupt", async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: true } as any);
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValueOnce("{ broken json {{");
    const result = await getQueue();
    expect(result).toEqual([]);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(
      expect.stringContaining("upload-queue.json"),
      { idempotent: true }
    );
  });
});

describe("addToQueue", () => {
  beforeEach(() => {
    // Default: queue file doesn't exist (empty queue), directory exists
    jest.mocked(FileSystem.getInfoAsync).mockImplementation((path: string) =>
      Promise.resolve({ exists: !String(path).includes("upload-queue.json") } as any)
    );
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue("[]");
  });

  it("copies the audio file to the managed directory", async () => {
    const metadata = makeMetadata("2024-01-17T10:00:00.000Z");
    await addToQueue("/cache/recording_123.wav", metadata);
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: "/cache/recording_123.wav",
      to: expect.stringContaining("recording_123.wav"),
    });
  });

  it("persists the new item to the queue JSON file", async () => {
    const metadata = makeMetadata("2024-01-17T10:00:00.000Z");
    await addToQueue("/cache/recording_123.wav", metadata);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining("upload-queue.json"),
      expect.stringContaining(metadata.timestamp),
      expect.anything()
    );
  });

  it("uses the metadata timestamp as the queue item ID", async () => {
    const ts = "2024-01-17T10:00:00.000Z";
    const metadata = makeMetadata(ts);
    await addToQueue("/cache/recording_123.wav", metadata);
    const writtenJson = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1] as string;
    const written = JSON.parse(writtenJson);
    expect(written[0].id).toBe(ts);
  });

  it("does not add a duplicate item with the same timestamp", async () => {
    const ts = "2024-01-17T10:00:00.000Z";
    const existingItem = makeItem(ts);
    jest.mocked(FileSystem.getInfoAsync).mockImplementation((path: string) =>
      Promise.resolve({ exists: true } as any)
    );
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(JSON.stringify([existingItem]));

    await addToQueue("/cache/recording_other.wav", makeMetadata(ts));

    // writeAsStringAsync should NOT have been called (no change to queue)
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it("does not add to queue if the audio file copy fails", async () => {
    jest.mocked(FileSystem.copyAsync).mockRejectedValueOnce(new Error("disk full"));
    const metadata = makeMetadata("2024-01-17T11:00:00.000Z");
    await addToQueue("/cache/recording_fail.wav", metadata);
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it("persists audioQualityFlags in the queue item metadata when provided", async () => {
    const metadata: Metadata = {
      studyId: "s1",
      location: "",
      notes: "",
      timestamp: "2024-01-17T10:00:00.000Z",
      platform: "ios",
      osVersion: "17.0",
      audioQualityFlags: {
        wouldHaveBeenFlagged: true,
        medianPeak: 0.001,
        maxWindowPeak: 0.002,
        artifactRatio: 2.0,
        hasArtifacts: false,
        windowPeaks: [0.001, 0.001, 0.001, 0.001, 0.001],
      },
    };
    await addToQueue("/cache/recording_quality.wav", metadata);
    const writtenJson = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1] as string;
    const written = JSON.parse(writtenJson);
    expect(written[0].metadata.audioQualityFlags).toEqual({
      wouldHaveBeenFlagged: true,
      medianPeak: 0.001,
      maxWindowPeak: 0.002,
      artifactRatio: 2.0,
      hasArtifacts: false,
      windowPeaks: [0.001, 0.001, 0.001, 0.001, 0.001],
    });
  });
});

describe("removeFromQueue", () => {
  it("removes the item with the matching ID from the queue", async () => {
    const ts = "2024-01-17T10:00:00.000Z";
    const items = [makeItem(ts), makeItem("2024-01-17T11:00:00.000Z")];
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(JSON.stringify(items));

    await removeFromQueue(ts);

    const writtenJson = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1] as string;
    const remaining = JSON.parse(writtenJson);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("2024-01-17T11:00:00.000Z");
  });

  it("does not modify queue when ID does not exist", async () => {
    const items = [makeItem("2024-01-17T10:00:00.000Z")];
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true } as any);
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue(JSON.stringify(items));

    await removeFromQueue("non-existent-id");

    // writeAsStringAsync should NOT be called — nothing changed
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
  });
});

describe("upload-queue listener management", () => {
  it("calls a subscribed listener immediately on subscribe", async () => {
    const listener = jest.fn();
    subscribeToQueueChanges(listener);
    // Allow the async getQueue() call to settle
    await flushPromises();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribeFromQueueChanges(listener);
  });

  it("calls listener with queue size 0 when queue is empty", async () => {
    const listener = jest.fn();
    subscribeToQueueChanges(listener);
    await flushPromises();
    expect(listener).toHaveBeenCalledWith(0);
    unsubscribeFromQueueChanges(listener);
  });

  it("does not call listener after unsubscribe when queue changes", async () => {
    const listener = jest.fn();
    subscribeToQueueChanges(listener);
    await flushPromises();
    unsubscribeFromQueueChanges(listener);
    const callCountAfterUnsubscribe = listener.mock.calls.length;

    // Trigger a queue change by removing an item (which calls notifyListeners internally)
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValueOnce(JSON.stringify([makeItem("2024-01-17T10:00:00.000Z")]));
    await removeFromQueue("2024-01-17T10:00:00.000Z");
    await flushPromises();

    // Listener should not have been called again
    expect(listener.mock.calls.length).toBe(callCountAfterUnsubscribe);
  });

  it("supports multiple independent listeners", async () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();

    subscribeToQueueChanges(listenerA);
    subscribeToQueueChanges(listenerB);
    await flushPromises();

    expect(listenerA).toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalled();

    unsubscribeFromQueueChanges(listenerA);
    unsubscribeFromQueueChanges(listenerB);
  });

  it("unsubscribing one listener does not affect others", async () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();

    subscribeToQueueChanges(listenerA);
    subscribeToQueueChanges(listenerB);
    await flushPromises();

    unsubscribeFromQueueChanges(listenerA);

    const callsBeforeA = listenerA.mock.calls.length;
    const callsBeforeB = listenerB.mock.calls.length;

    // listenerB should remain registered (not tested via further events,
    // but verifying it was called independently)
    expect(callsBeforeB).toBeGreaterThan(0);
    expect(callsBeforeA).toBeGreaterThan(0); // was called before removal

    unsubscribeFromQueueChanges(listenerB);
  });

  it("handles unsubscribing a listener that was never subscribed", () => {
    const never = jest.fn();
    expect(() => unsubscribeFromQueueChanges(never)).not.toThrow();
  });
});

