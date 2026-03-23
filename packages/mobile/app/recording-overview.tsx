import React, { useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Alert as AlertComponent, AlertSeverity } from "../components/Alert";
import {
  AnalysisResult,
  AnalysisStatus,
  fetchRecordingAnalysis,
  resolveAudioUriForQuery,
} from "../utils/recordings-service";
import { formatRelativeTime, formatTime } from "../utils/recording-row-utils";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { StaticWaveform } from "../components/StaticWaveform";
import { useI18n } from "../locales";
import { Colors, Fonts } from "../constants/theme";
import { useQuery } from "@tanstack/react-query";

const analysisStatusToSeverity: Record<AnalysisStatus, AlertSeverity> = {
  no_abnormalities: "success",
  unclear: "warning",
  abnormalities_detected: "error",
};

export default function RecordingOverviewScreen() {
  const params = useLocalSearchParams<{
    id: string;
    timestamp: string;
    s3Key: string;
    localPath: string;
    status: string;
  }>();

  const { t } = useI18n();

  const { isPlaying, isLoading, positionMillis, durationMillis, loadSound, togglePlayback } =
    useAudioPlayer();

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['recording-analysis', params.id],
    queryFn: () => fetchRecordingAnalysis(params.id),
    enabled: !!params.id,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

  const recording = {
    id: params.id,
    localPath: params.localPath,
    s3Key: params.s3Key,
    studyId: '',
    timestamp: '',
    status: 'uploaded' as const,
  };
  const { data: audioPath } = useQuery({
    queryKey: ['audio-url', params.id],
    queryFn: () => resolveAudioUriForQuery(recording),
    staleTime: 14.5 * 60_000,
    gcTime: 14.5 * 60_000,
    enabled: !!params.id,
  });

  // Auto-load sound as soon as the path is available
  useEffect(() => {
    if (audioPath) {
      loadSound(audioPath);
    }
  }, [audioPath, loadSound]);

  const handlePlayPress = async () => {
    await togglePlayback();
  };

  const remainingTime = durationMillis - positionMillis;

  const getAnalysisStrings = (status: AnalysisStatus) => {
    const map = {
      no_abnormalities: t.recordingOverview.noAbnormalities,
      unclear: t.recordingOverview.unclear,
      abnormalities_detected: t.recordingOverview.abnormalities,
    };
    return map[status];
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.common.appTitle}</Text>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/settings")}
          >
            <Ionicons name="settings-outline" size={22} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Title section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{t.recordingOverview.title}</Text>
          <Text style={styles.subtitle}>
            {params.timestamp ? formatRelativeTime(params.timestamp) : ""}
          </Text>
        </View>

        {/* Waveform + playback */}
        <View style={styles.playerCard}>
          <View style={styles.waveformContainer}>
            <StaticWaveform
              recordingPath={audioPath ?? ""}
              positionMillis={positionMillis}
              durationMillis={durationMillis}
            />
          </View>
          <View style={styles.playbackControls}>
            <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
            <TouchableOpacity
              onPress={handlePlayPress}
              style={styles.playButton}
              disabled={isLoading || durationMillis === 0}
            >
              {isLoading || durationMillis === 0 ? (
                <ActivityIndicator size="large" color={Colors.primary} />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause-circle" : "play-circle"}
                  size={44}
                  color={Colors.primary}
                />
              )}
            </TouchableOpacity>
            <Text style={styles.timeText}>
              -{formatTime(remainingTime > 0 ? remainingTime : durationMillis)}
            </Text>
          </View>
        </View>

        {/* AI Analysis card */}
        <View style={styles.analysisCard}>
          <Text style={styles.whatDoesThisMean}>
            {t.recordingOverview.thankYou}
          </Text>
          {/* <Text style={styles.analysisLabel}>{t.recordingOverview.aiAnalysis}</Text>
          <Text style={styles.analysisHeading}>{t.recordingOverview.question}</Text>
          <Text style={styles.analysisDescription}>{t.recordingOverview.modelDescription}</Text>

          {analysisLoading ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginVertical: 16 }} />
          ) : analysis ? (
            <>
              <View style={styles.alertWrapper}>
                <AlertComponent
                  severity={analysisStatusToSeverity[analysis.status]}
                  title={getAnalysisStrings(analysis.status).title}
                >
                  {getAnalysisStrings(analysis.status).description}
                </AlertComponent>
              </View>

              <Text style={styles.whatDoesThisMean}>
                {t.recordingOverview.whatDoesThisMean}
              </Text>
              <Text style={styles.explanationText}>
                {getAnalysisStrings(analysis.status).explanation}
              </Text>
            </>
          ) : null} */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: "#000",
  },
  headerIcon: {
    padding: 4,
  },
  titleSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: "#000",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  playerCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  waveformContainer: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  playbackControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  playButton: {
    padding: 4,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    minWidth: 45,
  },
  analysisCard: {
    backgroundColor: "#ffffff",
    padding: 24,
  },
  analysisLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: "#8E8EA0",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  analysisHeading: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: "#000000",
    marginBottom: 8,
  },
  analysisDescription: {
    fontSize: 14,
    color: "#737585",
    lineHeight: 20,
    marginBottom: 16,
  },
  alertWrapper: {
    marginBottom: 16,
  },
  whatDoesThisMean: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: "#000000",
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: "#737585",
    lineHeight: 22,
  },
});
