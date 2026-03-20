// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock("expo-file-system", () => ({
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Heavy: "heavy" },
}));

jest.mock("../hooks/useAudioRecording", () => ({
  useAudioRecording: jest.fn(),
}));

jest.mock("../utils/upload-queue", () => ({
  addToQueue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../utils/auth-storage", () => ({
  getAuthStudyId: jest.fn().mockResolvedValue("study-1"),
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      submit: { queuedTitle: "Queued", queuedMessage: "Recording queued for upload." },
      record: {
        cancelTitle: "Recording will be cancelled",
        cancelMessage: "Recording will be discarded.",
        startRecording: "Start Recording",
        startingIn: "Recording starting in:",
        inProgress: "Recording in progress",
        complete: "Done! The recording is now being saved",
        completeMessage: "This may take up to 30 seconds. You can move your phone now",
        micPermissionTitle: "Microphone Access Required",
        micPermissionMessage: "Microphone access is required.",
        micPermissionOpenSettings: "Open Settings",
      },
      common: { cancel: "Cancel", ok: "OK", appTitle: "Shunt Diary" },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
  interpolate: (text, params) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k]?.toString() ?? `{{${k}}}`),
}));

jest.mock("expo-av", () => ({
  Audio: {
    getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, canAskAgain: true }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...rest }) => React.createElement(View, rest, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock("@/components/guidelines/PhonePosition", () => {
  const React = require("react");
  const { TouchableOpacity, Text } = require("react-native");
  return ({ onButtonPress }) =>
    React.createElement(TouchableOpacity, { testID: "phone-position-button", onPress: onButtonPress },
      React.createElement(Text, null, "Start Recording")
    );
});

jest.mock("@/components/timers", () => {
  const React = require("react");
  const { TouchableOpacity, Text } = require("react-native");
  return {
    CountdownTimer: ({ onComplete }) =>
      React.createElement(TouchableOpacity, { testID: "countdown-complete-btn", onPress: onComplete },
        React.createElement(Text, null, "Countdown")
      ),
    ProgressTimer: () => React.createElement(Text, { testID: "progress-timer" }, "00:00"),
  };
});

jest.mock("../components/LowSignalOverlay", () => {
  const React = require("react");
  const { TouchableOpacity, Text, View } = require("react-native");
  return ({ visible, onRetry }) =>
    visible
      ? React.createElement(View, { testID: "low-signal-overlay" },
          React.createElement(TouchableOpacity, { testID: "low-signal-retry-btn", onPress: onRetry },
            React.createElement(Text, null, "Retry")
          )
        )
      : null;
});

jest.mock("../components/live-waveform", () => ({
  LiveWaveform: () => null,
}));

jest.mock("../components/QueueIndicator", () => ({
  QueueIndicator: () => null,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import { Alert, Animated } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { addToQueue } from "../utils/upload-queue";
import RecordScreen from "../app/record";

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildMockHook = (overrides = {}) => ({
  isRecording: false,
  duration: 0,
  recordingPath: null,
  startRecording: jest.fn().mockResolvedValue(undefined),
  stopRecording: jest.fn().mockResolvedValue("/path/recording.wav"),
  cancelRecording: jest.fn().mockResolvedValue(undefined),
  addChunkListener: jest.fn().mockReturnValue(() => {}),
  pauseTimer: jest.fn(),
  resumeTimer: jest.fn(),
  ...overrides,
});

const getHookMock = () => /** @type {jest.Mock} */ (useAudioRecording);
const getLastHookOptions = () => getHookMock().mock.calls.at(-1)?.[0];

/**
 * Repeatedly advance fake timers and flush microtasks so that async chains
 * containing `await new Promise(r => setTimeout(r, N))` can complete.
 */
const flushTimersAndMicrotasks = async (ms = 10000, steps = 20) => {
  const step = Math.ceil(ms / steps);
  for (let i = 0; i < steps; i++) {
    jest.advanceTimersByTime(step);
    await Promise.resolve(); // flush microtask queue
  }
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});

  // Make Animated.timing complete synchronously so the PhonePosition → recording
  // screen transition fires its callback immediately.
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      if (config && "toValue" in config) {
        (value as Animated.Value).setValue(config.toValue as number);
      }
      callback?.({ finished: true });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  }));

  getHookMock().mockReturnValue(buildMockHook());
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("initial render", () => {
  it("shows the PhonePosition overlay on first render", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    expect(screen.getByTestId("phone-position-button")).toBeTruthy();
  });

  it("does not show the CountdownTimer while PhonePosition is visible", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    expect(screen.queryByTestId("countdown-complete-btn")).toBeNull();
  });
});

