import React, { ReactNode } from "react";
import {
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { springConfig, AnimatedPressable } from "@/lib/animations";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "glass";
  size?: "sm" | "md" | "lg";
  icon?: keyof typeof Feather.glyphMap;
  iconRight?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  haptic?: boolean;
}

const hapticForVariant = (variant: string) => {
  if (Platform.OS === "web") return;
  try {
    if (variant === "danger") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (variant === "primary") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
};

export function Button({
  onPress,
  children,
  variant = "primary",
  size = "lg",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityHint,
  haptic = true,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const getHeight = () => {
    switch (size) {
      case "sm":
        return 36;
      case "md":
        return 44;
      case "lg":
        return 52;
      default:
        return 52;
    }
  };

  const getColors = () => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: theme.link,
          textColor: theme.buttonText,
          borderColor: "transparent",
          borderWidth: 0,
        };
      case "secondary":
        return {
          backgroundColor: `${theme.primary}15`,
          textColor: theme.primary,
          borderColor: "transparent",
          borderWidth: 0,
        };
      case "outline":
        return {
          backgroundColor: "transparent",
          textColor: theme.text,
          borderColor: theme.border,
          borderWidth: 1,
        };
      case "ghost":
        return {
          backgroundColor: "transparent",
          textColor: theme.primary,
          borderColor: "transparent",
          borderWidth: 0,
        };
      case "danger":
        return {
          backgroundColor: theme.error,
          textColor: theme.buttonText,
          borderColor: "transparent",
          borderWidth: 0,
        };
      case "glass":
        return {
          backgroundColor: isLiquidGlassAvailable()
            ? "transparent"
            : `${theme.primary}1F`,
          textColor: theme.primary,
          borderColor: `${theme.primary}33`,
          borderWidth: 0.5,
        };
      default:
        return {
          backgroundColor: theme.link,
          textColor: theme.buttonText,
          borderColor: "transparent",
          borderWidth: 0,
        };
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 16;
      case "md":
        return 18;
      case "lg":
        return 20;
      default:
        return 20;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(1, springConfig);
    }
  };

  const handlePress = () => {
    if (haptic) {
      hapticForVariant(variant);
    }
    onPress?.();
  };

  const colors = getColors();
  const height = getHeight();
  const iconSize = getIconSize();
  const isDisabled = disabled || loading;

  const renderGlassBackdrop =
    variant === "glass" &&
    Platform.OS === "ios" &&
    isLiquidGlassAvailable();

  return (
    <AnimatedPressable
      onPress={isDisabled ? undefined : handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.button,
        {
          height,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: colors.borderWidth,
          width: fullWidth ? "100%" : "auto",
          opacity: isDisabled ? 0.5 : 1,
          overflow: "hidden",
        },
        style,
        animatedStyle,
      ]}
    >
      {renderGlassBackdrop ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive={true}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>
        {icon && !loading ? (
          <Feather
            name={icon}
            size={iconSize}
            color={colors.textColor}
            style={styles.iconLeft}
          />
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.textColor}
            style={styles.iconLeft}
          />
        ) : null}

        <ThemedText
          type="body"
          style={[
            styles.buttonText,
            { color: colors.textColor },
            { fontSize: size === "sm" ? 14 : 16 },
          ]}
        >
          {children}
        </ThemedText>

        {iconRight && !loading ? (
          <Feather
            name={iconRight}
            size={iconSize}
            color={colors.textColor}
            style={styles.iconRight}
          />
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  buttonText: {
    fontWeight: "600",
  },
  iconLeft: {
    marginRight: Spacing.xs,
  },
  iconRight: {
    marginLeft: Spacing.xs,
  },
});
