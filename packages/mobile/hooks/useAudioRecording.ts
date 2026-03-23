import {
  AUDIO_FORMATS,
  AUDIO_SOURCES,
  CHANNEL_CONFIGS,
  configAudioSystem,
  InputAudioStream,
} from "@dr.pogodin/react-native-audio";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import * as WavEncoder from "wav-encoder";
import { Platform } from "react-native";
import { analyzeAudioQuality, SIGNAL_THRESHOLD_IOS, SIGNAL_THRESHOLD_ANDROID } from "../utils/audio-quality";
import type { AudioQualityResult } from "../utils/audio-quality";

// Define types for the chunk listener and unsubscribe function
export type ChunkListener = (chunk: Buffer) => void;
export type UnsubscribeFunction = () => void;
export type { AudioQualityResult } from "../utils/audio-quality";

const SAMPLE_RATE = 44100;
const CHANNEL_CONFIG = CHANNEL_CONFIGS.MONO;
const AUDIO_FORMAT = AUDIO_FORMATS.PCM_16BIT;
const CHUNK_SIZE = 4096;

interface UseAudioRecordingOptions {
  maxDuration?: number;
  onAutoStop?: (path: string | null) => void;
  qualityCheckAt?: number; // seconds into recording to run quality check
  onQualityCheck?: (quality: AudioQualityResult) => void;
}

interface UseAudioRecordingResult {
  isRecording: boolean;
  duration: number;
  recordingPath: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
  addChunkListener: (listener: ChunkListener) => UnsubscribeFunction;
  pauseTimer: () => void;
  resumeTimer: () => void;
}

