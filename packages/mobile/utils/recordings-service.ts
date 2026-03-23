import { apiService } from "./api-service";
import { API_CONFIG } from "../config/api";
import { getQueue, QueueItem } from "./upload-queue";
import { getCachedAudioPath } from "./audio-cache";
import { getAuthStudyId } from "./auth-storage";

export type RecordingStatus = "uploading" | "uploaded" | "failed";

export type AnalysisStatus = "no_abnormalities" | "unclear" | "abnormalities_detected";

export interface AnalysisResult {
  status: AnalysisStatus;
  title: string;
  description: string;
  explanation: string;
}

export interface Recording {
  id: string;
  timestamp: string; // ISO format
  studyId: string;
  s3Key?: string;
  localPath?: string;
  status: RecordingStatus;
  attempts?: number;
  classification?: AnalysisStatus;
}

export interface ApiRecording {
  id: string;
  s3Key: string;
  studyId: string;
  createdAt: string;
}

interface PaginatedApiResponse {
  data: ApiRecording[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Construct S3 URL from s3Key
export const getS3AudioUrl = (s3Key: string): string => {
  return `${API_CONFIG.S3_ENDPOINT}/${s3Key}.wav`;
};

// Resolve audio URI: local file (queue) or cached download (uploaded)
export const resolveAudioUri = async (
  id: string,
  recording: Pick<Recording, "localPath" | "s3Key">
): Promise<string | null> => {
  if (recording.localPath) return recording.localPath;
  if (recording.s3Key) return getCachedAudioPath(id);
  return null;
};

// Fetch recordings from API with pagination — throws on error
export const fetchRecordingsFromApi = async (
  page = 1,
  limit = 10
): Promise<{ recordings: Recording[]; totalPages: number }> => {
  const endpoint = `${API_CONFIG.ENDPOINTS.RECORDINGS.LIST}?page=${page}&limit=${limit}`;
  const response = await apiService.get<PaginatedApiResponse>(endpoint);

  return {
    recordings: response.data.map((item) => ({
      id: item.id,
      timestamp: item.createdAt,
      studyId: item.studyId,
      s3Key: item.s3Key,
      status: "uploaded" as RecordingStatus,
    })),
    totalPages: response.totalPages,
  };
};

// Convert queue item to recording
export const queueItemToRecording = (item: QueueItem): Recording => {
  const status: RecordingStatus = item.attempts > 0 && item.attempts >= 3 ? "failed" : "uploading";

  return {
    id: item.id,
    timestamp: item.metadata.timestamp,
    studyId: item.metadata.studyId,
    localPath: item.audioPath,
    status,
    attempts: item.attempts,
  };
};

// Merge API recordings with queue items
export const getMergedRecordings = async (
  page = 1
): Promise<{ recordings: Recording[]; totalPages: number; apiError: boolean; hasMore: boolean }> => {
  if (page > 1) {
    try {
      const result = await fetchRecordingsFromApi(page);
      return { ...result, apiError: false, hasMore: page < result.totalPages };
    } catch (error) {
      console.error("Failed to fetch recordings from API:", error);
      return { recordings: [], totalPages: 1, apiError: true, hasMore: false };
    }
  }

  let apiRecordings: Recording[] = [];
  let totalPages = 1;
  let apiError = false;

  try {
    const result = await fetchRecordingsFromApi(1);
    apiRecordings = result.recordings;
    totalPages = result.totalPages;
  } catch (error) {
    console.error("Failed to fetch recordings from API:", error);
    apiError = true;
  }

  const [queueItems, currentStudyId] = await Promise.all([
    getQueue(),
    getAuthStudyId(),
  ]);

  const apiTimestamps = new Set(apiRecordings.map((r) => r.timestamp));

  const queueRecordings = queueItems
    .filter((item) => !apiTimestamps.has(item.metadata.timestamp))
    .filter((item) => !currentStudyId || item.metadata.studyId === currentStudyId)
    .map(queueItemToRecording);

  const allRecordings = [...apiRecordings, ...queueRecordings];
  allRecordings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { recordings: allRecordings, totalPages, apiError, hasMore: page < totalPages };
};

export async function fetchRecordingsPage(
  page: number
): Promise<{ recordings: Recording[]; totalPages: number; hasMore: boolean }> {
  const result = await getMergedRecordings(page);
  if (result.apiError && result.recordings.length === 0) {
    throw new Error("Failed to fetch recordings");
  }
  return {
    recordings: result.recordings,
    totalPages: result.totalPages,
    hasMore: page < result.totalPages,
  };
}

export async function resolveAudioUriForQuery(recording: Recording): Promise<string> {
  const uri = await resolveAudioUri(recording.id, recording);
  if (!uri) throw new Error("Audio URI unavailable");
  return uri;
}

// Group recordings by time period
export type TimePeriod = "thisWeek" | "lastWeek" | "older";

export interface GroupedRecordings {
  thisWeek: Recording[];
  lastWeek: Recording[];
  older: Recording[];
}

export const groupRecordingsByPeriod = (recordings: Recording[]): GroupedRecordings => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = startOfToday.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Adjust for Monday as start of week

  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfToday.getDate() - diffToMonday);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const grouped: GroupedRecordings = {
    thisWeek: [],
    lastWeek: [],
    older: [],
  };

  recordings.forEach((recording) => {
    const recordingDate = new Date(recording.timestamp);

    if (recordingDate >= startOfThisWeek) {
      grouped.thisWeek.push(recording);
    } else if (recordingDate >= startOfLastWeek) {
      grouped.lastWeek.push(recording);
    } else {
      grouped.older.push(recording);
    }
  });

  return grouped;
};

// Fetch AI analysis for a recording
export const fetchRecordingAnalysis = async (recordingId: string): Promise<AnalysisResult> => {
  try {
    const endpoint = API_CONFIG.ENDPOINTS.RECORDINGS.ANALYSIS.replace(":id", recordingId);
    const result = await apiService.get<AnalysisResult>(endpoint);
    return result;
  } catch (error) {
    console.log("Analysis API not available, using dummy data");
    // Dummy data fallback — cycle through statuses based on ID hash
    const statuses: AnalysisStatus[] = ["no_abnormalities", "unclear", "abnormalities_detected"];
    const hash = recordingId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const status = statuses[hash % 3];

    const dummyResults: Record<AnalysisStatus, AnalysisResult> = {
      no_abnormalities: {
        status: "no_abnormalities",
        title: "No abnormalities detected",
        description: "Your shunt sounds are within normal range.",
        explanation: "Our AI model analyzed your recording and did not detect any unusual patterns.",
      },
      unclear: {
        status: "unclear",
        title: "Unclear result",
        description: "The analysis could not determine a clear result.",
        explanation: "The recording quality or shunt sounds were not clear enough for a definitive assessment.",
      },
      abnormalities_detected: {
        status: "abnormalities_detected",
        title: "Indication of abnormalities",
        description: "Unusual patterns were detected in the recording.",
        explanation: "Our AI model detected patterns that may indicate changes in your shunt flow.",
      },
    };

    return dummyResults[status];
  }
};

