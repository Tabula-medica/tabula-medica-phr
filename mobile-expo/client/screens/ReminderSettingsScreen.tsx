import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface ReminderPreferences {
  id: string;
  userId: string;
  enabled: boolean;
  reminderTimes: number[];
  channels: string[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const REMINDER_TIME_OPTIONS = [
  { value: 4320, label: "3 days before" },
  { value: 1440, label: "24 hours before" },
  { value: 120, label: "2 hours before" },
  { value: 60, label: "1 hour before" },
  { value: 30, label: "30 minutes before" },
  { value: 15, label: "15 minutes before" },
];

const CHANNEL_OPTIONS = [
  { value: "in_app", label: "In-App Notification", icon: "bell" as const },
  { value: "sms", label: "SMS Text Message", icon: "smartphone" as const },
  { value: "email", label: "Email", icon: "mail" as const },
];

export default function ReminderSettingsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState<number[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");

  const { data: preferences, isLoading } = useQuery<ReminderPreferences>({
    queryKey: ["/api/reminders/preferences"],
  });

  useEffect(() => {
    if (preferences) {
      setEnabled(preferences.enabled);
      setReminderTimes(preferences.reminderTimes || []);
      setChannels(preferences.channels || []);
      setQuietHoursStart(preferences.quietHoursStart || "");
      setQuietHoursEnd(preferences.quietHoursEnd || "");
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = new URL("/api/reminders/preferences", getApiUrl());
      return apiRequest("PUT", url.toString(), {
        enabled,
        reminderTimes,
        channels,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/preferences"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const toggleReminderTime = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReminderTimes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  };

  const toggleChannel = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChannels((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleToggleEnabled = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEnabled(value);
  };

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Animated.View entering={FadeInDown.delay(0).duration(400)}>
          <Card variant="glass" style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <ThemedText type="h4">Appointment Reminders</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                  {enabled ? "Reminders are enabled" : "Reminders are disabled"}
                </ThemedText>
              </View>
              <Switch
                testID="switch-reminders-enabled"
                value={enabled}
                onValueChange={handleToggleEnabled}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </Animated.View>

        {enabled ? (
          <>
            <Animated.View entering={FadeInDown.delay(80).duration(400)}>
              <Card variant="glass" style={styles.section}>
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Reminder Times
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                  Choose when to receive reminders before appointments
                </ThemedText>
                {REMINDER_TIME_OPTIONS.map((option) => {
                  const isSelected = reminderTimes.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      testID={`reminder-time-${option.value}`}
                      style={[
                        styles.optionRow,
                        { borderBottomColor: theme.border },
                      ]}
                      onPress={() => toggleReminderTime(option.value)}
                    >
                      <View style={styles.optionLabel}>
                        <Feather name="clock" size={16} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                          {option.label}
                        </ThemedText>
                      </View>
                      {isSelected ? (
                        <Feather name="check" size={20} color={theme.primary} />
                      ) : (
                        <View style={styles.emptyCheck} />
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(160).duration(400)}>
              <Card variant="glass" style={styles.section}>
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Notification Channels
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                  How would you like to receive reminders
                </ThemedText>
                {CHANNEL_OPTIONS.map((option) => {
                  const isSelected = channels.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      testID={`channel-${option.value}`}
                      style={[
                        styles.optionRow,
                        { borderBottomColor: theme.border },
                      ]}
                      onPress={() => toggleChannel(option.value)}
                    >
                      <View style={styles.optionLabel}>
                        <Feather name={option.icon} size={16} color={theme.textSecondary} />
                        <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>
                          {option.label}
                        </ThemedText>
                      </View>
                      {isSelected ? (
                        <Feather name="check" size={20} color={theme.primary} />
                      ) : (
                        <View style={styles.emptyCheck} />
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(240).duration(400)}>
              <Card variant="glass" style={styles.section}>
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Quiet Hours
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                  Reminders during quiet hours will be sent before the quiet period begins
                </ThemedText>
                <View style={styles.quietHoursRow}>
                  <View style={styles.quietHoursInput}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                      Start Time
                    </ThemedText>
                    <TextInput
                      testID="input-quiet-hours-start"
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      placeholder="22:00"
                      placeholderTextColor={theme.textSecondary}
                      value={quietHoursStart}
                      onChangeText={setQuietHoursStart}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={styles.quietHoursSeparator}>
                    <Feather name="arrow-right" size={16} color={theme.textSecondary} />
                  </View>
                  <View style={styles.quietHoursInput}>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                      End Time
                    </ThemedText>
                    <TextInput
                      testID="input-quiet-hours-end"
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.backgroundSecondary,
                          color: theme.text,
                          borderColor: theme.border,
                        },
                      ]}
                      placeholder="08:00"
                      placeholderTextColor={theme.textSecondary}
                      value={quietHoursEnd}
                      onChangeText={setQuietHoursEnd}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </Card>
            </Animated.View>
          </>
        ) : null}

        <Animated.View entering={FadeInDown.delay(enabled ? 320 : 80).duration(400)}>
          <Pressable
            testID="button-save-preferences"
            style={[styles.saveButton, { backgroundColor: theme.success }]}
            onPress={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFFFFF" />
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                  Save Preferences
                </ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emptyCheck: {
    width: 20,
    height: 20,
  },
  quietHoursRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  quietHoursInput: {
    flex: 1,
  },
  quietHoursSeparator: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },
  saveButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
});
