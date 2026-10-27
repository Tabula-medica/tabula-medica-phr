import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface AISummaryData {
  overallStatus: string;
  statusColor: string;
  oneLiner: string;
  keyFindings: string[];
  activeProblems: Array<{
    problem: string;
    status: string;
    trend: string;
    note: string;
  }>;
  recentChanges: string[];
  medicationSummary: {
    totalActive: number;
    recentChanges: string[];
    concerns: string[];
  };
  labHighlights: Array<{
    test: string;
    value: string;
    status: string;
    trend: string;
    note: string;
  }>;
  vitalSignsSummary: {
    overall: string;
    highlights: string[];
  };
  preventiveCareGaps: string[];
  riskFactors: string[];
  suggestedActions: Array<{
    action: string;
    priority: string;
    rationale: string;
  }>;
  nextReviewRecommendation: string;
  generatedAt: string;
  confidenceScore: number;
  disclaimer: string;
}

interface AIChartSummaryProps {
  phrData: any;
}

const STATUS_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  stable: { icon: "check-circle", color: "#10B981", label: "Stable" },
  improving: { icon: "trending-up", color: "#3B82F6", label: "Improving" },
  declining: { icon: "trending-down", color: "#F59E0B", label: "Declining" },
  critical: { icon: "alert-octagon", color: "#EF4444", label: "Critical" },
  needs_attention: { icon: "alert-circle", color: "#F59E0B", label: "Needs Attention" },
};

const TREND_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  improving: "trending-up",
  stable: "minus",
  worsening: "trending-down",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444",
  high: "#F59E0B",
  routine: "#10B981",
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function buildPatientDataForAI(phr: any) {
  const conditions = (phr.medicalHistory?.conditions || []).map((c: any) => c.title || c.name || "Unknown");
  const intakeDiagnoses = (phr.medicalHistory?.intakeDiagnoses || []).map((d: any) => d.condition || d.name || "Unknown");
  const allConditions = [...conditions, ...intakeDiagnoses];

  const meds = (phr.medications || []).map((m: any) => ({
    name: m.title || m.name || "Unknown",
    dosage: m.details?.dosage || m.dosage || "",
    frequency: m.details?.frequency || m.frequency || "",
  }));

  const allergies = (phr.allergies || []).map((a: any) => a.title || a.substance || a.name || "Unknown");

  const vitals = (phr.vitals || []).map((v: any) => ({
    type: v.title || v.type || "Unknown",
    value: v.details?.value || v.value || "",
    unit: v.details?.unit || v.unit || "",
    date: v.date || "",
  }));

  const labs = (phr.labResults || []).map((l: any) => ({
    name: l.title || l.name || "Unknown",
    value: l.details?.value || l.value || "",
    unit: l.details?.unit || l.unit || "",
    referenceRange: l.details?.referenceRange || l.referenceRange || "",
    date: l.date || "",
    flag: l.details?.flag || l.flag || "",
  }));

  const recentNotes = (phr.recentVisits || phr.medicalHistory?.conditions || [])
    .slice(0, 5)
    .map((n: any) => ({
      date: n.date,
      summary: n.summary || n.title || "",
      provider: n.provider || "",
    }));

  return {
    patientId: phr.patientInfo?.id || "current",
    name: phr.patientInfo?.name || "Patient",
    conditions: allConditions,
    medications: meds,
    allergies,
    vitals,
    labResults: labs,
    recentNotes,
  };
}

