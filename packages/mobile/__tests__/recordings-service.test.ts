jest.mock("../utils/api-service", () => ({
  apiService: { get: jest.fn() },
}));

jest.mock("../utils/upload-queue", () => ({
  getQueue: jest.fn(),
  subscribeToQueueChanges: jest.fn(),
  unsubscribeFromQueueChanges: jest.fn(),
}));

jest.mock("../utils/auth-storage", () => ({
  getAuthStudyId: jest.fn(),
}));

// audio-cache is imported transitively; mock to avoid native deps
jest.mock("../utils/audio-cache", () => ({
  getCachedAudioPath: jest.fn(),
}));

import {
  groupRecordingsByPeriod,
  queueItemToRecording,
  getS3AudioUrl,
  getMergedRecordings,
  fetchRecordingsFromApi,
  Recording,
} from "../utils/recordings-service";
import type { QueueItem } from "../utils/upload-queue";
import { apiService } from "../utils/api-service";
import { getQueue } from "../utils/upload-queue";
import { getAuthStudyId } from "../utils/auth-storage";

// Fixed reference point: a Wednesday at noon local time
// We compute week boundaries the same way the function does (local time)
// so tests are timezone-agnostic.
const NOW = new Date("2024-01-17T12:00:00");

/** Compute startOfThisWeek and startOfLastWeek exactly as groupRecordingsByPeriod does. */
function getWeekBoundaries() {
  const startOfToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const dayOfWeek = startOfToday.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfToday.getDate() - diffToMonday);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
  return { startOfThisWeek, startOfLastWeek };
}

const { startOfThisWeek, startOfLastWeek } = getWeekBoundaries();

function makeRecording(isoTimestamp: string): Recording {
  return {
    id: isoTimestamp,
    timestamp: isoTimestamp,
    studyId: "test-study",
    status: "uploaded",
  };
}

function ts(d: Date) {
  return d.toISOString();
}

