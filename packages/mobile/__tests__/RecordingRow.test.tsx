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
  resolveAudioUriForQuery: jest.fn().mockResolvedValue("/local/path.wav"),
}));

jest.mock("../utils/query-client", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// formatRelativeTime (used by RecordingRow) calls useI18n() and interpolate() internally
jest.mock("@/locales/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { justNow: "Just now", minAgo: "{{count}} min ago", today: "Today", yesterday: "Yesterday", dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
  interpolate: (text: string, params: Record<string, any>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k]?.toString() ?? `{{${k}}}`),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "expo-router";
import { RecordingRow } from "../components/RecordingRow";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { resolveAudioUriForQuery } from "../utils/recordings-service";
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

const renderWithQuery = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

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
    renderWithQuery(<RecordingRow recording={makeRecording()} />);
    expect(screen.getByText("5 min ago")).toBeTruthy();
  });

  it("displays 'Just now' for very recent recordings", () => {
    const recording = makeRecording({
      timestamp: new Date(NOW.getTime() - 10_000).toISOString(),
    });
    renderWithQuery(<RecordingRow recording={recording} />);
    expect(screen.getByText("Just now")).toBeTruthy();
  });
});

describe("status dot color", () => {
  it("renders a green dot for uploaded recordings", () => {
    const { toJSON } = renderWithQuery(<RecordingRow recording={makeRecording({ status: "uploaded" })} />);
    expect(JSON.stringify(toJSON())).toContain("#4CAF50");
  });

  it("renders a yellow dot for uploading recordings", () => {
    const { toJSON } = renderWithQuery(<RecordingRow recording={makeRecording({ status: "uploading" })} />);
    expect(JSON.stringify(toJSON())).toContain("#FFC107");
  });

  it("renders a red dot for failed recordings", () => {
    const { toJSON } = renderWithQuery(<RecordingRow recording={makeRecording({ status: "failed" })} />);
    expect(JSON.stringify(toJSON())).toContain("#F44336");
  });
});

describe("navigation", () => {
  it("navigates to /recording-overview when the row is pressed", () => {
    renderWithQuery(<RecordingRow recording={makeRecording()} />);

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
    renderWithQuery(<RecordingRow recording={makeRecording()} />);
    expect(screen.queryByText("00:00")).toBeNull();
  });

  it("shows playback time after pressing the chevron (expand)", async () => {
    renderWithQuery(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    // touchables[0] = main row (navigates), touchables[1] = chevron
    const chevron = touchables[1];

    await act(async () => { fireEvent.press(chevron); });

    expect(screen.getAllByText("00:00").length).toBeGreaterThan(0);
  });
});

describe("audio playback", () => {
  it("does NOT call resolveAudioUriForQuery when row is not expanded", () => {
    renderWithQuery(<RecordingRow recording={makeRecording()} />);
    expect(resolveAudioUriForQuery).not.toHaveBeenCalled();
  });

  it("calls resolveAudioUriForQuery when row is expanded", async () => {
    renderWithQuery(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[1]);

    await waitFor(() => expect(resolveAudioUriForQuery).toHaveBeenCalledTimes(1));
  });

  it("auto-loads sound on expand when localPath is available", async () => {
    const mockLoadSound = jest.fn().mockResolvedValue(undefined);

    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: null,
      positionMillis: 0,
      durationMillis: 0,
      loadSound: mockLoadSound,
      togglePlayback: jest.fn().mockResolvedValue(undefined),
    });

    renderWithQuery(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    await waitFor(() => expect(mockLoadSound).toHaveBeenCalled());
  });

  it("calls resolveAudioUriForQuery then loadSound on expand when localPath is absent", async () => {
    const mockLoadSound = jest.fn().mockResolvedValue(undefined);

    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: null,
      positionMillis: 0,
      durationMillis: 0,
      loadSound: mockLoadSound,
      togglePlayback: jest.fn().mockResolvedValue(undefined),
    });

    // Recording with no localPath — component will call resolveAudioUriForQuery on expand
    renderWithQuery(<RecordingRow recording={makeRecording({ localPath: null })} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    await waitFor(() => expect(resolveAudioUriForQuery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockLoadSound).toHaveBeenCalledWith("/local/path.wav"));
  });

  it("calls togglePlayback when play is pressed and sound is loaded (durationMillis > 0)", async () => {
    const mockTogglePlayback = jest.fn().mockResolvedValue(undefined);

    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: false,
      error: null,
      positionMillis: 0,
      durationMillis: 30000,
      loadSound: jest.fn().mockResolvedValue(undefined),
      togglePlayback: mockTogglePlayback,
    });

    renderWithQuery(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    const expandedTouchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    const playButton = expandedTouchables[2];
    await act(async () => { fireEvent.press(playButton); });

    expect(mockTogglePlayback).toHaveBeenCalled();
  });

  it("shows ActivityIndicator instead of play icon when isLoading=true", async () => {
    (useAudioPlayer as jest.Mock).mockReturnValue({
      isPlaying: false,
      isLoading: true,
      error: null,
      positionMillis: 0,
      durationMillis: 0,
      loadSound: jest.fn().mockResolvedValue(undefined),
      togglePlayback: jest.fn().mockResolvedValue(undefined),
    });

    renderWithQuery(<RecordingRow recording={makeRecording()} />);

    const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => { fireEvent.press(touchables[1]); });

    expect(screen.UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });
});