export default function AIChartSummary({ phrData }: AIChartSummaryProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const patientPayload = buildPatientDataForAI(phrData);
  const hasData =
    patientPayload.conditions.length > 0 ||
    patientPayload.medications.length > 0 ||
    patientPayload.vitals.length > 0 ||
    patientPayload.labResults.length > 0;

  const {
    data: summary,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<AISummaryData>({
    queryKey: ["/api/phr/ai-summary"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/phr/ai-summary", { patientData: patientPayload });
      return res.json();
    },
    enabled: hasData,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/phr/ai-summary"] });
    refetch();
  }, [queryClient, refetch]);

  if (!hasData) {
    return null;
  }

  if (isLoading) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]} testID="ai-summary-loading">
          <View style={styles.loadingHeader}>
            <View style={[styles.aiIconCircle, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="cpu" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700", letterSpacing: 0.5 }}>
                AI HEALTH SUMMARY
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Analyzing your health data...
              </ThemedText>
            </View>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
          <View style={styles.loadingBars}>
            <View style={[styles.loadingBar, { backgroundColor: `${theme.primary}10`, width: "90%" }]} />
            <View style={[styles.loadingBar, { backgroundColor: `${theme.primary}08`, width: "70%" }]} />
            <View style={[styles.loadingBar, { backgroundColor: `${theme.primary}06`, width: "50%" }]} />
          </View>
        </View>
      </Animated.View>
    );
  }

  if (isError || !summary) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Pressable
          onPress={handleRefresh}
          style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
          testID="ai-summary-error"
        >
          <View style={styles.errorRow}>
            <Feather name="refresh-cw" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
              Tap to generate AI health summary
            </ThemedText>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  const statusConfig = STATUS_CONFIG[summary.overallStatus] || STATUS_CONFIG.stable;

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100)} testID="ai-chart-summary">
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable onPress={() => setExpanded(!expanded)} style={styles.header} testID="ai-summary-toggle">
          <View style={[styles.aiIconCircle, { backgroundColor: `${statusConfig.color}15` }]}>
            <Feather name={statusConfig.icon} size={18} color={statusConfig.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700", letterSpacing: 0.5 }}>
                AI HEALTH SUMMARY
              </ThemedText>
              <View style={[styles.statusPill, { backgroundColor: `${statusConfig.color}15` }]}>
                <ThemedText style={[styles.statusPillText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={{ color: theme.text, marginTop: 2 }} numberOfLines={expanded ? undefined : 2}>
              {summary.oneLiner}
            </ThemedText>
          </View>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textSecondary}
            style={{ marginLeft: Spacing.sm }}
          />
        </Pressable>

        {expanded ? (
          <Animated.View entering={FadeIn.duration(200)}>
            {summary.keyFindings && summary.keyFindings.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  KEY FINDINGS
                </ThemedText>
                {summary.keyFindings.map((finding, i) => (
                  <View key={`finding-${i}`} style={styles.findingRow}>
                    <View style={[styles.findingDot, { backgroundColor: theme.primary }]} />
                    <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
                      {finding}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {summary.activeProblems && summary.activeProblems.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  ACTIVE PROBLEMS
                </ThemedText>
                {summary.activeProblems.slice(0, 5).map((prob, i) => {
                  const trendIcon = TREND_ICONS[prob.trend] || "minus";
                  const trendColor =
                    prob.trend === "improving" ? "#10B981" : prob.trend === "worsening" ? "#EF4444" : theme.textSecondary;
                  const statusColor =
                    prob.status === "uncontrolled" || prob.status === "new"
                      ? "#EF4444"
                      : prob.status === "monitoring"
                        ? "#F59E0B"
                        : "#10B981";
                  return (
                    <View key={`prob-${i}`} style={[styles.problemRow, { backgroundColor: `${statusColor}08` }]}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.problemHeader}>
                          <ThemedText type="body" style={{ color: theme.text, fontWeight: "600", flex: 1 }}>
                            {prob.problem}
                          </ThemedText>
                          <View style={[styles.tinyPill, { backgroundColor: `${statusColor}15` }]}>
                            <ThemedText style={{ fontSize: 10, color: statusColor, fontWeight: "600" }}>
                              {prob.status}
                            </ThemedText>
                          </View>
                        </View>
                        {prob.note ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                            {prob.note}
                          </ThemedText>
                        ) : null}
                      </View>
                      <Feather name={trendIcon} size={16} color={trendColor} style={{ marginLeft: Spacing.sm }} />
                    </View>
                  );
                })}
              </View>
            ) : null}

            {summary.labHighlights && summary.labHighlights.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  LAB HIGHLIGHTS
                </ThemedText>
                {summary.labHighlights.slice(0, 4).map((lab, i) => {
                  const labColor =
                    lab.status === "critical" ? "#EF4444" : lab.status === "abnormal" ? "#F59E0B" : "#10B981";
                  const trendIcon = TREND_ICONS[lab.trend] || "minus";
                  return (
                    <View key={`lab-${i}`} style={styles.labRow}>
                      <View style={[styles.labDot, { backgroundColor: labColor }]} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <ThemedText type="small" style={{ color: theme.text, fontWeight: "600" }}>
                            {lab.test}
                          </ThemedText>
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <ThemedText type="small" style={{ color: labColor, fontWeight: "600", marginRight: 4 }}>
                              {lab.value}
                            </ThemedText>
                            <Feather name={trendIcon} size={12} color={labColor} />
                          </View>
                        </View>
                        {lab.note ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>
                            {lab.note}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {summary.suggestedActions && summary.suggestedActions.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  SUGGESTED ACTIONS
                </ThemedText>
                {summary.suggestedActions.slice(0, 3).map((action, i) => {
                  const pColor = PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.routine;
                  return (
                    <View key={`action-${i}`} style={[styles.actionRow, { borderLeftColor: pColor }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                        <View style={[styles.tinyPill, { backgroundColor: `${pColor}15` }]}>
                          <ThemedText style={{ fontSize: 9, color: pColor, fontWeight: "700", textTransform: "uppercase" }}>
                            {action.priority}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText type="small" style={{ color: theme.text, fontWeight: "500" }}>
                        {action.action}
                      </ThemedText>
                      {action.rationale ? (
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, marginTop: 1 }}>
                          {action.rationale}
                        </ThemedText>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {summary.preventiveCareGaps && summary.preventiveCareGaps.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  PREVENTIVE CARE GAPS
                </ThemedText>
                {summary.preventiveCareGaps.slice(0, 3).map((gap, i) => (
                  <View key={`gap-${i}`} style={styles.findingRow}>
                    <Feather name="alert-triangle" size={12} color="#F59E0B" style={{ marginRight: Spacing.sm, marginTop: 2 }} />
                    <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
                      {gap}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.footer}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Feather name="clock" size={11} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginLeft: 4 }}>
                  {summary.generatedAt ? formatTimeAgo(summary.generatedAt) : ""}
                </ThemedText>
                {summary.confidenceScore ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginLeft: Spacing.sm }}>
                    Confidence: {summary.confidenceScore}%
                  </ThemedText>
                ) : null}
              </View>
              <Pressable onPress={handleRefresh} style={styles.refreshButton} testID="ai-summary-refresh">
                {isFetching ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Feather name="refresh-cw" size={14} color={theme.primary} />
                )}
              </Pressable>
            </View>

            <ThemedText type="small" style={[styles.disclaimer, { color: theme.textSecondary }]}>
              {summary.disclaimer || "AI-generated summary. Must be verified by a licensed healthcare provider."}
            </ThemedText>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  aiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  statusPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  loadingHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingBars: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  loadingBar: {
    height: 12,
    borderRadius: 6,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  section: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  sectionLabel: {
    fontWeight: "700",
    letterSpacing: 0.8,
    fontSize: 10,
    marginBottom: Spacing.sm,
  },
  findingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  findingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  problemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  problemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tinyPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  labRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
    paddingVertical: 2,
  },
  labDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: Spacing.sm,
  },
  actionRow: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  refreshButton: {
    padding: Spacing.xs,
  },
  disclaimer: {
    fontSize: 9,
    marginTop: Spacing.xs,
    fontStyle: "italic",
    textAlign: "center",
  },
});
