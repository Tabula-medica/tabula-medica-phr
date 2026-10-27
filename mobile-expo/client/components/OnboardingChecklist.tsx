import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const DISMISS_KEY = "@tabula_medica_checklist_dismissed";

export interface ChecklistState {
  recordsConnected: boolean;
  providerAdded: boolean;
  aiSummaryRun: boolean;
}

interface OnboardingChecklistProps {
  state: ChecklistState;
  onConnectRecords?: () => void;
  onAddProvider?: () => void;
  onRunAiSummary?: () => void;
}

export default function OnboardingChecklist({
  state,
  onConnectRecords,
  onAddProvider,
  onRunAiSummary,
}: OnboardingChecklistProps) {
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((v) => setDismissed(v === "true"));
  }, []);

  const handleDismiss = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await AsyncStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }, []);

  const allDone = state.recordsConnected && state.providerAdded && state.aiSummaryRun;
  if (dismissed === null || dismissed || allDone) return null;

  const completed = [
    state.recordsConnected,
    state.providerAdded,
    state.aiSummaryRun,
  ].filter(Boolean).length;
  const total = 3;

  const items: { label: string; done: boolean; onPress?: () => void; icon: keyof typeof Feather.glyphMap }[] = [
    {
      label: "Connect your health records",
      done: state.recordsConnected,
      onPress: onConnectRecords,
      icon: "link",
    },
    {
      label: "Add a provider",
      done: state.providerAdded,
      onPress: onAddProvider,
      icon: "user-plus",
    },
    {
      label: "Run your first AI summary",
      done: state.aiSummaryRun,
      onPress: onRunAiSummary,
      icon: "cpu",
    },
  ];

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[styles.container, { backgroundColor: theme.backgroundDefault, borderColor: theme.glassBorder }]}
      testID="card-onboarding-checklist"
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="body" style={styles.title}>
            Get the most out of Tabula Medica
          </ThemedText>
          <ThemedText type="caption" style={[styles.progress, { color: theme.textSecondary }]}>
            {completed} of {total} complete
          </ThemedText>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={12}
          style={styles.dismissBtn}
          testID="button-checklist-dismiss"
        >
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundTertiary }]}>
        <LinearGradient
          colors={[theme.primary, theme.primaryVibrant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: `${(completed / total) * 100}%` }]}
        />
      </View>

      <View style={styles.items}>
        {items.map((it, i) => (
          <Pressable
            key={i}
            onPress={it.done ? undefined : it.onPress}
            style={({ pressed }) => [
              styles.item,
              { opacity: pressed && !it.done ? 0.7 : 1 },
            ]}
            testID={`button-checklist-step-${i}`}
            disabled={it.done}
          >
            <View
              style={[
                styles.checkCircle,
                {
                  backgroundColor: it.done ? theme.success : "transparent",
                  borderColor: it.done ? theme.success : theme.border,
                },
              ]}
            >
              {it.done ? (
                <Feather name="check" size={14} color="#FFFFFF" />
              ) : (
                <Feather name={it.icon} size={12} color={theme.textSecondary} />
              )}
            </View>
            <ThemedText
              type="body"
              style={[
                styles.itemLabel,
                {
                  color: it.done ? theme.textSecondary : theme.text,
                  textDecorationLine: it.done ? "line-through" : "none",
                },
              ]}
            >
              {it.label}
            </ThemedText>
            {!it.done && (
              <Feather name="chevron-right" size={18} color={theme.textTertiary} />
            )}
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 16, fontWeight: "600" },
  progress: { fontSize: 13, marginTop: 2 },
  dismissBtn: { padding: 4 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  progressFill: { height: "100%", borderRadius: 3 },
  items: { gap: 4 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: { flex: 1, fontSize: 15 },
});
