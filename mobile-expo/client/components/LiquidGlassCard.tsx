import React, { useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StyleProp,
  ViewStyle,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  GlassEffects,
  BorderRadius,
  Shadows,
  isIOS26,
} from "../constants/theme";
import { useColorScheme } from "../hooks/useColorScheme";

interface LiquidGlassCardProps {
  children: React.ReactNode;
  variant?: "card" | "chrome" | "modal" | "tinted";
  tintColor?: string;
  showSpecular?: boolean;
  interactive?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  testID?: string;
}

export function LiquidGlassCard({
  children,
  variant = "card",
  tintColor,
  showSpecular = true,
  interactive = false,
  onPress,
  style,
  contentStyle,
  borderRadius,
  testID,
}: LiquidGlassCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const scale = useRef(new Animated.Value(1)).current;

  const glass =
    variant === "tinted" && tintColor
      ? GlassEffects.tinted(tintColor)
      : variant === "tinted"
      ? GlassEffects.card
      : GlassEffects[variant];

  const radius =
    borderRadius ??
    (variant === "modal"
      ? BorderRadius.modal
      : variant === "chrome"
      ? BorderRadius.tabBar
      : BorderRadius.card);

  const bgColor = isDark
    ? (glass as any).backgroundDark ?? (glass as any).background
    : (glass as any).background;

  const borderColor = isDark
    ? (glass as any).borderDark ?? (glass as any).border
    : (glass as any).border;

  const specularColor = isDark
    ? (glass as any).specularHighlightDark ?? "rgba(255,255,255,0.05)"
    : (glass as any).specularHighlight ?? "rgba(255,255,255,0.30)";

  // True iOS 26 native Liquid Glass (auto-falls back to plain View on
  // unsupported platforms per expo-glass-effect docs).
  const useNativeGlass = isLiquidGlassAvailable();

  const supportsBlur =
    Platform.OS === "ios" ||
    (Platform.OS === "android" &&
      typeof Platform.Version === "number" &&
      Platform.Version >= 31);

  const handlePressIn = () => {
    if (!interactive) return;
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      ...{ damping: 20, stiffness: 400 },
    }).start();
  };

  const handlePressOut = () => {
    if (!interactive) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...{ damping: 20, stiffness: 300 },
    }).start();
  };

  const renderContent = () => (
    <>
      {showSpecular && isIOS26 ? (
        <LinearGradient
          colors={[specularColor, "rgba(255,255,255,0.00)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            styles.specular,
            {
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
            },
          ]}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </>
  );

  const inner = (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale }] },
        Shadows.glass,
        style,
      ]}
      testID={testID}
    >
      {useNativeGlass ? (
        <GlassView
          key={`glass-${interactive || !!onPress ? "interactive" : "static"}-${variant}`}
          glassEffectStyle={variant === "modal" ? "clear" : "regular"}
          tintColor={
            variant === "tinted" && tintColor ? tintColor : undefined
          }
          isInteractive={interactive || !!onPress}
          style={[
            styles.nativeGlass,
            {
              borderRadius: radius,
              borderColor,
              borderWidth: 0.5,
            },
          ]}
        >
          {renderContent()}
        </GlassView>
      ) : supportsBlur ? (
        <BlurView
          intensity={(glass as any).intensity ?? 60}
          tint={isDark ? "dark" : "light"}
          style={[styles.blur, { borderRadius: radius }]}
        >
          <View
            style={[
              styles.surface,
              {
                backgroundColor: bgColor,
                borderRadius: radius,
                borderColor,
                borderWidth: 0.5,
              },
            ]}
          >
            {renderContent()}
          </View>
        </BlurView>
      ) : (
        <View
          style={[
            styles.fallback,
            {
              backgroundColor: isDark
                ? GlassEffects.fallback.dark.background
                : GlassEffects.fallback.light.background,
              borderColor: isDark
                ? GlassEffects.fallback.dark.border
                : GlassEffects.fallback.light.border,
              borderRadius: radius,
              borderWidth: 0.5,
            },
          ]}
        >
          <View style={[styles.content, contentStyle]}>{children}</View>
        </View>
      )}
    </Animated.View>
  );

  if (onPress || interactive) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        accessible={true}
        accessibilityRole="button"
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  container: {
    overflow: "visible",
  },
  blur: {
    overflow: "hidden",
  },
  nativeGlass: {
    overflow: "hidden",
  },
  surface: {
    overflow: "hidden",
  },
  specular: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 1,
  },
  content: {
    zIndex: 2,
  },
  fallback: {
    overflow: "hidden",
  },
});

export default LiquidGlassCard;
