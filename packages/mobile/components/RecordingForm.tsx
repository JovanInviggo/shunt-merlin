import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Text } from "./Text";
import { RadioButton } from "react-native-paper";
import { useI18n } from "../locales";
import { RadioButtonOption } from "./RadioButtonOption";
import { Colors, Fonts } from "../constants/theme";

// Types copied from submit.tsx
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

interface RecordingFormProps {
  studyId: string;
  setStudyId: (value: string) => void;
  recordingPosition: RecordingPosition;
  setRecordingPosition: (value: RecordingPosition) => void;
  notes: string;
  setNotes: (value: string) => void;
  recordingPositionOptions: RadioOption[];
}

export function RecordingForm({
  studyId,
  setStudyId,
  recordingPosition,
  setRecordingPosition,
  notes,
  setNotes,
  recordingPositionOptions,
}: RecordingFormProps) {
  const { t } = useI18n();

  return (
    <View style={styles.formContainer}>
      <Text style={styles.label}>{t.form.studyIdLabel}</Text>
      <TextInput
        style={styles.input}
        value={studyId}
        onChangeText={setStudyId}
        placeholder={t.form.studyIdPlaceholder}
      />

      <View style={styles.divider} />

      <Text style={styles.label}>{t.form.positionLabel}</Text>
      <RadioButton.Group
        onValueChange={(value: string) =>
          setRecordingPosition(value as RecordingPosition)
        }
        value={recordingPosition}
      >
        {recordingPositionOptions.map((option) => (
          <RadioButtonOption
            key={option.value}
            label={option.label}
            value={option.value}
            status={
              recordingPosition === option.value ? "checked" : "unchecked"
            }
            onPress={(value) =>
              setRecordingPosition(value as RecordingPosition)
            }
          />
        ))}
      </RadioButton.Group>

      <View style={styles.divider} />

      <Text style={styles.label}>{t.form.notesLabel}</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder={t.form.notesPlaceholder}
        multiline
      />
    </View>
  );
}

// Styles copied and adapted from submit.tsx
const styles = StyleSheet.create({
  formContainer: {
    gap: 15,
  },
  label: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: "top",
  },
  // radioOption: { // Style might be within RadioButtonOption component itself
  //   flexDirection: "row",
  //   alignItems: "center",
  // },
  divider: {
    height: 1,
    backgroundColor: Colors.primary,
    marginVertical: 20,
  },
});
