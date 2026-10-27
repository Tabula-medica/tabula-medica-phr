import React from "react";
import { StyleSheet, ViewStyle, StyleProp, View, Platform } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, GlassEffects } from "@/constants/theme";
import { springConfig, AnimatedPressable } from "@/lib/animations";

type CardVariant = "default" | "glass" | "elevated" | "outlined";
type AccentColor = "visit" | "lab" | "medication" | "imaging" | "primary";

interface CardProps {
  elevation?: number;
  variant?: CardVariant;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accent?: AccentColor;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const getBackgroundColorForElevation = (
  elevation: number,
  theme: any,
): string => {
  switch (elevation) {
    case 1:
      return theme.backgroundDefault;
    case 2:
      return theme.backgroundSecondary;
    case 3:
      return theme.backgroundTertiary;
    default:
      return theme.backgroundRoot;
  }
};

const getAccentColor = (accent: AccentColor, theme: any): string => {
  const colors: Record<AccentColor, string> = {
    visit: theme.recordVisit,
    lab: theme.recordLab,
    medication: theme.recordMedication,
    imaging: theme.recordImaging,
    primary: theme.primary,
  };
  return colors[accent];
};

export function Card({
  elevation = 1,
  variant = "default",
  title,
  description,
  children,
  onPress,
  style,
  accent,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const cardBackgroundColor = getBackgroundColorForElevation(elevation, theme);
  const accentColor = accent ? getAccentColor(accent, theme) : undefined;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.98, 1], [0.8, opacity.value]),
  }));

  const handlePressIn = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled && onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const getVariantStyles = (): ViewStyle => {
    const glassEffect = isDark ? GlassEffects.dark : GlassEffects.light;
    
    switch (variant) {
      case "glass":
        return {
          backgroundColor: glassEffect.background,
          borderWidth: 1,
          borderColor: glassEffect.border,
          ...Shadows.glass,
        };
      case "elevated":
        return {
          backgroundColor: cardBackgroundColor,
          ...Shadows.large,
        };
      case "outlined":
        return {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: theme.border,
        };
      default:
        return {
          backgroundColor: cardBackgroundColor,
          ...Shadows.small,
        };
    }
  };

  const renderContent = () => (
    <>
      {accent ? (
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      ) : null}
      <View style={styles.content}>
        {title ? (
          <ThemedText type="h4" style={styles.cardTitle}>
            {title}
          </ThemedText>
        ) : null}
        {description ? (
          <ThemedText type="small" style={styles.cardDescription}>
            {description}
          </ThemedText>
        ) : null}
        {children}
      </View>
    </>
  );

  const cardStyles = [
    styles.card,
    getVariantStyles(),
    accent ? styles.cardWithAccent : null,
    disabled ? styles.disabled : null,
    animatedStyle,
    style,
  ];

  const a11yProps = {
    accessible: true,
    accessibilityRole: onPress ? "button" as const : undefined,
    accessibilityLabel: accessibilityLabel || title,
    accessibilityHint: accessibilityHint,
    accessibilityState: { disabled },
    testID,
  };

  if (variant === "glass" && Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={cardStyles}
        {...a11yProps}
      >
        <GlassView
          key={`glass-${onPress ? "interactive" : "static"}`}
          glassEffectStyle="regular"
          isInteractive={!!onPress}
          style={StyleSheet.absoluteFill}
        />
        {renderContent()}
      </AnimatedPressable>
    );
  }

  if (variant === "glass" && Platform.OS === "ios") {
    return (
      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={cardStyles}
        {...a11yProps}
      >
        <BlurView
          intensity={isDark ? GlassEffects.dark.blur : GlassEffects.light.blur}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        {renderContent()}
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={cardStyles}
      {...a11yProps}
    >
      {renderContent()}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  cardWithAccent: {
    flexDirection: "row",
  },
  accentBar: {
    width: 3,
    borderTopLeftRadius: BorderRadius.sm,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
});
