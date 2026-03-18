import * as SecureStore from "expo-secure-store";

// Keys for storing auth data
const AUTH_REFRESH_TOKEN_KEY = "auth_refresh_token";
const AUTH_STUDY_ID_KEY = "auth_study_id";
const AUTH_USER_TYPE_KEY = "auth_user_type";

// Store refresh token
export const storeRefreshToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(AUTH_REFRESH_TOKEN_KEY, token);
};

// Get refresh token
export const getRefreshToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(AUTH_REFRESH_TOKEN_KEY);
};

// Check if user is logged in (refresh token survives restarts)
export const isLoggedIn = async (): Promise<boolean> => {
  const token = await getRefreshToken();
  return token !== null;
};

// Store study ID from login
export const storeAuthStudyId = async (studyId: string): Promise<void> => {
  await SecureStore.setItemAsync(AUTH_STUDY_ID_KEY, studyId);
};

// Get stored study ID
export const getAuthStudyId = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(AUTH_STUDY_ID_KEY);
};

// Store user type from login
export const storeUserType = async (type: string): Promise<void> => {
  await SecureStore.setItemAsync(AUTH_USER_TYPE_KEY, type);
};

// Get user type
export const getUserType = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync(AUTH_USER_TYPE_KEY);
};

// Clear all auth data (logout)
export const clearAuthToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(AUTH_REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(AUTH_STUDY_ID_KEY);
  await SecureStore.deleteItemAsync(AUTH_USER_TYPE_KEY);
};
