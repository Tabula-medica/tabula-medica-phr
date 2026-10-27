import React from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing } from "@/constants/theme";

export function DemoModeBanner() {
  const { user } = useAuthContext();
  const insets = useSafeAreaInsets();

  if (!user?.isDemo) {
    return null;
  }

  return (
    <View style={[styles.bannerContainer, { paddingTop: insets.top }]}>
      <View style={styles.banner}>
        <Feather name="alert-circle" size={14} color="#FFFFFF" />
        <ThemedText style={styles.text}>
          Demo Mode - Sample Data Only (No Real PHI)
        </ThemedText>
      </View>
    </View>
  );
}

export function DemoModeIndicator({ compact = false }: { compact?: boolean }) {
  const { user } = useAuthContext();

  if (!user?.isDemo) {
    return null;
  }

  if (compact) {
    return (
      <View style={styles.compactBadge}>
        <ThemedText style={styles.compactText}>DEMO</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.badge}>
      <Feather name="info" size={12} color="#FF9500" />
      <ThemedText style={styles.badgeText}>Sample Data</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: "#FF9500",
  },
  banner: {
    backgroundColor: "#FF9500",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  badge: {
    backgroundColor: "rgba(255, 149, 0, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    color: "#FF9500",
    fontSize: 11,
    fontWeight: "600",
  },
  compactBadge: {
    backgroundColor: "#FF9500",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  compactText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