describe("dismissing PhonePosition", () => {
  it("shows CountdownTimer after pressing the PhonePosition button", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    await act(async () => {
      fireEvent.press(screen.getByTestId("phone-position-button"));
    });

    expect(screen.getByTestId("countdown-complete-btn")).toBeTruthy();
    expect(screen.queryByTestId("phone-position-button")).toBeNull();
  });
});

describe("countdown completion triggers recording", () => {
  it("calls startRecording when CountdownTimer completes", async () => {
    const mockStart = jest.fn().mockResolvedValue(undefined);
    getHookMock().mockReturnValue(buildMockHook({ startRecording: mockStart }));

    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });
    await act(async () => { fireEvent.press(screen.getByTestId("phone-position-button")); });

    // Press countdown complete — this triggers vibrateAndStartRecording (async with setTimeout)
    fireEvent.press(screen.getByTestId("countdown-complete-btn"));
    // Flush the strongVibrate setTimeout(80ms) calls + settle delay (200ms iOS) + microtasks
    await act(async () => { await flushTimersAndMicrotasks(1000); });

    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("does not call startRecording before the vibration settle delay elapses", async () => {
    const mockStart = jest.fn().mockResolvedValue(undefined);
    getHookMock().mockReturnValue(buildMockHook({ startRecording: mockStart }));

    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });
    await act(async () => { fireEvent.press(screen.getByTestId("phone-position-button")); });

    fireEvent.press(screen.getByTestId("countdown-complete-btn"));
    // Advance only through haptic calls (3×80ms = 240ms) but not past the 200ms settle delay
    await act(async () => { await flushTimersAndMicrotasks(200); });

    expect(mockStart).not.toHaveBeenCalled();

    // Now flush the remaining settle delay — recording must start
    await act(async () => { await flushTimersAndMicrotasks(600); });
    expect(mockStart).toHaveBeenCalledTimes(1);
  });
});

describe("cancel / stop button", () => {
  const dismissPhonePosition = async () => {
    await act(async () => { fireEvent.press(screen.getByTestId("phone-position-button")); });
  };

  it("navigates directly to / without alert when close is pressed during countdown (not recording)", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });
    await dismissPhonePosition();

    // Close button is the first TouchableOpacity in the main recording UI
    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    await act(async () => { fireEvent.press(touchables[0]); });

    // No alert — navigates immediately since recording hasn't started
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("navigates directly to / without alert when close is pressed after recording is complete", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });
    await dismissPhonePosition();

    const { onAutoStop } = getLastHookOptions();
    // Trigger auto-stop to set recordingComplete=true (don't wait for the 7s delay)
    act(() => { onAutoStop("/path/recording.wav"); });
    await act(async () => { await flushTimersAndMicrotasks(500); });

    // Press close — should navigate home directly, no alert
    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    await act(async () => { fireEvent.press(touchables[0]); });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("cancels active recording when stop is pressed while isRecording=true", async () => {
    const mockCancel = jest.fn().mockResolvedValue(undefined);
    getHookMock().mockReturnValue(buildMockHook({
      isRecording: true,
      cancelRecording: mockCancel,
    }));

    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });
    await dismissPhonePosition();

    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    await act(async () => { fireEvent.press(touchables[0]); });

    // Alert.alert is called; simulate pressing OK
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const okButton = alertCall[2].find((btn: any) => btn.text === "OK");
    await act(async () => { okButton.onPress(); });

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/?cancelled=true");
  });
});

