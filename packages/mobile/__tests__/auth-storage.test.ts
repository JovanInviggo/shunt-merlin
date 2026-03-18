jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as SecureStore from "expo-secure-store";
import {
  storeRefreshToken,
  getRefreshToken,
  isLoggedIn,
  storeAuthStudyId,
  getAuthStudyId,
  storeUserType,
  getUserType,
  clearAuthToken,
} from "../utils/auth-storage";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isLoggedIn", () => {
  it("returns true when a refresh token is stored", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("my-refresh-token");
    expect(await isLoggedIn()).toBe(true);
  });

  it("returns false when no refresh token is stored (null)", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    expect(await isLoggedIn()).toBe(false);
  });
});

describe("storeRefreshToken / getRefreshToken", () => {
  it("stores the token under the correct key", async () => {
    await storeRefreshToken("ref-token-123");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("auth_refresh_token", "ref-token-123");
  });

  it("retrieves the stored refresh token", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("ref-token-123");
    const token = await getRefreshToken();
    expect(token).toBe("ref-token-123");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("auth_refresh_token");
  });

  it("returns null when no refresh token is stored", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
    expect(await getRefreshToken()).toBeNull();
  });
});

describe("storeAuthStudyId / getAuthStudyId", () => {
  it("stores the study ID under the correct key", async () => {
    await storeAuthStudyId("study-42");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("auth_study_id", "study-42");
  });

  it("retrieves the stored study ID", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("study-42");
    expect(await getAuthStudyId()).toBe("study-42");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("auth_study_id");
  });
});

describe("storeUserType / getUserType", () => {
  it("stores the user type under the correct key", async () => {
    await storeUserType("patient");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("auth_user_type", "patient");
  });

  it("retrieves the stored user type", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce("patient");
    expect(await getUserType()).toBe("patient");
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith("auth_user_type");
  });
});

describe("clearAuthToken", () => {
  it("deletes auth_refresh_token, auth_study_id, and auth_user_type", async () => {
    await clearAuthToken();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(3);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("auth_refresh_token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("auth_study_id");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("auth_user_type");
  });
});
