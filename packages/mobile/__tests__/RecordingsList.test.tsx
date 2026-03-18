jest.mock("../utils/recordings-service", () => ({
  subscribeToRecordingsChanges: jest.fn(),
  getMergedRecordings: jest.fn().mockResolvedValue({ recordings: [], totalPages: 1 }),
  groupRecordingsByPeriod: jest.fn().mockImplementation((recs: any[]) => ({
    thisWeek: recs,
    lastWeek: [],
    older: [],
  })),
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      recordings: { thisWeek: "THIS WEEK", lastWeek: "LAST WEEK", older: "OLDER" },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
  interpolate: (text: string, params: Record<string, any>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k]?.toString() ?? `{{${k}}}`),
}));

jest.mock("../components/RecordingRow", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    RecordingRow: ({ recording }: any) => (
      <Text testID={`row-${recording.id}`}>{recording.timestamp}</Text>
    ),
  };
});

import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react-native";
import {
  subscribeToRecordingsChanges,
  getMergedRecordings,
} from "../utils/recordings-service";
import { RecordingsList } from "../components/RecordingsList";

const makeRecording = (id: string) => ({
  id,
  timestamp: "2026-03-02T10:00:00.000Z",
  studyId: "s1",
  status: "uploaded",
  localPath: null,
  s3Key: `s1/${id}.wav`,
});

beforeEach(() => {
  jest.clearAllMocks();
  (getMergedRecordings as jest.Mock).mockResolvedValue({ recordings: [], totalPages: 1 });

  (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
    cb({ recordings: [], totalPages: 1 });
    return jest.fn();
  });
});

describe("loading state", () => {
  it("shows ActivityIndicator while waiting for first subscription event", async () => {
    // Subscription does NOT immediately call back → stays in loading state
    (subscribeToRecordingsChanges as jest.Mock).mockReturnValue(jest.fn());

    render(<RecordingsList />);
    await act(async () => {});

    // loading=true → ActivityIndicator rendered, no section labels
    expect(screen.queryByText("THIS WEEK")).toBeNull();
  });

  it("hides loader and renders nothing after subscription fires with empty array", async () => {
    render(<RecordingsList />);
    await act(async () => {});

    // loading=false, recordings=[] → component returns null
    expect(screen.queryByText("THIS WEEK")).toBeNull();
  });
});

describe("rendering recordings", () => {
  it("renders the THIS WEEK section when recordings are present", async () => {
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      cb({ recordings: [makeRecording("r1")], totalPages: 1 });
      return jest.fn();
    });

    render(<RecordingsList />);
    await act(async () => {});

    expect(screen.getByText("THIS WEEK")).toBeTruthy();
    expect(screen.getByTestId("row-r1")).toBeTruthy();
  });

  it("renders one RecordingRow per recording", async () => {
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      cb({ recordings: [makeRecording("r1"), makeRecording("r2"), makeRecording("r3")], totalPages: 1 });
      return jest.fn();
    });

    render(<RecordingsList />);
    await act(async () => {});

    expect(screen.getByTestId("row-r1")).toBeTruthy();
    expect(screen.getByTestId("row-r2")).toBeTruthy();
    expect(screen.getByTestId("row-r3")).toBeTruthy();
  });
});

describe("onEmpty callback", () => {
  it("calls onEmpty when recordings list is empty after loading", async () => {
    const onEmpty = jest.fn();

    render(<RecordingsList onEmpty={onEmpty} />);
    await act(async () => {});

    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onEmpty when recordings are present", async () => {
    const onEmpty = jest.fn();
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      cb({ recordings: [makeRecording("r1")], totalPages: 1 });
      return jest.fn();
    });

    render(<RecordingsList onEmpty={onEmpty} />);
    await act(async () => {});

    expect(onEmpty).not.toHaveBeenCalled();
  });
});

describe("subscription lifecycle", () => {
  it("subscribes to recordings changes on mount", async () => {
    render(<RecordingsList />);
    await act(async () => {});

    expect(subscribeToRecordingsChanges).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount", async () => {
    const mockUnsub = jest.fn();
    (subscribeToRecordingsChanges as jest.Mock).mockReturnValue(mockUnsub);

    const { unmount } = render(<RecordingsList />);
    await act(async () => {});

    act(() => { unmount(); });

    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });

  it("re-renders when subscription delivers new recordings", async () => {
    let capturedCb: ((result: { recordings: any[]; totalPages: number }) => void) | undefined;
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      capturedCb = cb;
      cb({ recordings: [], totalPages: 1 });
      return jest.fn();
    });

    render(<RecordingsList />);
    await act(async () => {});

    await act(async () => { capturedCb?.({ recordings: [makeRecording("new1")], totalPages: 1 }); });

    expect(screen.getByTestId("row-new1")).toBeTruthy();
  });
});

describe("infinite scroll / pagination", () => {
  it("calls loadMore with page 2 when onEndReached fires and more pages exist", async () => {
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      cb({ recordings: [makeRecording("r1")], totalPages: 2 });
      return jest.fn();
    });
    (getMergedRecordings as jest.Mock).mockResolvedValue({
      recordings: [makeRecording("r2")],
      totalPages: 2,
    });

    render(<RecordingsList />);
    await act(async () => {});

    const list = screen.getByTestId("recordings-list");
    await act(async () => {
      fireEvent(list, "endReached");
    });

    expect(getMergedRecordings).toHaveBeenCalledWith(2);
    expect(screen.getByTestId("row-r2")).toBeTruthy();
  });

  it("does not call getMergedRecordings when already on last page", async () => {
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      cb({ recordings: [makeRecording("r1")], totalPages: 1 });
      return jest.fn();
    });

    render(<RecordingsList />);
    await act(async () => {});

    const list = screen.getByTestId("recordings-list");
    await act(async () => {
      fireEvent(list, "endReached");
    });

    expect(getMergedRecordings).not.toHaveBeenCalled();
  });

  it("appends page 2 results to existing recordings list", async () => {
    (subscribeToRecordingsChanges as jest.Mock).mockImplementation((cb) => {
      cb({ recordings: [makeRecording("r1")], totalPages: 2 });
      return jest.fn();
    });
    (getMergedRecordings as jest.Mock).mockResolvedValue({
      recordings: [makeRecording("r2"), makeRecording("r3")],
      totalPages: 2,
    });

    render(<RecordingsList />);
    await act(async () => {});

    const list = screen.getByTestId("recordings-list");
    await act(async () => {
      fireEvent(list, "endReached");
    });

    expect(screen.getByTestId("row-r1")).toBeTruthy();
    expect(screen.getByTestId("row-r2")).toBeTruthy();
    expect(screen.getByTestId("row-r3")).toBeTruthy();
  });
});
