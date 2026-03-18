import { Buffer } from "buffer";
import React, { useEffect, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { ChunkListener, UnsubscribeFunction } from "../hooks/useAudioRecording";
import {
  BAR_GAP,
  BAR_WIDTH,
  MAX_BAR_HEIGHT,
  MIN_BAR_HEIGHT,
} from "../utils/waveform-constants";
import { scaleAmplitudeToBarHeight } from "../utils/waveform-utils";
import { Colors } from "../constants/theme";

// Define types for the chunk listener and unsubscribe function

interface LiveWaveformProps {
  isRecording: boolean;
  recording: any | null;
  addChunkListener?: (listener: ChunkListener) => UnsubscribeFunction;
}

// Define a threshold for high amplitude (e.g., 80% of max height)
const HIGH_AMPLITUDE_THRESHOLD = MAX_BAR_HEIGHT * 0.9;
const NUM_BARS = Math.floor(
  Dimensions.get("window").width / (BAR_WIDTH + BAR_GAP)
);

export function LiveWaveform({
  isRecording,
  recording,
  addChunkListener,
}: LiveWaveformProps) {
  const [amplitudes, setAmplitudes] = useState<number[]>([]);

  useEffect(() => {
    if (!isRecording) {
      setAmplitudes([]);
      return;
    }

    // If we have chunk listeners, use them to update the waveform
    if (addChunkListener) {
      const handleChunk = (chunk: Buffer) => {
        // Calculate amplitude from the chunk
        // This is a simple implementation - you might want to improve it
        let sum = 0;
        for (let i = 0; i < chunk.length; i += 2) {
          // Read 16-bit PCM value
          const int16 = chunk.readInt16LE(i);
          // Convert to absolute value and normalize
          sum += Math.abs(int16) / 32768.0;
        }

        // Calculate average amplitude
        const avgAmplitude = sum / (chunk.length / 2);

        // Use the utility function with consistent amplification factor
        const amplificationFactor = 100; // Same as StaticWaveform
        const height = scaleAmplitudeToBarHeight(
          avgAmplitude,
          amplificationFactor
        );

        setAmplitudes((prev) => {
          const updated = [...prev, height];
          if (updated.length > NUM_BARS) {
            return updated.slice(-NUM_BARS);
          }
          return updated;
        });
      };

      // Register the listener and get the unsubscribe function
      const unsubscribe = addChunkListener(handleChunk);

      // Clean up by calling the unsubscribe function
      return () => {
        unsubscribe();
      };
    } else {
      // Fallback to simulated waveform if no listeners provided
      const updateAmplitudes = () => {
        // Generate a random amplitude between 0 and 1 (normalized)
        const randomAmplitude = Math.random();

        // Scale using the utility function
        const amplificationFactor = 10; // Same as StaticWaveform
        const height = scaleAmplitudeToBarHeight(
          randomAmplitude,
          amplificationFactor
        );

        setAmplitudes((prev) => {
          const updated = [...prev, height];
          if (updated.length > NUM_BARS) {
            return updated.slice(-NUM_BARS);
          }
          return updated;
        });
      };

      const interval = setInterval(updateAmplitudes, 100);
      return () => clearInterval(interval);
    }
  }, [isRecording, addChunkListener]);

  return (
    <View style={styles.container}>
      <View style={styles.waveform}>
        {amplitudes.map((amplitude, index) => {
          // Determine bar color based on amplitude
          const barColor =
            amplitude > HIGH_AMPLITUDE_THRESHOLD ? Colors.error : Colors.guidelineText;
          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: amplitude, // No need for Math.max - utility already ensures minimum height
                  backgroundColor: barColor,
                },
              ]}
            />
          );
        })}
        {/* Fill remaining space with empty bars */}
        {[...Array(Math.max(0, NUM_BARS - amplitudes.length))].map(
          (_, index) => (
            <View
              key={`empty-${index}`}
              style={[
                styles.bar,
                {
                  height: MIN_BAR_HEIGHT, // Use MIN_BAR_HEIGHT instead of hardcoded 2
                  backgroundColor: Colors.border,
                },
              ]}
            />
          )
        )}
      </View>
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
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  bar: {
    width: BAR_WIDTH,
    marginHorizontal: BAR_GAP / 2,
    borderRadius: BAR_WIDTH / 2,
  },
});
