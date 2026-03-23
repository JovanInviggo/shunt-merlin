import React from "react";
import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { Fonts } from "../constants/theme";

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[styles.default, style]} {...props} />;
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.regular,
  },
});
