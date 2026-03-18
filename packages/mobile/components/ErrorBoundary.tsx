import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Text";
import { Colors, Fonts } from "../constants/theme";
import { useI18n } from "../locales";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.semiBold,
    color: Colors.textDark,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  button: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 75,
  },
  buttonText: {
    color: "white",
    fontFamily: Fonts.semiBold,
    fontSize: 16,
  },
});

function ErrorBoundaryContent({ onReset }: { onReset: () => void }) {
  const { t } = useI18n();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t.errorBoundary.title}</Text>
        <Text style={styles.subtitle}>{t.errorBoundary.message}</Text>
        <TouchableOpacity style={styles.button} onPress={onReset}>
          <Text style={styles.buttonText}>{t.errorBoundary.tryAgain}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return <ErrorBoundaryContent onReset={this.handleReset} />;
  }
}
