import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Colors, Fonts } from "../constants/theme";
import Svg, { Circle, Path } from "react-native-svg";

interface CountdownTimerProps {
  /** Starting number for countdown (e.g., 5 for 5→4→3→2→1) */
  seconds: number;
  /** Called when countdown reaches 0 */
  onComplete?: () => void;
  /** Called on each tick with remaining seconds */
  onTick?: (remaining: number) => void;
  /** Size of the timer circle */
  size?: number;
  /** Background color (unfilled portion) */
  backgroundColor?: string;
  /** Fill color (filled portion) */
  fillColor?: string;
  /** Text color for the number */
  textColor?: string;
  /** Whether to auto-start the countdown */
  autoStart?: boolean;
  /** Direction of fill: true = clockwise, false = counter-clockwise */
  clockwise?: boolean;
  /** Fill in discrete per-second chunks instead of smooth animation */
  chunked?: boolean;
}

export function CountdownTimer({
  seconds,
  onComplete,
  onTick,
  size = 200,
  backgroundColor = "#CFFFFF",
  fillColor = "#85E2FF",
  textColor = Colors.textDark,
  autoStart = true,
  clockwise = true,
  chunked = false,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Chunked mode: animates each 1-second step with a short ease-out
  const chunkedAnim = useRef(new Animated.Value(0)).current;
  const [chunkedProgress, setChunkedProgress] = useState(0);

  useEffect(() => {
    if (!chunked) return;
    const id = chunkedAnim.addListener(({ value }) => setChunkedProgress(value));
    return () => chunkedAnim.removeListener(id);
  }, [chunked]);

  // Animate to new chunk target whenever remaining ticks down
  const prevRemainingRef = useRef(seconds);
  useEffect(() => {
    if (!chunked) return;
    if (remaining === prevRemainingRef.current) return;
    prevRemainingRef.current = remaining;
    const target = (seconds - remaining) / seconds;
    Animated.timing(chunkedAnim, {
      toValue: target,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [remaining, chunked]);

  useEffect(() => {
    if (!autoStart) return;

    startTimeRef.current = Date.now();
    const totalDuration = seconds * 1000;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current || 0);
      const totalProgress = elapsed / totalDuration;

      if (totalProgress >= 1) {
        setRemaining(0);
        setProgress(1);
        if (intervalRef.current) clearInterval(intervalRef.current);
        onComplete?.();
        return;
      }

      const elapsedSeconds = Math.floor(elapsed / 1000);
      const newRemaining = seconds - elapsedSeconds;
      const progressInSecond = (elapsed % 1000) / 1000;

      setRemaining(newRemaining);
      setProgress((elapsedSeconds + progressInSecond) / seconds);

      if (newRemaining !== remaining) {
        onTick?.(newRemaining);
      }
    }, 16);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [seconds, autoStart, onComplete, onTick]);

  const radius = size / 2;
  const centerX = radius;
  const centerY = radius;

  const createPieSlice = (progressValue: number) => {
    if (progressValue <= 0) return "";
    if (progressValue >= 1) {
      return `M ${centerX} ${centerY}
              m -${radius}, 0
              a ${radius},${radius} 0 1,1 ${radius * 2},0
              a ${radius},${radius} 0 1,1 -${radius * 2},0`;
    }

    const angle = progressValue * 360;
    const angleRad = clockwise
      ? ((angle - 90) * Math.PI) / 180
      : ((-angle - 90) * Math.PI) / 180;

    const endX = centerX + radius * Math.cos(angleRad);
    const endY = centerY + radius * Math.sin(angleRad);
    const largeArc = angle > 180 ? 1 : 0;
    const sweepFlag = clockwise ? 1 : 0;
    const startX = centerX;
    const startY = centerY - radius;

    return `M ${centerX} ${centerY}
            L ${startX} ${startY}
            A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}
            Z`;
  };

  const pieProgress = chunked ? chunkedProgress : progress;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={centerX} cy={centerY} r={radius} fill={backgroundColor} />
        <Path d={createPieSlice(pieProgress)} fill={fillColor} />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.numberText, { color: textColor, fontSize: size * 0.35 }]}>
          {remaining}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  numberText: {
    fontFamily: Fonts.bold,
  },
});
