import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Colors } from "../constants/theme";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

interface ProgressTimerProps {
  /** Current duration in seconds */
  duration: number;
  /** Maximum duration in seconds */
  maxDuration: number;
  /** Size of the timer circle */
  size?: number;
  /** Width of the stroke */
  strokeWidth?: number;
  /** Background ring color */
  backgroundColor?: string;
  /** Progress ring color */
  progressColor?: string;
  /** Text color */
  textColor?: string;
  /** Secondary text color (for max duration) */
  secondaryTextColor?: string;
  /** Whether to show the time text */
  showTime?: boolean;
  /** Custom content to render in center (overrides default time display) */
  children?: React.ReactNode;
}

export function ProgressTimer({
  duration,
  maxDuration,
  size = 200,
  strokeWidth = 8,
  backgroundColor = "#CFFFFF",
  progressColor = "#3B84BB",
  textColor = "#3B84BB",
  secondaryTextColor = Colors.textDark,
  showTime = true,
  children,
}: ProgressTimerProps) {
  const progress = Math.min(duration / maxDuration, 1);
  const isComplete = progress >= 1;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);
  const centerX = size / 2;
  const centerY = size / 2;

  // Filled circle fades in, then checkmark pops in
  const fillOpacity = useRef(new Animated.Value(0)).current;
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isComplete) {
      Animated.sequence([
        Animated.timing(fillOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(checkmarkScale, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fillOpacity.setValue(0);
      checkmarkScale.setValue(0);
    }
  }, [isComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const badgeSize = Math.round(size * 0.26);
  // diameter of the inner fill area (inside the stroke)
  const fillDiameter = (radius - strokeWidth / 2) * 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background ring */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress ring */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={radius}
          stroke={isComplete ? backgroundColor : progressColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${centerX}, ${centerY}`}
        />
      </Svg>

      {/* Solid fill overlay — fades in on complete */}
      <Animated.View
        style={[
          styles.fillOverlay,
          {
            width: fillDiameter,
            height: fillDiameter,
            borderRadius: fillDiameter / 2,
            backgroundColor,
            opacity: fillOpacity,
          },
        ]}
      />

      {/* Checkmark badge — springs in after fill */}
      <Animated.View
        style={[
          styles.checkmarkBadge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: progressColor,
            transform: [{ scale: checkmarkScale }],
          },
        ]}
      >
        <Ionicons name="checkmark" size={badgeSize * 0.6} color="#fff" />
      </Animated.View>

      {/* Center content — time or children, hidden when complete */}
      {!isComplete && (
        <View style={styles.textContainer}>
          {children ? (
            children
          ) : showTime ? (
            <Text style={styles.timeText}>
              <Text style={[styles.currentTime, { color: textColor }]}>
                {formatTime(duration)}
              </Text>
              <Text style={[styles.maxTime, { color: secondaryTextColor }]}>
                /{formatTime(maxDuration)}
              </Text>
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  fillOverlay: {
    position: "absolute",
  },
  checkmarkBadge: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  timeText: {
    fontSize: 24,
  },
  currentTime: {
    fontWeight: "600",
  },
  maxTime: {
    fontWeight: "400",
  },
});
