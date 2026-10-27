import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { PORTAL_TOKEN_KEY } from "@/screens/AdminLoginScreen";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "AdminDashboard">;

interface DashboardStats {
  totalPatients?: number;
  activePatients?: number;
  pendingEnrollments?: number;
  totalProviders?: number;
  aiQueriesLast24h?: number;
  complianceScore?: number;
}

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  bg: string;
}

function StatTile({ card, isDark }: { card: StatCard; isDark: boolean }) {
  const { theme } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.springify()}
      style={[
        styles.statTile,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: card.bg }]}>
        <Feather name={card.icon} size={18} color={card.color} />
      </View>
      <ThemedText type="h3" style={{ fontWeight: "700", marginTop: Spacing.sm }}>
        {card.value}
      </ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
        {card.label}
      </ThemedText>
    </Animated.View>
  );
}

export default function AdminDashboardScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { providerName } = route.params;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage("");

      const token = await AsyncStorage.getItem(PORTAL_TOKEN_KEY);
      if (!token) throw new Error("Session expired. Please sign in again.");

      const base = getApiUrl();
      const res = await fetch(`${base}/api/portal/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        await AsyncStorage.removeItem(PORTAL_TOKEN_KEY);
        navigation.replace("AdminLogin");
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load dashboard.");
      setStats(data);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not load dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSignOut = async () => {
    await AsyncStorage.removeItem(PORTAL_TOKEN_KEY);
    navigation.replace("AdminLogin");
  };

  const statCards: StatCard[] = [
    {
      label: "Total Patients",
      value: stats?.totalPatients ?? "—",
      icon: "users",
      color: "#6366F1",
      bg: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.10)",
    },
    {
      label: "Active Patients",
      value: stats?.activePatients ?? "—",
      icon: "activity",
      color: "#10B981",
      bg: isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.10)",
    },
    {
      label: "Pending Enrollment",
      value: stats?.pendingEnrollments ?? "—",
      icon: "clock",
      color: "#F59E0B",
      bg: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.10)",
    },
    {
      label: "Providers",
      value: stats?.totalProviders ?? "—",
      icon: "briefcase",
      color: "#3B82F6",
      bg: isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.10)",
    },
    {
      label: "AI Queries (24h)",
      value: stats?.aiQueriesLast24h ?? "—",
      icon: "cpu",
      color: "#8B5CF6",
      bg: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.10)",
    },
    {
      label: "Compliance Score",
      value: stats?.complianceScore != null ? `${stats.complianceScore}%` : "—",
      icon: "shield",
      color: "#EC4899",
      bg: isDark ? "rgba(236,72,153,0.15)" : "rgba(236,72,153,0.10)",
    },
  ];

  return (
    <LinearGradient
      colors={isDark ? ["#0A0A0F", "#0D1117", "#111827"] : ["#F8FAFC", "#EEF2FF", "#F0F9FF"]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={[styles.headerBadge, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.10)" }]}>
            <Feather name="shield" size={13} color="#6366F1" />
            <ThemedText type="caption" style={{ color: "#6366F1", fontWeight: "700", marginLeft: 4 }}>
              ADMIN
            </ThemedText>
          </View>
          <ThemedText type="h3" style={{ fontWeight: "700" }}>
            {providerName}
          </ThemedText>
        </View>

        <Pressable
          testID="button-admin-signout"
          onPress={handleSignOut}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
          accessibilityRole="button"
          accessibilityLabel="Sign out of admin portal"
        >
          <Feather name="log-out" size={20} color={theme.error} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchStats(true)}
            tintColor={theme.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#6366F1" />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              Loading dashboard…
            </ThemedText>
          </View>
        ) : errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: `${theme.error}15`, borderColor: `${theme.error}30` }]}>
            <Feather name="alert-circle" size={16} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, flex: 1, marginLeft: Spacing.sm }}>
              {errorMessage}
            </ThemedText>
            <Pressable onPress={() => fetchStats()} hitSlop={8}>
              <ThemedText type="small" style={{ color: "#6366F1", fontWeight: "600" }}>
                Retry
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginLeft: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Platform Overview
              </ThemedText>
            </Animated.View>

            <View style={styles.statsGrid}>
              {statCards.map((card, i) => (
                <StatTile key={i} card={card} isDark={isDark} />
              ))}
            </View>

            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.sectionHeader}>
              <Feather name="link" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginLeft: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Quick Actions
              </ThemedText>
            </Animated.View>

            {[
              { label: "Patient Management", desc: "View, enroll and manage patients", icon: "users" as const, color: "#6366F1" },
              { label: "Compliance & Audit Logs", desc: "HIPAA audit trail and SOC 2 reports", icon: "file-text" as const, color: "#10B981" },
              { label: "Provider Accounts", desc: "Manage provider access and roles", icon: "briefcase" as const, color: "#3B82F6" },
              { label: "AI Operations", desc: "Monitor AI usage, costs and guardrails", icon: "cpu" as const, color: "#8B5CF6" },
            ].map((item, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(350 + i * 60).springify()}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
                      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={[styles.actionIcon, { backgroundColor: isDark ? `${item.color}22` : `${item.color}18` }]}>
                    <Feather name={item.icon} size={18} color={item.color} />
                  </View>
                  <View style={styles.actionText}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {item.label}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {item.desc}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </Pressable>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  loadingState: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statTile: {
    width: "31%",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "flex-start",
    minHeight: 110,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
  },
});
