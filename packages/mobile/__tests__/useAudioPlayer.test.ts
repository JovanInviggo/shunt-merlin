/**
 * Tests for useAudioPlayer hook.
 *
 * The expo-av Audio.Sound is replaced with a controllable fake that:
 *  - Captures the onPlaybackStatusUpdate callback so tests can trigger it.
 *  - Exposes mock functions for playAsync, pauseAsync, etc.
 *
 * Strategy:
 *  - State-driven tests use triggerStatus() to simulate the Sound callback.
 *  - Error-path tests configure createAsync to throw before calling loadSound.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("expo-av", () => {
  let capturedStatusCallback: ((s: any) => void) | null = null;

  const mockSound = {
    getStatusAsync: jest.fn(),
    playAsync: jest.fn().mockResolvedValue(undefined),
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
    setPositionAsync: jest.fn().mockResolvedValue(undefined),
  };

  const createAsync = jest.fn().mockImplementation(
    (_source: any, _options: any, cb: (s: any) => void) => {
      capturedStatusCallback = cb;
      return Promise.resolve({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: 30_000,
          positionMillis: 0,
          isPlaying: false,
        },
      });
    }
  );

  return {
    Audio: { Sound: { createAsync } },
    __testHelpers: {
      mockSound,
      createAsync,
      triggerStatus: (s: any) => capturedStatusCallback?.(s),
      resetCallback: () => { capturedStatusCallback = null; },
    },
  };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import { renderHook, act } from "@testing-library/react-native";
import { useAudioPlayer, stopAllAudio } from "../hooks/useAudioPlayer";

// ── Helpers ───────────────────────────────────────────────────────────────────

const getAv = () =>
  jest.requireMock("expo-av") as {
    __testHelpers: {
      mockSound: {
        getStatusAsync: jest.Mock;
        playAsync: jest.Mock;
        pauseAsync: jest.Mock;
        unloadAsync: jest.Mock;
        setPositionAsync: jest.Mock;
      };
      createAsync: jest.Mock;
      triggerStatus: (s: any) => void;
      resetCallback: () => void;
    };
  };

const loadedStatus = (overrides: object = {}) => ({
  isLoaded: true,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 30_000,
  didJustFinish: false,
  isLooping: false,
  ...overrides,
});

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  getAv().__testHelpers.resetCallback();

  // Default: getStatusAsync returns a not-playing, loaded status
  getAv().__testHelpers.mockSound.getStatusAsync.mockResolvedValue(
    loadedStatus()
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts with all state at default values", () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.durationMillis).toBe(0);
    expect(result.current.positionMillis).toBe(0);
  });
});

describe("loadSound", () => {
  it("isLoading becomes false after successful load", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///recording.wav");
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("sets durationMillis from the initial status returned by createAsync", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///recording.wav");
    });

    expect(result.current.durationMillis).toBe(30_000);
  });

  it("clears any previous error on load", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    // Inject an error state via a failing status callback
    act(() => {
      getAv().__testHelpers.triggerStatus({ isLoaded: false, error: "prev error" });
    });

    await act(async () => {
      await result.current.loadSound("file:///recording.wav");
    });

    expect(result.current.error).toBeNull();
  });

  it("calls Audio.Sound.createAsync with the provided URI", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///test.wav");
    });

    expect(getAv().__testHelpers.createAsync).toHaveBeenCalledWith(
      { uri: "file:///test.wav" },
      expect.objectContaining({ shouldPlay: false }),
      expect.any(Function)
    );
  });

  it("sets error and isLoading=false when createAsync throws", async () => {
    getAv().__testHelpers.createAsync.mockRejectedValueOnce(
      new Error("File not found")
    );
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///missing.wav");
    });

    expect(result.current.error).toMatch(/File not found/);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.durationMillis).toBe(0);
  });

  it("sets error when initialStatus.isLoaded is false", async () => {
    getAv().__testHelpers.createAsync.mockResolvedValueOnce({
      sound: getAv().__testHelpers.mockSound,
      status: { isLoaded: false },
    });
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///recording.wav");
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("onPlaybackStatusUpdate callback", () => {
  it("updates positionMillis when status is loaded", async () => {
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    act(() => {
      getAv().__testHelpers.triggerStatus(loadedStatus({ positionMillis: 5_000 }));
    });

    expect(result.current.positionMillis).toBe(5_000);
  });

  it("updates isPlaying from status", async () => {
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    act(() => {
      getAv().__testHelpers.triggerStatus(loadedStatus({ isPlaying: true }));
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it("resets positionMillis to 0 when didJustFinish", async () => {
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    act(() => {
      getAv().__testHelpers.triggerStatus(
        loadedStatus({ positionMillis: 28_000, didJustFinish: true, isLooping: false })
      );
    });

    expect(result.current.positionMillis).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it("calls setPositionAsync(0) when didJustFinish", async () => {
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    act(() => {
      getAv().__testHelpers.triggerStatus(
        loadedStatus({ didJustFinish: true, isLooping: false })
      );
    });

    await act(async () => {});
    expect(getAv().__testHelpers.mockSound.setPositionAsync).toHaveBeenCalledWith(0);
  });

  it("sets error state when status has error while not loaded", async () => {
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    act(() => {
      getAv().__testHelpers.triggerStatus({
        isLoaded: false,
        error: "Decoder error",
      });
    });

    expect(result.current.error).toMatch(/Decoder error/);
    expect(result.current.isPlaying).toBe(false);
  });
});

describe("togglePlayback", () => {
  it("calls playAsync when sound is loaded and not currently playing", async () => {
    getAv().__testHelpers.mockSound.getStatusAsync.mockResolvedValue(
      loadedStatus({ isPlaying: false, positionMillis: 0 })
    );
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    await act(async () => { await result.current.togglePlayback(); });

    expect(getAv().__testHelpers.mockSound.playAsync).toHaveBeenCalledTimes(1);
  });

  it("calls pauseAsync when sound is currently playing", async () => {
    getAv().__testHelpers.mockSound.getStatusAsync.mockResolvedValue(
      loadedStatus({ isPlaying: true })
    );
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    await act(async () => { await result.current.togglePlayback(); });

    expect(getAv().__testHelpers.mockSound.pauseAsync).toHaveBeenCalledTimes(1);
  });

  it("does NOT reset position to 0 when pausing (pause keeps current position)", async () => {
    getAv().__testHelpers.mockSound.getStatusAsync.mockResolvedValue(
      loadedStatus({ isPlaying: true, positionMillis: 10_000 })
    );
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    // Clear calls from loadSound (setPositionAsync is called during finish-detection setup)
    getAv().__testHelpers.mockSound.setPositionAsync.mockClear();

    await act(async () => { await result.current.togglePlayback(); });

    expect(getAv().__testHelpers.mockSound.setPositionAsync).not.toHaveBeenCalled();
  });

  it("does nothing if sound is not loaded (no sound in ref)", async () => {
    const { result } = renderHook(() => useAudioPlayer());
    // Do NOT call loadSound — soundRef.current remains null

    await act(async () => { await result.current.togglePlayback(); });

    expect(getAv().__testHelpers.mockSound.playAsync).not.toHaveBeenCalled();
    expect(getAv().__testHelpers.mockSound.pauseAsync).not.toHaveBeenCalled();
  });

  it("sets error state if getStatusAsync rejects", async () => {
    getAv().__testHelpers.mockSound.getStatusAsync.mockRejectedValueOnce(
      new Error("HW failure")
    );
    const { result } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });

    await act(async () => { await result.current.togglePlayback(); });

    expect(result.current.error).toMatch(/Error toggling playback/);
    expect(result.current.isPlaying).toBe(false);
  });
});

describe("singleton — only one player active at a time", () => {
  it("pauses the first instance when a second instance calls loadSound", async () => {
    getAv().__testHelpers.mockSound.getStatusAsync.mockResolvedValue(
      loadedStatus({ isPlaying: true })
    );

    const hookA = renderHook(() => useAudioPlayer());
    const hookB = renderHook(() => useAudioPlayer());

    // A loads and starts playing
    await act(async () => { await hookA.result.current.loadSound("f://a.wav"); });
    getAv().__testHelpers.mockSound.pauseAsync.mockClear();

    // B loads — should pause A first
    await act(async () => { await hookB.result.current.loadSound("f://b.wav"); });

    expect(getAv().__testHelpers.mockSound.pauseAsync).toHaveBeenCalledTimes(1);

    hookA.unmount();
    hookB.unmount();
  });

  it("stopAllAudio pauses the currently active sound", async () => {
    getAv().__testHelpers.mockSound.getStatusAsync.mockResolvedValue(
      loadedStatus({ isPlaying: true })
    );

    const { result, unmount } = renderHook(() => useAudioPlayer());
    await act(async () => { await result.current.loadSound("f://a.wav"); });
    getAv().__testHelpers.mockSound.pauseAsync.mockClear();

    act(() => { stopAllAudio(); });

    expect(getAv().__testHelpers.mockSound.pauseAsync).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("stopAllAudio is safe to call when nothing is playing", () => {
    expect(() => stopAllAudio()).not.toThrow();
  });
});

describe("cleanup on unmount", () => {
  it("calls unloadAsync when the hook unmounts", async () => {
    const { result, unmount } = renderHook(() => useAudioPlayer());

    await act(async () => {
      await result.current.loadSound("file:///recording.wav");
    });

    await act(async () => {
      unmount();
    });

    expect(getAv().__testHelpers.mockSound.unloadAsync).toHaveBeenCalledTimes(1);
  });

  it("does not throw if unmounted before any sound is loaded", async () => {
    const { unmount } = renderHook(() => useAudioPlayer());
    await expect(act(async () => { unmount(); })).resolves.not.toThrow();
  });
});
