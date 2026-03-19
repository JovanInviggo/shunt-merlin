import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
  Animated,
} from "react-native";
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { LiveWaveform } from "../components/live-waveform";
import { QueueIndicator } from "../components/QueueIndicator";
import { useAudioRecording } from "../hooks/useAudioRecording";
import { useI18n } from "../locales";
import { CountdownTimer, ProgressTimer } from "@/components/timers";
import PhonePosition from "@/components/guidelines/PhonePosition";
import LowSignalOverlay from "../components/LowSignalOverlay";
import { addToQueue, Metadata } from "../utils/upload-queue";
import { getAuthStudyId } from "../utils/auth-storage";
import { Colors, Fonts } from "../constants/theme";
import type { AudioQualityResult } from "../hooks/useAudioRecording";

const MAX_RECORDING_DURATION = 30;

const strongVibrate = async () => {
  if (Platform.OS === "android") {
    Vibration.vibrate([0, 250, 80, 250]);
  } else {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
    await new Promise((r) => setTimeout(r, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
    await new Promise((r) => setTimeout(r, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
  }
};

export default function RecordScreen() {
  const params = useLocalSearchParams<{ studyId?: string }>();
  const { t } = useI18n();
  const [currentStudyId, setCurrentStudyId] = useState(params.studyId || "");
  const [showPhonePosition, setShowPhonePosition] = useState(true);
  const [cancelled, setCancelled] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [showLowSignal, setShowLowSignal] = useState(false);
  const failedAttemptsRef = useRef(0);
  const qualityResultRef = useRef<AudioQualityResult | null>(null);
  const studyIdRef = useRef(currentStudyId);
  studyIdRef.current = currentStudyId;
  const hasQueuedRef = useRef(false);
  const cancelRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const phoneOverlayAnim = useRef(new Animated.Value(1)).current;
  const recordScreenAnim = useRef(new Animated.Value(0)).current;

  // Load studyId from auth storage if not provided via params
  useEffect(() => {
    if (!currentStudyId) {
      getAuthStudyId().then((id) => {
        if (id) setCurrentStudyId(id);
      });
    }
  }, []);

  // Keep permission status fresh — re-check whenever the app comes back to the foreground
  // so that returning from Settings takes effect on the next tap without showing an alert.
  const micPermissionRef = useRef<string | null>(null);
  useEffect(() => {
    const permission = Platform.OS === "ios" ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
    const checkPermission = async () => {
      try {
        const result = await check(permission);
        micPermissionRef.current = result;
      } catch {
        micPermissionRef.current = null;
      }
    };

    checkPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermission();
    });
    return () => subscription.remove();
  }, []);

  const queueAndGoHome = useCallback(async (
    path: string,
    studyId: string,
    qualityResult?: AudioQualityResult | null,
  ) => {
    const metadata: Metadata = {
      studyId,
      location: "",
      notes: "",
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      ...(qualityResult != null && {
        audioQualityFlags: {
          wouldHaveBeenFlagged: qualityResult.isLowSignal,
          medianPeak: qualityResult.medianPeak,
          maxWindowPeak: qualityResult.maxWindowPeak,
          artifactRatio: qualityResult.artifactRatio,
          hasArtifacts: qualityResult.hasArtifacts,
          windowPeaks: qualityResult.windowPeaks,
        },
      }),
    };
    await addToQueue(path, metadata);
    router.replace("/");
  }, []);

  const handleQualityCheck = useCallback(async (quality: AudioQualityResult) => {
    qualityResultRef.current = quality; // capture, never block
  }, []);

  const handleAutoStop = useCallback(async (path: string | null) => {
    // Guard against being called multiple times
    if (hasQueuedRef.current) return;
    hasQueuedRef.current = true;
    setRecordingComplete(true);

    await strongVibrate();

    // Wait before proceeding
    await new Promise((resolve) => setTimeout(resolve, 7000));

    const studyId = studyIdRef.current;
    if (!path || !studyId) {
      router.replace("/");
      return;
    }

    await queueAndGoHome(path, studyId, qualityResultRef.current);
  }, [queueAndGoHome]);

  const [isPaused, setIsPaused] = useState(false);

  const {
    isRecording,
    duration,
    startRecording,
    cancelRecording,
    addChunkListener,
    pauseTimer,
    resumeTimer,
  } = useAudioRecording({
    maxDuration: MAX_RECORDING_DURATION,
    onAutoStop: handleAutoStop,
    qualityCheckAt: 5,
    onQualityCheck: handleQualityCheck,
  });
  cancelRecordingRef.current = cancelRecording;

  useEffect(() => {
    setCurrentStudyId(params.studyId || "");
  }, [params.studyId]);

  const cancelRecordingAlert = () =>
    Alert.alert(t.record.cancelTitle, t.record.cancelMessage, [
      { text: t.common.ok, onPress: () => handleStop() },
    ]);

  const handleStop = async () => {
    setCancelled(true);
    hasQueuedRef.current = true;
    if (isRecording) {
      await cancelRecording();
    }
    router.replace("/");
  };

  const vibrateAndStartRecording = async () => {
    hasQueuedRef.current = false;
    await strongVibrate();
    startRecording();
  };

  const handleLowSignalRetry = useCallback(() => {
    setShowLowSignal(false);
    setRecordingComplete(false);
    setCancelled(false);
    hasQueuedRef.current = false;
    router.replace("/record");
  }, []);

  const showMicAlert = () => {
    Alert.alert(
      t.record.micPermissionTitle,
      t.record.micPermissionMessage,
      [
        { text: t.common.cancel, style: "cancel" },
        { text: t.record.micPermissionOpenSettings, onPress: () => Linking.openSettings() },
      ]
    );
  };

  const handleStartFromPhonePosition = async () => {
    try {
      const permission = Platform.OS === "ios" ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
      let result = micPermissionRef.current ?? await check(permission);

      if (result === RESULTS.DENIED) {
        result = await request(permission);
      }

      micPermissionRef.current = result;

      if (result !== RESULTS.GRANTED && result !== RESULTS.LIMITED) {
        showMicAlert();
        return;
      }
    } catch (e) {
      console.error("Microphone permission check failed:", e);
      showMicAlert();
      return;
    }

    Animated.timing(phoneOverlayAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowPhonePosition(false);
      recordScreenAnim.setValue(0);
      Animated.timing(recordScreenAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  return (
    <>
      <LowSignalOverlay
        visible={showLowSignal}
        onRetry={handleLowSignalRetry}
      />
      {showPhonePosition && (
        <Animated.View
          style={{
            flex: 1,
            opacity: phoneOverlayAnim,
            transform: [
              {
                translateX: phoneOverlayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          }}
        >
          <PhonePosition
            showCancelButton={true}
            onCancelPress={() => handleStop()}
            buttonText={t.record.startRecording}
            showHeader={false}
            onButtonPress={handleStartFromPhonePosition}
          />
        </Animated.View>
      )}
      {!showPhonePosition && (
        <Animated.View
          style={{
            flex: 1,
            opacity: recordScreenAnim,
            transform: [
              {
                translateX: recordScreenAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <SafeAreaView
            style={styles.container}
            edges={["top", "left", "right", "bottom"]}
          >
            <TouchableOpacity onPress={cancelRecordingAlert} style={styles.closeButton}>
              <Ionicons name="close" size={18} style={styles.closeButtonIcon} />
            </TouchableOpacity>

            {!isRecording && !recordingComplete && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingIndicatorText}>
                  {t.record.startingIn}
                </Text>
              </View>
            )}

            {isRecording && !recordingComplete && (
              <View style={styles.recordingIndicator}>
                <Text style={styles.recordingIndicatorText}>
                  {t.record.inProgress}
                </Text>
              </View>
            )}

            {recordingComplete && (
              <View style={styles.completedContainer}>
                <Text style={styles.completeText}>
                  {t.record.complete}
                </Text>
                <Text style={styles.completeMessage}>
                  {t.record.completeMessage}
                </Text>
              </View>
            )}

            {/* Centered timer + waveform */}
            <View style={styles.mainContent}>
              <View style={styles.timerContainer}>
                {(isRecording || recordingComplete) && (
                  <ProgressTimer
                    duration={duration}
                    maxDuration={MAX_RECORDING_DURATION}
                  />
                )}
                {!isRecording && !cancelled && !recordingComplete && (
                  <CountdownTimer
                    seconds={5}
                    autoStart={true}
                    chunked
                    onComplete={() => vibrateAndStartRecording()}
                  />
                )}
              </View>

              {isRecording && (
                <View style={styles.waveformContainer}>
                  <LiveWaveform
                    isRecording={isRecording}
                    addChunkListener={addChunkListener}
                    recording={null}
                  />
                </View>
              )}
            </View>

            {/* Bottom content */}
            <View style={styles.bottomContent}>
              <QueueIndicator />
            </View>

            {/* DEV-only buttons */}
            {__DEV__ && isRecording && (
              <View style={styles.devButtonRow}>
                <TouchableOpacity
                  onPress={() => {
                    if (isPaused) {
                      resumeTimer();
                      setIsPaused(false);
                    } else {
                      pauseTimer();
                      setIsPaused(true);
                    }
                  }}
                  style={styles.devButton}
                >
                  <Text style={styles.devButtonText}>
                    {isPaused ? "▶ Resume" : "⏸ Pause"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="dev-simulate-low-signal"
                  onPress={async () => {
                    hasQueuedRef.current = true;
                    await cancelRecording();
                    setShowLowSignal(true);
                  }}
                  style={styles.devButton}
                >
                  <Text style={styles.devButtonText}>⚠ Low Signal</Text>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0FFFF",
  },
  mainContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  waveformContainer: {
    alignItems: "center",
  },
  bottomContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  studyIdBadge: {
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  recordingIndicator: {

  },
  closeButton: {
    alignSelf: "flex-end",
    width: 32,
    height: 32,
    margin: 10,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonIcon: {
    color: "#8F909F",
  },
  recordingIndicatorText: {
    color: Colors.textDark,
    fontSize: 22,
    fontFamily: Fonts.bold,
    textAlign: "center",
  },
  completeText: {
    color: Colors.textDark,
    fontSize: 22,
    fontFamily: Fonts.bold,
    textAlign: "left",
  },
  completeMessage: {
    color: Colors.textDark,
    fontSize: 16,
    textAlign: "left",
  },
  completedContainer: {
    alignSelf: "stretch",
    paddingHorizontal: 20,
  },
  studyIdText: {
    fontSize: 14,
    color: "#333",
  },
  clearIdButton: {
    marginLeft: 10,
    padding: 5,
  },
  clearIdButtonText: {
    fontSize: 18,
    color: "#888",
    fontFamily: Fonts.bold,
  },
  devButtonRow: {
    position: "absolute",
    bottom: 80,
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  devButton: {
    backgroundColor: "rgba(255, 80, 0, 0.85)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  devButtonText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  recordButton: {
    width: "90%",
    borderRadius: 75,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 20,
    paddingVertical: 15,
    paddingHorizontal: 40
  },
  recordingButtonActive: {
    backgroundColor: Colors.textMuted,
  },
  recordButtonText: {
    color: "#fff",
    fontSize: 20,
    textAlign: "center",
  },
  durationText: {
    fontSize: 16,
    color: "#3C3C43",
    marginTop: 10,
  },
});
