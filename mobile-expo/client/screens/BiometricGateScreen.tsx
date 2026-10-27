import React, { useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSecurityContext } from "@/context/SecurityContext";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function BiometricGateScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    isCheckingAuth,
    biometricTypeName,
    lastError,
    timeoutMinutes,
    unlock,
  } = useSecurityContext();

  useEffect(() => {
    if (!isCheckingAuth) {
      unlock();
    }
  }, [isCheckingAuth]);

  const handleUnlock = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await unlock();
  }, [unlock]);

  const iconName = biometricTypeName.toLowerCase().includes("face")
    ? "eye"
    : biometricTypeName.toLowerCase().includes("touch") || biometricTypeName.toLowerCase().includes("finger")
      ? "smartphone"
      : "lock";

  if (isCheckingAuth) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[theme.primary + "15", theme.primary + "05", "transparent"]}
        style={[styles.gradient, { paddingTop: insets.top + Spacing["2xl"] }]}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.lockContainer}>
          <View style={[styles.lockCircle, { backgroundColor: theme.primary + "15" }]}>
            <View style={[styles.lockInner, { backgroundColor: theme.primary + "25" }]}>
              <Feather name="shield" size={48} color={theme.primary} />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.textContainer}>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Tabula Medica
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            HIPAA-Compliant Health Records
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.infoContainer}>
          <View style={[styles.infoRow, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" }]}>
            <Feather name="lock" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              Your health data is protected with {biometricTypeName}
            </ThemedText>
          </View>
          <View style={[styles.infoRow, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" }]}>
            <Feather name="clock" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              Auto-locks after {timeoutMinutes} minutes of inactivity
            </ThemedText>
          </View>
          <View style={[styles.infoRow, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" }]}>
            <Feather name="shield" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              No patient data stored on device
            </ThemedText>
          </View>
        </Animated.View>

        {lastError ? (
          <Animated.View entering={FadeInDown.delay(100)} style={styles.errorContainer}>
            <View style={[styles.errorBox, { backgroundColor: "#E85D75" + "15" }]}>
              <Feather name="alert-circle" size={16} color="#E85D75" />
              <ThemedText style={[styles.errorText, { color: "#E85D75" }]}>
                {lastError}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(600).springify()} style={styles.buttonContainer}>
          <Pressable
            testID="button-biometric-unlock"
            style={({ pressed }) => [
              styles.unlockButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleUnlock}
          >
            <Feather name={iconName} size={22} color="#FFFFFF" />
            <ThemedText style={styles.unlockButtonText}>
              Unlock with {biometricTypeName}
            </ThemedText>
          </Pressable>
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Feather name="shield" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            End-to-end encrypted. Zero PHI on device.
          </ThemedText>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  lockContainer: {
    marginBottom: Spacing["2xl"],
  },
  lockCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  lockInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  infoContainer: {
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing["2xl"],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  errorContainer: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  buttonContainer: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  unlockButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  unlockButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "absolute",
    bottom: 0,
  },
  footerText: {
    fontSize: 12,
  },
});
