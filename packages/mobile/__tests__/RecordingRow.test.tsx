// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../hooks/useAudioPlayer", () => ({
  useAudioPlayer: jest.fn(() => ({
    isPlaying: false,
    isLoading: false,
    error: null,
    positionMillis: 0,
    durationMillis: 0,
    loadSound: jest.fn().mockResolvedValue(undefined),
    togglePlayback: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../utils/recordings-service", () => ({
  resolveAudioUri: jest.fn().mockResolvedValue("/local/path.wav"),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// formatRelativeTime (used by RecordingRow) calls useI18n() internally
jest.mock("@/locales/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { justNow: "Just now" },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import { TouchableOpacity } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { router } from "expo-router";
import { RecordingRow } from "../components/RecordingRow";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { resolveAudioUri } from "../utils/recordings-service";
import type { Recording } from "../utils/recordings-service";

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date("2026-03-02T12:00:00.000Z");

const makeRecording = (overrides: Partial<Recording> = {}): Recording => ({
  id: "rec-1",
  timestamp: new Date(NOW.getTime() - 5 * 60_000).toISOString(), // 5 min ago
  studyId: "study-1",
  status: "uploaded",
  localPath: "file:///cache/recording.wav",
  s3Key: "study-1/recording.wav",
  ...overrides,
});

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);

  // Reset to default mock implementation
  (useAudioPlayer as jest.Mock).mockReturnValue({
    isPlaying: false,
    isLoading: false,
    error: null,
    positionMillis: 0,
    durationMillis: 0,
    loadSound: jest.fn().mockResolvedValue(undefined),
    togglePlayback: jest.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("timestamp display", () => {
  it("displays relative time for the recording timestamp", () => {
    render(<RecordingRow recording={makeRecording()} />);
    expect(screen.getByText("5 min ago")).toBeTruthy();
  });

  it("displays 'Just now' for very recent recordings", () => {
    const recording = makeRecording({
      timestamp: new Date(NOW.getTime() - 10_000).toISOString(),
    });
    render(<RecordingRow recording={recording} />);
    expect(screen.getByText("Just now")).toBeTruthy();
  });
});

describe("status dot color", () => {
  it("renders a green dot for uploaded recordings", () => {
    const { toJSON } = render(<RecordingRow recording={makeRecording({ status: "uploaded" })} />);
    expect(JSON.stringify(toJSON())).toContain("#4CAF50");
  });

  it("renders a yellow dot for uploading recordings", () => {
    const { toJSON } = render(<RecordingRow recording={makeRecording({ status: "uploading" })} />);
    expect(JSON.stringify(toJSON())).toContain("#FFC107");
  });

  it("renders a red dot for failed recordings", () => {
    const { toJSON } = render(<RecordingRow recording={makeRecording({ status: "failed" })} />);
    expect(JSON.stringify(toJSON())).toContain("#F44336");
  });
});

describe("navigation", () => {
  it("navigates to /recording-overview when the row is pressed", () => {
    render(<RecordingRow recording={makeRecording()} />);

    fireEvent.press(screen.getByText("5 min ago"));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/recording-overview",
        params: expect.objectContaining({ id: "rec-1" }),
      })
    );
  });
});

describe("expand / collapse", () => {
  it("does not show time display (00:00) initially (collapsed)", () => {
    render(<RecordingRow recording={makeRecording()} />);
    expect(screen.queryByText("00:00")).toBeNull();
  });

  it("shows playback time after pressing the chevron (expand)", async () => {
    render(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    // touchables[0] = main row (navigates), touchables[1] = chevron
    const chevron = touchables[1];

    await act(async () => { fireEvent.press(chevron); });

    expect(screen.getAllByText("00:00").length).toBeGreaterThan(0);
  });
});

describe("audio playback", () => {
  it("calls resolveAudioUri and loadSound when play button is pressed (first time)", async () => {
    const mockLoadSound = jest.fn().mockResolvedValue(undefined);
    const mockTogglePlayback = jest.fn().mockResolvedValue(undefined);

    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: null,
      positionMillis: 0,
      durationMillis: 0,
      loadSound: mockLoadSound,
      togglePlayback: mockTogglePlayback,
    });

    render(<RecordingRow recording={makeRecording()} />);

    // Expand first
    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    // Play button is the 3rd touchable (row, chevron, play)
    const expandedTouchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    const playButton = expandedTouchables[2];
    await act(async () => { fireEvent.press(playButton); });

    expect(resolveAudioUri).toHaveBeenCalledWith("rec-1", expect.objectContaining({
      localPath: "file:///cache/recording.wav",
      s3Key: "study-1/recording.wav",
    }));
    expect(mockLoadSound).toHaveBeenCalledWith("/local/path.wav");
    expect(mockTogglePlayback).toHaveBeenCalled();
  });

  it("calls togglePlayback directly when sound is already loaded (durationMillis > 0)", async () => {
    const mockLoadSound = jest.fn().mockResolvedValue(undefined);
    const mockTogglePlayback = jest.fn().mockResolvedValue(undefined);

    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: null,
      positionMillis: 0,
      durationMillis: 30000, // Already loaded
      loadSound: mockLoadSound,
      togglePlayback: mockTogglePlayback,
    });

    render(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    const expandedTouchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    const playButton = expandedTouchables[2];
    await act(async () => { fireEvent.press(playButton); });

    expect(mockLoadSound).not.toHaveBeenCalled();
    expect(mockTogglePlayback).toHaveBeenCalled();
  });

  it("does not trigger play when isLoading is true", async () => {
    const mockLoadSound = jest.fn().mockResolvedValue(undefined);
    const mockTogglePlayback = jest.fn().mockResolvedValue(undefined);

    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: true,
      error: null,
      positionMillis: 0,
      durationMillis: 0,
      loadSound: mockLoadSound,
      togglePlayback: mockTogglePlayback,
    });

    render(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    const expandedTouchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    const playButton = expandedTouchables[2];
    await act(async () => { fireEvent.press(playButton); });

    expect(mockLoadSound).not.toHaveBeenCalled();
    expect(mockTogglePlayback).not.toHaveBeenCalled();
  });
});
