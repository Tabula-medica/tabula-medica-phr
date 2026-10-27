import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface AnalyticsData {
  overview: {
    totalPatients: number;
    activeProfiles: number;
    totalRecords: number;
    familyMembersManaged: number;
    profileCompletenessAvg: number;
  };
  duplicateTestingAvoidance: {
    labTestsDuplicateAvoided: number;
    imagingDuplicateAvoided: number;
    totalDuplicatesAvoided: number;
    estimatedSavings: number;
    avgLabCostSaved: number;
    avgImagingCostSaved: number;
    methodology: string;
  };
  insuranceSavings: {
    premiumReductionOpportunity: number;
    preventiveCareComplianceRate: number;
    chronicDiseaseManagementSavings: number;
    emergencyVisitsAvoided: number;
    emergencyVisitAvgCost: number;
    totalERSavings: number;
  };
  acoMetrics: {
    qualityScore: number;
    sharedSavingsEstimate: number;
    hedisComplianceRate: number;
    patientEngagementScore: number;
    readmissionReductionRate: number;
  };
  recordsBreakdown: { type: string; count: string }[];
  recordsTrend: { month: string; count: string }[];
}

function MetricCard({ title, value, subtitle, icon, color, theme, isDark }: {
  title: string; value: string; subtitle?: string; icon: any; color: string; theme: any; isDark: boolean;
}) {
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  return (
    <View style={[styles.metricCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[styles.metricIconBg, { backgroundColor: `${color}12` }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <ThemedText style={[styles.metricValue, { color: theme.text }]}>{value}</ThemedText>
      <ThemedText style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</ThemedText>
      {subtitle ? <ThemedText style={[styles.metricSub, { color: theme.textSecondary }]}>{subtitle}</ThemedText> : null}
    </View>
  );
}

function SavingsRow({ label, value, icon, color, theme, isDark }: {
  label: string; value: string; icon: any; color: string; theme: any; isDark: boolean;
}) {
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  return (
    <View style={[styles.savingsRow, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[styles.savingsIcon, { backgroundColor: `${color}12` }]}>
        <Feather name={icon} size={14} color={color} />
      </View>
      <ThemedText style={[styles.savingsLabel, { color: theme.text }]}>{label}</ThemedText>
      <ThemedText style={[styles.savingsValue, { color }]}>{value}</ThemedText>
    </View>
  );
}

const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toLocaleString()}`;

type TabKey = "overview" | "duplicates" | "insurance" | "aco";

export default function EnterprisePlatformAnalyticsScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/enterprise/platform-analytics"],
  });

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: "bar-chart-2" },
    { key: "duplicates", label: "Dup. Avoidance", icon: "copy" },
    { key: "insurance", label: "Insurance", icon: "shield" },
    { key: "aco", label: "ACO/Quality", icon: "award" },
  ];

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.enterpriseBanner, { backgroundColor: "#1e293b" }]}>
          <Feather name="trending-up" size={20} color="#60a5fa" />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.bannerTitle}>Enterprise Platform Analytics</ThemedText>
            <ThemedText style={styles.bannerSub}>Population health metrics, cost savings, and quality measures</ThemedText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          {tabs.map(t => (
            <Pressable
              key={t.key}
              testID={`tab-${t.key}`}
              onPress={() => setActiveTab(t.key)}
              style={[styles.tabBtn, {
                backgroundColor: activeTab === t.key ? theme.primary : cardBg,
                borderColor: activeTab === t.key ? theme.primary : cardBorder,
              }]}
            >
              <Feather name={t.icon} size={13} color={activeTab === t.key ? "#fff" : theme.text} />
              <ThemedText style={[styles.tabText, { color: activeTab === t.key ? "#fff" : theme.text }]}>{t.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading analytics...</ThemedText>
          </View>
        ) : data ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            {activeTab === "overview" ? (
              <>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Platform Overview</ThemedText>
                <View style={styles.metricsGrid}>
                  <MetricCard title="Total Patients" value={data.overview.totalPatients.toLocaleString()} icon="users" color="#3B82F6" theme={theme} isDark={isDark} />
                  <MetricCard title="Health Records" value={data.overview.totalRecords.toLocaleString()} icon="file-text" color="#10B981" theme={theme} isDark={isDark} />
                  <MetricCard title="Active Profiles" value={data.overview.activeProfiles.toLocaleString()} icon="user-check" color="#8B5CF6" theme={theme} isDark={isDark} />
                  <MetricCard title="Family Members" value={data.overview.familyMembersManaged.toLocaleString()} icon="heart" color="#EC4899" theme={theme} isDark={isDark} />
                </View>

                <View style={[styles.completenessCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <ThemedText style={[styles.completenessLabel, { color: theme.textSecondary }]}>Avg Profile Completeness</ThemedText>
                  <View style={styles.completenessBar}>
                    <View style={[styles.completenessTrack, { backgroundColor: `${theme.primary}15` }]}>
                      <View style={[styles.completenessFill, { width: `${data.overview.profileCompletenessAvg}%`, backgroundColor: theme.primary }]} />
                    </View>
                    <ThemedText style={[styles.completenessValue, { color: theme.primary }]}>{data.overview.profileCompletenessAvg}%</ThemedText>
                  </View>
                </View>

                {data.recordsBreakdown.length > 0 ? (
                  <View style={[styles.breakdownCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <ThemedText style={[styles.breakdownTitle, { color: theme.text }]}>Records by Type</ThemedText>
                    {data.recordsBreakdown.slice(0, 8).map((r, i) => (
                      <View key={i} style={[styles.breakdownRow, { borderColor: cardBorder }]}>
                        <ThemedText style={[styles.breakdownType, { color: theme.text }]}>{r.type?.replace(/_/g, " ") || "Unknown"}</ThemedText>
                        <ThemedText style={[styles.breakdownCount, { color: theme.primary }]}>{parseInt(r.count).toLocaleString()}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {activeTab === "duplicates" ? (
              <>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Duplicate Testing Avoidance</ThemedText>
                <View style={[styles.savingsHighlight, { backgroundColor: "#10b98108", borderColor: "#10b98120" }]}>
                  <ThemedText style={[styles.savingsTotal, { color: "#10b981" }]}>{fmt(data.duplicateTestingAvoidance.estimatedSavings)}</ThemedText>
                  <ThemedText style={[styles.savingsLabel2, { color: theme.textSecondary }]}>Total Estimated Savings</ThemedText>
                </View>

                <View style={styles.metricsGrid}>
                  <MetricCard title="Lab Duplicates Avoided" value={data.duplicateTestingAvoidance.labTestsDuplicateAvoided.toLocaleString()} subtitle={`@ $${data.duplicateTestingAvoidance.avgLabCostSaved}/test`} icon="droplet" color="#3B82F6" theme={theme} isDark={isDark} />
                  <MetricCard title="Imaging Duplicates Avoided" value={data.duplicateTestingAvoidance.imagingDuplicateAvoided.toLocaleString()} subtitle={`@ $${data.duplicateTestingAvoidance.avgImagingCostSaved}/scan`} icon="image" color="#8B5CF6" theme={theme} isDark={isDark} />
                </View>

                <View style={[styles.methodCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Feather name="info" size={14} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.methodTitle, { color: theme.text }]}>Methodology</ThemedText>
                    <ThemedText style={[styles.methodText, { color: theme.textSecondary }]}>{data.duplicateTestingAvoidance.methodology}</ThemedText>
                  </View>
                </View>

                <View style={[styles.benefitsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <ThemedText style={[styles.benefitsTitle, { color: theme.text }]}>How Tabula Medica Prevents Duplicates</ThemedText>
                  {[
                    "Unified health timeline shows all prior tests across providers",
                    "Clinical decision support alerts flag recent similar orders",
                    "FHIR-based record sharing enables cross-system visibility",
                    "AI analysis identifies redundant testing patterns",
                    "Patient empowerment lets individuals share records at point of care",
                  ].map((item, i) => (
                    <View key={i} style={styles.benefitItem}>
                      <Feather name="check-circle" size={13} color="#10b981" />
                      <ThemedText style={[styles.benefitText, { color: theme.text }]}>{item}</ThemedText>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {activeTab === "insurance" ? (
              <>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Insurance Savings Report</ThemedText>
                <SavingsRow label="Premium Reduction Opportunity" value={fmt(data.insuranceSavings.premiumReductionOpportunity)} icon="trending-down" color="#10b981" theme={theme} isDark={isDark} />
                <SavingsRow label="Chronic Disease Mgmt Savings" value={fmt(data.insuranceSavings.chronicDiseaseManagementSavings)} icon="heart" color="#3B82F6" theme={theme} isDark={isDark} />
                <SavingsRow label="ER Visits Avoided" value={`${data.insuranceSavings.emergencyVisitsAvoided} visits`} icon="alert-circle" color="#f59e0b" theme={theme} isDark={isDark} />
                <SavingsRow label="ER Cost Savings" value={fmt(data.insuranceSavings.totalERSavings)} icon="dollar-sign" color="#10b981" theme={theme} isDark={isDark} />

                <View style={[styles.complianceCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <ThemedText style={[styles.complianceLabel, { color: theme.textSecondary }]}>Preventive Care Compliance</ThemedText>
                  <View style={styles.completenessBar}>
                    <View style={[styles.completenessTrack, { backgroundColor: "#10b98115" }]}>
                      <View style={[styles.completenessFill, { width: `${data.insuranceSavings.preventiveCareComplianceRate}%`, backgroundColor: "#10b981" }]} />
                    </View>
                    <ThemedText style={[styles.completenessValue, { color: "#10b981" }]}>{data.insuranceSavings.preventiveCareComplianceRate.toFixed(0)}%</ThemedText>
                  </View>
                </View>

                <View style={[styles.totalSavingsCard, { backgroundColor: "#10b98108", borderColor: "#10b98120" }]}>
                  <ThemedText style={[styles.totalSavingsLabel, { color: theme.textSecondary }]}>Total Insurance Savings Impact</ThemedText>
                  <ThemedText style={[styles.totalSavingsValue, { color: "#10b981" }]}>
                    {fmt(data.insuranceSavings.premiumReductionOpportunity + data.insuranceSavings.chronicDiseaseManagementSavings + data.insuranceSavings.totalERSavings)}
                  </ThemedText>
                </View>
              </>
            ) : null}

            {activeTab === "aco" ? (
              <>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>ACO Quality & Performance</ThemedText>
                <View style={[styles.qualityScoreCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <View style={[styles.scoreCircle, { borderColor: theme.primary }]}>
                    <ThemedText style={[styles.scoreValue, { color: theme.primary }]}>{data.acoMetrics.qualityScore.toFixed(0)}</ThemedText>
                    <ThemedText style={[styles.scoreLabel, { color: theme.textSecondary }]}>Quality Score</ThemedText>
                  </View>
                </View>

                <SavingsRow label="Shared Savings Estimate" value={fmt(data.acoMetrics.sharedSavingsEstimate)} icon="dollar-sign" color="#10b981" theme={theme} isDark={isDark} />
                <SavingsRow label="HEDIS Compliance Rate" value={`${data.acoMetrics.hedisComplianceRate.toFixed(0)}%`} icon="check-square" color="#3B82F6" theme={theme} isDark={isDark} />
                <SavingsRow label="Patient Engagement Score" value={`${data.acoMetrics.patientEngagementScore.toFixed(0)}%`} icon="users" color="#8B5CF6" theme={theme} isDark={isDark} />
                <SavingsRow label="Readmission Reduction" value={`${data.acoMetrics.readmissionReductionRate.toFixed(0)}%`} icon="trending-down" color="#f59e0b" theme={theme} isDark={isDark} />

                <View style={[styles.reportNote, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Feather name="file-text" size={14} color={theme.primary} />
                  <ThemedText style={[styles.reportNoteText, { color: theme.textSecondary }]}>
                    These metrics are calculated from platform data and industry benchmarks. For CMS MSSP reporting, additional clinical quality measures and attestation are required.
                  </ThemedText>
                </View>
              </>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  enterpriseBanner: { padding: Spacing.md, borderRadius: BorderRadius.md, flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md },
  bannerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  bannerSub: { color: "#94a3b8", fontSize: 12, marginTop: 1 },
  tabScroll: { marginBottom: Spacing.md },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, marginRight: 6 },
  tabText: { fontSize: 12, fontWeight: "600" },
  loadingBox: { padding: Spacing.xl, alignItems: "center" },
  loadingText: { fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  metricCard: { width: "48%", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs, flexGrow: 1 },
  metricIconBg: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xs },
  metricValue: { fontSize: 22, fontWeight: "700" },
  metricTitle: { fontSize: 12, marginTop: 2 },
  metricSub: { fontSize: 10, marginTop: 1 },
  completenessCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  completenessLabel: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.xs },
  completenessBar: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  completenessTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  completenessFill: { height: "100%", borderRadius: 4 },
  completenessValue: { fontSize: 14, fontWeight: "700", width: 40, textAlign: "right" },
  breakdownCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.xs },
  breakdownTitle: { fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  breakdownType: { fontSize: 13, textTransform: "capitalize" },
  breakdownCount: { fontSize: 13, fontWeight: "600" },
  savingsHighlight: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center", marginBottom: Spacing.md },
  savingsTotal: { fontSize: 36, fontWeight: "800" },
  savingsLabel2: { fontSize: 14, marginTop: 2 },
  savingsRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs },
  savingsIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  savingsLabel: { fontSize: 14, flex: 1 },
  savingsValue: { fontSize: 16, fontWeight: "700" },
  methodCard: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.sm },
  methodTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  methodText: { fontSize: 12, lineHeight: 17 },
  benefitsCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.sm },
  benefitsTitle: { fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm },
  benefitItem: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, paddingVertical: 3 },
  benefitText: { fontSize: 13, lineHeight: 18, flex: 1 },
  complianceCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.sm },
  complianceLabel: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.xs },
  totalSavingsCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center", marginTop: Spacing.md },
  totalSavingsLabel: { fontSize: 14, marginBottom: 4 },
  totalSavingsValue: { fontSize: 32, fontWeight: "800" },
  qualityScoreCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center", marginBottom: Spacing.md },
  scoreCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, justifyContent: "center", alignItems: "center" },
  scoreValue: { fontSize: 32, fontWeight: "800" },
  scoreLabel: { fontSize: 10, marginTop: -2 },
  reportNote: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  reportNoteText: { fontSize: 12, lineHeight: 17, flex: 1 },
});
