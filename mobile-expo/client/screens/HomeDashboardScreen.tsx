import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  TextInput,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useAuthContext } from "@/context/AuthContext";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";
import OnboardingChecklist from "@/components/OnboardingChecklist";

const RECORD_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  visit: "user",
  lab: "activity",
  medication: "package",
  imaging: "image",
  procedure: "tool",
  immunization: "shield",
  allergy: "alert-triangle",
  vital: "heart",
  condition: "file-text",
  document: "file",
  appointment: "calendar",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getHealthStatus(alertCount: number, activeMedCount: number, recordCount: number): { label: string; color: string; message: string } {
  if (alertCount > 2) return { label: "Needs Attention", color: "#EF4444", message: "You have alerts that need your review." };
  if (alertCount > 0) return { label: "Updates Available", color: "#F59E0B", message: "New updates found. Review when you're ready." };
  if (recordCount === 0) return { label: "Getting Started", color: "#6366F1", message: "Connect your health records to get started." };
  if (activeMedCount > 0) return { label: "Up to Date", color: "#10B981", message: "Your records are up to date, including active medications." };
  return { label: "Up to Date", color: "#10B981", message: "Your records are up to date." };
}

function SkeletonBox({ width, height, borderRadius = BorderRadius.sm, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const { theme } = useTheme();

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.backgroundTertiary,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

function DashboardSkeleton() {
  return (
    <View style={{ paddingTop: Spacing["2xl"] }}>
      <SkeletonBox width={200} height={28} style={{ marginBottom: Spacing.sm }} />
      <SkeletonBox width="100%" height={20} style={{ marginBottom: Spacing["3xl"] }} />
      <SkeletonBox width="100%" height={160} borderRadius={BorderRadius.xl} style={{ marginBottom: Spacing["2xl"] }} />
      <SkeletonBox width={100} height={16} style={{ marginBottom: Spacing.lg }} />
      <SkeletonBox width="100%" height={72} borderRadius={BorderRadius.md} style={{ marginBottom: Spacing.sm }} />
      <SkeletonBox width="100%" height={72} borderRadius={BorderRadius.md} style={{ marginBottom: Spacing.sm }} />
      <SkeletonBox width="100%" height={72} borderRadius={BorderRadius.md} />
    </View>
  );
}

export default function HomeDashboardScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const { checkFeature, promptProps } = useFeatureGate();

  const [searchActive, setSearchActive] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh] = useState(() => new Date());
  const [showRecentActivity, setShowRecentActivity] = useState(false);

  const { data: records = [], isLoading: recordsLoading, isError: recordsError } = useQuery<any[]>({
    queryKey: ["/api/health-records"],
  });

  const { data: medications = [], isLoading: medsLoading, isError: medsError } = useQuery<any[]>({
    queryKey: ["/api/medications"],
  });

  const { data: alerts = [], isLoading: alertsLoading, isError: alertsError } = useQuery<any[]>({
    queryKey: ["/api/health-records/alerts"],
  });

  const { data: patientProfile } = useQuery<any>({
    queryKey: ["/api/patient-profile"],
  });

  const annualReviewDue = React.useMemo(() => {
    if (!patientProfile) return false;
    const lastReview = patientProfile.annualReviewCompletedAt;
    if (!lastReview) return true;
    const daysSince = Math.floor((Date.now() - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 365;
  }, [patientProfile]);

  const { data: dedupStats } = useQuery<{
    totalPatients: number;
    pendingDuplicates: number;
    autoMerged: number;
    manuallyResolved: number;
    confirmedUnique: number;
  }>({
    queryKey: ["/api/deduplication/stats"],
  });

  const isLoading = recordsLoading || medsLoading || alertsLoading;
  const hasError = recordsError || medsError || alertsError;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/health-records"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/health-records/alerts"] });
    setRefreshing(false);
  }, [queryClient]);

  const activeMedCount = useMemo(() => {
    if (!Array.isArray(medications)) return 0;
    return medications.filter((m: any) => m.status === "active").length;
  }, [medications]);

  const alertCount = useMemo(() => {
    return Array.isArray(alerts) ? alerts.length : 0;
  }, [alerts]);

  const recordCount = Array.isArray(records) ? records.length : 0;

  const insights = useMemo(() => {
    const result: { text: string; icon: keyof typeof Feather.glyphMap; status: "stable" | "neutral" }[] = [];

    if (!Array.isArray(records)) return result;

    const labs = records.filter((r: any) => r.type === "lab");
    if (labs.length > 0) {
      result.push({ text: "Lab results on file", icon: "activity", status: "stable" });
    }

    if (activeMedCount > 0) {
      result.push({ text: `${activeMedCount} active medication${activeMedCount > 1 ? "s" : ""}`, icon: "package", status: "stable" });
    }

    const conditions = records.filter((r: any) => r.type === "condition" && r.status !== "resolved");
    if (conditions.length > 0) {
      result.push({ text: `${conditions.length} active condition${conditions.length > 1 ? "s" : ""}`, icon: "file-text", status: "neutral" });
    }

    const imaging = records.filter((r: any) => r.type === "imaging");
    if (imaging.length > 0) {
      result.push({ text: "Imaging records available", icon: "image", status: "neutral" });
    }

    if (result.length === 0 && recordCount > 0) {
      result.push({ text: `${recordCount} health records synced`, icon: "check-circle", status: "stable" });
    }

    return result.slice(0, 3);
  }, [records, activeMedCount, recordCount]);

  const recentRecords = useMemo(() => {
    if (!Array.isArray(records)) return [];
    return [...records]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [records]);

  const searchResults = useMemo(() => {
    if (!searchText.trim() || !Array.isArray(records)) return [];
    const query = searchText.toLowerCase();
    return records
      .filter((r: any) => r.title?.toLowerCase().includes(query))
      .slice(0, 8);
  }, [searchText, records]);

  const firstAlert = useMemo(() => {
    if (!Array.isArray(alerts) || alerts.length === 0) return null;
    return alerts[0];
  }, [alerts]);

  const healthStatus = getHealthStatus(alertCount, activeMedCount, recordCount);
  const userName = user?.name || "there";

  const statusColors: Record<"stable" | "neutral", string> = {
    stable: theme.success,
    neutral: theme.textSecondary,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing["2xl"],
          paddingHorizontal: Spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {hasError ? (
              <View style={[styles.errorBanner, { backgroundColor: theme.error + "08", borderColor: theme.error + "25" }]}>
                <Feather name="wifi-off" size={18} color={theme.error} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText style={{ fontSize: 14, fontWeight: "600", color: theme.error }}>
                    Unable to load some data
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                    Pull down to refresh and try again
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {/* Onboarding checklist — shown until 3-step setup complete or user dismisses */}
            <OnboardingChecklist
              state={{
                recordsConnected: recordCount > 0,
                providerAdded: Array.isArray(records) && records.some((r: any) => r.type === "visit" || r.provider),
                aiSummaryRun: insights.length > 0,
              }}
              onConnectRecords={() => (navigation as any).navigate("AddSource")}
              onAddProvider={() => (navigation as any).navigate("AddSource")}
              onRunAiSummary={() => (navigation as any).navigate("AIAssistant")}
            />

            {/* LAYER 1: Emotional Anchor — calm, large, breathing room */}
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.emotionalAnchor}>
              <LinearGradient
                colors={isDark
                  ? ["rgba(10,132,255,0.10)", "rgba(99,102,241,0.06)", "transparent"] as [string, string, string]
                  : ["rgba(0,122,255,0.06)", "rgba(99,102,241,0.04)", "transparent"] as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                <ThemedText style={[styles.greeting, { color: theme.text }]}>
                  {getGreeting()},
                </ThemedText>
                <ThemedText style={[styles.greetingName, { color: theme.primary }]}>
                  {userName}
                </ThemedText>
                {recordCount > 0 ? (
                  <View style={[styles.statusCard, {
                    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.7)",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  }]}>
                    <View style={styles.statusCardLeft}>
                      <View style={[styles.statusDotLarge, { backgroundColor: healthStatus.color }]}>
                        <View style={[styles.statusDotInner, { backgroundColor: healthStatus.color }]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.statusLabel, { color: healthStatus.color }]}>
                          {healthStatus.label}
                        </ThemedText>
                        <ThemedText style={[styles.statusMessage, { color: theme.textSecondary }]}>
                          {healthStatus.message}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={[styles.syncTimestamp, { color: theme.textSecondary }]}>
                      Synced {formatTimeAgo(lastRefresh)}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={[styles.statusMessage, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
                    Your health records, in your hands.
                  </ThemedText>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Empty state — hero CTA to import records via TEFCA */}
            {recordCount === 0 ? (
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Pressable
                  testID="button-import-records-hero"
                  onPress={() => navigation.navigate("ProfileTab", { screen: "ConnectHealthRecords" })}
                  accessibilityRole="button"
                  accessibilityLabel="Import your health records automatically from the national network"
                >
                  <LinearGradient
                    colors={isDark ? ["#1e3a5f", "#0f172a"] as [string, string] : ["#e0f2fe", "#f0f9ff"] as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.importHeroCard}
                  >
                    <View style={[styles.importHeroIconBg, { backgroundColor: theme.primary + "18" }]}>
                      <Feather name="download-cloud" size={28} color={theme.primary} />
                    </View>
                    <ThemedText style={[styles.importHeroTitle, { color: theme.text }]}>
                      Import My Records
                    </ThemedText>
                    <ThemedText style={[styles.importHeroSubtext, { color: theme.textSecondary }]}>
                      We find your records automatically from the national TEFCA network. No portal passwords needed.
                    </ThemedText>
                    <View style={[styles.importHeroBtn, { backgroundColor: theme.primary }]}>
                      <Feather name="download-cloud" size={16} color="#FFFFFF" />
                      <ThemedText style={styles.importHeroBtnText}>Import My Records</ThemedText>
                    </View>
                    <View style={styles.importHeroProviders}>
                      <ThemedText style={[styles.importHeroProvidersText, { color: theme.textSecondary }]}>
                        Epic MyChart, Cerner, VA, Medicare, and 50,000+ providers
                      </ThemedText>
                    </View>
                  </LinearGradient>
                </Pressable>

                <View style={styles.valuePropsGrid}>
                  {[
                    { icon: "cloud" as const, title: "50K+ Providers", desc: "National TEFCA network" },
                    { icon: "shield" as const, title: "HIPAA Compliant", desc: "AES-256 encrypted, SOC 2 readiness in flight" },
                    { icon: "globe" as const, title: "52 Languages", desc: "Records in your language" },
                    { icon: "dollar-sign" as const, title: "Free to Join", desc: "$0 premiums, always" },
                  ].map((prop, index) => (
                    <View
                      key={prop.title}
                      style={[styles.valuePropCard, {
                        backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                      }]}
                    >
                      <View style={[styles.valuePropIcon, { backgroundColor: theme.primary + "12" }]}>
                        <Feather name={prop.icon} size={16} color={theme.primary} />
                      </View>
                      <ThemedText style={[styles.valuePropTitle, { color: theme.text }]}>{prop.title}</ThemedText>
                      <ThemedText style={[styles.valuePropDesc, { color: theme.textSecondary }]}>{prop.desc}</ThemedText>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {/* Alert — only if critical */}
            {firstAlert ? (
              <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Pressable
                  testID="button-alert"
                  style={[
                    styles.alertCard,
                    {
                      backgroundColor: firstAlert.severity === "critical" ? theme.error + "08" : theme.warning + "08",
                      borderColor: firstAlert.severity === "critical" ? theme.error + "25" : theme.warning + "25",
                    },
                  ]}
                  onPress={() => navigation.navigate("RecordsTab")}
                  accessibilityRole="button"
                  accessibilityLabel={`Health alert: ${firstAlert.message || firstAlert.title || "Health alert"}. ${firstAlert.severity === "critical" ? "Critical severity" : "Warning"}`}
                  accessibilityHint="Opens your records for review"
                >
                  <View style={[styles.alertIconBg, {
                    backgroundColor: firstAlert.severity === "critical" ? theme.error + "15" : theme.warning + "15",
                  }]}>
                    <Feather
                      name="alert-circle"
                      size={18}
                      color={firstAlert.severity === "critical" ? theme.error : theme.warning}
                    />
                  </View>
                  <ThemedText
                    style={[styles.alertText, {
                      color: firstAlert.severity === "critical" ? theme.error : theme.warning,
                    }]}
                    numberOfLines={2}
                  >
                    {firstAlert.message || firstAlert.title || "Health alert"}
                  </ThemedText>
                  <Feather name="chevron-right" size={16} color={firstAlert.severity === "critical" ? theme.error : theme.warning} />
                </Pressable>
              </Animated.View>
            ) : null}

            {annualReviewDue ? (
              <Animated.View entering={FadeInDown.delay(115).springify()}>
                <Pressable
                  testID="button-annual-review-banner"
                  style={[
                    styles.annualReviewBanner,
                    {
                      backgroundColor: isDark ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.04)",
                      borderColor: isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.1)",
                    },
                  ]}
                  onPress={() => navigation.navigate("ProfileTab", { screen: "AnnualReview" })}
                  accessibilityRole="button"
                  accessibilityLabel="Annual health review is due. Tap to review your care team and pharmacy choices."
                >
                  <View style={[styles.annualReviewIcon, { backgroundColor: "#6366F118" }]}>
                    <Feather name="refresh-cw" size={18} color="#6366F1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.annualReviewTitle, { color: theme.text }]}>
                      Annual Health Review Due
                    </ThemedText>
                    <ThemedText style={[styles.annualReviewSubtext, { color: theme.textSecondary }]}>
                      Take a moment to review your care team and pharmacy preferences
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color="#6366F1" />
                </Pressable>
              </Animated.View>
            ) : null}

            {/* LAYER 2: Intelligence — 3 short insight cards */}
            {insights.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.insightsSection}>
                <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  KEY INSIGHTS
                </ThemedText>
                <View style={[styles.insightsCard, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.80)",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  ...Shadows.cardSubtle,
                }]}>
                  {insights.map((insight, index) => (
                    <View
                      key={index}
                      style={[styles.insightRow,
                        index < insights.length - 1 ? { borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" } : null,
                      ]}
                      accessible={true}
                      accessibilityRole="text"
                      accessibilityLabel={`${insight.text}, status: ${insight.status}`}
                    >
                      <View style={[styles.insightIconBg, { backgroundColor: statusColors[insight.status] + "12" }]}>
                        <Feather name={insight.icon} size={16} color={statusColors[insight.status]} />
                      </View>
                      <ThemedText style={[styles.insightText, { color: theme.text }]}>
                        {insight.text}
                      </ThemedText>
                      <View style={[styles.insightStatusPill, { backgroundColor: statusColors[insight.status] + "12" }]}>
                        <View style={[styles.insightStatusDot, { backgroundColor: statusColors[insight.status] }]} />
                        <ThemedText style={[styles.insightStatusText, { color: statusColors[insight.status] }]}>
                          {insight.status === "stable" ? "Available" : "Info"}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {dedupStats && (dedupStats.autoMerged > 0 || dedupStats.pendingDuplicates > 0) ? (
              <Animated.View entering={FadeInDown.delay(220).springify()}>
                <Pressable
                  testID="button-data-quality"
                  style={[styles.dataQualityCard, {
                    backgroundColor: isDark ? "rgba(99, 102, 241, 0.06)" : "rgba(99, 102, 241, 0.04)",
                    borderColor: isDark ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.1)",
                  }]}
                  onPress={() => navigation.navigate("ProfileTab", { screen: "DedupCenter" })}
                  accessibilityRole="button"
                  accessibilityLabel={`Data quality: ${dedupStats.autoMerged} duplicates resolved${dedupStats.pendingDuplicates > 0 ? `, ${dedupStats.pendingDuplicates} need review` : ""}`}
                >
                  <View style={styles.dataQualityRow}>
                    <View style={[styles.dataQualityIcon, { backgroundColor: "#6366F118" }]}>
                      <Feather name="layers" size={16} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.dataQualityTitle, { color: theme.text }]}>
                        Data Quality
                      </ThemedText>
                      <ThemedText style={[styles.dataQualitySubtext, { color: theme.textSecondary }]}>
                        {dedupStats.autoMerged > 0 ? `${dedupStats.autoMerged} duplicates resolved` : ""}
                        {dedupStats.autoMerged > 0 && dedupStats.pendingDuplicates > 0 ? " \u2022 " : ""}
                        {dedupStats.pendingDuplicates > 0 ? `${dedupStats.pendingDuplicates} need review` : ""}
                      </ThemedText>
                    </View>
                    {dedupStats.pendingDuplicates > 0 ? (
                      <View style={[styles.pendingBadge, { backgroundColor: "#F59E0B20" }]}>
                        <ThemedText style={{ fontSize: 11, fontWeight: "700", color: "#F59E0B" }}>
                          {dedupStats.pendingDuplicates}
                        </ThemedText>
                      </View>
                    ) : (
                      <Feather name="check-circle" size={16} color="#10B981" />
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ) : null}

            {/* Section Divider — only when preceding content exists */}
            {(insights.length > 0 || alertCount > 0 || annualReviewDue) ? (
              <View style={[styles.sectionDivider, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]} />
            ) : null}

            {/* View Full Summary CTA */}
            <Animated.View entering={FadeInDown.delay(260).springify()}>
              <Pressable
                testID="button-view-full-summary"
                style={({ pressed }) => [styles.viewSummaryBtn, { transform: [{ scale: pressed ? 0.97 : 1 }], ...Shadows.cardGlass }]}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                  if (checkFeature("ai_summaries")) {
                    navigation.navigate("HomeTab", { screen: "MyHealthSummary" });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`View My Health Summary${recordCount > 0 ? `, based on ${recordCount} records` : ""}`}
                accessibilityHint="Opens a detailed AI-powered summary of your health"
              >
                <LinearGradient
                  colors={["#6366F1", "#818CF8", "#8B5CF6"] as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.viewSummaryGradient}
                >
                  <View style={styles.viewSummaryContent}>
                    <View style={styles.viewSummaryLeft}>
                      <View style={styles.viewSummaryIconBg}>
                        <Feather name="cpu" size={18} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.viewSummaryTitle}>View My Health Summary</ThemedText>
                        <ThemedText style={styles.viewSummarySubtext}>
                          {recordCount > 0 ? `Based on ${recordCount} records` : "Get personalized insights"}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.viewSummaryArrow}>
                      <Feather name="arrow-right" size={18} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Complete Health Timeline CTA */}
            <Animated.View entering={FadeInDown.delay(280).springify()}>
              <Pressable
                testID="button-health-timeline"
                style={({ pressed }) => [styles.timelineBtn, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
                  borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)",
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  ...Shadows.cardElevated,
                }]}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  navigation.navigate("ProfileTab", { screen: "UnifiedHealthSummary" } as any);
                }}
                accessibilityRole="button"
                accessibilityLabel="View Complete Health Timeline"
              >
                <View style={[styles.timelineIconBg, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="layers" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.timelineTitle, { color: theme.text }]}>Complete Health Timeline</ThemedText>
                  <ThemedText style={[styles.timelineSubtext, { color: theme.textSecondary }]}>
                    {recordCount > 0 ? `${recordCount} events, always up to date` : "All your health events in one place"}
                  </ThemedText>
                </View>
                <View style={[styles.ctaChevron, { backgroundColor: theme.primary + "10" }]}>
                  <Feather name="chevron-right" size={16} color={theme.primary} />
                </View>
              </Pressable>
            </Animated.View>

            {/* Preventive Care CTA */}
            <Animated.View entering={FadeInDown.delay(290).springify()}>
              <Pressable
                testID="button-preventive-care"
                style={({ pressed }) => [styles.timelineBtn, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
                  borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)",
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                  ...Shadows.cardElevated,
                }]}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  navigation.navigate("ProfileTab", { screen: "PreventiveCare" } as any);
                }}
                accessibilityRole="button"
                accessibilityLabel="View Preventive Care Screenings"
              >
                <View style={[styles.timelineIconBg, { backgroundColor: "#10b98115" }]}>
                  <Feather name="check-circle" size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.timelineTitle, { color: theme.text }]}>Preventive Care Guide</ThemedText>
                  <ThemedText style={[styles.timelineSubtext, { color: theme.textSecondary }]}>
                    Screenings, vaccinations, and USPSTF guidelines by age
                  </ThemedText>
                </View>
                <View style={[styles.ctaChevron, { backgroundColor: "#10b98110" }]}>
                  <Feather name="chevron-right" size={16} color="#10b981" />
                </View>
              </Pressable>
            </Animated.View>

            {/* Section Divider */}
            <View style={[styles.sectionDivider, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]} />

            {/* LAYER 3: Quick Access Grid */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                QUICK ACCESS
              </ThemedText>
              <View style={styles.quickGrid}>
                {[
                  { icon: "heart" as const, label: "Medications", color: "#EF4444", screen: "MedicationAdherence", nested: "ProfileTab", gate: "" },
                  { icon: "activity" as const, label: "Lab Results", color: "#10B981", screen: "LabResults", nested: "ProfileTab", gate: "" },
                  { icon: "calendar" as const, label: "Appointments", color: "#3B82F6", screen: "AppointmentScheduling", nested: "ProfileTab", gate: "" },
                  { icon: "trending-up" as const, label: "Vitals", color: "#6366F1", screen: "VitalCharts", nested: "ProfileTab", gate: "" },
                  { icon: "image" as const, label: "Imaging", color: "#F97316", screen: "RecordsTab", nested: "", gate: "" },
                  { icon: "message-circle" as const, label: "Messages", color: "#8B5CF6", screen: "SecureMessaging", nested: "ProfileTab", gate: "secure_messaging" },
                  { icon: "bar-chart-2" as const, label: "Heart Risk", color: "#DC2626", screen: "ASCVDCalculator", nested: "ProfileTab", gate: "" },
                  { icon: "dollar-sign" as const, label: "Savings", color: "#059669", screen: "SavingsHub", nested: "ProfileTab", gate: "" },
                ].map((item, idx) => (
                  <Pressable
                    key={item.label}
                    testID={`quick-${item.label.toLowerCase()}`}
                    style={({ pressed }) => [
                      styles.quickGridItem,
                      {
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.90)",
                        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                        minHeight: 44,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                        ...Shadows.cardSubtle,
                      },
                    ]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      if (item.gate && !checkFeature(item.gate)) return;
                      if (item.nested) {
                        navigation.navigate(item.nested, { screen: item.screen });
                      } else {
                        navigation.navigate(item.screen);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    accessibilityHint={`Navigate to ${item.label}`}
                  >
                    <View style={[styles.quickGridIcon, { backgroundColor: item.color + "10" }]}>
                      <Feather name={item.icon} size={20} color={item.color} />
                    </View>
                    <ThemedText style={[styles.quickGridLabel, { color: theme.text }]} numberOfLines={1}>
                      {item.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            {/* LAYER 4: Actions */}
            <Animated.View entering={FadeInDown.delay(380).springify()} style={styles.actionsSection}>
              <Pressable
                testID="button-action-connect-records"
                style={[styles.actionRow, { borderColor: theme.border, minHeight: 44 }]}
                onPress={() => navigation.navigate("ProfileTab", { screen: "ConnectHealthRecords" })}
                accessibilityRole="button"
                accessibilityLabel="Import records from the national TEFCA network"
              >
                <View style={[styles.actionIconBg, { backgroundColor: theme.recordVisit + "12" }]}>
                  <Feather name="download-cloud" size={20} color={theme.recordVisit} />
                </View>
                <View style={styles.actionTextCol}>
                  <ThemedText style={[styles.actionTitle, { color: theme.text }]}>Import Records</ThemedText>
                  <ThemedText style={[styles.actionSubtext, { color: theme.textSecondary }]}>Auto-find from TEFCA national network</ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                testID="button-action-share-record"
                style={[styles.actionRow, { borderColor: theme.border, minHeight: 44 }]}
                onPress={() => navigation.navigate("ProfileTab", { screen: "Share" })}
                accessibilityRole="button"
                accessibilityLabel="Share Health Story, send a summary to your doctor"
              >
                <View style={[styles.actionIconBg, { backgroundColor: theme.recordLab + "12" }]}>
                  <Feather name="share-2" size={20} color={theme.recordLab} />
                </View>
                <View style={styles.actionTextCol}>
                  <ThemedText style={[styles.actionTitle, { color: theme.text }]}>Share Health Story</ThemedText>
                  <ThemedText style={[styles.actionSubtext, { color: theme.textSecondary }]}>Send a summary to your doctor</ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                testID="button-action-download-summary"
                style={[styles.actionRow, { borderColor: theme.border, borderBottomWidth: 0, minHeight: 44 }]}
                onPress={() => navigation.navigate("ProfileTab", { screen: "PacketExport" })}
                accessibilityRole="button"
                accessibilityLabel="Download Summary, export your complete health record"
              >
                <View style={[styles.actionIconBg, { backgroundColor: theme.recordImaging + "12" }]}>
                  <Feather name="download" size={20} color={theme.recordImaging} />
                </View>
                <View style={styles.actionTextCol}>
                  <ThemedText style={[styles.actionTitle, { color: theme.text }]}>Download Summary</ThemedText>
                  <ThemedText style={[styles.actionSubtext, { color: theme.textSecondary }]}>Export your complete health record</ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            </Animated.View>

            {/* LAYER 4: Deep Data — hidden by default, expandable */}
            <Animated.View entering={FadeInDown.delay(420).springify()}>
              <Pressable
                testID="button-toggle-recent"
                style={[styles.recentToggle, { minHeight: 44 }]}
                onPress={() => setShowRecentActivity(!showRecentActivity)}
                accessibilityRole="button"
                accessibilityLabel={`Recent activity, ${recentRecords.length} items`}
                accessibilityState={{ expanded: showRecentActivity }}
                accessibilityHint={showRecentActivity ? "Collapse recent activity" : "Expand recent activity"}
              >
                <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginBottom: 0 }]}>
                  RECENT ACTIVITY
                </ThemedText>
                <View style={styles.recentToggleRight}>
                  {recentRecords.length > 0 ? (
                    <View style={[styles.recentCountBadge, { backgroundColor: theme.primary + "12" }]}>
                      <ThemedText style={{ fontSize: 11, color: theme.primary, fontWeight: "600" }}>
                        {recentRecords.length}
                      </ThemedText>
                    </View>
                  ) : null}
                  <Feather
                    name={showRecentActivity ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={theme.textSecondary}
                  />
                </View>
              </Pressable>

              {showRecentActivity ? (
                <View style={[styles.recentList, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  {recentRecords.length > 0 ? (
                    recentRecords.map((record: any, index: number) => (
                      <Pressable
                        key={record.id}
                        testID={`recent-record-${record.id}`}
                        style={[
                          styles.recentItem,
                          index < recentRecords.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
                          { minHeight: 44 },
                        ]}
                        onPress={() => navigation.navigate("RecordDetail", { record })}
                        accessibilityRole="button"
                        accessibilityLabel={`${record.title}, ${formatDate(record.date)}${record.provider ? `, ${record.provider}` : ""}`}
                        accessibilityHint="View record details"
                      >
                        <View style={[styles.recentIconBg, { backgroundColor: theme.primary + "10" }]}>
                          <Feather
                            name={RECORD_TYPE_ICONS[record.type] || "file"}
                            size={15}
                            color={theme.primary}
                          />
                        </View>
                        <View style={styles.recentContent}>
                          <ThemedText style={{ fontSize: 14, fontWeight: "500", color: theme.text }} numberOfLines={1}>
                            {record.title}
                          </ThemedText>
                          <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 1 }}>
                            {formatDate(record.date)}
                            {record.provider ? ` \u2022 ${record.provider}` : ""}
                          </ThemedText>
                        </View>
                        <Feather name="chevron-right" size={15} color={theme.textSecondary} />
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.emptyRecent}>
                      <Feather name="inbox" size={24} color={theme.textSecondary} />
                      <ThemedText style={{ fontSize: 13, color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                        No records yet. Connect a health system to get started.
                      </ThemedText>
                    </View>
                  )}
                </View>
              ) : null}
            </Animated.View>

            {/* Search — subtle, at bottom */}
            <Animated.View entering={FadeInDown.delay(480).springify()} style={styles.searchSection}>
              <Pressable
                testID="button-search"
                style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                onPress={() => setSearchActive(true)}
              >
                <Feather name="search" size={16} color={theme.textSecondary} />
                {searchActive ? (
                  <TextInput
                    testID="input-search"
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search records, medications, labs..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoFocus
                    onBlur={() => {
                      if (!searchText.trim()) setSearchActive(false);
                    }}
                  />
                ) : (
                  <ThemedText style={{ fontSize: 13, color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
                    Search records...
                  </ThemedText>
                )}
                {searchActive ? (
                  <Pressable
                    testID="button-search-clear"
                    onPress={() => { setSearchText(""); setSearchActive(false); }}
                    style={styles.searchClearBtn}
                  >
                    <Feather name="x" size={16} color={theme.textSecondary} />
                  </Pressable>
                ) : null}
              </Pressable>

              {searchActive && searchText.trim().length > 0 && searchResults.length === 0 ? (
                <View style={[styles.searchResults, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, padding: Spacing.lg, alignItems: "center" }]}>
                  <Feather name="search" size={20} color={theme.textSecondary} />
                  <ThemedText style={{ fontSize: 13, color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                    No records matching "{searchText}"
                  </ThemedText>
                </View>
              ) : null}
              {searchActive && searchResults.length > 0 ? (
                <View style={[styles.searchResults, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  {searchResults.map((record: any) => (
                    <Pressable
                      key={record.id}
                      testID={`search-result-${record.id}`}
                      style={styles.searchResultItem}
                      onPress={() => navigation.navigate("RecordDetail", { record })}
                    >
                      <Feather
                        name={RECORD_TYPE_ICONS[record.type] || "file"}
                        size={15}
                        color={theme.primary}
                      />
                      <View style={styles.searchResultText}>
                        <ThemedText style={{ fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{record.title}</ThemedText>
                        <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>
                          {formatDate(record.date)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Animated.View>

            {/* Trust Footer */}
            <View style={styles.trustFooter}>
              <View style={styles.trustRow}>
                <Feather name="lock" size={11} color={theme.textSecondary} />
                <ThemedText style={[styles.trustText, { color: theme.textSecondary }]}>
                  End-to-end encrypted
                </ThemedText>
              </View>
              <View style={[styles.trustDivider, { backgroundColor: theme.border }]} />
              <View style={styles.trustRow}>
                <Feather name="shield" size={11} color={theme.textSecondary} />
                <ThemedText style={[styles.trustText, { color: theme.textSecondary }]}>
                  HIPAA compliant
                </ThemedText>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      <UpgradePrompt {...promptProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  emotionalAnchor: {
    marginBottom: Spacing["2xl"],
  },
  heroGradient: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
  },
  greeting: {
    fontSize: 32,
    fontWeight: "300",
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  greetingName: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: Spacing.lg,
  },
  statusCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  statusCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statusDotLarge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.15,
  },
  statusDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  statusMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  syncTimestamp: {
    fontSize: 11,
    textAlign: "right",
  },

  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing["2xl"],
    minHeight: 52,
  },
  alertIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
    lineHeight: 20,
  },

  sectionDivider: {
    height: 1,
    marginVertical: Spacing.lg,
    marginHorizontal: Spacing.md,
  },
  insightsSection: {
    marginBottom: Spacing["2xl"],
  },
  insightsCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  insightIconBg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  insightText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginLeft: Spacing.md,
  },
  insightStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  insightStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  insightStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },

  viewSummaryBtn: {
    marginBottom: Spacing.md,
  },
  viewSummaryArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  timelineBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  ctaChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  timelineSubtext: {
    fontSize: 12,
    marginTop: 1,
  },
  viewSummaryGradient: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  viewSummaryContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    minHeight: 56,
  },
  viewSummaryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  viewSummaryIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  viewSummaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  viewSummarySubtext: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  quickGridItem: {
    flex: 1,
    minWidth: "22%",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
  },
  quickGridIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  quickGridLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  actionsSection: {
    marginBottom: Spacing.xl,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextCol: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionSubtext: {
    fontSize: 12,
    marginTop: 1,
  },

  recentToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  recentToggleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  recentCountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recentList: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  recentIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  recentContent: {
    flex: 1,
    marginLeft: Spacing.sm,
    marginRight: Spacing.sm,
  },
  emptyRecent: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
  },

  searchSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    marginLeft: Spacing.sm,
    height: 42,
  },
  searchClearBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchResults: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  searchResultText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },

  annualReviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  annualReviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  annualReviewTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  annualReviewSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  securityCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  securityCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  securityCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  securityIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  securitySubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  securityStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  securityIndicators: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.xs,
  },
  securityIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  securityIndicatorText: {
    fontSize: 10,
    fontWeight: "500",
  },
  securityIndicatorDivider: {
    width: 1,
    height: 10,
    marginHorizontal: Spacing.sm,
  },
  importHeroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
    marginBottom: Spacing["2xl"],
    overflow: "hidden",
  },
  importHeroIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  importHeroTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  importHeroSubtext: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  importHeroBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: 14,
    borderRadius: BorderRadius.pill,
    marginBottom: Spacing.lg,
  },
  importHeroBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  importHeroProviders: {
    alignItems: "center",
  },
  importHeroProvidersText: {
    fontSize: 12,
    textAlign: "center",
  },
  trustFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    marginTop: Spacing.md,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  trustText: {
    fontSize: 11,
    marginLeft: 4,
  },
  trustDivider: {
    width: 1,
    height: 12,
    marginHorizontal: Spacing.md,
  },
  dataQualityCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dataQualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dataQualityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dataQualityTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  dataQualitySubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  pendingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  valuePropsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  valuePropCard: {
    width: "48%" as any,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: "center",
  },
  valuePropIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  valuePropTitle: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  valuePropDesc: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
});
