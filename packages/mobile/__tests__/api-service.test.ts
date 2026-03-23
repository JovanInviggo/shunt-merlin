// All mocks must be declared before imports (jest.mock is hoisted)
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

jest.mock("../utils/auth-storage", () => ({
  getRefreshToken: jest.fn(),
  storeRefreshToken: jest.fn(),
  clearAuthToken: jest.fn(),
}));

// upload-queue is no longer imported by api-service (dependency injected via setLogoutHandler)

import { router } from "expo-router";
import { getRefreshToken, storeRefreshToken, clearAuthToken } from "../utils/auth-storage";
import { apiService } from "../utils/api-service";

const mockStopQueue = jest.fn();

// Helper to create a fake fetch response
const makeFetchResponse = (status: number, body: object, ok: boolean = status >= 200 && status < 300) => ({
  ok,
  status,
  json: () => Promise.resolve(body),
});

beforeEach(async () => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  apiService.setLogoutHandler(mockStopQueue);
  // Reset in-memory accessToken by simulating logout with no refresh token
  (getRefreshToken as jest.Mock).mockResolvedValueOnce(null);
  await apiService.logout();
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("apiService.login", () => {
  it("POSTs to the correct auth/login URL", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(200, { accessToken: "tok", refreshToken: "ref-tok", type: "Bearer", studyId: "s1" })
    );

    await apiService.login("s1");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("sends studyId in request body", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(200, { accessToken: "tok", refreshToken: "ref-tok", type: "Bearer", studyId: "study-42" })
    );

    await apiService.login("study-42");

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ studyId: "study-42" });
  });

  it("stores the refresh token in SecureStore", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(200, { accessToken: "acc-tok", refreshToken: "ref-tok", type: "Bearer", studyId: "s1" })
    );

    await apiService.login("s1");

    expect(storeRefreshToken).toHaveBeenCalledWith("ref-tok");
  });

  it("stores access token in memory (used in subsequent Bearer headers)", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeFetchResponse(200, { accessToken: "mem-token", refreshToken: "ref-tok", type: "Bearer", studyId: "s1" })
      )
      .mockResolvedValueOnce(makeFetchResponse(200, { data: "ok" }));

    await apiService.login("s1");
    await apiService.get("/some-endpoint");

    // The second fetch call (GET) should have the Bearer header with the access token from login
    const [, getOptions] = (global.fetch as jest.Mock).mock.calls[1];
    expect(getOptions.headers.Authorization).toBe("Bearer mem-token");
  });

  it("returns the full login response on success", async () => {
    const mockResponse = { accessToken: "tok", refreshToken: "ref-tok", type: "Bearer", studyId: "s1" };
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeFetchResponse(200, mockResponse));

    const result = await apiService.login("s1");

    expect(result).toEqual(mockResponse);
  });

  it("throws ApiError with message and statusCode on non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(400, { message: "Bad request" }, false)
    );

    await expect(apiService.login("s1")).rejects.toMatchObject({
      message: "Bad request",
      statusCode: 400,
    });
  });

  it("throws ApiError with fallback message when response body has no message", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeFetchResponse(500, {}, false)
    );

    await expect(apiService.login("s1")).rejects.toMatchObject({
      statusCode: 500,
      message: expect.stringContaining("500"),
    });
  });
});

describe("apiService.get", () => {
  it("includes Bearer Authorization header when access token is in memory", async () => {
    // Login first to populate in-memory access token
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeFetchResponse(200, { accessToken: "my-token", refreshToken: "ref-tok", type: "Bearer", studyId: "s1" })
      )
      .mockResolvedValueOnce(makeFetchResponse(200, { data: "ok" }));

    await apiService.login("s1");
    await apiService.get("/some-endpoint");

    const [, options] = (global.fetch as jest.Mock).mock.calls[1];
    expect(options.headers.Authorization).toBe("Bearer my-token");
  });

  it("does not include Authorization header when no access token in memory", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeFetchResponse(200, {}));

    await apiService.get("/endpoint");

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("retries with new access token after successful refresh", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeFetchResponse(401, { message: "Unauthorized" }, false))  // initial GET → 401
      .mockResolvedValueOnce(
        makeFetchResponse(200, { accessToken: "new-acc", refreshToken: "new-ref" })  // POST /auth/refresh → 200
      )
      .mockResolvedValueOnce(makeFetchResponse(200, { data: "retried-ok" }));  // retry GET → 200

    (getRefreshToken as jest.Mock).mockResolvedValueOnce("old-ref-tok");

    const result = await apiService.get<{ data: string }>("/protected");

    expect(storeRefreshToken).toHaveBeenCalledWith("new-ref");
    expect(result).toEqual({ data: "retried-ok" });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("logs out and redirects to /login when refresh fails", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeFetchResponse(401, { message: "Unauthorized" }, false))  // initial GET → 401
      .mockResolvedValueOnce(makeFetchResponse(401, {}, false));  // POST /auth/refresh → 401

    (getRefreshToken as jest.Mock).mockResolvedValueOnce("expired-ref-tok");

    await expect(apiService.get("/protected")).rejects.toMatchObject({ statusCode: 401 });

    expect(clearAuthToken).toHaveBeenCalled();
    expect(mockStopQueue).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/login");
  });
});

describe("apiService.post", () => {
  it("sends JSON body with correct Content-Type", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeFetchResponse(200, {}));

    const body = { key: "value", num: 42 };
    await apiService.post("/endpoint", body);

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual(body);
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("includes Bearer header in POST when access token is in memory", async () => {
    // Login first to populate in-memory access token
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeFetchResponse(200, { accessToken: "post-token", refreshToken: "ref-tok", type: "Bearer", studyId: "s1" })
      )
      .mockResolvedValueOnce(makeFetchResponse(201, {}));

    await apiService.login("s1");
    await apiService.post("/create", { name: "test" });

    const [, options] = (global.fetch as jest.Mock).mock.calls[1];
    expect(options.headers.Authorization).toBe("Bearer post-token");
  });
});

describe("apiService.logout", () => {
  it("calls stopQueueProcessing and clearAuthToken", async () => {
    (getRefreshToken as jest.Mock).mockResolvedValueOnce(null);

    await apiService.logout();

    expect(mockStopQueue).toHaveBeenCalled();
    expect(clearAuthToken).toHaveBeenCalled();
  });

  it("POSTs to /auth/logout with refresh token when available", async () => {
    (getRefreshToken as jest.Mock).mockResolvedValueOnce("valid-ref-tok");
    (global.fetch as jest.Mock).mockResolvedValueOnce(makeFetchResponse(204, {}));

    await apiService.logout();

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/auth/logout");
    expect(JSON.parse(options.body)).toEqual({ refreshToken: "valid-ref-tok" });
    expect(clearAuthToken).toHaveBeenCalled();
  });

  it("still clears local auth even if logout POST throws", async () => {
    (getRefreshToken as jest.Mock).mockResolvedValueOnce("valid-ref-tok");
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    await apiService.logout();

    expect(clearAuthToken).toHaveBeenCalled();
  });

  it("does not navigate on explicit logout (only refresh failure does)", async () => {
    (getRefreshToken as jest.Mock).mockResolvedValueOnce(null);

    await apiService.logout();

    expect(router.replace).not.toHaveBeenCalled();
  });
});
