import * as FileSystem from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlayerControls } from "../components/PlayerControls";
import { RecordingForm } from "../components/RecordingForm";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useI18n } from "../locales";
import { addToQueue, Metadata } from "../utils/upload-queue";
import { Colors, Fonts } from "../constants/theme";

// Types moved to RecordingForm.tsx
type RecordingPosition =
  | "proximal"
  | "anastomose"
  | "anastomose_3cm"
  | "anastomose_8cm"
  | "engstelle";

interface RadioOption {
  value: RecordingPosition;
  label: string;
}

export default function SubmitScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { recordingPath, studyId: initialStudyId } = useLocalSearchParams<{
    recordingPath: string;
    studyId?: string;
  }>();

  // Recording position options with translations
  const recordingPositionOptions: RadioOption[] = [
    { value: "anastomose", label: t.positions.anastomose },
    { value: "anastomose_3cm", label: t.positions.anastomose_3cm },
    { value: "anastomose_8cm", label: t.positions.anastomose_8cm },
    { value: "proximal", label: t.positions.proximal },
    { value: "engstelle", label: t.positions.engstelle },
  ];

  // Audio Player Hook
  const {
    isPlaying,
    isLoading: isPlayerLoading,
    error: playerError,
    durationMillis,
    positionMillis,
    loadSound,
    togglePlayback,
  } = useAudioPlayer();

  // Form State
  const [studyId, setStudyId] = useState(initialStudyId || "");
  const [recordingPosition, setRecordingPosition] =
    useState<RecordingPosition>("anastomose");
  const [notes, setNotes] = useState("");

  // Component/Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [wasUploaded, setWasUploaded] = useState(false);
  const [isQueued, setIsQueued] = useState(false);

  // Effect to load sound
  useEffect(() => {
    if (recordingPath) {
      loadSound(recordingPath).catch(console.error);
    }
  }, [recordingPath, loadSound]);

  // Function to handle going back and discarding the recording
  const handleGoBack = () => {
    Alert.alert(
      t.submit.discardTitle,
      t.submit.discardMessage,
      [
        {
          text: t.common.cancel,
          onPress: () => null, // Do nothing, stay on the screen
          style: "cancel",
        },
        {
          text: t.submit.discardButton,
          onPress: () => {
            // Delete the recording file
            if (recordingPath) {
              FileSystem.deleteAsync(recordingPath)
                .then(() =>
                  console.log("Recording discarded via manual back button.")
                )
                .catch((err) =>
                  console.error("Failed to delete recording on discard:", err)
                );
            }
            // Navigate back without saving studyId
            router.back();
            router.setParams({ studyId: "" });
          },
          style: "destructive",
        },
      ],
      { cancelable: false } // Prevent dismissing the alert by tapping outside
    );
  };

  // Effect to handle hardware back press on Android using the extracted function
  useEffect(() => {
    const backAction = () => {
      handleGoBack();
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove(); // Clean up listener on unmount
  }, [handleGoBack]); // Dependency is now the stable handleGoBack function

  // Effect for deleting file on unmount
  useEffect(() => {
    const currentRecordingPath = recordingPath;
    return () => {
      if (!wasUploaded && !isQueued && currentRecordingPath) {
        console.log(
          "SubmitScreen unmounting, wasn't uploaded or queued. Deleting recording:",
          currentRecordingPath
        );
        FileSystem.deleteAsync(currentRecordingPath)
          .then(() =>
            console.log("Recording deleted successfully by SubmitScreen.")
          )
          .catch((deleteError) =>
            console.error(
              "Error deleting recording file in SubmitScreen cleanup:",
              deleteError
            )
          );
      } else if (wasUploaded) {
        console.log(
          "SubmitScreen unmounting after successful upload. File kept (for now)."
        );
      } else if (isQueued) {
        console.log(
          "SubmitScreen unmounting, recording queued. File kept for queue processor."
        );
      }
    };
    // Only re-run cleanup function if path changes; state check happens at time of cleanup
  }, [recordingPath, wasUploaded, isQueued]);

  // Navigation Handler
  const navigateBackAfterAction = (andNext: boolean) => {
    console.log("studyId", studyId);
    console.log("andNext", andNext);
    router.back();

    router.setParams(andNext ? { studyId: studyId.trim() } : { studyId: "" });
  };

  // Upload Handler
  const handleUpload = async (andNext: boolean) => {
    if (!studyId) {
      Alert.alert(t.common.error, t.submit.errorNoStudyId);
      return;
    }
    if (!recordingPath) {
      Alert.alert(t.common.error, t.submit.errorNoPath);
      return;
    }

    setIsUploading(true);
    const timestamp = new Date().toISOString();
    const metadata: Metadata = {
      studyId: studyId.trim(),
      location: recordingPosition,
      notes: notes.trim(),
      timestamp: timestamp,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
    };
    // const baseKey = `${metadata.studyId}/${metadata.timestamp}`; // No longer needed for direct upload

    try {
      // Always add to queue instead of attempting direct upload first
      await addToQueue(recordingPath, metadata);
      setIsQueued(true); // Mark as queued immediately
      setWasUploaded(false); // Ensure wasUploaded is false if previously set
      Alert.alert(
        t.submit.queuedTitle,
        t.submit.queuedMessage,
        [{ text: t.common.ok, onPress: () => navigateBackAfterAction(andNext) }]
      );
    } catch (error) {
      console.error("Error adding recording to queue:", error);
      // Keep existing error handling for queue failure
      Alert.alert(t.common.error, t.submit.queueErrorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // Main Render
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t.submit.title}</Text>

          <PlayerControls
            isPlaying={isPlaying}
            isLoading={isPlayerLoading}
            error={playerError}
            durationMillis={durationMillis}
            positionMillis={positionMillis}
            recordingPath={recordingPath}
            onTogglePlayback={togglePlayback}
          />

          <View style={styles.divider} />

          <RecordingForm
            studyId={studyId}
            setStudyId={setStudyId}
            recordingPosition={recordingPosition}
            setRecordingPosition={setRecordingPosition}
            notes={notes}
            setNotes={setNotes}
            recordingPositionOptions={recordingPositionOptions}
          />

          <View style={styles.divider} />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.uploadButton,
                isUploading && styles.buttonDisabled,
              ]}
              onPress={() => handleUpload(false)}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t.submit.uploadButton}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.uploadNextButton,
                isUploading && styles.buttonDisabled,
              ]}
              onPress={() => handleUpload(true)}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t.submit.uploadNextButton}</Text>
              )}
            </TouchableOpacity>
            {/* Manual Go Back Button */}
            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={handleGoBack}
              disabled={isUploading} // Also disable if uploading
            >
              <Text style={styles.buttonText}>{t.submit.backDiscardButton}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles kept in SubmitScreen (related to layout, buttons, loading)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.semiBold,
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 10,
    marginTop: 20,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  uploadButton: {
    backgroundColor: Colors.link,
  },
  uploadNextButton: {
    backgroundColor: "#34C759",
  },
  backButton: {
    backgroundColor: Colors.error,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 20,
  },
});
