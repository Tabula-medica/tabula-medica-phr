/**
 * LiquidGlassTabBar — iOS 26 floating tab bar
 *
 * iOS 26 redesigns the tab bar as a floating pill that sits
 * above the home indicator with a glass background.
 * Falls back to standard tab bar on Android/web.
 */
import React from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Text,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Colors, BorderRadius, Shadows, Spacing, GlassEffects, isIOS26, Typography } from "../constants/theme";
import { useColorScheme } from "../hooks/useColorScheme";

export function LiquidGlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const glass = GlassEffects.chrome;
  const borderColor = isDark ? glass.borderDark : glass.border;
  const bgColor = isDark ? glass.backgroundDark : glass.background;

  // iOS 26: floating pill, centered
  // Other: standard bottom tab bar
  const isFloating = isIOS26;

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
      {Platform.OS === "ios" ? (
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
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const iconColor = isFocused
                ? colors.tabIconSelected
                : colors.tabIconDefault;

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={styles.tab}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? route.name}
                  testID={options.tabBarTestID}
                >
                  {/* Active indicator pill */}
                  {isFocused && isFloating && (
                    <View
                      style={[
                        styles.activePill,
                        { backgroundColor: isDark ? "rgba(10,132,255,0.15)" : "rgba(0,122,255,0.10)" },
                      ]}
                    />
                  )}
                  {/* Icon */}
                  {options.tabBarIcon?.({
                    focused: isFocused,
                    color: iconColor,
                    size: 24,
                  })}
                  {/* Label */}
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
                    {options.tabBarLabel as string ?? route.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      ) : (
        /* Android / web: standard flat tab bar */
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
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const iconColor = isFocused ? colors.tabIconSelected : colors.tabIconDefault;

            return (
              <TouchableOpacity
                key={route.key}
                onPress={() => navigation.navigate(route.name)}
                style={styles.tab}
                accessibilityRole="button"
                accessibilityState={{ selected: isFocused }}
              >
                {options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: 24 })}
                <Text style={[styles.label, { color: iconColor }]}>
                  {options.tabBarLabel as string ?? route.name}
                </Text>
              </TouchableOpacity>
            );
          })}
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
    top: 6,
    left: 8,
    right: 8,
    bottom: 6,
    borderRadius: 12,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
});

export default LiquidGlassTabBar;
