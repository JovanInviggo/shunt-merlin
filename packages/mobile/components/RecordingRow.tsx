import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Text } from "./Text";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Recording, resolveAudioUri } from "../utils/recordings-service";
import { formatRelativeTime, getStatusColor, formatTime } from "../utils/recording-row-utils";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { StaticWaveform } from "./StaticWaveform";
import { Colors, Fonts } from "../constants/theme";

interface RecordingRowProps {
  recording: Recording;
}

export const RecordingRow: React.FC<RecordingRowProps> = ({ recording }) => {
  const [expanded, setExpanded] = useState(false);
  const [audioPath, setAudioPath] = useState<string | null>(recording.localPath || null);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const { isPlaying, isLoading, positionMillis, durationMillis, loadSound, togglePlayback } =
    useAudioPlayer();

  // Resolve audio path once on first expand
  useEffect(() => {
    if (expanded && !audioPath && recording.s3Key) {
      resolveAudioUri(recording.id, { s3Key: recording.s3Key })
        .then(setAudioPath)
        .catch(() => {});
    }
  }, [expanded]);

  // Handle expand/collapse animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(rotateAnim, {
        toValue: expanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(expandAnim, {
        toValue: expanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [expanded]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const navigateToOverview = () => {
    router.push({
      pathname: "/recording-overview",
      params: {
        id: recording.id,
        timestamp: recording.timestamp,
        s3Key: recording.s3Key || "",
        localPath: recording.localPath || "",
        status: recording.status,
      },
    });
  };

  const toggleExpand = () => {
    if (expanded && isPlaying) {
      togglePlayback();
    }
    setExpanded(!expanded);
  };

  const handlePlayPress = async () => {
    if (isLoading) return;
    if (durationMillis === 0) {
      const uri = await resolveAudioUri(recording.id, recording);
      if (uri) {
        await loadSound(uri);
        await togglePlayback();
      }
    } else {
      await togglePlayback();
    }
  };

  const remainingTime = durationMillis - positionMillis;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.row} onPress={navigateToOverview} activeOpacity={0.7}>
        <View style={styles.leftContent}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(recording.status) }]} />
          <Text style={styles.timestamp}>{formatRelativeTime(recording.timestamp)}</Text>
        </View>
        <TouchableOpacity onPress={toggleExpand} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </Animated.View>
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <Animated.View
          style={[
            styles.expandedContent,
            {
              opacity: expandAnim,
            },
          ]}
        >
          {/* Waveform */}
          <View style={styles.waveformContainer}>
            {audioPath ? (
              <StaticWaveform
                recordingPath={audioPath}
                positionMillis={positionMillis}
                durationMillis={durationMillis}
              />
            ) : (
              <View style={styles.waveformPlaceholder} />
            )}
          </View>

          {/* Playback controls */}
          <View style={styles.playbackControls}>
            <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
            <TouchableOpacity onPress={handlePlayPress} style={styles.playButton}>
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={24}
                  color={Colors.textSecondary}
                />
              )}
            </TouchableOpacity>
            <Text style={styles.timeText}>-{formatTime(remainingTime > 0 ? remainingTime : durationMillis)}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 16,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  timestamp: {
    fontSize: 16,
    color: "#333",
    fontFamily: Fonts.semiBold,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  waveformContainer: {
    height: 60,
    justifyContent: "center",
  },
  waveformPlaceholder: {
    width: "100%",
    height: 60,
    backgroundColor: Colors.border,
    borderRadius: 4,
  },
  playbackControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  playButton: {
    padding: 8,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    minWidth: 45,
  },
});

export default RecordingRow;
