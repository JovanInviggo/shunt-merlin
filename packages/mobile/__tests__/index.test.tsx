// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock("../utils/upload-queue", () => ({
  clearQueue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../components/RecordingsList", () => ({
  RecordingsList: () => null,
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      common: { appTitle: "Shunt Diary" },
      recordings: {
        newButton: "New recording",
        emptyState: "No recordings yet.",
      },
      record: {
        cancelledToast: "Recording cancelled",
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

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import IndexScreen from "../app/index";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("cancelled toast", () => {
  it("shows the toast when cancelled=true param is present", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ cancelled: "true" });

    render(<IndexScreen />);
    await act(async () => {});

    expect(screen.getByTestId("recording-cancelled-toast")).toBeTruthy();
    expect(screen.getByText("Recording cancelled")).toBeTruthy();
  });

  it("does not show the toast when no cancelled param", async () => {
    render(<IndexScreen />);
    await act(async () => {});

    expect(screen.queryByTestId("recording-cancelled-toast")).toBeNull();
  });

  it("hides the toast after 3 seconds", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ cancelled: "true" });

    render(<IndexScreen />);
    await act(async () => {});

    expect(screen.getByTestId("recording-cancelled-toast")).toBeTruthy();

    await act(async () => { jest.advanceTimersByTime(3000); });

    expect(screen.queryByTestId("recording-cancelled-toast")).toBeNull();
  });

  it("does not hide the toast before 3 seconds", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ cancelled: "true" });

    render(<IndexScreen />);
    await act(async () => {});

    await act(async () => { jest.advanceTimersByTime(2999); });

    expect(screen.getByTestId("recording-cancelled-toast")).toBeTruthy();
  });
});
