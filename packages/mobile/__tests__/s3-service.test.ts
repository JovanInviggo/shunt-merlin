jest.mock("expo-file-system", () => ({
  uploadAsync: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: "binaryContent" },
}));

jest.mock("../utils/api-service", () => ({
  apiService: { get: jest.fn() },
}));

import * as FileSystem from "expo-file-system";
import { apiService } from "../utils/api-service";
import { uploadFileWithPresignedUrl, getPresignedUploadUrl } from "../utils/s3-service";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("uploadFileWithPresignedUrl", () => {
  it("calls uploadAsync with PUT method", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 200, body: "" });

    await uploadFileWithPresignedUrl("/path/to/file.wav", "https://s3-presigned-url");

    expect(FileSystem.uploadAsync).toHaveBeenCalledWith(
      "https://s3-presigned-url",
      "/path/to/file.wav",
      expect.objectContaining({ httpMethod: "PUT" })
    );
  });

  it("sends audio/wav Content-Type header", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 200, body: "" });

    await uploadFileWithPresignedUrl("/file.wav", "https://url");

    const [, , options] = (FileSystem.uploadAsync as jest.Mock).mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("audio/wav");
  });

  it("uses BINARY_CONTENT upload type", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 200, body: "" });

    await uploadFileWithPresignedUrl("/file.wav", "https://url");

    const [, , options] = (FileSystem.uploadAsync as jest.Mock).mock.calls[0];
    expect(options.uploadType).toBe(FileSystem.FileSystemUploadType.BINARY_CONTENT);
  });

  it("resolves without error on 200", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 200, body: "OK" });

    await expect(uploadFileWithPresignedUrl("/file.wav", "https://url")).resolves.toBeUndefined();
  });

  it("resolves without error on 204", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 204, body: "" });

    await expect(uploadFileWithPresignedUrl("/file.wav", "https://url")).resolves.toBeUndefined();
  });

  it("throws on 400 status", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 400, body: "Bad Request" });

    await expect(uploadFileWithPresignedUrl("/file.wav", "https://url")).rejects.toThrow(
      "S3 upload failed with status 400"
    );
  });

  it("throws on 500 status", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 500, body: "Server Error" });

    await expect(uploadFileWithPresignedUrl("/file.wav", "https://url")).rejects.toThrow(
      "S3 upload failed with status 500"
    );
  });

  it("throws on 403 status", async () => {
    (FileSystem.uploadAsync as jest.Mock).mockResolvedValueOnce({ status: 403, body: "Forbidden" });

    await expect(uploadFileWithPresignedUrl("/file.wav", "https://url")).rejects.toThrow(
      "S3 upload failed"
    );
  });
});

describe("getPresignedUploadUrl", () => {
  it("delegates to apiService.get", async () => {
    const mockResponse = { uploadUrl: "https://presigned-url", s3Key: "recordings/s1/file.wav" };
    (apiService.get as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await getPresignedUploadUrl("recording.wav");

    expect(apiService.get).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockResponse);
  });

  it("calls apiService.get with presigned-upload-url endpoint and filename param", async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ uploadUrl: "https://url", s3Key: "key" });

    await getPresignedUploadUrl("file.wav");

    const [endpoint] = (apiService.get as jest.Mock).mock.calls[0];
    expect(endpoint).toContain("presigned-upload-url");
    expect(endpoint).toContain("filename=file.wav");
  });

  it("url-encodes filename query param", async () => {
    (apiService.get as jest.Mock).mockResolvedValueOnce({ uploadUrl: "https://url", s3Key: "key" });

    await getPresignedUploadUrl("my file.wav");

    const [endpoint] = (apiService.get as jest.Mock).mock.calls[0];
    expect(endpoint).toContain("filename=my%20file.wav");
  });

  it("propagates errors from apiService.get", async () => {
    (apiService.get as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    await expect(getPresignedUploadUrl("file.wav")).rejects.toThrow("Network error");
  });
});
