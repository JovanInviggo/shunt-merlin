import React, { useMemo, useEffect, useState } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Text } from './Text';
import { RecordingRow } from './RecordingRow';
import {
  Recording,
  fetchRecordingsPage,
  groupRecordingsByPeriod,
} from '../utils/recordings-service';
import { useI18n } from '../locales';
import { Colors, Fonts } from '../constants/theme';
import { getAuthStudyId } from '../utils/auth-storage';

interface RecordingsListProps {
  onEmpty?: () => void;
}

export const RecordingsList: React.FC<RecordingsListProps> = ({ onEmpty }) => {
  const { t } = useI18n();
  const [studyId, setStudyId] = useState<string | null>(null);

  useEffect(() => {
    getAuthStudyId().then(setStudyId);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['recordings', studyId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchRecordingsPage(pageParam as number),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
    maxPages: 10,
    enabled: studyId !== null,
  });

  const allRecordings: Recording[] = useMemo(
    () => data?.pages.flatMap((p) => p.recordings) ?? [],
    [data]
  );

  const grouped = useMemo(() => groupRecordingsByPeriod(allRecordings), [allRecordings]);

  const sections = useMemo(
    () =>
      [
        { title: t.recordings.thisWeek, data: grouped.thisWeek },
        { title: t.recordings.lastWeek, data: grouped.lastWeek },
        { title: t.recordings.older, data: grouped.older },
      ].filter((s) => s.data.length > 0),
    [grouped, t]
  );

  const studyIdLoaded = studyId !== null;
  const isSettled = studyIdLoaded && !isLoading;

  useEffect(() => {
    if (isSettled && !isError && allRecordings.length === 0 && onEmpty) {
      onEmpty();
    }
  }, [isSettled, isError, allRecordings.length, onEmpty]);

  if (!studyIdLoaded || isLoading) {
    return (
      <View testID="recordings-loading" style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (isError && allRecordings.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t.recordings.errorLoading}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>{t.recordings.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      onEndReached={() => { if (hasNextPage) fetchNextPage(); }}
      onEndReachedThreshold={0.3}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={Colors.primary} /> : null}
      refreshing={false}
      onRefresh={() => refetch()}
      contentContainerStyle={styles.contentContainer}
      stickySectionHeadersEnabled={false}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { fontSize: 16, color: Colors.textSecondary },
  retryButton: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary },
  retryText: { color: Colors.primary, fontSize: 15, fontFamily: Fonts.semiBold },
  sectionTitle: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: 8, letterSpacing: 0.5, paddingHorizontal: 14, paddingVertical: 8 },
});

export default RecordingsList;
