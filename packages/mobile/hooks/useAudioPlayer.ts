import { Audio, AVPlaybackStatus } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  durationMillis: number;
  positionMillis: number;
  loadSound: (uri: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
}

// ─── Module-level singleton ───────────────────────────────────────────────────
// Ensures at most one audio player is active at a time across all components.
// When a new loadSound() call arrives, the previous instance is paused first.

let activeInstanceId: number | null = null;
let activeStopFn: (() => void) | null = null;
let nextInstanceId = 0;

/** Pause any currently playing audio. Call on logout or app background. */
export function stopAllAudio(): void {
  activeStopFn?.();
  activeStopFn = null;
  activeInstanceId = null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function useAudioPlayer(): AudioPlayerState {
  const instanceId = useRef(nextInstanceId++).current;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);
  const [positionMillis, setPositionMillis] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(async () => {
    if (positionUpdateInterval.current) {
      clearInterval(positionUpdateInterval.current);
      positionUpdateInterval.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.error("useAudioPlayer: Error unloading sound:", e instanceof Error ? e.message : String(e));
      } finally {
        soundRef.current = null;
      }
    }
    setIsPlaying(false);
    setDurationMillis(0);
    setPositionMillis(0);
    setIsLoading(false);
  }, []);

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) {
          console.error(`useAudioPlayer: Playback Error: ${status.error}`);
          setError(`Playback Error: ${status.error}`);
          if (positionUpdateInterval.current) {
            clearInterval(positionUpdateInterval.current);
            positionUpdateInterval.current = null;
          }
          setIsPlaying(false);
        }
        return;
      }

      setPositionMillis(status.positionMillis);
      setIsPlaying(status.isPlaying);

      if (status.didJustFinish && !status.isLooping) {
        setPositionMillis(0);
        setIsPlaying(false);
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
          positionUpdateInterval.current = null;
        }
        soundRef.current?.setPositionAsync(0).catch((e) => {
          console.error("useAudioPlayer: Error resetting position after finish:", e instanceof Error ? e.message : String(e));
        });
      }
    },
    [setError]
  );

  const updatePositionFromTimer = useCallback(async () => {
    if (!soundRef.current) {
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
        positionUpdateInterval.current = null;
      }
      return;
    }
    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        setPositionMillis(status.positionMillis);
        if (status.didJustFinish && !status.isLooping) {
          setIsPlaying(false);
          setPositionMillis(0);
          if (positionUpdateInterval.current) {
            clearInterval(positionUpdateInterval.current);
            positionUpdateInterval.current = null;
          }
          await soundRef.current.setPositionAsync(0);
        }
      } else {
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
          positionUpdateInterval.current = null;
        }
        setIsPlaying(false);
        if (status.error) {
          setError(`Playback Status Error: ${status.error}`);
        }
      }
    } catch (e) {
      console.error("useAudioPlayer: Error getting status in timer:", e instanceof Error ? e.message : String(e));
      setError("Error getting playback status: " + (e instanceof Error ? e.message : String(e)));
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
        positionUpdateInterval.current = null;
      }
      setIsPlaying(false);
    }
  }, [setError]);

  const loadSound = useCallback(
    async (uri: string) => {
      // Stop any other active player before loading — prevents two sounds playing at once
      if (activeInstanceId !== null && activeInstanceId !== instanceId) {
        activeStopFn?.();
      }
      // Register this instance as the active player
      activeInstanceId = instanceId;
      activeStopFn = () => {
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
          positionUpdateInterval.current = null;
        }
        soundRef.current?.pauseAsync().catch(() => {});
        setIsPlaying(false);
      };

      setIsLoading(true);
      setError(null);
      await cleanup();

      try {
        const { sound: newSound, status: initialStatus } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );
        soundRef.current = newSound;

        if (initialStatus.isLoaded) {
          setDurationMillis(initialStatus.durationMillis ?? 0);
          setPositionMillis(0);
          setIsPlaying(false);
          setError(null);
        } else {
          setError("Failed to load audio resource.");
          if (initialStatus.error) {
            setError(`Loading Error: ${initialStatus.error}`);
          }
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("useAudioPlayer: Error loading sound:", errorMessage);
        setError("Error loading sound: " + errorMessage);
        soundRef.current = null;
        setDurationMillis(0);
        setPositionMillis(0);
        setIsPlaying(false);
      } finally {
        setIsLoading(false);
      }
    },
    [instanceId, cleanup, onPlaybackStatusUpdate, setError]
  );

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current || isLoading) return;

    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        setError("Cannot play, audio not loaded.");
        return;
      }

      setError(null);

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        // Note: do NOT call setPositionAsync(0) here — pause keeps the current position
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
          positionUpdateInterval.current = null;
        }
      } else {
        // If at or near the end, restart from the beginning
        if (status.positionMillis >= (status.durationMillis ?? 0) - 50) {
          await soundRef.current.setPositionAsync(0);
          setPositionMillis(0);
        }
        await soundRef.current.playAsync();
        if (positionUpdateInterval.current) {
          clearInterval(positionUpdateInterval.current);
        }
        positionUpdateInterval.current = setInterval(updatePositionFromTimer, 50);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("useAudioPlayer: Error toggling playback:", errorMessage);
      setError("Error toggling playback: " + errorMessage);
      if (positionUpdateInterval.current) {
        clearInterval(positionUpdateInterval.current);
        positionUpdateInterval.current = null;
      }
      setIsPlaying(false);
    }
  }, [isLoading, updatePositionFromTimer, setError]);

  useEffect(() => {
    return () => {
      // Deregister from singleton if this was the active instance
      if (activeInstanceId === instanceId) {
        activeInstanceId = null;
        activeStopFn = null;
      }
      cleanup().catch(console.error);
    };
  }, [cleanup, instanceId]);

  return {
    isPlaying,
    isLoading,
    error,
    durationMillis,
    positionMillis,
    loadSound,
    togglePlayback,
  };
}
