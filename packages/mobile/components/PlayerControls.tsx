import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "./Text";
import { Icon } from "react-native-paper";
import { formatTime } from "../utils/format-time"; // Assuming path is correct
import { StaticWaveform } from "./StaticWaveform";
import { Colors } from "../constants/theme";

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  durationMillis: number;
  positionMillis: number;
  recordingPath: string | undefined | null;
  onTogglePlayback: () => void;
}

export function PlayerControls({
  isPlaying,
  isLoading,
  error,
  durationMillis,
  positionMillis,
  recordingPath,
  onTogglePlayback,
}: PlayerControlsProps) {
  return (
    <View style={styles.playerOuterContainer}>
      {error && <Text style={styles.errorText}>Audio Fehler: {error}</Text>}
      <View style={styles.playerContainer}>
        <TouchableOpacity
          onPress={onTogglePlayback}
          style={[styles.playButton, isLoading && styles.buttonDisabled]}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon source={isPlaying ? "stop" : "play"} size={24} color="#fff" />
          )}
        </TouchableOpacity>
        <View style={styles.waveformContainer}>
          {recordingPath ? (
            <StaticWaveform
              recordingPath={recordingPath}
              positionMillis={positionMillis}
              durationMillis={durationMillis}
            />
          ) : (
            <View style={styles.waveformPlaceholder} /> // Placeholder if no path
          )}
          <Text style={styles.progressText}>
            {formatTime(positionMillis / 1000)} /{" "}
            {formatTime(durationMillis / 1000)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Styles copied and adapted from submit.tsx
const styles = StyleSheet.create({
  playerOuterContainer: {
    marginBottom: 20,
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.link,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    fontSize: 20,
    color: "#fff",
    fontFamily: "SpaceMono-Regular",
  },
  waveformContainer: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 10,
  },
  waveformPlaceholder: {
    height: 50, // Match approx height of waveform
    backgroundColor: "#f0f0f0", // Placeholder color
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4, // Add some space above progress text
  },
  buttonDisabled: {
    opacity: 0.7,
    backgroundColor: "#a0a0a0", // Maintain disabled style
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
});
