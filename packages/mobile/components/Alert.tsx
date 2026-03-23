import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Text } from "./Text";
import { Ionicons } from "@expo/vector-icons";
import { Fonts } from "../constants/theme";

export type AlertSeverity = "success" | "error" | "warning" | "info";

export interface AlertProps {
  severity: AlertSeverity;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "filled" | "outlined" | "standard";
}

const severityConfig: Record<
  AlertSeverity,
  {
    icon: keyof typeof Ionicons.glyphMap;
    bgColor: string;
    bgColorFilled: string;
    borderColor: string;
    textColor: string;
    textColorFilled: string;
    iconColor: string;
  }
> = {
  success: {
    icon: "checkmark-circle",
    bgColor: "#EDF7ED",
    bgColorFilled: "#4CAF50",
    borderColor: "#4CAF50",
    textColor: "#1E4620",
    textColorFilled: "#FFFFFF",
    iconColor: "#4CAF50",
  },
  error: {
    icon: "alert-circle",
    bgColor: "#FF927E",
    bgColorFilled: "#F44336",
    borderColor: "#F44336",
    textColor: "#561624",
    textColorFilled: "#FFFFFF",
    iconColor: "#BB4141",
  },
  warning: {
    icon: "warning",
    bgColor: "#FFF4E5",
    bgColorFilled: "#FF9800",
    borderColor: "#FF9800",
    textColor: "#663C00",
    textColorFilled: "#FFFFFF",
    iconColor: "#FF9800",
  },
  info: {
    icon: "information-circle",
    bgColor: "#E5F6FD",
    bgColorFilled: "#2196F3",
    borderColor: "#2196F3",
    textColor: "#014361",
    textColorFilled: "#FFFFFF",
    iconColor: "#2196F3",
  },
};

export const Alert: React.FC<AlertProps> = ({
  severity,
  title,
  children,
  onClose,
  icon,
  action,
  variant = "standard",
}) => {
  const config = severityConfig[severity];

  const isFilled = variant === "filled";
  const isOutlined = variant === "outlined";

  const backgroundColor = isFilled ? config.bgColorFilled : config.bgColor;
  const textColor = isFilled ? config.textColorFilled : config.textColor;
  const iconColor = isFilled ? config.textColorFilled : config.iconColor;
  const borderWidth = isOutlined ? 1 : 0;
  const borderColor = isOutlined ? config.borderColor : "transparent";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderWidth,
          borderColor,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {icon || (
          <Ionicons name={config.icon} size={22} color={iconColor} />
        )}
      </View>

      <View style={styles.content}>
        {title && (
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        )}
        <Text style={[styles.message, { color: textColor }]}>{children}</Text>
      </View>

      {action && <View style={styles.actionContainer}>{action}</View>}

      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={textColor} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  iconContainer: {
    marginRight: 12,
    paddingTop: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionContainer: {
    marginLeft: 8,
    justifyContent: "center",
  },
  closeButton: {
    marginLeft: 8,
    padding: 2,
  },
});

export default Alert;