export function useAudioRecording(options?: UseAudioRecordingOptions): UseAudioRecordingResult {
  const maxDuration = options?.maxDuration;
  const onAutoStopRef = useRef(options?.onAutoStop);
  onAutoStopRef.current = options?.onAutoStop;
  const onQualityCheckRef = useRef(options?.onQualityCheck);
  onQualityCheckRef.current = options?.onQualityCheck;
  const qualityCheckAt = options?.qualityCheckAt;
  const hasCheckedQualityRef = useRef(false);
  const [recording, setRecording] = useState<InputAudioStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const audioChunksRef = useRef<Buffer[]>([]);
  const chunkListenersRef = useRef<ChunkListener[]>([]);
  const durationTimer = useRef<number | null>(null);
  const recordingRef = useRef<InputAudioStream | null>(null);
  const isAutoStoppingRef = useRef(false);
  const isCancelledRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Configure audio system
        await configAudioSystem();
      } catch (err) {
        console.error("Failed to configure audio system", err);
      }
    };

    setupAudio();
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
      if (recording) {
        recording.stop();
      }
    };
  }, []);

  const addChunkListener = useCallback(
    (listener: ChunkListener): UnsubscribeFunction => {
      // Add the listener to our ref
      chunkListenersRef.current.push(listener);

      // Return an unsubscribe function
      return () => {
        chunkListenersRef.current = chunkListenersRef.current.filter(
          (l) => l !== listener
        );
      };
    },
    []
  );

  const startRecording = async () => {
    try {
      // Create a new audio stream for recording
      const newRecording = new InputAudioStream(
        AUDIO_SOURCES.RAW,
        SAMPLE_RATE,
        CHANNEL_CONFIG,
        AUDIO_FORMAT,
        CHUNK_SIZE
      );

      // Add chunk listener to collect audio data
      newRecording.addChunkListener((chunk: Buffer) => {
        // Store chunk in ref to avoid rerenders
        audioChunksRef.current.push(chunk);

        // Notify all listeners about the new chunk
        chunkListenersRef.current.forEach((listener) => listener(chunk));
      });

      // Start recording
      await newRecording.start();

      recordingRef.current = newRecording;
      isAutoStoppingRef.current = false;
      isCancelledRef.current = false;
      hasCheckedQualityRef.current = false;
      startTimeRef.current = Date.now();
      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);
      audioChunksRef.current = [];

      // Clear any orphaned interval before creating a new one
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }

      durationTimer.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDuration(elapsed);

        if (qualityCheckAt && elapsed >= qualityCheckAt && !hasCheckedQualityRef.current && !isCancelledRef.current) {
          hasCheckedQualityRef.current = true;
          const chunks = audioChunksRef.current;
          if (chunks.length > 0) {
            const signalThreshold = Platform.OS === "ios" ? SIGNAL_THRESHOLD_IOS : SIGNAL_THRESHOLD_ANDROID;
            const quality = analyzeAudioQuality(chunks, SAMPLE_RATE, signalThreshold);
            console.log("[AudioQuality early check] medianPeak:", quality.medianPeak.toFixed(4),
              "| artifactRatio:", quality.artifactRatio.toFixed(2),
              "| windowPeaks:", quality.windowPeaks.map(p => p.toFixed(4)).join(", "));
            onQualityCheckRef.current?.(quality);
          }
        }

        if (maxDuration && elapsed >= maxDuration && !isAutoStoppingRef.current) {
          isAutoStoppingRef.current = true;
          autoStop();
        }
      }, 100) as unknown as number;
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopAndSave = async (): Promise<string | null> => {
    const currentRecording = recordingRef.current;
    if (!currentRecording) return null;

    try {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }

      await currentRecording.stop();

      const chunks = audioChunksRef.current;
      const wavBuffer = await convertToWav(chunks, SAMPLE_RATE);
      const tempFilePath = await saveWavToFile(wavBuffer);

      setRecordingPath(tempFilePath);
      recordingRef.current = null;
      setRecording(null);
      setIsRecording(false);

      return tempFilePath;
    } catch (err) {
      console.error("Failed to stop recording", err);
      return null;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    return stopAndSave();
  };

  const autoStop = async () => {
    const path = await stopAndSave();
    // Don't call back if recording was cancelled during save
    if (isCancelledRef.current) return;
    onAutoStopRef.current?.(path);
  };

  const cancelRecording = async (): Promise<void> => {
    // Set cancelled flag first to block any in-flight autoStop
    isCancelledRef.current = true;
    isAutoStoppingRef.current = true;

    const currentRecording = recordingRef.current;
    if (!currentRecording) return;

    try {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }

      await currentRecording.stop();

      audioChunksRef.current = [];
      recordingRef.current = null;
      setRecording(null);
      setIsRecording(false);
      setDuration(0);
    } catch (err) {
      console.error("Failed to cancel recording", err);
    }
  };

  // Function to convert audio chunks to WAV format using wav-encoder
  const convertToWav = async (
    chunks: Buffer[],
    sampleRate: number
  ): Promise<Buffer> => {
    // Combine all chunks into a single buffer
    const audioData = Buffer.concat(chunks);

    // Convert buffer to Float32Array for wav-encoder
    const float32Array = new Float32Array(audioData.length / 2);
    for (let i = 0; i < audioData.length / 2; i++) {
      // Convert 16-bit PCM to float32 (-1 to 1)
      const int16 = audioData.readInt16LE(i * 2);
      float32Array[i] = int16 / 32768.0;
    }

    // Create audio data object for wav-encoder
    const audioDataObj = {
      sampleRate,
      channelData: [float32Array], // Array of Float32Arrays, one per channel
    };

    // Encode to WAV
    const wavBuffer = await WavEncoder.encode(audioDataObj);

    return Buffer.from(wavBuffer);
  };

  // Function to save WAV buffer to a file
  const saveWavToFile = async (wavBuffer: Buffer): Promise<string> => {
    const tempDir = FileSystem.cacheDirectory;
    const fileName = `recording_${Date.now()}.wav`;
    const filePath = `${tempDir}${fileName}`;

    await FileSystem.writeAsStringAsync(
      filePath,
      wavBuffer.toString("base64"),
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );

    return filePath;
  };

  const pauseTimer = useCallback(() => {
    if (!durationTimer.current) return;
    pausedElapsedRef.current = (Date.now() - startTimeRef.current) / 1000;
    clearInterval(durationTimer.current);
    durationTimer.current = null;
  }, []);

  const resumeTimer = useCallback(() => {
    if (durationTimer.current) return; // already running
    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;
    durationTimer.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDuration(elapsed);
      if (maxDuration && elapsed >= maxDuration && !isAutoStoppingRef.current) {
        isAutoStoppingRef.current = true;
        autoStop();
      }
    }, 100) as unknown as number;
  }, [maxDuration]);

  return {
    isRecording,
    duration,
    recordingPath,
    startRecording,
    stopRecording,
    cancelRecording,
    addChunkListener,
    pauseTimer,
    resumeTimer,
  };
}
