import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { useI18n, interpolate } from "../locales";
import { Colors } from "../constants/theme";
import {
  getQueue,
  subscribeToQueueChanges,
  unsubscribeFromQueueChanges,
} from "../utils/upload-queue";

export function QueueIndicator() {
  const { t } = useI18n();
  const [queueSize, setQueueSize] = useState(0);
  // Subscribe to queue changes
  useEffect(() => {
    const handleQueueChange = (newSize: number) => {
      setQueueSize(newSize);
    };

    // Subscribe to changes
    subscribeToQueueChanges(handleQueueChange);

    // Get initial size (the subscription also calls this, but belt and suspenders)
    getQueue()
      .then((queue) => setQueueSize(queue.length))
      .catch((err) => {
        console.error("Failed to get initial queue size:", err);
        setQueueSize(0);
      });

    // Unsubscribe on cleanup
    return () => {
      unsubscribeFromQueueChanges(handleQueueChange);
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  if (queueSize === 0) {
    return null; // Don't render anything if queue is empty
  }

  const queueText = queueSize === 1
    ? interpolate(t.queue.uploading, { count: queueSize })
    : interpolate(t.queue.uploadingPlural, { count: queueSize });

  return (
    <View style={styles.indicatorContainer}>
      <ActivityIndicator size="small" color={Colors.textMuted} />
      <Text style={styles.queueIndicatorText}>{` ${queueText}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  indicatorContainer: {
    position: "absolute",
    bottom: 20,
    left: 0, // Ensure it spans across if needed, adjust as necessary
    right: 0, // Ensure it spans across if needed, adjust as necessary
    flexDirection: "row", // Align items horizontally
    justifyContent: "center", // Center items horizontally
    alignItems: "center", // Center items vertically
  },
  queueIndicatorText: {
    marginLeft: 5, // Add some space between spinner and text
    fontSize: 14,
    color: Colors.textMuted, // A slightly muted color
  },
});
