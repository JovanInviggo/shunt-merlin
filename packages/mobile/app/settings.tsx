import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n, Language } from "../locales";
import { apiService } from "../utils/api-service";
import { getAuthStudyId } from "../utils/auth-storage";
import { Colors, Fonts } from "../constants/theme";

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
}

function SettingsRow({ label, value, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {onPress && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useI18n();
  const [studyId, setStudyId] = useState<string | null>(null);

  const appVersion = Constants.expoConfig?.version || "1.0.0";

  const toggleLanguage = () => {
    const newLanguage: Language = language === "en" ? "de" : "en";
    setLanguage(newLanguage);
  };

  const languageDisplay = language === "en" ? "English" : "Deutsch";

  useEffect(() => {
    const loadStudyId = async () => {
      const id = await getAuthStudyId();
      setStudyId(id);
    };
    loadStudyId();
  }, []);

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t.record.logoutTitle,
      t.record.logoutMessage,
      [
        { text: t.common.cancel, style: "cancel" },
        {
          text: t.record.logout,
          style: "destructive",
          onPress: async () => {
            await apiService.logout();
            if (router.canDismiss()) router.dismissAll();
            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title}>{t.settings.title}</Text>

      {/* Content */}
      <View style={styles.content}>
        {/* Account Section */}
        <Text style={styles.sectionHeader}>{t.settings.accountSection}</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            label={t.settings.studyIdLabel}
            value={studyId || "-"}
          />
          <View style={styles.rowDivider} />

          <SettingsRow
            label={t.settings.languageLabel}
            value={languageDisplay}
            onPress={toggleLanguage}
          />
        </View>

        {/* Legal Section */}
        <Text style={styles.sectionHeader}>{t.settings.legalSection}</Text>
        <View style={styles.sectionContent}>
          <SettingsRow
            label={t.settings.consentsLabel}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label={t.settings.legalDisclosureLabel}
          />
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.versionText}>
            {t.settings.version} {appVersion}
          </Text>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>{t.record.logout}</Text>
          </TouchableOpacity>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF9F6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerSpacer: {
    width: 40,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.textDark,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 20,
  },
  sectionContent: {
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  rowLabel: {
    fontSize: 18,
    color: "#1C1C1E",
    fontFamily: Fonts.semiBold,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowValue: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#E5E5EA",
  },
  spacer: {
    flex: 1,
  },
  bottomSection: {
    paddingBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: Colors.destructive,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  deleteButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: Colors.destructive,
    fontSize: 16,
  },
});
