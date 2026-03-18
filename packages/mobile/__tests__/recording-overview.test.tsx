// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({
    id: "rec-1",
    timestamp: "2026-03-02T11:55:00.000Z", // 5 min before NOW
    s3Key: "study-1/rec-1",
    localPath: "",
    status: "uploaded",
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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
  fetchRecordingAnalysis: jest.fn().mockResolvedValue({
    status: "no_abnormalities",
    title: "No abnormalities detected",
    description: "Your shunt sounds are within normal range.",
    explanation: "No unusual patterns detected.",
  }),
  resolveAudioUri: jest.fn().mockResolvedValue("/cache/recording_rec-1.wav"),
}));

jest.mock("../components/StaticWaveform", () => ({
  StaticWaveform: ({ recordingPath }: any) => {
    const { Text } = require("react-native");
    return <Text testID="static-waveform">{recordingPath}</Text>;
  },
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      common: { appTitle: "Shunt Diary", ok: "OK", cancel: "Cancel" },
      recordingOverview: {
        title: "Shunt recording",
        thankYou: "Thank you for your recording and participating in our study!",
        aiAnalysis: "AI Analysis",
        question: "How is my shunt doing?",
        modelDescription: "We ran your recording through our AI model.",
        whatDoesThisMean: "What does this mean?",
        noAbnormalities: {
          title: "No abnormalities detected",
          description: "Your shunt sounds are within normal range.",
          explanation: "No unusual patterns detected.",
        },
        unclear: {
          title: "Unclear result",
          description: "The analysis could not determine a clear result.",
          explanation: "Recording quality insufficient.",
        },
        abnormalities: {
          title: "Indication of abnormalities",
          description: "Unusual patterns were detected.",
          explanation: "Consult your doctor.",
        },
      },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
}));

// formatRelativeTime (used by recording-overview) calls useI18n() internally
jest.mock("@/locales/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { justNow: "Just now" },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
}));

jest.mock("../components/Alert", () => ({
  Alert: ({ title, children }: any) => {
    const { Text, View } = require("react-native");
    return (
      <View>
        <Text>{title}</Text>
        <Text>{children}</Text>
      </View>
    );
  },
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import React from "react";
import { TouchableOpacity } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { resolveAudioUri, fetchRecordingAnalysis } from "../utils/recordings-service";
import RecordingOverviewScreen from "../app/recording-overview";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  (useAudioPlayer as jest.Mock).mockReturnValue({
    isPlaying: false,
    isLoading: false,
    error: null,
    positionMillis: 0,
    durationMillis: 0,
    loadSound: jest.fn().mockResolvedValue(undefined),
    togglePlayback: jest.fn().mockResolvedValue(undefined),
  });

  (useLocalSearchParams as jest.Mock).mockReturnValue({
    id: "rec-1",
    timestamp: "2026-03-02T11:55:00.000Z",
    s3Key: "study-1/rec-1",
    localPath: "",
    status: "uploaded",
  });
});


// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RecordingOverviewScreen", () => {
  describe("rendering", () => {
    it("renders the title", async () => {
      render(<RecordingOverviewScreen />);
      await act(async () => {});
      expect(screen.getByText("Shunt recording")).toBeTruthy();
    });

    it("renders a subtitle string for the timestamp", async () => {
      render(<RecordingOverviewScreen />);
      await act(async () => {});
      // subtitle text is whatever formatRelativeTime returns — just check it's non-empty
      // Node's toLocaleDateString may return "Mar 2, 2026" style or "2 Mar 2026" style
      const subtitleEl = screen.getByText(
        /ago|Today|Yesterday|Just now|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\w{3} \d{1,2}, \d{4}|\d{1,2} \w{3} \d{4}/
      );
      expect(subtitleEl).toBeTruthy();
    });

    it("renders time display as 00:00 initially", async () => {
      render(<RecordingOverviewScreen />);
      await act(async () => {});
      expect(screen.getAllByText("00:00").length).toBeGreaterThan(0);
    });
  });

  describe("waveform", () => {
    it("shows StaticWaveform when audioPath resolves for uploaded recording", async () => {
      render(<RecordingOverviewScreen />);
      await act(async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      });
      expect(screen.queryByTestId("static-waveform")).toBeTruthy();
    });

    it("shows StaticWaveform immediately when localPath is provided", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        id: "rec-1",
        timestamp: "2026-03-02T11:55:00.000Z",
        s3Key: "",
        localPath: "file:///local/rec-1.wav",
        status: "uploading",
      });
      render(<RecordingOverviewScreen />);
      await act(async () => {});
      expect(screen.queryByTestId("static-waveform")).toBeTruthy();
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

      render(<RecordingOverviewScreen />);
      await act(async () => {});

      const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
      // Play button: back(0), settings(1), play(2)
      const playButton = touchables[2];

      await act(async () => { fireEvent.press(playButton); });

      expect(resolveAudioUri).toHaveBeenCalledWith(
        "rec-1",
        expect.objectContaining({ s3Key: "study-1/rec-1" })
      );
      expect(mockLoadSound).toHaveBeenCalledWith("/cache/recording_rec-1.wav");
      expect(mockTogglePlayback).toHaveBeenCalled();
    });

    it("calls togglePlayback directly when sound already loaded", async () => {
      const mockLoadSound = jest.fn().mockResolvedValue(undefined);
      const mockTogglePlayback = jest.fn().mockResolvedValue(undefined);

      (useAudioPlayer as jest.Mock).mockReturnValue({
        isPlaying: false,
        isLoading: false,
        error: null,
        positionMillis: 0,
        durationMillis: 30000, // already loaded
        loadSound: mockLoadSound,
        togglePlayback: mockTogglePlayback,
      });

      render(<RecordingOverviewScreen />);
      await act(async () => {});

      const touchables = screen.UNSAFE_getAllByType(TouchableOpacity);
      const playButton = touchables[2];
      await act(async () => { fireEvent.press(playButton); });

      expect(mockLoadSound).not.toHaveBeenCalled();
      expect(mockTogglePlayback).toHaveBeenCalled();
    });
  });

  describe("AI analysis", () => {
    it("calls fetchRecordingAnalysis with the recording id on mount", () => {
      render(<RecordingOverviewScreen />);
      expect(fetchRecordingAnalysis).toHaveBeenCalledWith("rec-1");
    });

    it("renders the thank you message in the analysis card", async () => {
      render(<RecordingOverviewScreen />);
      await act(async () => {});
      expect(
        screen.getByText("Thank you for your recording and participating in our study!")
      ).toBeTruthy();
    });
  });
});
