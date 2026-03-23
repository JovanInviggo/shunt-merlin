import * as FileSystem from "expo-file-system";
import { apiService } from "./api-service";
import { API_CONFIG } from "../config/api";

interface DownloadUrlResponse {
  downloadUrl: string;
}

export const getCachedAudioPath = async (id: string): Promise<string> => {
  const cachePath = `${FileSystem.cacheDirectory}recording_${id}.wav`;
  const info = await FileSystem.getInfoAsync(cachePath);
  if (info.exists) return cachePath;

  const endpoint = API_CONFIG.ENDPOINTS.RECORDINGS.DOWNLOAD_URL.replace(":id", id);
  const { downloadUrl } = await apiService.get<DownloadUrlResponse>(endpoint);

  const result = await FileSystem.downloadAsync(downloadUrl, cachePath);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed with status ${result.status}`);
  }
  return cachePath;
};
