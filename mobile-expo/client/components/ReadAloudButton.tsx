import React, { useState, useCallback, useEffect } from "react";
import { Pressable, View, StyleSheet, Platform } from "react-native";
import * as Speech from "expo-speech";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAccessibility } from "@/context/AccessibilityContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ReadAloudButtonProps {
  text: string;
  label?: string;
  compact?: boolean;
  style?: any;
}

export function ReadAloudButton({ text, label, compact = false, style }: ReadAloudButtonProps) {
  const { theme, fontScale } = useTheme();
  const { settings } = useAccessibility();
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handlePress = useCallback(async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const cleanedText = text
      .replace(/[#*_~`]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ", ")
      .trim();

    if (!cleanedText) return;

    setIsSpeaking(true);

    const rate = settings.fontSizeLevel === "extraLarge" ? 0.75 : 0.85;

    Speech.speak(cleanedText, {
      language: "en-US",
      pitch: 1.0,
      rate,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [text, isSpeaking, settings.fontSizeLevel]);

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.compactButton,
          {
            backgroundColor: isSpeaking ? `${theme.primary}20` : `${theme.primary}10`,
            opacity: pressed ? 0.7 : 1,
          },
          style,
        ]}
        accessibilityLabel={isSpeaking ? "Stop reading" : "Read aloud"}
        accessibilityRole="button"
        testID="read-aloud-button"
      >
        <Feather
          name={isSpeaking ? "volume-x" : "volume-2"}
          size={Math.round(18 * fontScale)}
          color={theme.primary}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isSpeaking ? theme.primary : `${theme.primary}12`,
          borderColor: isSpeaking ? theme.primary : `${theme.primary}30`,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
      accessibilityLabel={isSpeaking ? "Stop reading" : (label || "Read this content aloud")}
      accessibilityRole="button"
      testID="read-aloud-button"
    >
      <Feather
        name={isSpeaking ? "volume-x" : "volume-2"}
        size={Math.round(18 * fontScale)}
        color={isSpeaking ? "#FFFFFF" : theme.primary}
      />
      <ThemedText
        type="small"
        style={{
          color: isSpeaking ? "#FFFFFF" : theme.primary,
          fontWeight: "600",
        }}
      >
        {isSpeaking ? "Stop Reading" : (label || "Read Aloud")}
      </ThemedText>
    </Pressable>
  );
}

export function ReadAloudFloatingButton({ text }: { text: string }) {
  const { theme, fontScale } = useTheme();
  const { settings } = useAccessibility();
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!settings.readAloudEnabled) return null;

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const cleanedText = text
      .replace(/[#*_~`]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ", ")
      .trim();

    if (!cleanedText) return;

    setIsSpeaking(true);

    const rate = settings.fontSizeLevel === "extraLarge" ? 0.75 : 0.85;

    Speech.speak(cleanedText, {
      language: "en-US",
      pitch: 1.0,
      rate,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.floatingButton,
        {
          backgroundColor: isSpeaking ? theme.error : theme.primary,
          width: Math.round(56 * fontScale),
          height: Math.round(56 * fontScale),
          borderRadius: Math.round(28 * fontScale),
        },
      ]}
      accessibilityLabel={isSpeaking ? "Stop reading" : "Read page content aloud"}
      accessibilityRole="button"
      testID="read-aloud-floating"
    >
      <Feather
        name={isSpeaking ? "volume-x" : "volume-2"}
        size={Math.round(24 * fontScale)}
        color="#FFFFFF"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
