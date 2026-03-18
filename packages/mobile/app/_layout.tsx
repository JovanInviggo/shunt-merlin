import "react-native-get-random-values";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  SourceSansPro_400Regular,
  SourceSansPro_600SemiBold,
  SourceSansPro_700Bold,
} from "@expo-google-fonts/source-sans-pro";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import "react-native-reanimated";
import { initializeQueueProcessing, stopQueueProcessing } from "../utils/upload-queue";
import { apiService } from "../utils/api-service";
import { Colors } from "../constants/theme";
import { I18nProvider } from "../locales";

import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuthCheck } from "../hooks/useAuthCheck";
import MyHeader from "../components/Header";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { stopAllAudio } from "../hooks/useAudioPlayer";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Wire up logout handler at module level — ensures it's set before any component
// mounts or effect runs, with no dependency on React's lifecycle.
apiService.setLogoutHandler(() => {
  stopQueueProcessing();
  stopAllAudio();
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  // Stop any playing audio on every screen transition
  useEffect(() => {
    stopAllAudio();
  }, [pathname]);

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    SourceSansPro_400Regular,
    SourceSansPro_600SemiBold,
    SourceSansPro_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    const cleanup = initializeQueueProcessing();
    return cleanup;
  }, []);
  const { isChecking } = useAuthCheck();

  return (
    <ErrorBoundary>
    <I18nProvider initialLanguage="de">
      <PaperProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerShown: true,
              header: () => <MyHeader />,
              contentStyle: { backgroundColor: Colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="record" options={{ headerShown: false }} />
            <Stack.Screen name="submit" />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="guideline" options={{ headerShown: false }} />
            <Stack.Screen name="recording-overview" options={{ headerShown: false }} />
          </Stack>
          {isChecking && (
            <View style={styles.authOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </I18nProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  authOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
