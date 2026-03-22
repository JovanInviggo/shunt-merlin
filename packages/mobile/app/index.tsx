import React, { useState, useEffect } from 'react';
import { Alert, TouchableOpacity, StyleSheet, Image, View } from 'react-native';
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { clearQueue } from "../utils/upload-queue";
import { RecordingsList } from "../components/RecordingsList";
import { useI18n } from "../locales";
import { Colors, Fonts } from "../constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function Index() {
  const { t } = useI18n();
  const { cancelled } = useLocalSearchParams<{ cancelled?: string }>();
  const [hasRecordings, setHasRecordings] = useState<boolean>(true);
  const [showCancelledToast, setShowCancelledToast] = useState(false);

  useEffect(() => {
    if (cancelled === "true") {
      setShowCancelledToast(true);
      const timer = setTimeout(() => setShowCancelledToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [cancelled]);

  // Show empty state while loading or when no recordings
  const showEmptyState = hasRecordings === false;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>

      {showCancelledToast && (
        <View testID="recording-cancelled-toast" style={styles.cancelledToast}>
          <Text style={styles.cancelledToastText}>{t.record.cancelledToast}</Text>
        </View>
      )}

      <Text style={styles.title}>{t.common.appTitle}</Text>

      {showEmptyState ? (
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
  cancelledToast: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: Colors.textDark,
    paddingVertical: 14,
    paddingHorizontal: 20,
    zIndex: 10,
    borderRadius: 8,
  },
  cancelledToastText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
});