const makePaginatedResponse = (items: any[], totalPages = 1) => ({
  data: items,
  total: items.length,
  page: 1,
  limit: 10,
  totalPages,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

function makeQueueItem(attempts: number): QueueItem {
  return {
    id: "2024-01-17T10:00:00.000Z",
    audioPath: "/queued_audio/recording.wav",
    metadata: {
      studyId: "s1",
      location: "",
      notes: "",
      timestamp: "2024-01-17T10:00:00.000Z",
      platform: "ios",
    },
    attempts,
    lastAttempt: 0,
  };
}

describe("queueItemToRecording", () => {
  it("sets status to 'uploading' when attempts is 0", () => {
    const result = queueItemToRecording(makeQueueItem(0));
    expect(result.status).toBe("uploading");
  });

  it("sets status to 'uploading' when attempts is 1", () => {
    const result = queueItemToRecording(makeQueueItem(1));
    expect(result.status).toBe("uploading");
  });

  it("sets status to 'uploading' when attempts is 2", () => {
    const result = queueItemToRecording(makeQueueItem(2));
    expect(result.status).toBe("uploading");
  });

  it("sets status to 'failed' when attempts reaches 3", () => {
    const result = queueItemToRecording(makeQueueItem(3));
    expect(result.status).toBe("failed");
  });

  it("sets status to 'failed' for high attempt counts", () => {
    expect(queueItemToRecording(makeQueueItem(10)).status).toBe("failed");
    expect(queueItemToRecording(makeQueueItem(499)).status).toBe("failed");
  });

  it("maps metadata fields to recording correctly", () => {
    const item = makeQueueItem(0);
    const result = queueItemToRecording(item);
    expect(result.id).toBe(item.id);
    expect(result.timestamp).toBe(item.metadata.timestamp);
    expect(result.studyId).toBe(item.metadata.studyId);
    expect(result.localPath).toBe(item.audioPath);
    expect(result.attempts).toBe(item.attempts);
  });

  it("does not set s3Key (file not yet uploaded)", () => {
    const result = queueItemToRecording(makeQueueItem(0));
    expect(result.s3Key).toBeUndefined();
  });
});

describe("getS3AudioUrl", () => {
  it("constructs a valid https URL as endpoint/key.wav", () => {
    const key = "study-abc/rec-123";
    const url = getS3AudioUrl(key);
    expect(url).toBe(`https://shunt-dev.s3.fr-par.scw.cloud/${key}.wav`);
  });
});

describe("groupRecordingsByPeriod", () => {
  describe("thisWeek", () => {
    it("includes a recording from now (midday today)", () => {
      const r = makeRecording(ts(NOW));
      const { thisWeek } = groupRecordingsByPeriod([r]);
      expect(thisWeek).toContainEqual(r);
    });

    it("includes a recording 1ms after startOfThisWeek", () => {
      const r = makeRecording(ts(new Date(startOfThisWeek.getTime() + 1)));
      const { thisWeek } = groupRecordingsByPeriod([r]);
      expect(thisWeek).toContainEqual(r);
    });

    it("includes a recording at the exact start of this week", () => {
      const r = makeRecording(ts(startOfThisWeek));
      const { thisWeek } = groupRecordingsByPeriod([r]);
      expect(thisWeek).toContainEqual(r);
    });
  });

  describe("lastWeek", () => {
    it("includes a recording 1ms before startOfThisWeek", () => {
      const r = makeRecording(ts(new Date(startOfThisWeek.getTime() - 1)));
      const { lastWeek } = groupRecordingsByPeriod([r]);
      expect(lastWeek).toContainEqual(r);
    });

    it("includes a recording at the exact start of last week", () => {
      const r = makeRecording(ts(startOfLastWeek));
      const { lastWeek } = groupRecordingsByPeriod([r]);
      expect(lastWeek).toContainEqual(r);
    });

    it("includes a recording midway through last week", () => {
      const mid = new Date(startOfLastWeek.getTime() + 3.5 * 24 * 60 * 60 * 1000);
      const r = makeRecording(ts(mid));
      const { lastWeek } = groupRecordingsByPeriod([r]);
      expect(lastWeek).toContainEqual(r);
    });
  });

  describe("older", () => {
    it("includes a recording 1ms before startOfLastWeek", () => {
      const r = makeRecording(ts(new Date(startOfLastWeek.getTime() - 1)));
      const { older } = groupRecordingsByPeriod([r]);
      expect(older).toContainEqual(r);
    });

    it("includes a recording 30 days before now", () => {
      const r = makeRecording(ts(new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)));
      const { older } = groupRecordingsByPeriod([r]);
      expect(older).toContainEqual(r);
    });

    it("includes a recording from a year ago", () => {
      const r = makeRecording(ts(new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000)));
      const { older } = groupRecordingsByPeriod([r]);
      expect(older).toContainEqual(r);
    });
  });

  describe("grouping correctness", () => {
    it("returns empty arrays when no recordings", () => {
      const result = groupRecordingsByPeriod([]);
      expect(result.thisWeek).toHaveLength(0);
      expect(result.lastWeek).toHaveLength(0);
      expect(result.older).toHaveLength(0);
    });

    it("places each recording in exactly one group", () => {
      const recordings = [
        makeRecording(ts(new Date(startOfThisWeek.getTime() + 1))),
        makeRecording(ts(new Date(startOfLastWeek.getTime() + 1))),
        makeRecording(ts(new Date(startOfLastWeek.getTime() - 1))),
      ];
      const { thisWeek, lastWeek, older } = groupRecordingsByPeriod(recordings);
      expect(thisWeek.length + lastWeek.length + older.length).toBe(recordings.length);
    });

    it("places multiple recordings in the same period into the same group", () => {
      const recordings = [
        makeRecording(ts(new Date(startOfThisWeek.getTime() + 1000))),
        makeRecording(ts(new Date(startOfThisWeek.getTime() + 2000))),
        makeRecording(ts(new Date(startOfThisWeek.getTime() + 3000))),
      ];
      const { thisWeek } = groupRecordingsByPeriod(recordings);
      expect(thisWeek).toHaveLength(3);
    });
  });
});

// ── fetchRecordingsFromApi ───────────────────────────────────────────────────

describe("fetchRecordingsFromApi", () => {
  it("parses paginated response and returns recordings + totalPages", async () => {
    const apiItem = { id: "r1", s3Key: "s1/r1", studyId: "s1", createdAt: "2024-01-17T10:00:00.000Z" };
    (apiService.get as jest.Mock).mockResolvedValue(makePaginatedResponse([apiItem], 3));

    const { recordings, totalPages } = await fetchRecordingsFromApi(1, 10);

    expect(recordings).toHaveLength(1);
    expect(recordings[0].id).toBe("r1");
    expect(recordings[0].timestamp).toBe("2024-01-17T10:00:00.000Z");
    expect(recordings[0].s3Key).toBe("s1/r1");
    expect(recordings[0].status).toBe("uploaded");
    expect(totalPages).toBe(3);
  });

  it("sends page and limit as query params", async () => {
    (apiService.get as jest.Mock).mockResolvedValue(makePaginatedResponse([], 1));

    await fetchRecordingsFromApi(2, 5);

    expect(apiService.get).toHaveBeenCalledWith(
      expect.stringContaining("page=2")
    );
    expect(apiService.get).toHaveBeenCalledWith(
      expect.stringContaining("limit=5")
    );
  });

  it("throws on error", async () => {
    (apiService.get as jest.Mock).mockRejectedValue(new Error("network error"));

    await expect(fetchRecordingsFromApi()).rejects.toThrow("network error");
  });
});

