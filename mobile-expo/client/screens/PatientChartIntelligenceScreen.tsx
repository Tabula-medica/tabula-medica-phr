import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const DEMO_PATIENT = {
  patientId: "demo-patient-001",
  patientName: "Robert Thompson",
  demographics: { age: 65, gender: "male", ethnicity: "Caucasian", bmi: 31.2, smokingStatus: "former" },
  conditions: [
    { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2018-03-15", severity: "moderate", icdCode: "E11.9" },
    { name: "Essential Hypertension", status: "active", onsetDate: "2015-06-22", severity: "moderate", icdCode: "I10" },
    { name: "Hyperlipidemia", status: "active", onsetDate: "2019-01-10", icdCode: "E78.5" },
    { name: "Chronic Kidney Disease Stage 3", status: "active", onsetDate: "2022-08-01", severity: "moderate", icdCode: "N18.3" },
  ],
  medications: [
    { name: "Metformin", dosage: "1000mg", frequency: "twice daily", startDate: "2018-04-01", adherence: "good" },
    { name: "Lisinopril", dosage: "20mg", frequency: "once daily", startDate: "2015-07-01", adherence: "excellent" },
    { name: "Atorvastatin", dosage: "40mg", frequency: "once daily", startDate: "2019-02-01", adherence: "good" },
    { name: "Amlodipine", dosage: "5mg", frequency: "once daily", startDate: "2020-03-15", adherence: "fair" },
  ],
  allergies: [
    { substance: "Sulfa drugs", reaction: "Rash", severity: "moderate" },
    { substance: "Iodine contrast", reaction: "Anaphylaxis", severity: "severe" },
  ],
  vitals: [
    { type: "Blood Pressure", value: 158, unit: "mmHg systolic", date: "2024-02-15", trend: "worsening" },
    { type: "Heart Rate", value: 82, unit: "bpm", date: "2024-02-15", trend: "stable" },
    { type: "Weight", value: 210, unit: "lbs", date: "2024-02-15", trend: "increasing" },
    { type: "BMI", value: 31.2, unit: "kg/m2", date: "2024-02-15" },
    { type: "Blood Glucose", value: 185, unit: "mg/dL", date: "2024-02-15", trend: "worsening" },
  ],
  labResults: [
    { name: "HbA1c", value: 8.2, unit: "%", referenceRange: "4.0-5.6", date: "2024-01-20", flag: "high" },
    { name: "eGFR", value: 42, unit: "mL/min", referenceRange: ">60", date: "2024-01-20", flag: "low" },
    { name: "Creatinine", value: 1.8, unit: "mg/dL", referenceRange: "0.7-1.3", date: "2024-01-20", flag: "high" },
    { name: "LDL Cholesterol", value: 145, unit: "mg/dL", referenceRange: "<100", date: "2024-01-20", flag: "high" },
    { name: "Potassium", value: 5.2, unit: "mEq/L", referenceRange: "3.5-5.0", date: "2024-01-20", flag: "high" },
    { name: "Microalbumin", value: 85, unit: "mg/L", referenceRange: "<30", date: "2024-01-20", flag: "high" },
  ],
  recentVisits: [
    { date: "2024-02-15", type: "Follow-up", provider: "Dr. Sarah Chen", summary: "Diabetes management review. A1c elevated at 8.2%." },
    { date: "2024-01-20", type: "Lab Review", provider: "Dr. Sarah Chen", summary: "Annual labs completed. CKD staging reviewed. eGFR declining." },
    { date: "2023-10-05", type: "Cardiology Consult", provider: "Dr. James Park", summary: "Cardiovascular risk assessment. Recommended increased statin therapy." },
  ],
  immunizations: [
    { name: "Influenza", date: "2023-10-15", status: "completed" },
    { name: "COVID-19 booster", date: "2023-09-20", status: "completed" },
    { name: "Tdap", date: "2020-06-10", status: "completed" },
  ],
  procedures: [
    { name: "Colonoscopy", date: "2019-05-20", outcome: "Normal" },
    { name: "Echocardiogram", date: "2023-10-05", outcome: "Mild LVH" },
  ],
  familyHistory: [
    { condition: "Type 2 Diabetes", relationship: "Mother" },
    { condition: "Coronary Artery Disease", relationship: "Father" },
    { condition: "Stroke", relationship: "Father" },
    { condition: "Breast Cancer", relationship: "Maternal Aunt" },
  ],
  socialHistory: {
    smokingStatus: "Former (quit 2010)",
    alcoholUse: "Occasional",
    exerciseFrequency: "2x/week walking",
    occupation: "Retired teacher",
  },
  screenings: [
    { name: "Colonoscopy", date: "2019-05-20", result: "Normal", nextDue: "2029-05-20" },
    { name: "Diabetic Foot Exam", date: "2024-02-15", result: "Normal" },
  ],
};

type TabKey = "risk" | "summary" | "gaps";

function getRiskColor(level: string): string {
  switch (level) {
    case "very_high": return "#DC2626";
    case "high": return "#EF4444";
    case "moderate": return "#F59E0B";
    case "low": return "#10B981";
    default: return "#6B7280";
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#DC2626";
    case "high": return "#EF4444";
    case "moderate": return "#F59E0B";
    case "low": return "#3B82F6";
    default: return "#6B7280";
  }
}

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  switch (category) {
    case "screening": return "search";
    case "immunization": return "shield";
    case "monitoring": return "activity";
    case "follow_up": return "calendar";
    case "medication": return "package";
    case "referral": return "send";
    case "lifestyle": return "heart";
    default: return "alert-circle";
  }
}

