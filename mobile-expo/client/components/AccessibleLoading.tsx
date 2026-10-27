import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface AccessibleLoadingProps {
  message?: string;
  size?: "small" | "large";
  fullScreen?: boolean;
}

export function AccessibleLoading({ message = "Loading", size = "large", fullScreen = false }: AccessibleLoadingProps) {
  const { theme } = useTheme();
  return (
    <View
      style={fullScreen ? styles.fullScreen : styles.inline}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size={size} color={theme.primary} />
      <ThemedText style={[styles.text, { color: theme.textSecondary }]}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  inline: {
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    marginTop: Spacing.sm,
    fontSize: 14,
  },
});
