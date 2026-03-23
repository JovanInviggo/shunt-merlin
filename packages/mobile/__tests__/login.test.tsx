// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../utils/api-service", () => ({
  apiService: { login: jest.fn() },
}));

jest.mock("../utils/auth-storage", () => ({
  storeAuthStudyId: jest.fn().mockResolvedValue(undefined),
  storeUserType: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      login: {
        title: "Shunt Wizard",
        description: "Please enter your Study ID to log in.",
        placeholder: "Study ID",
        button: "Log In",
        buttonLoading: "Logging in...",
        errorEmpty: "Please enter a Study ID",
        errorInvalid: "Invalid Study ID. Please try again.",
        errorFailed: "Login failed. Please try again later.",
      },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
  interpolate: (text: string, params: Record<string, any>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k]?.toString() ?? `{{${k}}}`),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...rest }: any) => <View {...rest}>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import { apiService } from "../utils/api-service";
import { storeAuthStudyId, storeUserType } from "../utils/auth-storage";
import LoginScreen from "../app/login";

// ── Setup ─────────────────────────────────────────────────────────────────────

let mockReplace: jest.Mock;
let mockDismissAll: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockReplace = jest.fn();
  mockDismissAll = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace, dismissAll: mockDismissAll });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("empty submission validation", () => {
  it("shows error when submitting with empty study ID", async () => {
    render(<LoginScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(screen.getByText("Please enter a Study ID")).toBeTruthy();
    expect(apiService.login).not.toHaveBeenCalled();
  });

  it("shows error when submitting whitespace-only study ID", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "   ");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(screen.getByText("Please enter a Study ID")).toBeTruthy();
  });
});

describe("successful login", () => {
  const successResponse = {
    accessToken: "token-123",
    studyId: "study-42",
    type: "participant",
  };

  beforeEach(() => {
    (apiService.login as jest.Mock).mockResolvedValue(successResponse);
  });

  it("calls apiService.login with the trimmed study ID", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), " study-42 ");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(apiService.login).toHaveBeenCalledWith("study-42");
  });

  it("stores studyId and userType after successful login", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "study-42");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(storeAuthStudyId).toHaveBeenCalledWith("study-42");
    expect(storeUserType).toHaveBeenCalledWith("participant");
  });

  it("navigates to /guideline on success", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "study-42");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(mockReplace).toHaveBeenCalledWith("/guideline");
  });

  it("does not show any error message after successful login", async () => {
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "study-42");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    // Use exact strings (not broad regex) to avoid matching description text
    expect(screen.queryByText("Please enter a Study ID")).toBeNull();
    expect(screen.queryByText("Invalid Study ID. Please try again.")).toBeNull();
    expect(screen.queryByText("Login failed. Please try again later.")).toBeNull();
  });
});

describe("login errors", () => {
  it("shows invalid-credentials error for 401 status", async () => {
    (apiService.login as jest.Mock).mockRejectedValue({ statusCode: 401, message: "Unauthorized" });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "bad-id");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(screen.getByText("Invalid Study ID. Please try again.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows invalid-credentials error for 404 status", async () => {
    (apiService.login as jest.Mock).mockRejectedValue({ statusCode: 404, message: "Not found" });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "missing-id");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(screen.getByText("Invalid Study ID. Please try again.")).toBeTruthy();
  });

  it("shows generic error for network / 500 errors", async () => {
    (apiService.login as jest.Mock).mockRejectedValue({ statusCode: 500, message: "Server error" });

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "study-id");

    await act(async () => {
      fireEvent.press(screen.getByText("Log In"));
    });

    expect(screen.getByText("Login failed. Please try again later.")).toBeTruthy();
  });

  it("clears a previous error when a new submission succeeds", async () => {
    (apiService.login as jest.Mock).mockRejectedValueOnce({ statusCode: 401 });
    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "bad");
    await act(async () => { fireEvent.press(screen.getByText("Log In")); });
    expect(screen.getByText("Invalid Study ID. Please try again.")).toBeTruthy();

    (apiService.login as jest.Mock).mockResolvedValueOnce({
      accessToken: "t",
      studyId: "good",
      type: "participant",
    });
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "good");
    await act(async () => { fireEvent.press(screen.getByText("Log In")); });

    expect(screen.queryByText("Invalid Study ID. Please try again.")).toBeNull();
  });
});

describe("loading state", () => {
  it("shows 'Logging in...' while request is in flight", async () => {
    let resolve!: (v: any) => void;
    (apiService.login as jest.Mock).mockReturnValue(
      new Promise((res) => { resolve = res; })
    );

    render(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText("Study ID"), "study-id");

    act(() => { fireEvent.press(screen.getByText("Log In")); });

    expect(screen.getByText("Logging in...")).toBeTruthy();

    await act(async () => {
      resolve({ accessToken: "t", studyId: "study-id", type: "p" });
    });
  });
});
