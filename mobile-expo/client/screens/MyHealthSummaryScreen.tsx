import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator, Share, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useAuthContext } from "@/context/AuthContext";

const DISCLAIMER_TEXT = "This is not medical advice. Always consult your healthcare provider for medical decisions.";

type ReadingLevel = "simple" | "detailed";

interface HealthSummaryData {
  overallStatus: string;
  statusSeverity?: "good" | "fair" | "needs-attention";
  conditions: Array<{ name: string; simplifiedExplanation: string; status: string; urgency?: string }>;
  medications: Array<{ name: string; purpose: string; schedule: string; importantNotes: string }>;
  upcomingAppointments: Array<{ type: string; provider: string; date: string; whatToExpect: string; prepInstructions?: string }>;
  recentResults: Array<{ testName: string; result: string; whatItMeans: string; status: string; trend?: string }>;
  aiInsights: Array<{ title: string; summary: string; actionItem: string; priority?: string }>;
  wellnessTips: string[];
  careGaps?: Array<{ gap: string; recommendation: string; timeframe: string }>;
  lastUpdated: string;
  readingLevel?: string;
  disclaimer: string;
  fromCache?: boolean;
  snapshot: {
    totalRecords: number;
    conditionCount: number;
    activeMedications: number;
    upcomingAppointmentCount: number;
    recentLabCount: number;
    activeGoals: number;
  };
}

function getStatusBadgeColor(status: string, theme: any): string {
  const lower = (status || "").toLowerCase();
  if (lower === "stable" || lower === "controlled" || lower === "improving") return theme.success;
  if (lower === "monitoring" || lower === "new") return theme.warning;
  if (lower === "worsening") return theme.error;
  return theme.textSecondary;
}

function getResultStatusColor(status: string, theme: any): string {
  const lower = (status || "").toLowerCase();
  if (lower === "normal") return theme.success;
  if (lower === "borderline") return theme.warning;
  if (lower === "abnormal" || lower === "critical") return theme.error;
  return theme.textSecondary;
}

function getSeverityConfig(severity: string | undefined, theme: any) {
  switch (severity) {
    case "good":
      return { icon: "check-circle" as const, color: theme.success, label: "Looking Good" };
    case "needs-attention":
      return { icon: "alert-triangle" as const, color: theme.error, label: "Needs Attention" };
    default:
      return { icon: "info" as const, color: theme.warning, label: "Fair" };
  }
}

function getPriorityColor(priority: string | undefined, theme: any): string {
  switch (priority) {
    case "high": return theme.error;
    case "medium": return theme.warning;
    default: return theme.success;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getTrendIcon(status: string): "trending-up" | "trending-down" | "minus" {
  const lower = (status || "").toLowerCase();
  if (lower === "improving" || lower === "normal" || lower === "controlled") return "trending-up";
  if (lower === "worsening" || lower === "abnormal" || lower === "critical") return "trending-down";
  return "minus";
}

function getRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const updated = new Date(dateStr).getTime();
    const diffMs = now - updated;
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return "Refreshed just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Refreshed ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Refreshed ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Refreshed ${diffDays}d ago`;
  } catch {
    return "";
  }
}