// ── getMergedRecordings — studyId filter ─────────────────────────────────────

function makeQueueItemForStudy(studyId: string, timestamp: string): QueueItem {
  return {
    id: timestamp,
    audioPath: "/queued_audio/recording.wav",
    metadata: { studyId, location: "", notes: "", timestamp, platform: "ios" },
    attempts: 0,
    lastAttempt: 0,
  };
}

describe("getMergedRecordings — studyId filter", () => {
  const TIMESTAMP_A = "2024-01-17T10:00:00.000Z";
  const TIMESTAMP_B = "2024-01-17T11:00:00.000Z";

  beforeEach(() => {
    (apiService.get as jest.Mock).mockResolvedValue(makePaginatedResponse([]));
  });

  it("includes queue items that match the current studyId", async () => {
    (getAuthStudyId as jest.Mock).mockResolvedValue("study-A");
    (getQueue as jest.Mock).mockResolvedValue([
      makeQueueItemForStudy("study-A", TIMESTAMP_A),
    ]);

    const { recordings } = await getMergedRecordings();
    expect(recordings).toHaveLength(1);
    expect(recordings[0].studyId).toBe("study-A");
  });

  it("excludes queue items belonging to a different studyId", async () => {
    (getAuthStudyId as jest.Mock).mockResolvedValue("study-B");
    (getQueue as jest.Mock).mockResolvedValue([
      makeQueueItemForStudy("study-A", TIMESTAMP_A),
    ]);

    const { recordings } = await getMergedRecordings();
    expect(recordings).toHaveLength(0);
  });

  it("excludes items from other users while including items for the current user", async () => {
    (getAuthStudyId as jest.Mock).mockResolvedValue("study-B");
    (getQueue as jest.Mock).mockResolvedValue([
      makeQueueItemForStudy("study-A", TIMESTAMP_A),
      makeQueueItemForStudy("study-B", TIMESTAMP_B),
    ]);

    const { recordings } = await getMergedRecordings();
    expect(recordings).toHaveLength(1);
    expect(recordings[0].studyId).toBe("study-B");
  });

  it("includes all queue items when studyId is null (not logged in)", async () => {
    (getAuthStudyId as jest.Mock).mockResolvedValue(null);
    (getQueue as jest.Mock).mockResolvedValue([
      makeQueueItemForStudy("study-A", TIMESTAMP_A),
      makeQueueItemForStudy("study-B", TIMESTAMP_B),
    ]);

    const { recordings } = await getMergedRecordings();
    expect(recordings).toHaveLength(2);
  });
});

// ── getMergedRecordings — pagination ─────────────────────────────────────────

describe("getMergedRecordings — pagination", () => {
  const TIMESTAMP_Q = "2024-01-17T09:00:00.000Z";
  const TIMESTAMP_A = "2024-01-17T10:00:00.000Z";

  it("page 1 merges API recordings with queue and returns totalPages", async () => {
    const apiItem = { id: "api1", s3Key: "s1/api1", studyId: "s1", createdAt: TIMESTAMP_A };
    (apiService.get as jest.Mock).mockResolvedValue(makePaginatedResponse([apiItem], 3));
    (getAuthStudyId as jest.Mock).mockResolvedValue("s1");
    (getQueue as jest.Mock).mockResolvedValue([makeQueueItemForStudy("s1", TIMESTAMP_Q)]);

    const { recordings, totalPages } = await getMergedRecordings(1);

    expect(recordings).toHaveLength(2);
    expect(totalPages).toBe(3);
    // API item + queue item, sorted newest first
    expect(recordings[0].id).toBe("api1");
    expect(recordings[1].timestamp).toBe(TIMESTAMP_Q);
  });

  it("page > 1 returns API-only results (no queue items) with correct totalPages", async () => {
    const apiItem = { id: "api2", s3Key: "s1/api2", studyId: "s1", createdAt: TIMESTAMP_A };
    (apiService.get as jest.Mock).mockResolvedValue(makePaginatedResponse([apiItem], 3));

    const { recordings, totalPages } = await getMergedRecordings(2);

    expect(recordings).toHaveLength(1);
    expect(recordings[0].id).toBe("api2");
    expect(totalPages).toBe(3);
    // Queue should not have been fetched
    expect(getQueue).not.toHaveBeenCalled();
  });

  it("returns { recordings: [], totalPages: 1 } when API fails on page 1", async () => {
    (apiService.get as jest.Mock).mockRejectedValue(new Error("network error"));
    (getQueue as jest.Mock).mockResolvedValue([]);
    (getAuthStudyId as jest.Mock).mockResolvedValue(null);

    const { recordings, totalPages } = await getMergedRecordings(1);

    expect(recordings).toHaveLength(0);
    expect(totalPages).toBe(1);
  });
});
