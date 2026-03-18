import React from "react";
import {
  StyleSheet,
  View,
  TouchableWithoutFeedback,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface OverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Called when the overlay should close */
  onClose?: () => void;
  /** Close when tapping the backdrop */
  closeOnBackdropPress?: boolean;
  /** Position of the content */
  position?: "center" | "bottom";
  /** Background color of the backdrop */
  backdropColor?: string;
  /** Opacity of the backdrop (0-1) */
  backdropOpacity?: number;
  /** Content to render inside the overlay */
  children: React.ReactNode;
  /** Whether to avoid keyboard */
  avoidKeyboard?: boolean;
  /** Whether to respect safe area insets */
  useSafeArea?: boolean;
}

export function Overlay({
  visible,
  onClose,
  closeOnBackdropPress = true,
  position = "center",
  backdropColor = "#000",
  backdropOpacity = 0.5,
  children,
  avoidKeyboard = true,
  useSafeArea = true,
}: OverlayProps) {
  const insets = useSafeAreaInsets();

  const handleBackdropPress = () => {
    if (closeOnBackdropPress && onClose) {
      onClose();
    }
  };

  const contentStyle = [
    styles.content,
    position === "bottom" && styles.contentBottom,
    position === "bottom" && useSafeArea && { paddingBottom: insets.bottom },
  ];

  const content = (
    <TouchableWithoutFeedback onPress={handleBackdropPress}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: backdropColor, opacity: backdropOpacity },
        ]}
      />
    </TouchableWithoutFeedback>
  );

  const innerContent = (
    <View style={contentStyle} pointerEvents="box-none">
      <TouchableWithoutFeedback>
        <View>{children}</View>
      </TouchableWithoutFeedback>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {content}
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            pointerEvents="box-none"
          >
            {innerContent}
          </KeyboardAvoidingView>
        ) : (
          innerContent
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contentBottom: {
    justifyContent: "flex-end",
  },
});
