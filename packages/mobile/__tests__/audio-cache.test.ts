// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

jest.mock("../utils/api-service", () => ({
  apiService: {
    get: jest.fn(),
  },
}));

jest.mock("../config/api", () => ({
  API_CONFIG: {
    BASE_URL: "http://localhost:3000",
    ENDPOINTS: {
      RECORDINGS: {
        DOWNLOAD_URL: "/recordings/:id/download-url",
      },
    },
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import * as FileSystem from "expo-file-system";
import { apiService } from "../utils/api-service";
import { getCachedAudioPath } from "../utils/audio-cache";

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockGetInfo = FileSystem.getInfoAsync as jest.Mock;
const mockDownload = FileSystem.downloadAsync as jest.Mock;
const mockApiGet = apiService.get as jest.Mock;

const RECORDING_ID = "rec-123";
const CACHED_PATH = "file:///cache/recording_rec-123.wav";
const PRESIGNED_URL = "https://s3.example.com/presigned-url?sig=abc";

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getCachedAudioPath", () => {
  it("returns cached path immediately when file already exists (no API call)", async () => {
    mockGetInfo.mockResolvedValue({ exists: true });

    const result = await getCachedAudioPath(RECORDING_ID);

    expect(result).toBe(CACHED_PATH);
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("calls apiService.get with correct endpoint when file not cached", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    mockApiGet.mockResolvedValue({ downloadUrl: PRESIGNED_URL });
    mockDownload.mockResolvedValue({ status: 200 });

    await getCachedAudioPath(RECORDING_ID);

    expect(mockApiGet).toHaveBeenCalledWith("/recordings/rec-123/download-url");
  });

  it("calls FileSystem.downloadAsync with presigned URL and cache path", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    mockApiGet.mockResolvedValue({ downloadUrl: PRESIGNED_URL });
    mockDownload.mockResolvedValue({ status: 200 });

    await getCachedAudioPath(RECORDING_ID);

    expect(mockDownload).toHaveBeenCalledWith(PRESIGNED_URL, CACHED_PATH);
  });

  it("returns local cache path after successful download", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    mockApiGet.mockResolvedValue({ downloadUrl: PRESIGNED_URL });
    mockDownload.mockResolvedValue({ status: 200 });

    const result = await getCachedAudioPath(RECORDING_ID);

    expect(result).toBe(CACHED_PATH);
  });

  it("throws when download status is non-2xx", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    mockApiGet.mockResolvedValue({ downloadUrl: PRESIGNED_URL });
    mockDownload.mockResolvedValue({ status: 403 });

    await expect(getCachedAudioPath(RECORDING_ID)).rejects.toThrow(
      "Download failed with status 403"
    );
  });

  it("throws when download status is 500", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    mockApiGet.mockResolvedValue({ downloadUrl: PRESIGNED_URL });
    mockDownload.mockResolvedValue({ status: 500 });

    await expect(getCachedAudioPath(RECORDING_ID)).rejects.toThrow(
      "Download failed with status 500"
    );
  });
});
