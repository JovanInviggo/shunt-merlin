import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system";
import React, { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import WavDecoder from "wav-decoder";
import {
  BAR_GAP,
  BAR_WIDTH,
  MAX_BAR_HEIGHT,
  MIN_BAR_HEIGHT,
  PLAYED_COLOR,
  UNPLAYED_COLOR,
} from "../utils/waveform-constants";
import { scaleAmplitudeToBarHeight } from "../utils/waveform-utils";
import { Colors, Fonts } from "../constants/theme";

interface StaticWaveformProps {
  /** Path to the recording file (used as a key to trigger regeneration) */
  recordingPath: string;
  /** Current playback position in milliseconds */
  positionMillis: number;
  /** Total duration of the recording in milliseconds */
  durationMillis: number;
  /** Optional container style overrides */
  style?: object;
}

export function StaticWaveform({
  recordingPath,
  positionMillis,
  durationMillis,
  style,
}: StaticWaveformProps) {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const [numBars, setNumBars] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (containerWidth === null || !recordingPath) {
      setAmplitudes([]);
      return;
    }

    if (containerWidth <= 0) return;

    const calculatedNumBars = Math.floor(
      containerWidth / (BAR_WIDTH + BAR_GAP)
    );
    if (calculatedNumBars <= 0) return;

    setNumBars(calculatedNumBars);
    setIsLoading(true);
    setError(null);
    setAmplitudes([]);

    const processAudio = async () => {
      try {
        console.log(`Reading audio file: ${recordingPath}`);
        // 1. Read the audio file as Base64
        const fileContentBase64 = await FileSystem.readAsStringAsync(
          recordingPath,
          {
            encoding: FileSystem.EncodingType.Base64,
          }
        );

        // 2. Convert Base64 to Buffer
        const audioBuffer = Buffer.from(fileContentBase64, "base64");

        console.log(`Decoding WAV data...`);
        // 3. Decode the WAV buffer
        // wav-decoder expects an ArrayBuffer, Buffer needs conversion
        // Convert Node.js Buffer to ArrayBuffer using the .buffer property
        const arrayBuffer = audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength
        );
        const audioData = await WavDecoder.decode(arrayBuffer);
        // audioData contains { sampleRate, channelData: [Float32Array, Float32Array, ...] }

        console.log(
          `Processing ${audioData.channelData[0].length} samples for ${calculatedNumBars} bars.`
        );

        // --- Process the Decoded Audio Data ---
        // We'll use the first channel for the waveform
        const channelSamples = audioData.channelData[0];
        const totalSamples = channelSamples.length;

        if (totalSamples <= 0) {
          throw new Error("No audio samples found in the file.");
        }

        const samplesPerBar = Math.max(
          1,
          Math.floor(totalSamples / calculatedNumBars)
        );
        const calculatedAmplitudes: number[] = [];

        for (let i = 0; i < calculatedNumBars; i++) {
          const startIndex = i * samplesPerBar;
          const endIndex = Math.min(startIndex + samplesPerBar, totalSamples);

          let sumOfSquares = 0;
          let count = 0;
          for (let j = startIndex; j < endIndex; j++) {
            // wav-decoder gives Float32Array values between -1.0 and 1.0
            const sampleValue = channelSamples[j];
            sumOfSquares += sampleValue * sampleValue; // Use square for RMS
            count++;
          }

          // Calculate Root Mean Square (RMS) for the bar's amplitude
          const rms = count > 0 ? Math.sqrt(sumOfSquares / count) : 0;

          // Scale RMS (0 to 1) to visual height using the utility function
          const amplificationFactor = 10; // Consistent factor
          const barHeight = scaleAmplitudeToBarHeight(rms, amplificationFactor);
          calculatedAmplitudes.push(barHeight);
        }

        setAmplitudes(calculatedAmplitudes);

        // --- No need to load with Audio.Sound or fallback to simulation ---
      } catch (e: any) {
        console.error("Error processing audio for waveform:", e);
        // Check if it's a FileSystem error
        if (e.code && e.code.startsWith("ERR_FILESYSTEM")) {
          setError(`Failed to read audio file: ${e.message}`);
        } else {
          setError(`Failed to process audio: ${e.message}`);
        }
        // Optional: Fallback to placeholder on error?
        setAmplitudes([]); // Clear amps on error
      } finally {
        setIsLoading(false);
        // No soundObject to unload
      }
    };

    processAudio();

    // Cleanup function
    return () => {
      // console.log("StaticWaveform cleanup");
    };
  }, [containerWidth, recordingPath]); // Rerun if width or recording changes

  const progressIndex =
    durationMillis > 0 && numBars > 0
      ? Math.floor((positionMillis / durationMillis) * numBars)
      : 0;

  // --- Rendering Logic (mostly unchanged, ensures MIN_BAR_HEIGHT) ---
  const renderContent = () => {
    if (containerWidth === null) {
      return <View style={styles.placeholder} />;
    }
    if (isLoading) {
      return (
        <View style={[styles.placeholder, { backgroundColor: Colors.border }]} />
      );
    }
    if (error) {
      console.error("Rendering waveform error state:", error);
      // Display error or placeholder
      return (
        <View style={[styles.placeholder, styles.errorContainer]}>
          <Text style={styles.errorText}>Error loading waveform</Text>
          {/* <Text style={styles.errorTextDetails}>{error}</Text> */}
        </View>
      );
      // return <View style={[styles.placeholder, { backgroundColor: UNPLAYED_COLOR }]} />;
    }
    if (amplitudes.length > 0) {
      return (
        <View style={styles.waveform}>
          {amplitudes.map((amplitude, index) => {
            const barColor =
              index < progressIndex ? PLAYED_COLOR : UNPLAYED_COLOR;
            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    height: Math.max(MIN_BAR_HEIGHT, amplitude),
                    backgroundColor: barColor,
                  },
                ]}
              />
            );
          })}
        </View>
      );
    }
    // Default placeholder if no amplitudes and not loading/error
    return <View style={styles.placeholder} />;
  };

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: MAX_BAR_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    minHeight: MAX_BAR_HEIGHT,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    width: "100%",
    height: MAX_BAR_HEIGHT,
    overflow: "hidden",
  },
  bar: {
    width: BAR_WIDTH,
    marginRight: BAR_GAP,
    borderRadius: BAR_WIDTH / 2,
  },
  placeholder: {
    width: "100%",
    height: MAX_BAR_HEIGHT,
    backgroundColor: UNPLAYED_COLOR,
    borderRadius: 4,
    justifyContent: "center", // For error text alignment
    alignItems: "center", // For error text alignment
  },
  // Added styles for error display
  errorContainer: {
    backgroundColor: "#ffe0e0", // Light red background for error
  },
  errorText: {
    color: Colors.error,
    fontFamily: Fonts.bold,
  },
  errorTextDetails: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 10,
  },
});
