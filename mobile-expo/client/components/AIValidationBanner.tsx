import React, { useMemo } from "react";
import { View, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface ValidationIssue {
  type: "error" | "warning" | "info";
  field: string;
  message: string;
  suggestion?: string;
}

interface AIValidationBannerProps {
  issues: ValidationIssue[];
  isValidating: boolean;
  onDismiss?: () => void;
}

const ICON_MAP: Record<ValidationIssue["type"], keyof typeof Feather.glyphMap> = {
  error: "alert-circle",
  warning: "alert-triangle",
  info: "info",
};

const TYPE_ORDER: ValidationIssue["type"][] = ["error", "warning", "info"];

export function AIValidationBanner({ issues, isValidating, onDismiss }: AIValidationBannerProps) {
  const { theme } = useTheme();

  const colorMap = useMemo(() => ({
    error: theme.error,
    warning: theme.warning,
    info: theme.info,
  }), [theme]);

  const groupedIssues = useMemo(() => {
    const grouped: Record<string, ValidationIssue[]> = { error: [], warning: [], info: [] };
    for (const issue of issues) {
      grouped[issue.type].push(issue);
    }
    return grouped;
  }, [issues]);

  if (isValidating) {
    return (
      <Animated.View entering={FadeInDown.duration(300)} style={[styles.validatingBar, { backgroundColor: `${theme.info}15`, borderColor: `${theme.info}30` }]}>
        <ActivityIndicator size="small" color={theme.info} />
        <ThemedText style={[styles.validatingText, { color: theme.info }]}>Analyzing your entries...</ThemedText>
      </Animated.View>
    );
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }, Shadows.medium]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="zap" size={16} color={theme.primary} />
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>AI Review</ThemedText>
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} testID="dismiss-validation" accessibilityRole="button" accessibilityLabel="Dismiss AI review">
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {TYPE_ORDER.map((type) =>
        groupedIssues[type].length > 0 ? (
          <View key={type} style={styles.issueGroup}>
            {groupedIssues[type].map((issue, idx) => (
              <View key={`${type}-${idx}`} style={[styles.issueRow, { backgroundColor: `${colorMap[type]}10`, borderLeftColor: colorMap[type] }]}>
                <Feather name={ICON_MAP[type] as any} size={16} color={colorMap[type]} style={styles.issueIcon} />
                <View style={styles.issueContent}>
                  <ThemedText style={[styles.issueMessage, { color: theme.text }]}>{issue.message}</ThemedText>
                  {issue.suggestion ? (
                    <ThemedText style={[styles.issueSuggestion, { color: theme.textSecondary }]}>{issue.suggestion}</ThemedText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null
      )}

      <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
        AI validation is for informational purposes only.
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  validatingBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  validatingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  card: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  issueGroup: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderLeftWidth: 3,
    marginBottom: Spacing.xs,
  },
  issueIcon: {
    marginTop: 2,
    marginRight: Spacing.sm,
  },
  issueContent: {
    flex: 1,
  },
  issueMessage: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  issueSuggestion: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    fontStyle: "italic",
  },
  disclaimer: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
