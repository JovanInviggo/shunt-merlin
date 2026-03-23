import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "./Text";
import { RadioButton } from "react-native-paper";
import { Colors } from "../constants/theme";

interface RadioButtonOptionProps {
  label: string;
  value: string;
  status: "checked" | "unchecked";
  onPress: (value: string) => void;
}

export function RadioButtonOption({
  label,
  value,
  status,
  onPress,
}: RadioButtonOptionProps) {
  const handlePress = () => {
    onPress(value);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      activeOpacity={0.7}
    >
      <RadioButton.Android
        value={value}
        status={status}
        onPress={handlePress} // Keep onPress on RadioButton too for accessibility
        color={Colors.link}
        uncheckedColor={Colors.textMuted}
      />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    // Add some padding if needed, or manage spacing in the parent
    // paddingVertical: 8,
  },
  label: {
    marginLeft: 8, // Space between radio button and text
    fontSize: 16, // Match previous style
  },
});
