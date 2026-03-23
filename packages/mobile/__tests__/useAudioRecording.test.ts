/**
 * Tests for useAudioRecording hook.
 *
 * Strategy:
 * - Native module (@dr.pogodin/react-native-audio) is replaced with a fake
 *   InputAudioStream that exposes a triggerChunk helper via __mockState.
 * - wav-encoder and expo-file-system are mocked to avoid file I/O.
 * - auto-stop / quality-check tests use real timers with tiny durations
 *   to avoid fake-timer + async-chain interaction issues.
 * - pause / resume tests use fake timers (pure synchronous timer math).
 */

// ── Mocks (hoisted before all imports) ─────────────────────────────────────

jest.mock("@dr.pogodin/react-native-audio", () => {
  // Shared state exposed via __mockState for cross-test access.
  const mockState: { chunkCallback: ((chunk: any) => void) | null } = {
    chunkCallback: null,
  };

  class FakeInputStream {
    start = jest.fn().mockResolvedValue(undefined);
    stop = jest.fn().mockResolvedValue(undefined);

    addChunkListener(cb: (chunk: any) => void) {
      mockState.chunkCallback = cb;
    }
  }

  return {
    AUDIO_FORMATS: { PCM_16BIT: "pcm16bit" },
    AUDIO_SOURCES: { RAW: "raw" },
    CHANNEL_CONFIGS: { MONO: "mono" },
    configAudioSystem: jest.fn().mockResolvedValue(undefined),
    InputAudioStream: FakeInputStream,
    __mockState: mockState,
  };
});

jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("wav-encoder", () => ({
  encode: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
}));

jest.mock("../utils/audio-quality", () => ({
  analyzeAudioQuality: jest.fn().mockReturnValue({
    medianPeak: 0.3,
    maxWindowPeak: 0.5,
    artifactRatio: 1.2,
    hasArtifacts: false,
    isLowSignal: false,
    windowPeaks: [0.3, 0.3, 0.3, 0.3, 0.3],
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { Buffer } from "buffer";
import { renderHook, act } from "@testing-library/react-native";
import { useAudioRecording } from "../hooks/useAudioRecording";

// ── Helpers ─────────────────────────────────────────────────────────────────

const getAudioMock = () =>
  jest.requireMock("@dr.pogodin/react-native-audio") as {
    __mockState: { chunkCallback: ((chunk: Buffer) => void) | null };
    configAudioSystem: jest.Mock;
  };

/** Synchronously dispatch a fake audio chunk to the current stream listener. */
const triggerChunk = (chunk: Buffer) => {
  getAudioMock().__mockState.chunkCallback?.(chunk);
};

/** Small buffer suitable as a fake audio chunk. */
const makeChunk = () => Buffer.alloc(16, 0);

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  getAudioMock().__mockState.chunkCallback = null;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("lifecycle", () => {
  it("isRecording is false before startRecording", () => {
    const { result } = renderHook(() => useAudioRecording());
    expect(result.current.isRecording).toBe(false);
  });

  it("startRecording sets isRecording to true", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    unmount();
  });

  it("stopRecording sets isRecording to false", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    unmount();
  });

  it("stopRecording returns a .wav file path", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    let path: string | null = null;
    await act(async () => {
      path = await result.current.stopRecording();
    });

    expect(path).toMatch(/\.wav$/);
    unmount();
  });

  it("cancelRecording sets isRecording to false", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.cancelRecording();
    });

    expect(result.current.isRecording).toBe(false);
    unmount();
  });
});

