import React, { useEffect, useState } from "react";
import {
  View,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Text } from "./Text";
import { RecordingRow } from "./RecordingRow";
import {
  Recording,
  getMergedRecordings,
  groupRecordingsByPeriod,
  subscribeToRecordingsChanges,
} from "../utils/recordings-service";
import { useI18n } from "../locales";
import { Colors, Fonts } from "../constants/theme";

interface RecordingsListProps {
  onEmpty?: () => void;
}

export const RecordingsList: React.FC<RecordingsListProps> = ({ onEmpty }) => {
  const { t } = useI18n();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToRecordingsChanges(({ recordings: newRecordings, totalPages: newTotalPages, apiError: newApiError }) => {
      setRecordings(newRecordings);
      setTotalPages(newTotalPages);
      setCurrentPage(1);
      setApiError(newApiError);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const { recordings: newRecordings, totalPages: newTotalPages, apiError: newApiError } = await getMergedRecordings(1);
    setRecordings(newRecordings);
    setTotalPages(newTotalPages);
    setCurrentPage(1);
    setApiError(newApiError);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || currentPage >= totalPages) return;
    setLoadingMore(true);
    const { recordings: more, apiError: moreError } = await getMergedRecordings(currentPage + 1);
    if (!moreError) {
      setRecordings((prev) => [...prev, ...more]);
      setCurrentPage((p) => p + 1);
    }
    setLoadingMore(false);
  };

  // Notify parent when truly empty (not just an API error)
  useEffect(() => {
    if (!loading && !apiError && recordings.length === 0 && onEmpty) {
      onEmpty();
    }
  }, [loading, apiError, recordings.length, onEmpty]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (recordings.length === 0) {
    if (apiError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t.recordings.errorLoading}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryText}>{t.recordings.retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null; // Parent handles the no-recordings empty state
  }

  const grouped = groupRecordingsByPeriod(recordings);
  const sections = [
    { title: t.recordings?.thisWeek || "THIS WEEK", data: grouped.thisWeek },
    { title: t.recordings?.lastWeek || "LAST WEEK", data: grouped.lastWeek },
    { title: t.recordings?.older || "OLDER", data: grouped.older },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      testID="recordings-list"
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <RecordingRow recording={item} />}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} /> : null}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={styles.contentContainer}
      stickySectionHeadersEnabled={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
});

export default RecordingsList;
