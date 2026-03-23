import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "./Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Fonts } from "../constants/theme";
import { useI18n } from "../locales";

interface LowSignalOverlayProps {
  visible: boolean;
  onRetry: () => void;
}

function CheckItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <Ionicons name="checkmark" size={20} color={Colors.primary} style={styles.checkIcon} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

function HelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.helpBackdrop}>
        <View style={styles.helpSheet}>
          <Text style={styles.helpTitle}>{t.lowSignal.helpTitle}</Text>
          <Text style={styles.helpBody}>{t.lowSignal.helpBody}</Text>
          <Text style={styles.helpContact}>office@shuntwizard.com</Text>
          <TouchableOpacity style={styles.helpClose} onPress={onClose}>
            <Text style={styles.helpCloseText}>{t.lowSignal.helpClose}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function LowSignalOverlay({ visible, onRetry }: LowSignalOverlayProps) {
  const { t } = useI18n();
  const [showHelp, setShowHelp] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(24);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.animatedContainer, { opacity, transform: [{ translateY }] }]}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <Text style={styles.title}>{t.lowSignal.title}</Text>
          <Text style={styles.subtitle}>{t.lowSignal.subtitle}</Text>

          <View style={styles.checklist}>
            <CheckItem text={t.lowSignal.check1} />
            <CheckItem text={t.lowSignal.check2} />
          </View>

          <Image
            source={require("../assets/images/position-phone-guideline.png")}
            style={styles.image}
            resizeMode="contain"
          />

          <TouchableOpacity onPress={() => setShowHelp(true)}>
            <Text style={styles.needHelp}>{t.lowSignal.needHelp}</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="reload" size={20} color="#fff" style={styles.retryIcon} />
          <Text style={styles.retryText}>{t.lowSignal.newRecording}</Text>
        </TouchableOpacity>

        <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.textDark,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#555",
    alignSelf: "flex-start",
    marginBottom: 20,
    lineHeight: 22,
  },
  checklist: {
    alignSelf: "stretch",
    marginBottom: 24,
    gap: 14,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkIcon: {
    marginTop: 1,
  },
  checkText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.textDark,
    lineHeight: 22,
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  needHelp: {
    fontSize: 15,
    color: Colors.primary,
    textDecorationLine: "underline",
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    borderRadius: 75,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 16,
    gap: 10,
  },
  retryIcon: {},
  retryText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: Fonts.bold,
  },
  // Help modal
  helpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  helpSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 28,
    paddingBottom: 40,
    gap: 12,
  },
  helpTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textDark,
  },
  helpBody: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
  },
  helpContact: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  helpClose: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 75,
    paddingVertical: 14,
    alignItems: "center",
  },
  helpCloseText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});
