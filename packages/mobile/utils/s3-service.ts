import * as FileSystem from "expo-file-system";
import { apiService } from "./api-service";
import { API_CONFIG } from "../config/api";

interface PresignedUploadResponse {
  uploadUrl: string;
  s3Key: string;
}

// Request a presigned upload URL from the backend
export const getPresignedUploadUrl = async (
  filename: string
): Promise<PresignedUploadResponse> => {
  return apiService.get<PresignedUploadResponse>(
    `${API_CONFIG.ENDPOINTS.RECORDINGS.PRESIGNED_UPLOAD_URL}?filename=${encodeURIComponent(filename)}`
  );
};

// Upload a file to S3 using the presigned URL
export const uploadFileWithPresignedUrl = async (
  filePath: string,
  uploadUrl: string
): Promise<void> => {
  const result = await FileSystem.uploadAsync(uploadUrl, filePath, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": "audio/wav",
    },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `S3 upload failed with status ${result.status}: ${result.body}`
    );
  }

  console.log("File uploaded successfully via presigned URL");
};
