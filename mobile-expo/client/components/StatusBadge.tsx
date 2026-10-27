import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

type BadgeVariant = "dot" | "pill" | "outline";
type BadgeSize = "sm" | "md" | "lg";

interface StatusBadgeProps {
  label: string;
  color?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  testID?: string;
}

const SIZE_CONFIG = {
  sm: { paddingH: Spacing.xs, paddingV: 2, fontSize: 10, dotSize: 5 },
  md: { paddingH: Spacing.sm, paddingV: Spacing.xs, fontSize: 11, dotSize: 6 },
  lg: { paddingH: Spacing.md, paddingV: Spacing.sm, fontSize: 14, dotSize: 8 },
};

export function StatusBadge({
  label,
  color,
  variant = "pill",
  size = "md",
  style,
  testID,
}: StatusBadgeProps) {
  const { theme } = useTheme();
  const badgeColor = color || theme.primary;
  const config = SIZE_CONFIG[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variant === "outline" ? "transparent" : `${badgeColor}15`,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: badgeColor,
          paddingHorizontal: config.paddingH,
          paddingVertical: config.paddingV,
        },
        style,
      ]}
      testID={testID}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      {variant === "dot" ? (
        <View
          style={[
            styles.dot,
            {
              width: config.dotSize,
              height: config.dotSize,
              borderRadius: config.dotSize / 2,
              backgroundColor: badgeColor,
            },
          ]}
        />
      ) : null}
      <ThemedText
        style={[
          styles.label,
          {
            color: badgeColor,
            fontSize: config.fontSize,
            marginLeft: variant === "dot" ? 4 : 0,
          },
        ]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

export function getStatusColor(
  status: string,
  theme: { success: string; warning: string; error: string; primary: string; textSecondary: string }
): string {
  const map: Record<string, string> = {
    active: theme.success,
    connected: theme.success,
    completed: theme.success,
    approved: theme.success,
    granted: theme.success,
    confirmed: theme.success,
    healthy: theme.success,
    pending: theme.warning,
    scheduled: theme.warning,
    in_progress: theme.warning,
    syncing: theme.warning,
    paused: theme.warning,
    inactive: theme.textSecondary,
    disconnected: theme.textSecondary,
    expired: theme.textSecondary,
    cancelled: theme.textSecondary,
    error: theme.error,
    failed: theme.error,
    denied: theme.error,
    revoked: theme.error,
    overdue: theme.error,
    critical: theme.error,
  };
  return map[status.toLowerCase()] || theme.primary;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  dot: {},
  label: {
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
