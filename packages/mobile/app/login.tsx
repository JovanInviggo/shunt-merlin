import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../locales";
import { apiService } from "../utils/api-service";
import { storeAuthStudyId, storeUserType } from "../utils/auth-storage";
import { Colors, Fonts } from "../constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [studyId, setStudyId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!studyId.trim()) {
      setError(t.login.errorEmpty);
      return;
    }

    try {
      setIsLoading(true);

      const response = await apiService.login(studyId.trim());

      // Store additional auth data
      await storeAuthStudyId(response.studyId);
      await storeUserType(response.type);

      if (router.canDismiss()) router.dismissAll();
      router.replace("/guideline");
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.statusCode === 401 || err.statusCode === 404) {
        setError(t.login.errorInvalid);
      } else {
        setError(t.login.errorFailed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View>
            <Text style={styles.title}>{t.login.title}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.login.placeholder}
              value={studyId}
              onChangeText={setStudyId}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <Text style={styles.description}>{t.login.description}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? t.login.buttonLoading : t.login.button}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 30,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    marginBottom: 32,
    color: Colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: Colors.background,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 50,
    padding: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: Fonts.semiBold,
  },
  errorText: {
    color: Colors.error,
    marginBottom: 16,
    fontSize: 16,
    textAlign: "center",
  },
});
