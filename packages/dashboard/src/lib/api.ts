const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const ACCESS_TOKEN_KEY = "adminToken";
const REFRESH_TOKEN_KEY = "adminRefreshToken";

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

export function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function getAuthHeaders() {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

async function attemptTokenRefresh(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = await res.json();
  storeTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401 && path !== "/auth/admin/login" && path !== "/auth/refresh") {
    let newToken: string | null;

    if (isRefreshing) {
      newToken = await new Promise<string | null>((resolve) => {
        refreshQueue.push(resolve);
      });
    } else {
      isRefreshing = true;
      newToken = await attemptTokenRefresh();
      isRefreshing = false;
      refreshQueue.forEach((resolve) => resolve(newToken));
      refreshQueue = [];
    }

    if (!newToken) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    const retryRes = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
        ...(init?.headers || {}),
      },
    });

    if (!retryRes.ok) {
      const text = await retryRes.text().catch(() => "");
      throw new Error(`API error ${retryRes.status} ${retryRes.statusText}${text ? `: ${text}` : ""}`);
    }

    return retryRes.json() as Promise<T>;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error ${res.status} ${res.statusText}${
        text ? `: ${text}` : ""
      }`,
    );
  }

  return res.json() as Promise<T>;
}

export interface Study {
  id: string;
  studyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Recording {
  id: string;
  studyId: string;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  refreshToken: string;
  type: "admin";
  role: string;
}

export function adminLogin(email: string, password: string) {
  return apiFetch<AdminLoginResponse>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function revokeRefreshToken(refreshToken: string) {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function fetchStudies() {
  return apiFetch<Study[]>("/study");
}

export function createStudy(studyId: string) {
  return apiFetch<Study>("/study", {
    method: "POST",
    body: JSON.stringify({ studyId }),
  });
}

export function fetchRecordings() {
  return apiFetch<Recording[]>("/recordings");
}

