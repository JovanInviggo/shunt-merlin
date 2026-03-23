import { StyleSheet, TouchableOpacity, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { router, usePathname } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Alert as AlertComponent } from "@/components/Alert";
import { useI18n } from "@/locales";

export default function MyHeader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const netInfo = NetInfo.useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };
  return (
    <View>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} />
        </TouchableOpacity>
        {pathname !== "/settings" && (
          <TouchableOpacity testID="settings-button" onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={24} />
          </TouchableOpacity>
        )}
      </SafeAreaView>
      {isOffline && (
        <View style={styles.alertWrap}>
          <AlertComponent severity="error" title={t.header.offlineTitle}>
            {t.header.offlineMessage}
          </AlertComponent>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  alertWrap: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
});