describe("onAutoStop callback", () => {
  it("queues recording and navigates home when a path is provided", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    const { onAutoStop } = getLastHookOptions();

    // onAutoStop takes a single argument (path) and has a 7s internal delay
    // Start the async function (don't await it yet)
    let autoStopDone = false;
    act(() => { onAutoStop("/path/recording.wav").then(() => { autoStopDone = true; }); });

    // Advance past the strongVibrate (3x 80ms) + 7000ms delay
    await act(async () => { await flushTimersAndMicrotasks(10000, 50); });

    expect(addToQueue).toHaveBeenCalledWith(
      "/path/recording.wav",
      expect.objectContaining({ studyId: "study-1" })
    );
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("navigates home without queuing when path is null", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    const { onAutoStop } = getLastHookOptions();

    act(() => { onAutoStop(null); });
    await act(async () => { await flushTimersAndMicrotasks(10000, 50); });

    expect(addToQueue).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("does not queue a second time if called twice (hasQueuedRef guard)", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    const { onAutoStop } = getLastHookOptions();

    act(() => { onAutoStop("/path/recording.wav"); });
    await act(async () => { await flushTimersAndMicrotasks(10000, 50); });

    act(() => { onAutoStop("/path/recording.wav"); });
    await act(async () => { await flushTimersAndMicrotasks(10000, 50); });

    expect(addToQueue).toHaveBeenCalledTimes(1);
  });
});

describe("onAutoStop — low signal path", () => {
  const lowSignalQuality = {
    isLowSignal: true,
    medianPeak: 0.001,
    maxWindowPeak: 0.002,
    artifactRatio: 1.0,
    hasArtifacts: false,
    windowPeaks: [0.001, 0.001, 0.001, 0.001, 0.001],
  };

  it("does not show LowSignalOverlay when quality check fires low signal", async () => {
    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    const { onQualityCheck } = getLastHookOptions();
    await act(async () => { await onQualityCheck(lowSignalQuality); });

    expect(screen.queryByTestId("low-signal-overlay")).toBeNull();
  });
});

describe("onQualityCheck — low signal path", () => {
  const lowSignalQuality = {
    isLowSignal: true,
    medianPeak: 0.001,
    maxWindowPeak: 0.002,
    artifactRatio: 1.0,
    hasArtifacts: false,
    windowPeaks: [0.001, 0.001, 0.001, 0.001, 0.001],
  };

  it("does NOT show LowSignalOverlay when quality check detects low signal", async () => {
    const mockCancel = jest.fn().mockResolvedValue(undefined);
    getHookMock().mockReturnValue(buildMockHook({ cancelRecording: mockCancel }));

    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    const { onQualityCheck } = getLastHookOptions();
    await act(async () => { await onQualityCheck(lowSignalQuality); });

    expect(screen.queryByTestId("low-signal-overlay")).toBeNull();
  });

  it("does NOT cancel the recording when quality check detects low signal", async () => {
    const mockCancel = jest.fn().mockResolvedValue(undefined);
    getHookMock().mockReturnValue(buildMockHook({ cancelRecording: mockCancel }));

    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    const { onQualityCheck } = getLastHookOptions();
    await act(async () => { await onQualityCheck(lowSignalQuality); });

    expect(mockCancel).not.toHaveBeenCalled();
  });
});

describe("LowSignalOverlay retry", () => {
  it("resets state and shows PhonePosition without calling router.replace('/record')", async () => {
    const mockCancel = jest.fn().mockResolvedValue(undefined);
    getHookMock().mockReturnValue(buildMockHook({
      isRecording: true,
      cancelRecording: mockCancel,
    }));

    render(<RecordScreen />);
    await act(async () => { await flushTimersAndMicrotasks(); });

    // Dismiss PhonePosition to enter recording phase
    await act(async () => { fireEvent.press(screen.getByTestId("phone-position-button")); });

    // Trigger the DEV low-signal button — sets showLowSignal: true
    await act(async () => {
      fireEvent.press(screen.getByTestId("dev-simulate-low-signal"));
    });

    // LowSignalOverlay mock is now visible — retry button is rendered
    const retryBtn = screen.getByTestId("low-signal-retry-btn");

    await act(async () => { fireEvent.press(retryBtn); });

    // Must NOT navigate away (would stack a second modal)
    expect(router.replace).not.toHaveBeenCalledWith("/record");

    // Must show PhonePosition again (state reset in-place)
    expect(screen.getByTestId("phone-position-button")).toBeTruthy();
  });
});