describe("auto-stop (real timers, tiny maxDuration)", () => {
  const WAIT_MS = 600;

  it("onAutoStop fires after maxDuration elapses", async () => {
    const onAutoStop = jest.fn();
    const { result, unmount } = renderHook(() =>
      useAudioRecording({ maxDuration: 0.2, onAutoStop })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Trigger a chunk so quality metrics are available at auto-stop
    act(() => { triggerChunk(makeChunk()); });

    await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    await act(async () => {});

    expect(onAutoStop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    unmount();
  }, 10_000);

  it("onAutoStop is NOT called after cancelRecording", async () => {
    const onAutoStop = jest.fn();
    const { result, unmount } = renderHook(() =>
      useAudioRecording({ maxDuration: 0.2, onAutoStop })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.cancelRecording();
    });

    // Wait longer than maxDuration – callback must stay silent
    await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    await act(async () => {});

    expect(onAutoStop).not.toHaveBeenCalled();
    unmount();
  }, 10_000);
});

describe("quality check (real timers, tiny qualityCheckAt)", () => {
  const WAIT_MS = 600;

  it("onQualityCheck fires exactly once at qualityCheckAt", async () => {
    const onQualityCheck = jest.fn();
    const { result, unmount } = renderHook(() =>
      useAudioRecording({ qualityCheckAt: 0.15, onQualityCheck })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Provide a chunk so analyzeAudioQuality is called
    act(() => { triggerChunk(makeChunk()); });

    await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    await act(async () => {});

    expect(onQualityCheck).toHaveBeenCalledTimes(1);

    // Wait more – must NOT fire a second time
    await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    await act(async () => {});

    expect(onQualityCheck).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.cancelRecording(); });
    unmount();
  }, 10_000);

  it("onQualityCheck is NOT called when no chunks have arrived", async () => {
    const onQualityCheck = jest.fn();
    const { result, unmount } = renderHook(() =>
      useAudioRecording({ qualityCheckAt: 0.15, onQualityCheck })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    // Do NOT trigger any chunks

    await new Promise<void>((resolve) => setTimeout(resolve, WAIT_MS));
    await act(async () => {});

    expect(onQualityCheck).not.toHaveBeenCalled();

    await act(async () => { await result.current.cancelRecording(); });
    unmount();
  }, 10_000);
});

describe("chunk listeners", () => {
  it("listener registered with addChunkListener receives chunks", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    const received: Buffer[] = [];
    result.current.addChunkListener((chunk) => received.push(chunk));

    const testChunk = Buffer.from([1, 2, 3, 4]);
    act(() => { triggerChunk(testChunk); });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(testChunk);
    unmount();
  });

  it("multiple listeners each receive the same chunk", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    const receivedA: Buffer[] = [];
    const receivedB: Buffer[] = [];
    result.current.addChunkListener((c) => receivedA.push(c));
    result.current.addChunkListener((c) => receivedB.push(c));

    act(() => { triggerChunk(makeChunk()); });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(1);
    unmount();
  });

  it("unsubscribing stops listener from receiving further chunks", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    const received: Buffer[] = [];
    const unsub = result.current.addChunkListener((c) => received.push(c));

    act(() => { triggerChunk(makeChunk()); });
    expect(received).toHaveLength(1);

    unsub();

    act(() => { triggerChunk(makeChunk()); });
    expect(received).toHaveLength(1); // still 1 — no new chunk received
    unmount();
  });

  it("unsubscribing one listener does not affect others", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    const receivedA: Buffer[] = [];
    const receivedB: Buffer[] = [];
    const unsubA = result.current.addChunkListener((c) => receivedA.push(c));
    result.current.addChunkListener((c) => receivedB.push(c));

    act(() => { triggerChunk(makeChunk()); });
    unsubA();

    act(() => { triggerChunk(makeChunk()); });

    // A got 1 chunk (before unsub), B got 2 chunks
    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(2);
    unmount();
  });
});

describe("pause and resume timer (fake timers)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("pauseTimer freezes elapsed duration", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    // Advance 5 seconds
    act(() => { jest.advanceTimersByTime(5000); });
    const durationAtPause = result.current.duration;
    expect(durationAtPause).toBeGreaterThan(4.9);

    // Pause and advance 3 more seconds
    act(() => {
      result.current.pauseTimer();
      jest.advanceTimersByTime(3000);
    });

    // Duration must not have changed since pause
    expect(result.current.duration).toBeCloseTo(durationAtPause, 1);

    await act(async () => { await result.current.cancelRecording(); });
    unmount();
  });

  it("resumeTimer continues from the paused offset, not from zero", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    // Advance 5 seconds and pause
    act(() => { jest.advanceTimersByTime(5000); });
    act(() => { result.current.pauseTimer(); });

    // Advance 3 seconds while paused (timer should not advance)
    act(() => { jest.advanceTimersByTime(3000); });

    // Resume, then advance 2 more seconds
    act(() => { result.current.resumeTimer(); });
    act(() => { jest.advanceTimersByTime(2000); });

    // Total elapsed from recording perspective: 5s recorded + 2s after resume = ~7s
    // (the 3s while paused should NOT count)
    expect(result.current.duration).toBeGreaterThan(6.5);
    expect(result.current.duration).toBeLessThan(7.5);

    await act(async () => { await result.current.cancelRecording(); });
    unmount();
  });

  it("calling pauseTimer twice does not corrupt the elapsed offset", async () => {
    const { result, unmount } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => { jest.advanceTimersByTime(2000); });
    act(() => { result.current.pauseTimer(); });
    const firstPausedDuration = result.current.duration;

    // Pause again — should be a no-op
    act(() => { result.current.pauseTimer(); });

    act(() => { result.current.resumeTimer(); });
    act(() => { jest.advanceTimersByTime(1000); });

    // Duration should be ~3s (2s + 1s resumed), not corrupted by double-pause
    expect(result.current.duration).toBeGreaterThan(firstPausedDuration);

    await act(async () => { await result.current.cancelRecording(); });
    unmount();
  });
});
