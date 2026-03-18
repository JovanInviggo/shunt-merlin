import Constants from "expo-constants";

// BASE_URL is injected at build time via app.config.js → extra.apiBaseUrl.
// Falls back to localhost for local dev (yarn start / jest).
const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "http://localhost:3000";

export const API_CONFIG = {
  BASE_URL,

  // S3 endpoint for constructing playback URLs (public, not a secret)
  S3_ENDPOINT: "https://shunt-dev.s3.fr-par.scw.cloud",

  ENDPOINTS: {
    AUTH: {
      LOGIN: "/auth/login",
      REFRESH: "/auth/refresh",
      LOGOUT: "/auth/logout",
    },
    RECORDINGS: {
      CREATE: "/recordings",
      LIST: "/recordings",
      ANALYSIS: "/recordings/:id/analysis",
      DOWNLOAD_URL: "/recordings/:id/download-url",
      PRESIGNED_UPLOAD_URL: "/s3/presigned-upload-url",
    },
  },
};

export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
