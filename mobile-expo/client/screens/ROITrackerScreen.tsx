import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

type Period = 7 | 30 | 90;

interface ROIMetrics {
  wastePrevention: {
    totalDuplicatesFlagged: number;
    totalDuplicatesBlocked: number;
    totalGhostSavings: number;
    savingsByTestType: Array<{ testType: string; count: number; savings: number }>;
    avgDuplicateRate: number;
    industryBenchmarkRate: number;
  };
  systemLoad: {
    totalEhrSyncs: number;
    activeSyncsNow: number;
    syncSuccessRate: number;
    avgSyncLatencyMs: number;
    last24hSyncs: number;
    uptimePercent: number;
  };
  aiAccuracy: {
    totalExtractions: number;
    totalOverrides: number;
    accuracyRate: number;
    extractionsByType: Array<{ type: string; count: number; overrides: number }>;
    confidenceDistribution: { high: number; medium: number; low: number };
  };
  timeROI: {
    avgSecondsPerRecord: number;
    manualBaselineSeconds: number;
    timeSavedPerRecord: number;
    totalRecordsProcessed: number;
    totalHoursSaved: number;
    minutesSavedPerPatient: number;
  };
  dataIntegrity: {
    avgCleanliness: number;
    recordsScanned: number;
    issuesFound: number;
    issuesResolved: number;
    scoreDistribution: { excellent: number; good: number; fair: number; poor: number };
  };
  summary: {
    totalSavings: number;
    totalTimeSavedHours: number;
    totalRecords: number;
    totalUsers: number;
    totalOrgs: number;
    periodStart: string;
    periodEnd: string;
  };
}