function getPriorityIcon(priority: string): keyof typeof Feather.glyphMap {
  switch (priority) {
    case "immediate": return "alert-triangle";
    case "short_term": return "clock";
    case "long_term": return "calendar";
    default: return "check-circle";
  }
}

export default function PatientChartIntelligenceScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState<TabKey>("risk");

  const [riskResult, setRiskResult] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [gapsResult, setGapsResult] = useState<any>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);

  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [expandedGap, setExpandedGap] = useState<string | null>(null);

  const isLoading = riskLoading || summaryLoading || gapsLoading;

  const handleRunRiskStratification = useCallback(async () => {
    setRiskLoading(true);
    setRiskError(null);
    try {
      const res = await apiRequest("POST", "/api/chart-intelligence/risk-stratification", DEMO_PATIENT);
      const data = await res.json();
      setRiskResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setRiskError(err.message || "Failed to run risk analysis");
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const handleRunHistorySummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await apiRequest("POST", "/api/chart-intelligence/history-summary", DEMO_PATIENT);
      const data = await res.json();
      setSummaryResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setSummaryError(err.message || "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const handleRunCareGaps = useCallback(async () => {
    setGapsLoading(true);
    setGapsError(null);
    try {
      const res = await apiRequest("POST", "/api/chart-intelligence/care-gaps", DEMO_PATIENT);
      const data = await res.json();
      setGapsResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setGapsError(err.message || "Failed to analyze care gaps");
    } finally {
      setGapsLoading(false);
    }
  }, []);

  const handleRunActiveTab = useCallback(() => {
    if (activeTab === "risk") handleRunRiskStratification();
    else if (activeTab === "summary") handleRunHistorySummary();
    else handleRunCareGaps();
  }, [activeTab, handleRunRiskStratification, handleRunHistorySummary, handleRunCareGaps]);

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "risk", label: "Risk", icon: "trending-up" },
    { key: "summary", label: "Summary", icon: "file-text" },
    { key: "gaps", label: "Care Gaps", icon: "alert-circle" },
  ];

  const renderRiskTab = () => {
    if (riskLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText type="small" style={{ marginTop: Spacing.md, color: colors.textSecondary }}>
            Analyzing risk factors across clinical guidelines...
          </ThemedText>
        </View>
      );
    }

    if (riskError) {
      return (
        <Card elevation={1} style={styles.errorCard}>
          <View style={styles.errorContent}>
            <Feather name="alert-triangle" size={20} color={colors.error} />
            <ThemedText type="small" style={{ color: colors.error, marginLeft: Spacing.sm, flex: 1 }}>
              {riskError}
            </ThemedText>
          </View>
        </Card>
      );
    }

    if (!riskResult) {
      return (
        <View style={styles.centeredContent}>
          <Feather name="trending-up" size={48} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <ThemedText type="body" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            Predictive risk stratification analyzes patient data against clinical scoring models
          </ThemedText>
          <Pressable
            testID="button-run-risk"
            onPress={handleRunRiskStratification}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="play" size={16} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
              Run Risk Analysis
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    const tierColor = getRiskColor(riskResult.overallRiskTier);

    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card elevation={2} style={styles.summaryCard}>
          <View style={styles.riskOverview}>
            <View style={styles.riskScoreCircle}>
              <View style={[styles.scoreRing, { borderColor: tierColor }]}>
                <ThemedText type="h2" style={{ color: tierColor, fontWeight: "700" }}>
                  {riskResult.compositeScore}
                </ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>
                  / 100
                </ThemedText>
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.lg }}>
              <View style={styles.riskBadge}>
                <View style={[styles.riskBadgeInner, { backgroundColor: tierColor + "20" }]}>
                  <Feather
                    name={riskResult.trendDirection === "worsening" ? "arrow-down" : riskResult.trendDirection === "improving" ? "arrow-up" : "minus"}
                    size={12}
                    color={tierColor}
                  />
                  <ThemedText type="small" style={{ color: tierColor, marginLeft: 4, fontWeight: "600", textTransform: "capitalize" }}>
                    {riskResult.overallRiskTier?.replace("_", " ")} Risk
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
                Trend: {riskResult.trendDirection}
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>
                {riskResult.riskFactors?.length || 0} risk factors identified
              </ThemedText>
            </View>
          </View>
        </Card>

        {riskResult.riskFactors?.map((rf: any, idx: number) => {
          const isExpanded = expandedRisk === rf.id;
          const rfColor = getRiskColor(rf.riskLevel);
          return (
            <Card key={rf.id || idx} elevation={1} style={styles.itemCard}>
              <Pressable
                testID={`risk-factor-${idx}`}
                onPress={() => setExpandedRisk(isExpanded ? null : rf.id)}
                style={styles.itemHeader}
              >
                <View style={[styles.severityDot, { backgroundColor: rfColor }]} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{rf.condition}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary }}>
                    Score: {rf.riskScore}/100 | {rf.timeframe}
                  </ThemedText>
                </View>
                <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </Pressable>
              {isExpanded ? (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.expandedContent}>
                  <ThemedText type="small" style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>
                    {rf.recommendation}
                  </ThemedText>
                  {rf.contributing?.length > 0 ? (
                    <View style={styles.factorSection}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: colors.error, marginBottom: 4 }}>
                        Contributing Factors
                      </ThemedText>
                      {rf.contributing.map((f: string, i: number) => (
                        <View key={i} style={styles.factorRow}>
                          <Feather name="minus" size={12} color={colors.error} />
                          <ThemedText type="small" style={{ marginLeft: 6, flex: 1, color: colors.textSecondary }}>{f}</ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {rf.protective?.length > 0 ? (
                    <View style={styles.factorSection}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: colors.success, marginBottom: 4 }}>
                        Protective Factors
                      </ThemedText>
                      {rf.protective.map((f: string, i: number) => (
                        <View key={i} style={styles.factorRow}>
                          <Feather name="check" size={12} color={colors.success} />
                          <ThemedText type="small" style={{ marginLeft: 6, flex: 1, color: colors.textSecondary }}>{f}</ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={[styles.evidenceBadge, { backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="book-open" size={11} color={colors.textSecondary} />
                    <ThemedText type="small" style={{ marginLeft: 4, color: colors.textSecondary, fontSize: 11 }}>
                      {rf.evidenceBasis}
                    </ThemedText>
                  </View>
                </Animated.View>
              ) : null}
            </Card>
          );
        })}

        {riskResult.keyInterventions?.length > 0 ? (
          <Card elevation={1} style={styles.itemCard}>
            <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
              Key Interventions
            </ThemedText>
            {riskResult.keyInterventions.map((ki: any, idx: number) => (
              <View key={idx} style={styles.interventionRow}>
                <Feather name={getPriorityIcon(ki.priority)} size={14} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText type="small" style={{ fontWeight: "500" }}>{ki.intervention}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {ki.expectedImpact}
                  </ThemedText>
                </View>
                <View style={[styles.priorityTag, { backgroundColor: colors.primary + "15" }]}>
                  <ThemedText type="small" style={{ color: colors.primary, fontSize: 10, fontWeight: "600", textTransform: "capitalize" }}>
                    {ki.priority?.replace("_", " ")}
                  </ThemedText>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.disclaimerRow}>
          <Feather name="info" size={12} color={colors.textSecondary} />
          <ThemedText type="small" style={{ color: colors.textSecondary, marginLeft: 6, flex: 1, fontSize: 11 }}>
            {riskResult.disclaimer}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderSummaryTab = () => {
    if (summaryLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText type="small" style={{ marginTop: Spacing.md, color: colors.textSecondary }}>
            Summarizing patient history across all modules...
          </ThemedText>
        </View>
      );
    }

    if (summaryError) {
      return (
        <Card elevation={1} style={styles.errorCard}>
          <View style={styles.errorContent}>
            <Feather name="alert-triangle" size={20} color={colors.error} />
            <ThemedText type="small" style={{ color: colors.error, marginLeft: Spacing.sm, flex: 1 }}>
              {summaryError}
            </ThemedText>
          </View>
        </Card>
      );
    }

    if (!summaryResult) {
      return (
        <View style={styles.centeredContent}>
          <Feather name="file-text" size={48} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <ThemedText type="body" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            AI-powered summarization of the complete patient history across all data modules
          </ThemedText>
          <Pressable
            testID="button-run-summary"
            onPress={handleRunHistorySummary}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="play" size={16} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
              Generate Summary
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card elevation={2} style={styles.summaryCard}>
          <View style={styles.sectionHeader}>
            <Feather name="zap" size={16} color={colors.primary} />
            <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.sm }}>Executive Summary</ThemedText>
          </View>
          <ThemedText type="body" style={{ color: colors.textSecondary, lineHeight: 22 }}>
            {summaryResult.executiveSummary}
          </ThemedText>
        </Card>

        {summaryResult.timelineNarrative ? (
          <Card elevation={1} style={styles.itemCard}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={14} color={colors.primary} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>Health Journey</ThemedText>
            </View>
            <ThemedText type="small" style={{ color: colors.textSecondary, lineHeight: 20 }}>
              {summaryResult.timelineNarrative}
            </ThemedText>
          </Card>
        ) : null}

        {summaryResult.activeProblems?.length > 0 ? (
          <Card elevation={1} style={styles.itemCard}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-circle" size={14} color={colors.warning} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>Active Problems</ThemedText>
            </View>
            {summaryResult.activeProblems.map((p: any, idx: number) => (
              <View key={idx} style={styles.problemRow}>
                <View style={[styles.statusDot, { backgroundColor: p.status === "controlled" ? colors.success : p.status === "uncontrolled" ? colors.error : colors.warning }]} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ fontWeight: "500" }}>{p.condition}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {p.management}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: p.status === "controlled" ? colors.success + "15" : p.status === "uncontrolled" ? colors.error + "15" : colors.warning + "15",
                }]}>
                  <ThemedText type="small" style={{
                    fontSize: 10,
                    fontWeight: "600",
                    textTransform: "capitalize",
                    color: p.status === "controlled" ? colors.success : p.status === "uncontrolled" ? colors.error : colors.warning,
                  }}>
                    {p.status}
                  </ThemedText>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {summaryResult.medicationSummary?.current?.length > 0 ? (
          <Card elevation={1} style={styles.itemCard}>
            <View style={styles.sectionHeader}>
              <Feather name="package" size={14} color={colors.recordMedication} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>Medications</ThemedText>
            </View>
            {summaryResult.medicationSummary.current.map((med: string, idx: number) => (
              <View key={idx} style={styles.medRow}>
                <Feather name="minus" size={10} color={colors.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: 6, color: colors.textSecondary }}>{med}</ThemedText>
              </View>
            ))}
            {summaryResult.medicationSummary.adherenceNotes ? (
              <View style={[styles.adherenceNote, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, fontStyle: "italic" }}>
                  {summaryResult.medicationSummary.adherenceNotes}
                </ThemedText>
              </View>
            ) : null}
          </Card>
        ) : null}

        {(summaryResult.preventiveCare?.overdue?.length > 0 || summaryResult.preventiveCare?.upToDate?.length > 0) ? (
          <Card elevation={1} style={styles.itemCard}>
            <View style={styles.sectionHeader}>
              <Feather name="shield" size={14} color={colors.success} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>Preventive Care</ThemedText>
            </View>
            {summaryResult.preventiveCare.upToDate?.map((item: string, idx: number) => (
              <View key={`up-${idx}`} style={styles.preventiveRow}>
                <Feather name="check-circle" size={13} color={colors.success} />
                <ThemedText type="small" style={{ marginLeft: 6, color: colors.textSecondary }}>{item}</ThemedText>
              </View>
            ))}
            {summaryResult.preventiveCare.overdue?.map((item: string, idx: number) => (
              <View key={`od-${idx}`} style={styles.preventiveRow}>
                <Feather name="alert-circle" size={13} color={colors.error} />
                <ThemedText type="small" style={{ marginLeft: 6, color: colors.error }}>{item}</ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        {summaryResult.crossModuleInsights?.length > 0 ? (
          <Card elevation={1} style={styles.itemCard}>
            <View style={styles.sectionHeader}>
              <Feather name="layers" size={14} color={colors.info} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>Cross-Module Insights</ThemedText>
            </View>
            {summaryResult.crossModuleInsights.map((insight: string, idx: number) => (
              <View key={idx} style={styles.insightRow}>
                <Feather name="chevron-right" size={12} color={colors.info} />
                <ThemedText type="small" style={{ marginLeft: 6, flex: 1, color: colors.textSecondary, lineHeight: 18 }}>{insight}</ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.disclaimerRow}>
          <Feather name="info" size={12} color={colors.textSecondary} />
          <ThemedText type="small" style={{ color: colors.textSecondary, marginLeft: 6, flex: 1, fontSize: 11 }}>
            {summaryResult.disclaimer}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderGapsTab = () => {
    if (gapsLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText type="small" style={{ marginTop: Spacing.md, color: colors.textSecondary }}>
            Checking clinical guidelines for care gaps...
          </ThemedText>
        </View>
      );
    }

    if (gapsError) {
      return (
        <Card elevation={1} style={styles.errorCard}>
          <View style={styles.errorContent}>
            <Feather name="alert-triangle" size={20} color={colors.error} />
            <ThemedText type="small" style={{ color: colors.error, marginLeft: Spacing.sm, flex: 1 }}>
              {gapsError}
            </ThemedText>
          </View>
        </Card>
      );
    }

    if (!gapsResult) {
      return (
        <View style={styles.centeredContent}>
          <Feather name="alert-circle" size={48} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <ThemedText type="body" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            Identifies gaps in care based on evidence-based clinical guidelines
          </ThemedText>
          <Pressable
            testID="button-run-gaps"
            onPress={handleRunCareGaps}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="play" size={16} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
              Analyze Care Gaps
            </ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card elevation={2} style={styles.summaryCard}>
          <View style={styles.gapOverview}>
            <View style={styles.gapStat}>
              <ThemedText type="h2" style={{ fontWeight: "700", color: colors.text }}>{gapsResult.totalGaps}</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Total Gaps</ThemedText>
            </View>
            <View style={[styles.gapStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.gapStat}>
              <ThemedText type="h2" style={{ fontWeight: "700", color: gapsResult.criticalGaps > 0 ? colors.error : colors.success }}>
                {gapsResult.criticalGaps}
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Critical</ThemedText>
            </View>
            <View style={[styles.gapStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.gapStat}>
              <ThemedText type="h2" style={{ fontWeight: "700", color: gapsResult.complianceScore >= 70 ? colors.success : colors.warning }}>
                {gapsResult.complianceScore}%
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Compliance</ThemedText>
            </View>
          </View>
        </Card>

        {gapsResult.gaps?.map((gap: any, idx: number) => {
          const isExpanded = expandedGap === gap.id;
          const gapColor = getSeverityColor(gap.severity);
          return (
            <Card key={gap.id || idx} elevation={1} style={styles.itemCard}>
              <Pressable
                testID={`care-gap-${idx}`}
                onPress={() => setExpandedGap(isExpanded ? null : gap.id)}
                style={styles.itemHeader}
              >
                <View style={[styles.categoryIcon, { backgroundColor: gapColor + "15" }]}>
                  <Feather name={getCategoryIcon(gap.category)} size={14} color={gapColor} />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{gap.title}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, textTransform: "capitalize" }}>
                    {gap.category?.replace("_", " ")} | {gap.severity}
                  </ThemedText>
                </View>
                <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </Pressable>
              {isExpanded ? (
                <Animated.View entering={FadeInDown.duration(200)} style={styles.expandedContent}>
                  <ThemedText type="small" style={{ color: colors.textSecondary, lineHeight: 18, marginBottom: Spacing.sm }}>
                    {gap.description}
                  </ThemedText>
                  <View style={[styles.guidelineBadge, { backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="book-open" size={11} color={colors.primary} />
                    <ThemedText type="small" style={{ marginLeft: 4, color: colors.primary, fontSize: 11 }}>
                      {gap.guidelineSource}: {gap.guideline}
                    </ThemedText>
                  </View>
                  <View style={styles.actionRow}>
                    <Feather name="arrow-right" size={12} color={colors.success} />
                    <ThemedText type="small" style={{ marginLeft: 6, color: colors.textSecondary, fontWeight: "500" }}>
                      {gap.recommendedAction}
                    </ThemedText>
                  </View>
                  {gap.estimatedImpact ? (
                    <View style={styles.impactRow}>
                      <Feather name="bar-chart-2" size={11} color={colors.textSecondary} />
                      <ThemedText type="small" style={{ marginLeft: 6, color: colors.textSecondary, fontSize: 11, fontStyle: "italic" }}>
                        {gap.estimatedImpact}
                      </ThemedText>
                    </View>
                  ) : null}
                </Animated.View>
              ) : null}
            </Card>
          );
        })}

        {gapsResult.nextActions?.length > 0 ? (
          <Card elevation={1} style={styles.itemCard}>
            <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
              Prioritized Next Actions
            </ThemedText>
            {gapsResult.nextActions.map((action: any, idx: number) => (
              <View key={idx} style={styles.nextActionRow}>
                <View style={[styles.actionNumber, { backgroundColor: colors.primary }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{idx + 1}</ThemedText>
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText type="small" style={{ fontWeight: "500" }}>{action.action}</ThemedText>
                  <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11, textTransform: "capitalize" }}>
                    Priority: {action.priority?.replace("_", " ")}
                  </ThemedText>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.disclaimerRow}>
          <Feather name="info" size={12} color={colors.textSecondary} />
          <ThemedText type="small" style={{ color: colors.textSecondary, marginLeft: 6, flex: 1, fontSize: 11 }}>
            {gapsResult.disclaimer}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRunActiveTab} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.tabBar, { backgroundColor: colors.backgroundSecondary }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                testID={`tab-${tab.key}`}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  isActive ? { backgroundColor: colors.backgroundDefault } : null,
                ]}
              >
                <Feather name={tab.icon} size={14} color={isActive ? colors.primary : colors.textSecondary} />
                <ThemedText
                  type="small"
                  style={[
                    styles.tabLabel,
                    { color: isActive ? colors.primary : colors.textSecondary },
                    isActive ? { fontWeight: "600" } : null,
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {activeTab === "risk" ? renderRiskTab() : null}
        {activeTab === "summary" ? renderSummaryTab() : null}
        {activeTab === "gaps" ? renderGapsTab() : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  tabLabel: {
    fontSize: 13,
  },
  centeredContent: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    paddingHorizontal: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  errorCard: {
    marginBottom: Spacing.md,
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryCard: {
    marginBottom: Spacing.md,
  },
  itemCard: {
    marginBottom: Spacing.sm,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  expandedContent: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  factorSection: {
    marginBottom: Spacing.sm,
  },
  factorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
    paddingLeft: Spacing.xs,
  },
  evidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  interventionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: Spacing.xs,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  riskOverview: {
    flexDirection: "row",
    alignItems: "center",
  },
  riskScoreCircle: {
    alignItems: "center",
  },
  scoreRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  riskBadge: {
    flexDirection: "row",
  },
  riskBadgeInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  problemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB30",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: Spacing.xs,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  adherenceNote: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  preventiveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  gapOverview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  gapStat: {
    alignItems: "center",
    flex: 1,
  },
  gapStatDivider: {
    width: 1,
    height: 40,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  guidelineBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  nextActionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  actionNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
});
