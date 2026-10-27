import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface LoadingStateProps {
  message?: string;
  size?: "small" | "large";
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function LoadingState({
  message,
  size = "large",
  fullScreen = false,
  style,
}: LoadingStateProps) {
  const { theme } = useTheme();

  const content = (
    <View style={[styles.container, style]} accessible={true} accessibilityRole="progressbar" accessibilityLabel={message || "Loading"} accessibilityLiveRegion="polite">
      <ActivityIndicator size={size} color={theme.primary} accessibilityElementsHidden={true} />
      {message ? (
        <ThemedText style={[styles.message, { color: theme.textSecondary }]}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );

  if (fullScreen) {
    return <ThemedView style={styles.fullScreen}>{content}</ThemedView>;
  }

  return content;
}

interface EmptyStateProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

export function EmptyState({ icon, title, subtitle, action, style, testID }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.emptyContainer, style]} testID={testID} accessible={true} accessibilityRole="text" accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ""}`}>
      <View style={[styles.emptyIconContainer, { backgroundColor: `${theme.primary}10` }]} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants">
        <Feather name={icon} size={36} color={theme.textSecondary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>{title}</ThemedText>
      {subtitle ? (
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </ThemedText>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.sectionHeader, style]} accessible={false}>
      <ThemedText type="h3" style={{ color: theme.text }} accessibilityRole="header">{title}</ThemedText>
      {action || null}
    </View>
  );
}

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({
  width = 100,
  height = 16,
  borderRadius: radius = BorderRadius.sm,
  style,
}: SkeletonBoxProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: typeof width === "number" ? width : width,
          height,
          borderRadius: radius,
          backgroundColor: theme.border,
        } as ViewStyle,
        animatedStyle,
        style,
      ]}
    />
  );
}

interface SkeletonLineProps {
  width?: string;
  style?: ViewStyle;
}

export function SkeletonLine({ width = "100%", style }: SkeletonLineProps) {
  return (
    <SkeletonBox
      width={width}
      height={14}
      borderRadius={BorderRadius.xs}
      style={style ? { ...style, marginBottom: Spacing.sm } : { marginBottom: Spacing.sm }}
    />
  );
}

export function SkeletonCard() {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.skeletonCardContainer,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
      ]}
    >
      <View style={styles.skeletonCardContent}>
        <SkeletonBox width="90%" height={16} borderRadius={BorderRadius.xs} />
        <SkeletonLine width="75%" />
        <SkeletonLine width="85%" />
      </View>
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
}

export function SkeletonList({ count = 3 }: SkeletonListProps) {
  return (
    <View style={styles.skeletonListContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  fullScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyAction: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  skeletonCardContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  skeletonCardContent: {
    gap: Spacing.sm,
  },
  skeletonListContainer: {
    paddingVertical: Spacing.md,
  },
});