interface DemoReport {
  generatedAt: string;
  periodLabel: string;
  metrics: ROIMetrics;
  highlights: string[];
  benchmarkComparisons: Array<{
    metric: string;
    ourValue: number;
    industryAvg: number;
    percentBetter: number;
  }>;
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
  theme,
  delay = 0,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  subtext?: string;
  color: string;
  theme: any;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={styles.statCardWrapper}>
      <Card style={styles.statCard}>
        <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
          <Feather name={icon} size={16} color={color} />
        </View>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        {subtext ? (
          <ThemedText style={[styles.statSubtext, { color }]}>{subtext}</ThemedText>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function ProgressBar({
  value,
  maxValue,
  color,
  theme,
}: {
  value: number;
  maxValue: number;
  color: string;
  theme: any;
}) {
  const pct = Math.min(100, Math.max(0, (value / maxValue) * 100));
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function BenchmarkRow({
  metric,
  ourValue,
  industryAvg,
  percentBetter,
  theme,
}: {
  metric: string;
  ourValue: number;
  industryAvg: number;
  percentBetter: number;
  theme: any;
}) {
  const isPositive = percentBetter > 0;
  return (
    <View style={[styles.benchRow, { borderBottomColor: theme.border }]}>
      <ThemedText style={styles.benchMetric} numberOfLines={1}>
        {metric}
      </ThemedText>
      <View style={styles.benchValues}>
        <ThemedText style={[styles.benchOur, { color: theme.primary }]}>
          {ourValue}
        </ThemedText>
        <ThemedText style={[styles.benchIndustry, { color: theme.textSecondary }]}>
          vs {industryAvg}
        </ThemedText>
        <View style={[styles.benchBadge, { backgroundColor: isPositive ? "#34C75918" : "#FF3B3018" }]}>
          <Feather
            name={isPositive ? "trending-up" : "trending-down"}
            size={10}
            color={isPositive ? "#34C759" : "#FF3B30"}
          />
          <ThemedText style={{ fontSize: 10, fontWeight: "600", color: isPositive ? "#34C759" : "#FF3B30" }}>
            {Math.abs(percentBetter)}%
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

export default function ROITrackerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [period, setPeriod] = useState<Period>(30);
  const [activeTab, setActiveTab] = useState<"overview" | "waste" | "ai" | "time" | "report">("overview");

  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["roi-metrics", period],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/roi/metrics?days=${period}`);
      return res.json() as Promise<{ metrics: ROIMetrics }>;
    },
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ["roi-report", period],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/roi/demo-report?days=${period}`);
      return res.json() as Promise<{ report: DemoReport }>;
    },
    enabled: activeTab === "report",
  });

  const m = metricsData?.metrics;
  const report = reportData?.report;

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: "grid" as const },
    { key: "waste" as const, label: "Waste", icon: "shield" as const },
    { key: "ai" as const, label: "AI", icon: "cpu" as const },
    { key: "time" as const, label: "Time", icon: "clock" as const },
    { key: "report" as const, label: "Report", icon: "file-text" as const },
  ];

  async function shareReport() {
    if (!report) return;
    const text = [
      `Tabula Medica ROI Report — ${report.periodLabel}`,
      "",
      "HIGHLIGHTS:",
      ...report.highlights.map(h => `  - ${h}`),
      "",
      "BENCHMARKS:",
      ...report.benchmarkComparisons.map(
        b => `  ${b.metric}: ${b.ourValue} vs industry ${b.industryAvg} (${b.percentBetter > 0 ? "+" : ""}${b.percentBetter}%)`
      ),
      "",
      `Total Savings: $${report.metrics.summary.totalSavings.toLocaleString()}`,
      `Time Saved: ${report.metrics.summary.totalTimeSavedHours}h`,
      `Records: ${report.metrics.summary.totalRecords.toLocaleString()}`,
      `Users: ${report.metrics.summary.totalUsers}`,
      "",
      `Generated ${new Date(report.generatedAt).toLocaleDateString()}`,
    ].join("\n");
    try {
      await Share.share({ message: text, title: "Tabula Medica ROI Report" });
    } catch (_e) {}
  }

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: Spacing["2xl"] }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText style={styles.headerTitle}>ROI Tracker</ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Internal metrics — PII stripped
              </ThemedText>
            </View>
            <View style={[styles.internalBadge, { backgroundColor: "#FF9F0A20" }]}>
              <Feather name="lock" size={10} color="#FF9F0A" />
              <ThemedText style={{ fontSize: 9, fontWeight: "600", color: "#FF9F0A" }}>
                INTERNAL ONLY
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {([7, 30, 90] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[
                styles.periodBtn,
                { borderColor: theme.border },
                period === p && { backgroundColor: theme.primary + "15", borderColor: theme.primary },
              ]}
              testID={`period-${p}`}
            >
              <ThemedText style={[
                styles.periodText,
                { color: period === p ? theme.primary : theme.textSecondary },
              ]}>
                {p}d
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                { borderColor: theme.border },
                activeTab === tab.key && { backgroundColor: theme.primary + "12", borderColor: theme.primary },
              ]}
              testID={`tab-${tab.key}`}
            >
              <Feather
                name={tab.icon}
                size={14}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
              <ThemedText style={[
                styles.tabText,
                { color: activeTab === tab.key ? theme.primary : theme.textSecondary },
              ]}>
                {tab.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {metricsLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : m ? (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === "overview" ? (
              <View>
                {/* Hero stats */}
                <View style={styles.statsGrid}>
                  <StatCard
                    icon="dollar-sign"
                    label="Total Savings"
                    value={`$${m.summary.totalSavings.toLocaleString()}`}
                    subtext="Ghost savings"
                    color="#34C759"
                    theme={theme}
                    delay={0}
                  />
                  <StatCard
                    icon="clock"
                    label="Time Saved"
                    value={`${m.summary.totalTimeSavedHours}h`}
                    subtext={`${m.timeROI.minutesSavedPerPatient}min/patient`}
                    color="#007AFF"
                    theme={theme}
                    delay={50}
                  />
                  <StatCard
                    icon="shield"
                    label="Duplicates Blocked"
                    value={m.wastePrevention.totalDuplicatesBlocked.toString()}
                    subtext={`${m.wastePrevention.totalDuplicatesFlagged} flagged`}
                    color="#FF9F0A"
                    theme={theme}
                    delay={100}
                  />
                  <StatCard
                    icon="cpu"
                    label="AI Accuracy"
                    value={`${m.aiAccuracy.accuracyRate.toFixed(1)}%`}
                    subtext={`${m.aiAccuracy.totalExtractions} extractions`}
                    color="#5856D6"
                    theme={theme}
                    delay={150}
                  />
                  <StatCard
                    icon="activity"
                    label="EHR Syncs"
                    value={m.systemLoad.totalEhrSyncs.toLocaleString()}
                    subtext={`${m.systemLoad.syncSuccessRate.toFixed(1)}% success`}
                    color="#30D158"
                    theme={theme}
                    delay={200}
                  />
                  <StatCard
                    icon="check-circle"
                    label="Data Quality"
                    value={`${Math.round(m.dataIntegrity.avgCleanliness)}%`}
                    subtext="Cleanliness score"
                    color="#FF2D55"
                    theme={theme}
                    delay={250}
                  />
                </View>

                {/* Sales value props */}
                <Card style={styles.salesCard}>
                  <ThemedText style={styles.salesTitle}>Sales Value Propositions</ThemedText>
                  <View style={styles.salesItem}>
                    <Feather name="trending-down" size={14} color="#34C759" />
                    <ThemedText style={styles.salesText}>
                      "We've saved your pilot group ${m.summary.totalSavings > 0 ? `$${m.summary.totalSavings.toLocaleString()}` : "significant costs"} this month."
                    </ThemedText>
                  </View>
                  <View style={styles.salesItem}>
                    <Feather name="zap" size={14} color="#007AFF" />
                    <ThemedText style={styles.salesText}>
                      "Our AI is {m.aiAccuracy.accuracyRate.toFixed(1)}% accurate in clinical extraction."
                    </ThemedText>
                  </View>
                  <View style={styles.salesItem}>
                    <Feather name="clock" size={14} color="#FF9F0A" />
                    <ThemedText style={styles.salesText}>
                      "We save your doctors {m.timeROI.minutesSavedPerPatient} minutes per patient."
                    </ThemedText>
                  </View>
                  <View style={styles.salesItem}>
                    <Feather name="server" size={14} color="#30D158" />
                    <ThemedText style={styles.salesText}>
                      "Our infrastructure maintains {m.systemLoad.uptimePercent}% uptime."
                    </ThemedText>
                  </View>
                </Card>
              </View>
            ) : null}

            {/* WASTE TAB */}
            {activeTab === "waste" ? (
              <View>
                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>Waste Prevention Monitor</ThemedText>
                  <View style={styles.wasteStatsRow}>
                    <View style={styles.wasteStat}>
                      <ThemedText style={[styles.wasteStatValue, { color: "#FF9F0A" }]}>
                        {m.wastePrevention.totalDuplicatesFlagged}
                      </ThemedText>
                      <ThemedText style={[styles.wasteStatLabel, { color: theme.textSecondary }]}>
                        Flagged
                      </ThemedText>
                    </View>
                    <View style={styles.wasteStat}>
                      <ThemedText style={[styles.wasteStatValue, { color: "#34C759" }]}>
                        {m.wastePrevention.totalDuplicatesBlocked}
                      </ThemedText>
                      <ThemedText style={[styles.wasteStatLabel, { color: theme.textSecondary }]}>
                        Blocked
                      </ThemedText>
                    </View>
                    <View style={styles.wasteStat}>
                      <ThemedText style={[styles.wasteStatValue, { color: "#007AFF" }]}>
                        ${m.wastePrevention.totalGhostSavings.toLocaleString()}
                      </ThemedText>
                      <ThemedText style={[styles.wasteStatLabel, { color: theme.textSecondary }]}>
                        Saved
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {/* Duplicate rate vs benchmark */}
                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>Duplicate Rate vs Industry</ThemedText>
                  <View style={styles.benchmarkCompare}>
                    <View>
                      <ThemedText style={[styles.benchLabel, { color: theme.textSecondary }]}>Ours</ThemedText>
                      <ThemedText style={[styles.benchValue, { color: "#34C759" }]}>
                        {m.wastePrevention.avgDuplicateRate}%
                      </ThemedText>
                      <ProgressBar
                        value={m.wastePrevention.avgDuplicateRate}
                        maxValue={15}
                        color="#34C759"
                        theme={theme}
                      />
                    </View>
                    <View>
                      <ThemedText style={[styles.benchLabel, { color: theme.textSecondary }]}>Industry (8-12%)</ThemedText>
                      <ThemedText style={[styles.benchValue, { color: "#FF9F0A" }]}>
                        {m.wastePrevention.industryBenchmarkRate}%
                      </ThemedText>
                      <ProgressBar
                        value={m.wastePrevention.industryBenchmarkRate}
                        maxValue={15}
                        color="#FF9F0A"
                        theme={theme}
                      />
                    </View>
                  </View>
                </Card>

                {/* Savings by test type */}
                {m.wastePrevention.savingsByTestType.length > 0 ? (
                  <Card style={styles.sectionCard}>
                    <ThemedText style={styles.sectionTitle}>Savings by Test Type</ThemedText>
                    {m.wastePrevention.savingsByTestType
                      .sort((a, b) => b.savings - a.savings)
                      .slice(0, 10)
                      .map((item, idx) => (
                        <View key={idx} style={[styles.testTypeRow, { borderBottomColor: theme.border }]}>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={styles.testTypeName}>{item.testType}</ThemedText>
                            <ThemedText style={[styles.testTypeCount, { color: theme.textSecondary }]}>
                              {item.count} blocked
                            </ThemedText>
                          </View>
                          <ThemedText style={[styles.testTypeSavings, { color: "#34C759" }]}>
                            ${item.savings.toLocaleString()}
                          </ThemedText>
                        </View>
                      ))}
                  </Card>
                ) : null}
              </View>
            ) : null}

            {/* AI TAB */}
            {activeTab === "ai" ? (
              <View>
                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>AI Extraction Performance</ThemedText>
                  <View style={styles.aiStatsRow}>
                    <View style={styles.aiStat}>
                      <ThemedText style={[styles.aiStatValue, { color: "#5856D6" }]}>
                        {m.aiAccuracy.accuracyRate.toFixed(1)}%
                      </ThemedText>
                      <ThemedText style={[styles.aiStatLabel, { color: theme.textSecondary }]}>
                        Accuracy
                      </ThemedText>
                    </View>
                    <View style={styles.aiStat}>
                      <ThemedText style={[styles.aiStatValue, { color: "#007AFF" }]}>
                        {m.aiAccuracy.totalExtractions.toLocaleString()}
                      </ThemedText>
                      <ThemedText style={[styles.aiStatLabel, { color: theme.textSecondary }]}>
                        Extractions
                      </ThemedText>
                    </View>
                    <View style={styles.aiStat}>
                      <ThemedText style={[styles.aiStatValue, { color: "#FF9F0A" }]}>
                        {m.aiAccuracy.totalOverrides}
                      </ThemedText>
                      <ThemedText style={[styles.aiStatLabel, { color: theme.textSecondary }]}>
                        Overrides
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {/* Confidence distribution */}
                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>Confidence Distribution</ThemedText>
                  <View style={styles.confRow}>
                    <View style={styles.confItem}>
                      <View style={[styles.confDot, { backgroundColor: "#34C759" }]} />
                      <ThemedText style={styles.confLabel}>High (90%+)</ThemedText>
                      <ThemedText style={[styles.confValue, { color: "#34C759" }]}>
                        {m.aiAccuracy.confidenceDistribution.high}
                      </ThemedText>
                    </View>
                    <View style={styles.confItem}>
                      <View style={[styles.confDot, { backgroundColor: "#FF9F0A" }]} />
                      <ThemedText style={styles.confLabel}>Medium (70-89%)</ThemedText>
                      <ThemedText style={[styles.confValue, { color: "#FF9F0A" }]}>
                        {m.aiAccuracy.confidenceDistribution.medium}
                      </ThemedText>
                    </View>
                    <View style={styles.confItem}>
                      <View style={[styles.confDot, { backgroundColor: "#FF3B30" }]} />
                      <ThemedText style={styles.confLabel}>Low (&lt;70%)</ThemedText>
                      <ThemedText style={[styles.confValue, { color: "#FF3B30" }]}>
                        {m.aiAccuracy.confidenceDistribution.low}
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {/* By extraction type */}
                {m.aiAccuracy.extractionsByType.length > 0 ? (
                  <Card style={styles.sectionCard}>
                    <ThemedText style={styles.sectionTitle}>By Extraction Type</ThemedText>
                    {m.aiAccuracy.extractionsByType
                      .sort((a, b) => b.count - a.count)
                      .map((item, idx) => {
                        const acc = item.count > 0
                          ? (((item.count - item.overrides) / item.count) * 100).toFixed(1)
                          : "100.0";
                        return (
                          <View key={idx} style={[styles.typeRow, { borderBottomColor: theme.border }]}>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.typeName}>
                                {item.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                              </ThemedText>
                              <ThemedText style={[styles.typeDetail, { color: theme.textSecondary }]}>
                                {item.count} extractions, {item.overrides} overrides
                              </ThemedText>
                            </View>
                            <ThemedText style={[styles.typeAccuracy, { color: "#5856D6" }]}>
                              {acc}%
                            </ThemedText>
                          </View>
                        );
                      })}
                  </Card>
                ) : null}
              </View>
            ) : null}

            {/* TIME TAB */}
            {activeTab === "time" ? (
              <View>
                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>Time ROI</ThemedText>
                  <View style={styles.timeCompare}>
                    <View style={styles.timeBlock}>
                      <ThemedText style={[styles.timeValue, { color: "#34C759" }]}>
                        {m.timeROI.avgSecondsPerRecord}s
                      </ThemedText>
                      <ThemedText style={[styles.timeLabel, { color: theme.textSecondary }]}>
                        Tabula Medica
                      </ThemedText>
                    </View>
                    <View style={styles.timeVsBlock}>
                      <Feather name="arrow-right" size={20} color={theme.textSecondary} />
                      <ThemedText style={[styles.timeSaved, { color: "#007AFF" }]}>
                        {m.timeROI.minutesSavedPerPatient}min saved
                      </ThemedText>
                    </View>
                    <View style={styles.timeBlock}>
                      <ThemedText style={[styles.timeValue, { color: "#FF3B30" }]}>
                        {m.timeROI.manualBaselineSeconds}s
                      </ThemedText>
                      <ThemedText style={[styles.timeLabel, { color: theme.textSecondary }]}>
                        Manual Lookup
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                <View style={styles.statsGrid}>
                  <StatCard
                    icon="file-text"
                    label="Records Processed"
                    value={m.timeROI.totalRecordsProcessed.toLocaleString()}
                    color="#007AFF"
                    theme={theme}
                  />
                  <StatCard
                    icon="clock"
                    label="Total Hours Saved"
                    value={`${m.timeROI.totalHoursSaved}h`}
                    color="#34C759"
                    theme={theme}
                  />
                </View>

                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>Data Integrity</ThemedText>
                  <View style={styles.integrityRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.integrityScoreRow}>
                        <ThemedText style={styles.integrityScore}>
                          {Math.round(m.dataIntegrity.avgCleanliness)}%
                        </ThemedText>
                        <ThemedText style={[styles.integrityLabel, { color: theme.textSecondary }]}>
                          cleanliness score
                        </ThemedText>
                      </View>
                      <ProgressBar
                        value={m.dataIntegrity.avgCleanliness}
                        maxValue={100}
                        color="#5856D6"
                        theme={theme}
                      />
                    </View>
                  </View>
                  <View style={styles.integrityStats}>
                    <View style={styles.integrityStat}>
                      <ThemedText style={[styles.integrityStatValue, { color: theme.primary }]}>
                        {m.dataIntegrity.recordsScanned}
                      </ThemedText>
                      <ThemedText style={[styles.integrityStatLabel, { color: theme.textSecondary }]}>
                        Scanned
                      </ThemedText>
                    </View>
                    <View style={styles.integrityStat}>
                      <ThemedText style={[styles.integrityStatValue, { color: "#FF9F0A" }]}>
                        {m.dataIntegrity.issuesFound}
                      </ThemedText>
                      <ThemedText style={[styles.integrityStatLabel, { color: theme.textSecondary }]}>
                        Issues
                      </ThemedText>
                    </View>
                    <View style={styles.integrityStat}>
                      <ThemedText style={[styles.integrityStatValue, { color: "#34C759" }]}>
                        {m.dataIntegrity.issuesResolved}
                      </ThemedText>
                      <ThemedText style={[styles.integrityStatLabel, { color: theme.textSecondary }]}>
                        Resolved
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.qualityDistRow}>
                    {(["excellent", "good", "fair", "poor"] as const).map((level) => {
                      const colors: Record<string, string> = {
                        excellent: "#34C759",
                        good: "#007AFF",
                        fair: "#FF9F0A",
                        poor: "#FF3B30",
                      };
                      return (
                        <View key={level} style={styles.qualityDistItem}>
                          <View style={[styles.qualityDistDot, { backgroundColor: colors[level] }]} />
                          <ThemedText style={[styles.qualityDistLabel, { color: theme.textSecondary }]}>
                            {level}
                          </ThemedText>
                          <ThemedText style={styles.qualityDistValue}>
                            {m.dataIntegrity.scoreDistribution[level]}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                </Card>

                <Card style={styles.sectionCard}>
                  <ThemedText style={styles.sectionTitle}>System Health</ThemedText>
                  <View style={styles.sysRow}>
                    <ThemedText style={[styles.sysLabel, { color: theme.textSecondary }]}>Uptime</ThemedText>
                    <ThemedText style={[styles.sysValue, { color: "#34C759" }]}>{m.systemLoad.uptimePercent}%</ThemedText>
                  </View>
                  <View style={styles.sysRow}>
                    <ThemedText style={[styles.sysLabel, { color: theme.textSecondary }]}>Sync Success Rate</ThemedText>
                    <ThemedText style={styles.sysValue}>{m.systemLoad.syncSuccessRate.toFixed(1)}%</ThemedText>
                  </View>
                  <View style={styles.sysRow}>
                    <ThemedText style={[styles.sysLabel, { color: theme.textSecondary }]}>Avg Sync Latency</ThemedText>
                    <ThemedText style={styles.sysValue}>{m.systemLoad.avgSyncLatencyMs}ms</ThemedText>
                  </View>
                  <View style={styles.sysRow}>
                    <ThemedText style={[styles.sysLabel, { color: theme.textSecondary }]}>Active Syncs</ThemedText>
                    <ThemedText style={styles.sysValue}>{m.systemLoad.activeSyncsNow}</ThemedText>
                  </View>
                  <View style={styles.sysRow}>
                    <ThemedText style={[styles.sysLabel, { color: theme.textSecondary }]}>24h Syncs</ThemedText>
                    <ThemedText style={styles.sysValue}>{m.systemLoad.last24hSyncs}</ThemedText>
                  </View>
                </Card>
              </View>
            ) : null}

            {/* REPORT TAB */}
            {activeTab === "report" ? (
              <View>
                {reportLoading ? (
                  <View style={styles.loading}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                      Generating demo report...
                    </ThemedText>
                  </View>
                ) : report ? (
                  <>
                    <Card style={[styles.sectionCard, { borderWidth: 1, borderColor: "#5856D640" }]}>
                      <View style={styles.reportHeader}>
                        <View>
                          <ThemedText style={styles.reportTitle}>Demo Report</ThemedText>
                          <ThemedText style={[styles.reportSubtitle, { color: theme.textSecondary }]}>
                            {report.periodLabel}
                          </ThemedText>
                        </View>
                        <TouchableOpacity
                          onPress={shareReport}
                          style={[styles.shareBtn, { backgroundColor: "#5856D615" }]}
                          testID="button-share-report"
                        >
                          <Feather name={Platform.OS === "web" ? "copy" : "share"} size={16} color="#5856D6" />
                        </TouchableOpacity>
                      </View>

                      <ThemedText style={[styles.highlightsTitle, { color: theme.textSecondary }]}>
                        Key Highlights
                      </ThemedText>
                      {report.highlights.map((h, idx) => (
                        <View key={idx} style={styles.highlightRow}>
                          <Feather name="star" size={12} color="#FF9F0A" />
                          <ThemedText style={styles.highlightText}>{h}</ThemedText>
                        </View>
                      ))}
                    </Card>

                    <Card style={styles.sectionCard}>
                      <ThemedText style={styles.sectionTitle}>Industry Benchmarks</ThemedText>
                      {report.benchmarkComparisons.map((b, idx) => (
                        <BenchmarkRow
                          key={idx}
                          metric={b.metric}
                          ourValue={b.ourValue}
                          industryAvg={b.industryAvg}
                          percentBetter={b.percentBetter}
                          theme={theme}
                        />
                      ))}
                    </Card>

                    <Card style={styles.sectionCard}>
                      <ThemedText style={styles.sectionTitle}>Period Summary</ThemedText>
                      <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                          <ThemedText style={[styles.summaryValue, { color: "#34C759" }]}>
                            ${report.metrics.summary.totalSavings.toLocaleString()}
                          </ThemedText>
                          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                            Total Savings
                          </ThemedText>
                        </View>
                        <View style={styles.summaryItem}>
                          <ThemedText style={[styles.summaryValue, { color: "#007AFF" }]}>
                            {report.metrics.summary.totalTimeSavedHours}h
                          </ThemedText>
                          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                            Time Saved
                          </ThemedText>
                        </View>
                        <View style={styles.summaryItem}>
                          <ThemedText style={[styles.summaryValue, { color: "#5856D6" }]}>
                            {report.metrics.summary.totalRecords.toLocaleString()}
                          </ThemedText>
                          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                            Records
                          </ThemedText>
                        </View>
                        <View style={styles.summaryItem}>
                          <ThemedText style={[styles.summaryValue, { color: "#FF9F0A" }]}>
                            {report.metrics.summary.totalUsers}
                          </ThemedText>
                          <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                            Users
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.summaryPeriod, { color: theme.textSecondary }]}>
                        {report.metrics.summary.periodStart} — {report.metrics.summary.periodEnd}
                      </ThemedText>
                    </Card>

                    {/* Demo mode notice */}
                    <Card style={[styles.demoNotice, { borderColor: "#FF9F0A40" }]}>
                      <Feather name="alert-circle" size={14} color="#FF9F0A" />
                      <ThemedText style={[styles.demoNoticeText, { color: theme.textSecondary }]}>
                        This report uses PII-stripped aggregate data. Safe for external sharing with HIMSS leads, sales decks, and investor presentations.
                      </ThemedText>
                    </Card>
                  </>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  internalBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  periodRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  periodBtn: {
    paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  periodText: { fontSize: 13, fontWeight: "500" },
  tabRow: { paddingHorizontal: Spacing.lg, gap: 6, marginBottom: Spacing.md },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  tabText: { fontSize: 12, fontWeight: "500" },
  loading: { alignItems: "center", paddingTop: 60 },
  loadingText: { marginTop: 12, fontSize: 13 },
  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: Spacing.lg, gap: 10,
  },
  statCardWrapper: { width: "47%" },
  statCard: { padding: 14 },
  statIcon: {
    width: 32, height: 32, borderRadius: 10,
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  statSubtext: { fontSize: 10, marginTop: 2, fontWeight: "500" },
  salesCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  salesTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  salesItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  salesText: { fontSize: 12, flex: 1, lineHeight: 18, fontStyle: "italic" },
  sectionCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  wasteStatsRow: { flexDirection: "row", justifyContent: "space-around" },
  wasteStat: { alignItems: "center" },
  wasteStatValue: { fontSize: 22, fontWeight: "700" },
  wasteStatLabel: { fontSize: 11, marginTop: 2 },
  benchmarkCompare: { gap: 16 },
  benchLabel: { fontSize: 11, marginBottom: 4 },
  benchValue: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  testTypeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 0.5,
  },
  testTypeName: { fontSize: 12, fontWeight: "500" },
  testTypeCount: { fontSize: 10, marginTop: 2 },
  testTypeSavings: { fontSize: 14, fontWeight: "600" },
  aiStatsRow: { flexDirection: "row", justifyContent: "space-around" },
  aiStat: { alignItems: "center" },
  aiStatValue: { fontSize: 22, fontWeight: "700" },
  aiStatLabel: { fontSize: 11, marginTop: 2 },
  confRow: { gap: 10 },
  confItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  confDot: { width: 10, height: 10, borderRadius: 5 },
  confLabel: { fontSize: 12, flex: 1 },
  confValue: { fontSize: 14, fontWeight: "600" },
  typeRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5,
  },
  typeName: { fontSize: 12, fontWeight: "500" },
  typeDetail: { fontSize: 10, marginTop: 2 },
  typeAccuracy: { fontSize: 14, fontWeight: "600" },
  timeCompare: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginBottom: 8 },
  timeBlock: { alignItems: "center" },
  timeValue: { fontSize: 28, fontWeight: "700" },
  timeLabel: { fontSize: 11, marginTop: 2 },
  timeVsBlock: { alignItems: "center", gap: 4 },
  timeSaved: { fontSize: 12, fontWeight: "600" },
  integrityRow: { marginBottom: 16 },
  integrityScoreRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 8 },
  integrityScore: { fontSize: 28, fontWeight: "700" },
  integrityLabel: { fontSize: 12 },
  integrityStats: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  integrityStat: { alignItems: "center" },
  integrityStatValue: { fontSize: 18, fontWeight: "600" },
  integrityStatLabel: { fontSize: 10, marginTop: 2 },
  qualityDistRow: { flexDirection: "row", justifyContent: "space-around" },
  qualityDistItem: { alignItems: "center", gap: 4 },
  qualityDistDot: { width: 8, height: 8, borderRadius: 4 },
  qualityDistLabel: { fontSize: 10, textTransform: "capitalize" },
  qualityDistValue: { fontSize: 14, fontWeight: "600" },
  sysRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 6,
  },
  sysLabel: { fontSize: 12 },
  sysValue: { fontSize: 14, fontWeight: "600" },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  reportTitle: { fontSize: 18, fontWeight: "700" },
  reportSubtitle: { fontSize: 12, marginTop: 2 },
  shareBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  highlightsTitle: {
    fontSize: 10, fontWeight: "600", textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 10,
  },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  highlightText: { fontSize: 12, flex: 1, lineHeight: 18 },
  benchRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 0.5,
  },
  benchMetric: { fontSize: 12, flex: 1 },
  benchValues: { flexDirection: "row", alignItems: "center", gap: 6 },
  benchOur: { fontSize: 14, fontWeight: "600" },
  benchIndustry: { fontSize: 11 },
  benchBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  summaryItem: { width: "45%", alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "700" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  summaryPeriod: { fontSize: 11, textAlign: "center", marginTop: 16 },
  demoNotice: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1,
  },
  demoNoticeText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