export default function MyHealthSummaryScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("simple");

  const { data, isLoading, error, refetch, isRefetching } = useQuery<HealthSummaryData>({
    queryKey: ["/api/my-health-summary", readingLevel],
    queryFn: async () => {
      const url = new URL(`/api/my-health-summary?readingLevel=${readingLevel}`, getApiUrl());
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers["x-user-id"] = user.id;
      }
      const response = await fetch(url.toString(), { headers });
      if (!response.ok) throw new Error("Failed to load summary");
      return response.json();
    },
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [relativeTime, setRelativeTime] = useState("");

  useEffect(() => {
    if (data?.lastUpdated) {
      setRelativeTime(getRelativeTime(data.lastUpdated));
      const interval = setInterval(() => {
        setRelativeTime(getRelativeTime(data.lastUpdated));
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [data?.lastUpdated]);

  const showToast = useCallback((message: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToastMessage(message);
    toastTimeout.current = setTimeout(() => setToastMessage(null), 2000);
  }, []);

  const handleActionPress = useCallback((message: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(message);
  }, [showToast]);

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/my-health-summary", readingLevel] });
    refetch();
  }, [refetch, queryClient, readingLevel]);

  const handleForceRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const url = new URL(`/api/my-health-summary?readingLevel=${readingLevel}&refresh=true`, getApiUrl());
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers["x-user-id"] = user.id;
      }
      const response = await fetch(url.toString(), { headers });
      if (response.ok) {
        const fresh = await response.json();
        queryClient.setQueryData(["/api/my-health-summary", readingLevel], fresh);
        showToast("Summary regenerated");
      }
    } catch {
      showToast("Could not refresh");
    }
  }, [readingLevel, queryClient, showToast]);

  const handleShare = useCallback(async () => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sections: string[] = [];
    sections.push(`Health Summary - ${formatDate(data.lastUpdated)}`);
    sections.push(`\nOverview: ${data.overallStatus}`);
    if (data.conditions.length > 0) {
      sections.push("\nConditions:");
      data.conditions.forEach(c => sections.push(`  - ${c.name}: ${c.simplifiedExplanation}`));
    }
    if (data.medications.length > 0) {
      sections.push("\nMedications:");
      data.medications.forEach(m => sections.push(`  - ${m.name}: ${m.purpose} (${m.schedule})`));
    }
    if (data.wellnessTips.length > 0) {
      sections.push("\nWellness Tips:");
      data.wellnessTips.forEach((t, i) => sections.push(`  ${i + 1}. ${t}`));
    }
    sections.push(`\n${data.disclaimer}`);
    try {
      await Share.share({ message: sections.join("\n"), title: "My Health Summary" });
    } catch {
      showToast("Unable to share");
    }
  }, [data, showToast]);

  const toggleReadingLevel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReadingLevel(prev => prev === "simple" ? "detailed" : "simple");
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="small" style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          Preparing your health summary...
        </ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.primary + "12" }]}>
          <Feather name="heart" size={32} color={theme.primary} />
        </View>
        <ThemedText type="h4" style={{ marginTop: Spacing.lg, color: theme.text }}>Your summary is not ready yet</ThemedText>
        <ThemedText type="small" style={{ marginTop: Spacing.sm, color: theme.textSecondary, textAlign: "center", paddingHorizontal: Spacing.xl, lineHeight: 20 }}>
          We could not load your health summary right now. This can happen if your records are still syncing or the connection is slow.
        </ThemedText>
        <Pressable onPress={handleRefresh} style={[styles.retryButton, { backgroundColor: theme.primary }]} testID="button-retry">
          <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>Try Again</ThemedText>
        </Pressable>
      </View>
    );
  }

  const summary = data;
  const severityConfig = getSeverityConfig(summary?.statusSeverity, theme);
  let sectionIndex = 0;

  if ((summary as any)?.isEmpty) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl, paddingHorizontal: Spacing.lg, flexGrow: 1, justifyContent: "center" }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={theme.primary} />}
        >
          <View style={{ alignItems: "center" }}>
            <View style={[styles.emptyIconContainer, { backgroundColor: theme.primary + "12" }]}>
              <Feather name="heart" size={32} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, color: theme.text, textAlign: "center" }}>
              Welcome to Your Health Summary
            </ThemedText>
            <ThemedText type="body" style={{ marginTop: Spacing.md, color: theme.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: Spacing.lg }}>
              {summary?.overallStatus || "Connect your health records to see a personalized summary of your conditions, medications, and more."}
            </ThemedText>
            {summary?.wellnessTips && summary.wellnessTips.length > 0 ? (
              <Card style={{ marginTop: Spacing.xl, width: "100%" }}>
                {summary.wellnessTips.map((tip: string, index: number) => (
                  <View key={index} style={[styles.tipRow, index === summary.wellnessTips.length - 1 ? { marginBottom: 0 } : undefined]}>
                    <Feather name="arrow-right" size={14} color={theme.primary} />
                    <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.text }}>{tip}</ThemedText>
                  </View>
                ))}
              </Card>
            ) : null}
            <ThemedText type="caption" style={{ marginTop: Spacing.xl, color: theme.textSecondary, textAlign: "center" }}>
              {summary?.disclaimer || DISCLAIMER_TEXT}
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl, paddingHorizontal: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="reading-level-toggle">
          <View style={styles.controlBar}>
            <Pressable
              onPress={toggleReadingLevel}
              style={[styles.levelToggle, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              testID="button-toggle-reading-level"
            >
              <Feather name={readingLevel === "simple" ? "book" : "book-open"} size={14} color={theme.primary} />
              <ThemedText type="caption" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
                {readingLevel === "simple" ? "Simple" : "Detailed"}
              </ThemedText>
            </Pressable>
            {summary?.fromCache ? (
              <Pressable
                onPress={handleForceRefresh}
                style={[styles.refreshPill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                testID="button-force-refresh"
              >
                <Feather name="refresh-cw" size={12} color={theme.textSecondary} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>Regenerate</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleShare}
              style={[styles.refreshPill, { backgroundColor: theme.primary + "15" }]}
              testID="button-share-summary"
              accessibilityRole="button"
              accessibilityLabel="Share health summary"
            >
              <Feather name="share-2" size={14} color={theme.primary} />
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-overall-status">
          <Card variant="glass" style={styles.overallCard}>
            <View style={styles.overallContent}>
              <View style={[styles.severityBadge, { backgroundColor: severityConfig.color + "18" }]}>
                <Feather name={severityConfig.icon} size={16} color={severityConfig.color} />
                <ThemedText type="caption" style={{ color: severityConfig.color, marginLeft: Spacing.xs, fontWeight: "600" }}>
                  {severityConfig.label}
                </ThemedText>
              </View>
              <ThemedText type="h2" style={{ marginTop: Spacing.md, color: theme.text, textAlign: "center" }}>
                {summary?.overallStatus || "No status available"}
              </ThemedText>
              {summary?.lastUpdated ? (
                <View style={{ alignItems: "center", marginTop: Spacing.sm }}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {relativeTime || formatDate(summary.lastUpdated)}
                  </ThemedText>
                </View>
              ) : null}
              {summary?.snapshot ? (
                <View style={styles.snapshotRow}>
                  <View style={styles.snapshotItem}>
                    <ThemedText type="h4" style={{ color: theme.primary }}>{summary.snapshot.totalRecords}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Records</ThemedText>
                  </View>
                  <View style={styles.snapshotItem}>
                    <ThemedText type="h4" style={{ color: theme.primary }}>{summary.snapshot.activeMedications}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Meds</ThemedText>
                  </View>
                  <View style={styles.snapshotItem}>
                    <ThemedText type="h4" style={{ color: theme.primary }}>{summary.snapshot.upcomingAppointmentCount}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Appts</ThemedText>
                  </View>
                  <View style={styles.snapshotItem}>
                    <ThemedText type="h4" style={{ color: theme.primary }}>{summary.snapshot.recentLabCount}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>Labs</ThemedText>
                  </View>
                </View>
              ) : null}
            </View>
          </Card>
        </Animated.View>

        {summary?.careGaps && summary.careGaps.length > 0 ? (
          <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-care-gaps-section">
            <Pressable onPress={() => toggleSection("careGaps")} style={styles.sectionHeader}>
              <Feather name="alert-circle" size={20} color={theme.warning} />
              <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>Care Gaps</ThemedText>
              <View style={[styles.countBadge, { backgroundColor: theme.warning + "20" }]}>
                <ThemedText type="caption" style={{ color: theme.warning, fontWeight: "600" }}>{summary.careGaps.length}</ThemedText>
              </View>
              <Feather name={collapsedSections.careGaps ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} style={{ marginLeft: Spacing.sm }} />
            </Pressable>
            {!collapsedSections.careGaps ? (
              summary.careGaps.map((gap, index) => (
                <Card key={index} style={[styles.itemCard, { borderLeftWidth: 3, borderLeftColor: theme.warning }]}>
                  <ThemedText type="h4" style={{ color: theme.text }}>{gap.gap}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>{gap.recommendation}</ThemedText>
                  <View style={[styles.timeframeBadge, { backgroundColor: theme.warning + "12" }]}>
                    <Feather name="clock" size={12} color={theme.warning} />
                    <ThemedText type="caption" style={{ color: theme.warning, marginLeft: 4 }}>{gap.timeframe}</ThemedText>
                  </View>
                </Card>
              ))
            ) : null}
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-conditions-section">
          <Pressable onPress={() => toggleSection("conditions")} style={styles.sectionHeader}>
            <Feather name="file-text" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>My Conditions</ThemedText>
            {summary?.conditions && summary.conditions.length > 0 ? (
              <View style={[styles.countBadge, { backgroundColor: theme.primary + "15" }]}>
                <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>{summary.conditions.length}</ThemedText>
              </View>
            ) : null}
            <Feather name={collapsedSections.conditions ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} style={{ marginLeft: Spacing.sm }} />
          </Pressable>
          {!collapsedSections.conditions ? (
            <>
              {summary?.conditions && summary.conditions.length > 0 ? (
                summary.conditions.map((condition, index) => (
                  <Card key={index} accent="visit" style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <ThemedText type="h4" style={{ flex: 1, color: theme.text }}>{condition.name}</ThemedText>
                      <Feather
                        name={getTrendIcon(condition.status)}
                        size={14}
                        color={getStatusBadgeColor(condition.status, theme)}
                        style={{ marginRight: Spacing.xs }}
                      />
                      <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor(condition.status, theme) + "20" }]}>
                        <ThemedText type="caption" style={{ color: getStatusBadgeColor(condition.status, theme) }}>
                          {condition.status}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                      {condition.simplifiedExplanation}
                    </ThemedText>
                    {condition.urgency && condition.urgency !== "routine" ? (
                      <View style={[styles.urgencyBadge, { backgroundColor: condition.urgency === "urgent" ? theme.error + "15" : theme.warning + "15" }]}>
                        <Feather name="alert-triangle" size={12} color={condition.urgency === "urgent" ? theme.error : theme.warning} />
                        <ThemedText type="caption" style={{ color: condition.urgency === "urgent" ? theme.error : theme.warning, marginLeft: 4 }}>
                          {condition.urgency === "urgent" ? "Urgent" : "Follow up soon"}
                        </ThemedText>
                      </View>
                    ) : null}
                  </Card>
                ))
              ) : (
                <ThemedText type="small" style={styles.emptyText}>No active conditions on file</ThemedText>
              )}
            </>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-medications-section">
          <Pressable onPress={() => toggleSection("medications")} style={styles.sectionHeader}>
            <Feather name="package" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>My Medications</ThemedText>
            {summary?.medications && summary.medications.length > 0 ? (
              <View style={[styles.countBadge, { backgroundColor: theme.primary + "15" }]}>
                <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>{summary.medications.length}</ThemedText>
              </View>
            ) : null}
            <Feather name={collapsedSections.medications ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} style={{ marginLeft: Spacing.sm }} />
          </Pressable>
          {!collapsedSections.medications ? (
            <>
              {summary?.medications && summary.medications.length > 0 ? (
                summary.medications.map((med, index) => (
                  <Card key={index} accent="medication" style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <ThemedText type="h4" style={{ flex: 1, color: theme.text }}>{med.name}</ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>{med.purpose}</ThemedText>
                    <View style={styles.medDetailRow}>
                      <Feather name="clock" size={14} color={theme.textSecondary} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>{med.schedule}</ThemedText>
                    </View>
                    {med.importantNotes ? (
                      <View style={[styles.noteBox, { backgroundColor: theme.backgroundSecondary }]}>
                        <ThemedText type="caption" style={{ color: theme.warning }}>{med.importantNotes}</ThemedText>
                      </View>
                    ) : null}
                  </Card>
                ))
              ) : (
                <ThemedText type="small" style={styles.emptyText}>No active medications on file</ThemedText>
              )}
            </>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-appointments-section">
          <Pressable onPress={() => toggleSection("appointments")} style={styles.sectionHeader}>
            <Feather name="calendar" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>Upcoming Appointments</ThemedText>
            <Feather name={collapsedSections.appointments ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} />
          </Pressable>
          {!collapsedSections.appointments ? (
            <>
              {summary?.upcomingAppointments && summary.upcomingAppointments.length > 0 ? (
                summary.upcomingAppointments.map((appt, index) => (
                  <Card key={index} accent="primary" style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Feather name="calendar" size={16} color={theme.primary} />
                      <ThemedText type="h4" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>{appt.type}</ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>{appt.provider}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.primary, marginTop: Spacing.xs }}>{formatDate(appt.date)}</ThemedText>
                    {appt.whatToExpect ? (
                      <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>{appt.whatToExpect}</ThemedText>
                    ) : null}
                    {appt.prepInstructions ? (
                      <View style={[styles.prepBox, { backgroundColor: theme.primary + "08", borderLeftColor: theme.primary }]}>
                        <Feather name="info" size={12} color={theme.primary} />
                        <ThemedText type="caption" style={{ color: theme.text, marginLeft: Spacing.xs, flex: 1 }}>{appt.prepInstructions}</ThemedText>
                      </View>
                    ) : null}
                  </Card>
                ))
              ) : (
                <ThemedText type="small" style={styles.emptyText}>No upcoming appointments scheduled</ThemedText>
              )}
            </>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-results-section">
          <Pressable onPress={() => toggleSection("results")} style={styles.sectionHeader}>
            <Feather name="activity" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>Recent Results</ThemedText>
            <Feather name={collapsedSections.results ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} />
          </Pressable>
          {!collapsedSections.results ? (
            <>
              {summary?.recentResults && summary.recentResults.length > 0 ? (
                summary.recentResults.map((result, index) => (
                  <Card key={index} accent="lab" style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <ThemedText type="h4" style={{ flex: 1, color: theme.text }}>{result.testName}</ThemedText>
                      {result.trend ? (
                        <View style={[styles.trendBadge, { backgroundColor: getStatusBadgeColor(result.trend, theme) + "15" }]}>
                          <Feather name={getTrendIcon(result.trend)} size={12} color={getStatusBadgeColor(result.trend, theme)} />
                          <ThemedText type="caption" style={{ color: getStatusBadgeColor(result.trend, theme), marginLeft: 2 }}>{result.trend}</ThemedText>
                        </View>
                      ) : null}
                      <View style={[styles.statusDot, { backgroundColor: getResultStatusColor(result.status, theme) }]} />
                    </View>
                    <ThemedText type="body" style={{ color: theme.text, marginTop: Spacing.xs }}>{result.result}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>{result.whatItMeans}</ThemedText>
                    <View style={styles.resultFooter}>
                      <View style={[styles.statusBadge, { backgroundColor: getResultStatusColor(result.status, theme) + "20" }]}>
                        <ThemedText type="caption" style={{ color: getResultStatusColor(result.status, theme) }}>
                          {result.status}
                        </ThemedText>
                      </View>
                    </View>
                  </Card>
                ))
              ) : (
                <ThemedText type="small" style={styles.emptyText}>No recent lab results available</ThemedText>
              )}
            </>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-insights-section">
          <Pressable onPress={() => toggleSection("insights")} style={styles.sectionHeader}>
            <Feather name="sun" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>AI Insights</ThemedText>
            <Feather name={collapsedSections.insights ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} />
          </Pressable>
          {!collapsedSections.insights ? (
            <>
              {summary?.aiInsights && summary.aiInsights.length > 0 ? (
                summary.aiInsights.slice(0, 3).map((insight, index) => (
                  <Card key={index} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Feather name="sun" size={18} color={theme.warning} />
                      <ThemedText type="h4" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>{insight.title}</ThemedText>
                      {insight.priority ? (
                        <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(insight.priority, theme) }]} />
                      ) : null}
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>{insight.summary}</ThemedText>
                    <View style={[styles.actionBox, { backgroundColor: theme.backgroundSecondary, borderLeftColor: theme.primary }]}>
                      <ThemedText type="small" style={{ color: theme.text }}>{insight.actionItem}</ThemedText>
                    </View>
                  </Card>
                ))
              ) : (
                <ThemedText type="small" style={styles.emptyText}>No AI insights available at this time</ThemedText>
              )}
            </>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)} testID="summary-tips-section">
          <Pressable onPress={() => toggleSection("tips")} style={styles.sectionHeader}>
            <Feather name="check-circle" size={20} color={theme.primary} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm, flex: 1, color: theme.text }}>Wellness Tips</ThemedText>
            <Feather name={collapsedSections.tips ? "chevron-down" : "chevron-up"} size={20} color={theme.textSecondary} />
          </Pressable>
          {!collapsedSections.tips ? (
            <>
              {summary?.wellnessTips && summary.wellnessTips.length > 0 ? (
                <Card style={styles.itemCard}>
                  {summary.wellnessTips.map((tip, index) => (
                    <View key={index} style={styles.tipRow}>
                      <Feather name="check-circle" size={16} color={theme.success} />
                      <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.text }}>
                        {index + 1}. {tip}
                      </ThemedText>
                    </View>
                  ))}
                </Card>
              ) : (
                <ThemedText type="small" style={styles.emptyText}>No wellness tips available</ThemedText>
              )}
            </>
          ) : null}
        </Animated.View>

        {summary?.disclaimer ? (
          <Animated.View entering={FadeInDown.delay((sectionIndex++) * 80)}>
            <ThemedText type="caption" style={[styles.disclaimer, { color: theme.textSecondary }]}>
              {summary.disclaimer}
            </ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      {toastMessage ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.toast, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
        >
          <Feather name="info" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.text, marginLeft: Spacing.sm }}>{toastMessage}</ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  levelToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "transparent",
  },
  overallCard: {
    marginBottom: Spacing.lg,
  },
  overallContent: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  severityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: Spacing.lg,
  },
  snapshotItem: {
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  itemCard: {
    marginBottom: Spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: Spacing.sm,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  urgencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  medDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  noteBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
  },
  prepBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
    borderLeftWidth: 3,
  },
  timeframeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  actionBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
    borderLeftWidth: 3,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: "#9CA3AF",
    fontStyle: "italic",
    paddingVertical: Spacing.md,
  },
  disclaimer: {
    marginTop: Spacing.xl,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  resultFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  toast: {
    position: "absolute",
    bottom: 100,
    left: Spacing.xl,
    right: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
