import React from "react";
import { reloadAppAsync } from "expo";
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  ScrollView,
  useColorScheme,
} from "react-native";
import { Spacing, BorderRadius } from "@/constants/theme";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = {
    background: isDark ? "#121212" : "#FFFFFF",
    text: isDark ? "#F5F5F5" : "#1A1A1A",
    subtext: isDark ? "rgba(245,245,245,0.6)" : "rgba(26,26,26,0.6)",
    errorBg: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.05)",
    errorText: isDark ? "#FCA5A5" : "#DC2626",
    button: "#007AFF",
    buttonText: "#FFFFFF",
  };

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      resetError();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>
          Something went wrong
        </Text>

        <Text style={[styles.message, { color: colors.subtext }]}>
          Tabula Medica encountered an unexpected error. Please reload the app to continue.
        </Text>

        <View style={[styles.errorBox, { backgroundColor: colors.errorBg }]}>
          <Text style={[styles.errorLabel, { color: colors.errorText }]}>
            Error Details:
          </Text>
          <Text style={[styles.errorMessage, { color: colors.errorText }]} selectable>
            {error.message}
          </Text>
          {error.stack ? (
            <Text style={[styles.errorStack, { color: colors.subtext }]} selectable numberOfLines={8}>
              {error.stack.split("\n").slice(0, 6).join("\n")}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleRestart}
          testID="button-restart"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.button,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>
            Try Again
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    width: "100%",
    maxWidth: 600,
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 40,
  },
  message: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
  },
  errorBox: {
    width: "100%",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.sm,
  },
  errorLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase" as const,
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "monospace",
  },
  button: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing["2xl"],
    minWidth: 200,
  },
  buttonText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});
