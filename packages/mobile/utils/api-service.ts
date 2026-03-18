import { router } from "expo-router";
import { API_CONFIG, getApiUrl } from "../config/api";
import { getRefreshToken, storeRefreshToken, clearAuthToken } from "./auth-storage";

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  type: string;
  studyId: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;
  private onLogout: () => void = () => {};

  setLogoutHandler(fn: () => void): void {
    this.onLogout = fn;
  }

  private async getHeaders(includeAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (includeAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async doRefresh(): Promise<void> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");
    const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH.REFRESH), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) throw new Error("Refresh failed");
    const data: RefreshResponse = await response.json();
    this.accessToken = data.accessToken;
    await storeRefreshToken(data.refreshToken);
  }

  private performRefresh(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async handleResponse<T>(response: Response, retryFn?: () => Promise<Response>): Promise<T> {
    if (response.status === 401 && retryFn) {
      try {
        await this.performRefresh();
      } catch {
        await this.logout();
        router.replace("/login");
        throw { message: "Session expired", statusCode: 401 } as ApiError;
      }
      const retried = await retryFn();
      return this.handleResponse<T>(retried);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw {
        message: errorData.message || `Request failed with status ${response.status}`,
        statusCode: response.status,
      } as ApiError;
    }

    return response.json();
  }

  async login(studyId: string): Promise<LoginResponse> {
    const url = getApiUrl(API_CONFIG.ENDPOINTS.AUTH.LOGIN);

    const response = await fetch(url, {
      method: "POST",
      headers: await this.getHeaders(false),
      body: JSON.stringify({ studyId }),
    });

    const data = await this.handleResponse<LoginResponse>(response);

    this.accessToken = data.accessToken;
    await storeRefreshToken(data.refreshToken);

    return data;
  }

  async logout(): Promise<void> {
    this.onLogout();
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      try {
        await fetch(getApiUrl(API_CONFIG.ENDPOINTS.AUTH.LOGOUT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // offline — proceed with local cleanup
      }
    }
    this.accessToken = null;
    await clearAuthToken();
  }

  async get<T>(endpoint: string): Promise<T> {
    const url = getApiUrl(endpoint);
    const makeRequest = async () => fetch(url, { method: "GET", headers: await this.getHeaders() });
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async post<T>(endpoint: string, body: object): Promise<T> {
    const url = getApiUrl(endpoint);
    const makeRequest = async () =>
      fetch(url, {
        method: "POST",
        headers: await this.getHeaders(),
        body: JSON.stringify(body),
      });
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }
}

export const apiService = new ApiService();
