import React, { useState, useEffect } from 'react';
import { Alert, TouchableOpacity, StyleSheet, Image, View } from 'react-native';
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { clearQueue } from "../utils/upload-queue";
import { RecordingsList } from "../components/RecordingsList";
import { getMergedRecordings } from "../utils/recordings-service";
import { useI18n } from "../locales";
import { Colors, Fonts } from "../constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function Index() {
  const { t } = useI18n();
  const [hasRecordings, setHasRecordings] = useState<boolean | null>(null);

  useEffect(() => {
    getMergedRecordings().then(({ recordings, apiError }) => {
      // On API error with no local queue items, let RecordingsList show the error state
      if (apiError && recordings.length === 0) {
        setHasRecordings(true); // mount RecordingsList so it can show retry
      } else {
        setHasRecordings(recordings.length > 0);
      }
    });
  }, []);

  // Show empty state while loading or when no recordings
  const showEmptyState = hasRecordings === false;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      <Text style={styles.title}>{t.common.appTitle}</Text>

      {hasRecordings === null ? (
        // Loading state
        <View style={styles.contentBlock} />
      ) : showEmptyState ? (
        // Empty state
        <View style={styles.contentBlock}>
          <Image source={require('../assets/images/wave.png')} />
          <Text style={styles.wrappingText}>
            {t.recordings.emptyState}
          </Text>
        </View>
      ) : (
        // Recordings list
        <RecordingsList onEmpty={() => setHasRecordings(false)} />
      )}

      <TouchableOpacity style={styles.button} onPress={() => router.push('/record')}>
        <Ionicons name="add-outline" size={24} color="white" />

        <Text style={styles.buttonText}>
          {t.recordings.newButton}
        </Text>
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity style={styles.clearQueueButton} onPress={() => {
          Alert.alert("Clear Queue!", "Delete all queued recordings?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clear", style: "destructive", onPress: async () => {
                await clearQueue();
                setHasRecordings(false);
              }
            },
          ]);
        }}>
          <Text style={styles.clearQueueText}>Clear upload queue</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 10,
  },
  contentBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrappingText: {
    flexShrink: 1,
    color: '#595C6A',
    textAlign: 'center',
    fontSize: 18,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.semiBold,
    color: 'black',
    textAlign: 'left',
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  button: {
    alignSelf: 'center',
    width: '60%',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 75,
    paddingHorizontal: 8,
    marginTop: 8,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontFamily: Fonts.bold,
    fontSize: 18,
    marginLeft: 8,
  },
  clearQueueButton: {
    alignSelf: 'center',
    marginTop: 12,
    padding: 10,
  },
  clearQueueText: {
    color: Colors.destructive,
    fontSize: 14,
  },
});
