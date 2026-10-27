import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface MetricCardProps {
  value: string | number;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  color?: string;
  style?: ViewStyle;
  onPress?: () => void;
  testID?: string;
}

export function MetricCard({ value, label, icon, color, style, onPress, testID }: MetricCardProps) {
  const { theme } = useTheme();
  const accentColor = color || theme.primary;

  return (
    <Card
      style={StyleSheet.flatten([styles.card, style]) as ViewStyle}
      onPress={onPress}
    >
      <View style={styles.content} testID={testID}>
        {icon ? (
          <View style={[styles.iconContainer, { backgroundColor: `${accentColor}15` }]}>
            <Feather name={icon} size={20} color={accentColor} />
          </View>
        ) : null}
        <ThemedText style={[styles.value, { color: accentColor }]}>
          {value}
        </ThemedText>
        <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      </View>
    </Card>
  );
}

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  style?: ViewStyle;
}

export function StatsGrid({ children, style }: StatsGridProps) {
  return (
    <View style={[styles.grid, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    padding: 0,
  },
  content: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  value: {
    ...Typography.h2,
    fontSize: 28,
    fontWeight: "700",
  },
  label: {
    ...Typography.small,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
});
