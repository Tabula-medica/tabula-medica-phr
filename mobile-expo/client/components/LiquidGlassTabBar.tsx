import React, { useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Text,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Colors, BorderRadius, Shadows, Spacing, GlassEffects, isIOS26, Typography } from "../constants/theme";
import { useColorScheme } from "../hooks/useColorScheme";

function AnimatedTab({
  route,
  options,
  isFocused,
  iconColor,
  isDark,
  isFloating,
  onPress,
}: {
  route: any;
  options: any;
  isFocused: boolean;
  iconColor: string;
  isDark: boolean;
  isFloating: boolean;
  onPress: () => void;
}) {
  const pillOpacity = useSharedValue(isFocused ? 1 : 0);
  const pillScale = useSharedValue(isFocused ? 1 : 0.85);
  const iconScale = useSharedValue(1);
  const iconTranslateY = useSharedValue(0);
  const dotScale = useSharedValue(isFocused ? 1 : 0);
  const dotOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    pillOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
    pillScale.value = withSpring(isFocused ? 1 : 0.85, { damping: 16, stiffness: 280 });
    dotScale.value = withSpring(isFocused ? 1 : 0, { damping: 14, stiffness: 350 });
    dotOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ scaleX: pillScale.value }, { scaleY: pillScale.value }],
  }));

  const handlePress = () => {
    iconScale.value = withSpring(0.82, { damping: 10, stiffness: 450 }, () => {
      iconScale.value = withSpring(1, { damping: 14, stiffness: 280 });
    });
    iconTranslateY.value = withSpring(-2, { damping: 10, stiffness: 400 }, () => {
      iconTranslateY.value = withSpring(0, { damping: 14, stiffness: 280 });
    });
    onPress();
  };

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { translateY: iconTranslateY.value }],
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <TouchableOpacity
      key={route.key}
      onPress={handlePress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.tabBarAccessibilityLabel ?? route.name}
      testID={(options as any).tabBarTestID ?? `tab-${route.name.toLowerCase()}`}
      activeOpacity={0.7}
    >
      {isFloating ? (
        <Animated.View
          style={[
            styles.activePill,
            { backgroundColor: isDark ? "rgba(10,132,255,0.18)" : "rgba(0,122,255,0.12)" },
            pillStyle,
          ]}
        />
      ) : null}
      <Animated.View style={iconAnimStyle}>
        {options.tabBarIcon?.({
          focused: isFocused,
          color: iconColor,
          size: 24,
        })}
      </Animated.View>
      <Text
        style={[
          styles.label,
          Typography.caption2,
          {
            color: iconColor,
            fontWeight: isFocused ? "600" : "400",
            marginTop: 2,
          },
        ]}
        numberOfLines={1}
      >
        {(options.tabBarLabel as string) ?? route.name}
      </Text>
      <Animated.View style={[styles.activeIndicatorDot, { backgroundColor: iconColor }, dotAnimStyle]} />
    </TouchableOpacity>
  );
}

export function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const glass = GlassEffects.chrome;
  const borderColor = isDark ? glass.borderDark : glass.border;
  const bgColor = isDark ? glass.backgroundDark : glass.background;

  const isFloating = isIOS26;
  const useNativeGlass = isLiquidGlassAvailable();

  const renderTab = (route: any, index: number) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const iconColor = isFocused ? colors.tabIconSelected : colors.tabIconDefault;

    return (
      <AnimatedTab
        key={route.key}
        route={route}
        options={options}
        isFocused={isFocused}
        iconColor={iconColor}
        isDark={isDark}
        isFloating={isFloating}
        onPress={() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            navigation.navigate(route.name);
          }
        }}
      />
    );
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          ...(isFloating ? styles.floatingWrapper : styles.standardWrapper),
        },
      ]}
      pointerEvents="box-none"
    >
      {Platform.OS === "ios" && useNativeGlass ? (
        <GlassView
          glassEffectStyle="regular"
          isInteractive={true}
          style={[
            styles.barContainer,
            isFloating ? styles.floatingBar : styles.standardBar,
            { borderColor, borderWidth: 0.5 },
          ]}
        >
          <View style={styles.inner}>
            {state.routes.map(renderTab)}
          </View>
        </GlassView>
      ) : Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "dark" : "light"}
          style={[
            styles.barContainer,
            isFloating ? styles.floatingBar : styles.standardBar,
            { borderColor, borderWidth: 0.5 },
          ]}
        >
          <View style={[styles.inner, { backgroundColor: bgColor }]}>
            {state.routes.map(renderTab)}
          </View>
        </BlurView>
      ) : (
        <View
          style={[
            styles.barContainer,
            styles.standardBar,
            {
              backgroundColor: isDark ? Colors.dark.backgroundDefault : Colors.light.backgroundDefault,
              borderTopColor: isDark ? Colors.dark.border : Colors.light.border,
              borderTopWidth: 0.5,
            },
          ]}
        >
          {state.routes.map(renderTab)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  floatingWrapper: {
    paddingHorizontal: 24,
  },
  standardWrapper: {
    paddingHorizontal: 0,
  },
  barContainer: {
    overflow: "hidden",
  },
  floatingBar: {
    borderRadius: BorderRadius.tabBar,
    ...Shadows.floating,
  },
  standardBar: {
    borderRadius: 0,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    minHeight: Spacing.touchTarget,
    position: "relative",
  },
  activePill: {
    position: "absolute",
    top: 4,
    left: 6,
    right: 6,
    bottom: 4,
    borderRadius: 14,
  },
  activeIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
});

export default LiquidGlassTabBar;
