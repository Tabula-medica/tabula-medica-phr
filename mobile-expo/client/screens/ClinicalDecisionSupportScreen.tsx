import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingState, BaseModal, FormInput, Button } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface CDSAlert {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  rationale: string;
  recommendations: string[];
  disclaimer: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: string;
  description: string;
  clinicalEffect: string;
  management: string;
}

interface DifferentialDiagnosis {
  condition: string;
  icd10Code: string;
  probability: string;
  supportingFactors: string[];
  rulingOutFactors: string[];
}

interface RecommendedTest {
  testName: string;
  loincCode: string;
  priority: string;
  rationale: string;
  expectedFindings: string;
  uscdiCategory: string;
}

interface PreventiveCareGap {
  measure: string;
  dueDate: string;
  status: string;
  recommendation: string;
}

interface CDSResult {
  patientId: string;
  generatedAt: string;
  context: string;
  alerts: CDSAlert[];
  differentialDiagnoses: DifferentialDiagnosis[];
  drugInteractions: DrugInteraction[];
  recommendedTests: RecommendedTest[];
  preventiveCareGaps: PreventiveCareGap[];
  disclaimer: string;
}

type CDSSection = "input" | "alerts" | "diagnoses" | "interactions" | "tests" | "preventive" | "risk" | "screening";

interface RiskFactor {
  factor: string;
  weight: number;
  present: boolean;
  category: string;
}

interface RiskProfile {
  conditionName: string;
  icd10Code: string;
  riskLevel: "high" | "moderate" | "low";
  riskScore: number;
  confidenceInterval: { lower: number; upper: number };
  factors: RiskFactor[];
  timeHorizon: string;
  recommendations: string[];
  aiRationale?: string;
  lastAssessed: string;
}

interface RiskStratificationResult {
  patientId: string;
  generatedAt: string;
  overallRiskLevel: "high" | "moderate" | "low";
  riskProfiles: RiskProfile[];
  modelVersion: string;
  disclaimer: string;
}

interface ScreeningAlertItem {
  id: string;
  screeningType: string;
  guidelineSource: string;
  recommendedFrequency: string;
  ageRange: string;
  applicableGender: string;
  status: "overdue" | "due_soon" | "current";
  lastPerformed: string | null;
  nextDue: string;
  priority: "high" | "moderate" | "low";
  recommendation: string;
  icd10Code: string;
  loincCode: string;
}

interface VaccinationAlertItem {
  id: string;
  vaccineName: string;
  vaccineCode: string;
  guidelineSource: string;
  status: "overdue" | "due_soon" | "current";
  lastAdministered: string | null;
  nextDue: string;
  ageRange: string;
  priority: "high" | "moderate" | "low";
  recommendation: string;
  series: { doseNumber: number | null; totalDoses: number; isComplete: boolean };
}

interface ScreeningAlertsResult {
  patientId: string;
  generatedAt: string;
  screeningAlerts: ScreeningAlertItem[];
  vaccinationAlerts: VaccinationAlertItem[];
  summary: {
    totalScreenings: number;
    overdueScreenings: number;
    currentScreenings: number;
    totalVaccinations: number;
    overdueVaccinations: number;
    upToDateVaccinations: number;
  };
  disclaimer: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  contraindicated: "#DC2626",
  high: "#EA580C",
  major: "#EA580C",
  moderate: "#D97706",
  low: "#2563EB",
  minor: "#2563EB",
  info: "#6B7280",
};

const SEVERITY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  critical: "alert-octagon",
  contraindicated: "alert-octagon",
  high: "alert-triangle",
  major: "alert-triangle",
  moderate: "alert-circle",
  low: "info",
  minor: "info",
  info: "info",
};

const PRIORITY_COLORS: Record<string, string> = {
  stat: "#DC2626",
  urgent: "#EA580C",
  routine: "#2563EB",
  elective: "#6B7280",
};

const CONTEXT_OPTIONS = [
  { value: "record_review", label: "Record Review" },
  { value: "telehealth", label: "Telehealth Session" },
  { value: "medication_review", label: "Medication Review" },
  { value: "general", label: "General Assessment" },
];

export default function ClinicalDecisionSupportScreen() {
  const { theme } = useTheme();
  const colors = theme;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [activeSection, setActiveSection] = useState<CDSSection>("input");
  const [patientId, setPatientId] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [medications, setMedications] = useState("");
  const [conditions, setConditions] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [context, setContext] = useState("general");
  const [result, setResult] = useState<CDSResult | null>(null);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  const [drugCheckMeds, setDrugCheckMeds] = useState("");
  const [drugCheckResult, setDrugCheckResult] = useState<{
    interactions: DrugInteraction[];
    safeCount: number;
    totalChecked: number;
  } | null>(null);

  const [riskResult, setRiskResult] = useState<RiskStratificationResult | null>(null);
  const [screeningResult, setScreeningResult] = useState<ScreeningAlertsResult | null>(null);

  const { checkFeature, promptProps } = useFeatureGate();

  const analyzeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axiosInstance.post("/api/cds/analyze", data);
      return response.data;
    },
    onSuccess: (data: CDSResult) => {
      setResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (data.alerts.length > 0) {
        setActiveSection("alerts");
      } else if (data.differentialDiagnoses.length > 0) {
        setActiveSection("diagnoses");
      } else if (data.recommendedTests.length > 0) {
        setActiveSection("tests");
      }
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const drugCheckMutation = useMutation({
    mutationFn: async (medList: string[]) => {
      const response = await axiosInstance.post("/api/cds/drug-interactions", {
        medications: medList,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setDrugCheckResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const riskMutation = useMutation({
    mutationFn: async (pid: string) => {
      const response = await axiosInstance.post("/api/cds/risk-stratification", { patientId: pid });
      return response.data;
    },
    onSuccess: (data: RiskStratificationResult) => {
      setRiskResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const screeningMutation = useMutation({
    mutationFn: async (pid: string) => {
      const response = await axiosInstance.post("/api/cds/screening-alerts", { patientId: pid });
      return response.data;
    },
    onSuccess: (data: ScreeningAlertsResult) => {
      setScreeningResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleAnalyze = useCallback(() => {
    if (!patientId.trim()) return;
    if (!checkFeature("cds")) return;
    const pid = patientId.trim();
    const symptomList = symptoms.split(",").map(s => s.trim()).filter(Boolean);
    const medList = medications.split(",").map(m => m.trim()).filter(Boolean);
    const condList = conditions.split(",").map(c => c.trim()).filter(Boolean);
    analyzeMutation.mutate({
      patientId: pid,
      symptoms: symptomList,
      medications: medList,
      conditions: condList,
      chiefComplaint: chiefComplaint.trim() || undefined,
      context,
    });
    riskMutation.mutate(pid);
    screeningMutation.mutate(pid);
  }, [patientId, symptoms, medications, conditions, chiefComplaint, context, checkFeature]);

  const handleDrugCheck = useCallback(() => {
    const medList = drugCheckMeds.split(",").map(m => m.trim()).filter(Boolean);
    if (medList.length < 2) return;
    if (!checkFeature("drug_interactions")) return;
    drugCheckMutation.mutate(medList);
  }, [drugCheckMeds, checkFeature]);

  const getSeverityColor = (severity: string) => SEVERITY_COLORS[severity] || "#6B7280";
  const getSeverityIcon = (severity: string): keyof typeof Feather.glyphMap =>
    SEVERITY_ICONS[severity] || "info";

  const alertCount = result?.alerts.length || 0;
  const criticalCount = result?.alerts.filter(a => a.severity === "critical" || a.severity === "high").length || 0;

  const renderSectionTab = (section: CDSSection, label: string, icon: keyof typeof Feather.glyphMap, badge?: number) => (
    <Pressable
      testID={`tab-${section}`}
      onPress={() => setActiveSection(section)}
      style={[
        styles.sectionTab,
        {
          backgroundColor: activeSection === section ? colors.primary + "18" : "transparent",
          borderColor: activeSection === section ? colors.primary : colors.border,
        },
      ]}
    >
      <Feather name={icon} size={16} color={activeSection === section ? colors.primary : colors.textSecondary} />
      <ThemedText style={[styles.sectionTabText, { color: activeSection === section ? colors.primary : colors.textSecondary }]}>
        {label}
      </ThemedText>
      {badge !== undefined && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.error }]}>
          <ThemedText style={styles.badgeText}>{badge}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );

  const renderInputSection = () => (
    <Animated.View entering={FadeInDown.delay(100)}>
      <View style={[styles.card, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="search" size={20} color={colors.primary} />
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
            Patient Analysis
          </ThemedText>
        </View>

        <FormInput
          label="Patient ID *"
          testID="input-patient-id"
          value={patientId}
          onChangeText={setPatientId}
          placeholder="Enter patient ID"
        />

        <FormInput
          label="Chief Complaint"
          testID="input-chief-complaint"
          value={chiefComplaint}
          onChangeText={setChiefComplaint}
          placeholder="e.g., Chest pain radiating to left arm"
        />

        <FormInput
          label="Symptoms (comma-separated)"
          testID="input-symptoms"
          value={symptoms}
          onChangeText={setSymptoms}
          placeholder="e.g., headache, fatigue, dizziness"
          multiline
        />

        <FormInput
          label="Active Medications (comma-separated)"
          testID="input-medications"
          value={medications}
          onChangeText={setMedications}
          placeholder="e.g., lisinopril, metformin, atorvastatin"
          multiline
        />

        <FormInput
          label="Known Conditions (comma-separated)"
          testID="input-conditions"
          value={conditions}
          onChangeText={setConditions}
          placeholder="e.g., Type 2 Diabetes, Hypertension"
          multiline
        />

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Clinical Context</ThemedText>
          <View style={styles.contextRow}>
            {CONTEXT_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                testID={`context-${opt.value}`}
                onPress={() => setContext(opt.value)}
                style={[
                  styles.contextChip,
                  {
                    backgroundColor: context === opt.value ? colors.primary + "18" : colors.backgroundSecondary,
                    borderColor: context === opt.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <ThemedText style={[styles.contextChipText, { color: context === opt.value ? colors.primary : colors.textSecondary }]}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <Button
          testID="button-analyze"
          onPress={handleAnalyze}
          disabled={!patientId.trim()}
          loading={analyzeMutation.isPending}
          icon="cpu"
          fullWidth
          style={styles.analyzeButton}
        >
          {analyzeMutation.isPending ? "Analyzing..." : "Run CDS Analysis"}
        </Button>
      </View>

      <View style={[styles.card, { backgroundColor: colors.backgroundDefault, borderColor: colors.border, marginTop: Spacing.md }]}>
        <View style={styles.cardHeader}>
          <Feather name="shield" size={20} color="#EA580C" />
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
            Quick Drug Interaction Check
          </ThemedText>
        </View>
        <View style={styles.inputGroup}>
          <FormInput
            label="Medications (comma-separated, at least 2)"
            testID="input-drug-check"
            value={drugCheckMeds}
            onChangeText={setDrugCheckMeds}
            placeholder="e.g., warfarin, aspirin, lisinopril"
            multiline
          />
        </View>
        <Button
          testID="button-drug-check"
          onPress={handleDrugCheck}
          disabled={drugCheckMeds.split(",").filter(m => m.trim()).length < 2}
          loading={drugCheckMutation.isPending}
          icon="zap"
          fullWidth
          style={[styles.drugCheckButton, { backgroundColor: "#EA580C" }]}
        >
          {drugCheckMutation.isPending ? "Checking..." : "Check Interactions"}
        </Button>

        {drugCheckResult ? (
          <Animated.View entering={FadeInDown} style={styles.drugCheckResults}>
            <View style={[styles.drugCheckSummary, { backgroundColor: drugCheckResult.interactions.length > 0 ? "#FEF2F2" : "#F0FDF4" }]}>
              <Feather
                name={drugCheckResult.interactions.length > 0 ? "alert-triangle" : "check-circle"}
                size={20}
                color={drugCheckResult.interactions.length > 0 ? "#DC2626" : "#16A34A"}
              />
              <ThemedText style={[styles.drugCheckSummaryText, { color: drugCheckResult.interactions.length > 0 ? "#DC2626" : "#16A34A" }]}>
                {drugCheckResult.interactions.length > 0
                  ? `${drugCheckResult.interactions.length} interaction(s) found`
                  : `No interactions detected (${drugCheckResult.safeCount} pairs checked)`}
              </ThemedText>
            </View>
            {drugCheckResult.interactions.map((interaction, idx) => (
              <View key={idx} style={[styles.interactionCard, { borderColor: getSeverityColor(interaction.severity), backgroundColor: colors.backgroundSecondary }]}>
                <View style={styles.interactionHeader}>
                  <Feather name={getSeverityIcon(interaction.severity)} size={16} color={getSeverityColor(interaction.severity)} />
                  <ThemedText style={[styles.interactionSeverity, { color: getSeverityColor(interaction.severity) }]}>
                    {interaction.severity.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.interactionDrugs, { color: colors.text }]}>
                  {interaction.drug1} + {interaction.drug2}
                </ThemedText>
                <ThemedText style={[styles.interactionDesc, { color: colors.textSecondary }]}>
                  {interaction.description}
                </ThemedText>
                <View style={[styles.managementBox, { backgroundColor: colors.backgroundDefault }]}>
                  <ThemedText style={[styles.managementLabel, { color: colors.primary }]}>Management:</ThemedText>
                  <ThemedText style={[styles.managementText, { color: colors.text }]}>{interaction.management}</ThemedText>
                </View>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );

  const renderAlertsSection = () => {
    if (!result) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        {result.alerts.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <Feather name="check-circle" size={40} color={colors.success} />
            <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>No Active Alerts</ThemedText>
            <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
              No critical safety alerts were identified for this patient.
            </ThemedText>
          </View>
        ) : null}
        {result.alerts.map((alert, idx) => (
          <Animated.View key={alert.id} entering={FadeInDown.delay(idx * 80)}>
            <View style={[styles.alertCard, { borderLeftColor: getSeverityColor(alert.severity), backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertSeverityBadge, { backgroundColor: getSeverityColor(alert.severity) + "18" }]}>
                  <Feather name={getSeverityIcon(alert.severity)} size={16} color={getSeverityColor(alert.severity)} />
                  <ThemedText style={[styles.alertSeverityText, { color: getSeverityColor(alert.severity) }]}>
                    {alert.severity.toUpperCase()}
                  </ThemedText>
                </View>
                <View style={[styles.alertCategoryBadge, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.alertCategoryText, { color: colors.textSecondary }]}>
                    {alert.category.replace("_", " ")}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.alertTitle, { color: colors.text }]}>{alert.title}</ThemedText>
              <ThemedText style={[styles.alertDesc, { color: colors.textSecondary }]}>{alert.description}</ThemedText>
              {alert.rationale ? (
                <View style={[styles.rationaleBox, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.rationaleLabel, { color: colors.primary }]}>Clinical Rationale:</ThemedText>
                  <ThemedText style={[styles.rationaleText, { color: colors.text }]}>{alert.rationale}</ThemedText>
                </View>
              ) : null}
              {alert.recommendations.length > 0 ? (
                <View style={styles.recommendationsList}>
                  <ThemedText style={[styles.recommendationsLabel, { color: colors.text }]}>Recommendations:</ThemedText>
                  {alert.recommendations.map((rec, rIdx) => (
                    <View key={rIdx} style={styles.recommendationItem}>
                      <Feather name="chevron-right" size={14} color={colors.primary} />
                      <ThemedText style={[styles.recommendationText, { color: colors.textSecondary }]}>{rec}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };

  const renderDiagnosesSection = () => {
    if (!result) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        {result.differentialDiagnoses.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <Feather name="file-text" size={40} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>No Differential Diagnoses</ThemedText>
            <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
              Provide symptoms and conditions for AI-powered diagnostic suggestions.
            </ThemedText>
          </View>
        ) : null}
        {result.differentialDiagnoses.map((dx, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 80)}>
            <View style={[styles.dxCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
              <View style={styles.dxHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.dxCondition, { color: colors.text }]}>{dx.condition}</ThemedText>
                  <ThemedText style={[styles.dxCode, { color: colors.primary }]}>ICD-10: {dx.icd10Code}</ThemedText>
                </View>
                <View style={[
                  styles.probabilityBadge,
                  {
                    backgroundColor: dx.probability === "high" ? "#DC262618" :
                      dx.probability === "moderate" ? "#D9770618" : "#2563EB18",
                  },
                ]}>
                  <ThemedText style={[
                    styles.probabilityText,
                    {
                      color: dx.probability === "high" ? "#DC2626" :
                        dx.probability === "moderate" ? "#D97706" : "#2563EB",
                    },
                  ]}>
                    {dx.probability.toUpperCase()}
                  </ThemedText>
                </View>
              </View>
              {dx.supportingFactors.length > 0 ? (
                <View style={styles.factorsSection}>
                  <ThemedText style={[styles.factorsLabel, { color: colors.success }]}>Supporting Factors:</ThemedText>
                  {dx.supportingFactors.map((f, fIdx) => (
                    <View key={fIdx} style={styles.factorItem}>
                      <Feather name="plus-circle" size={12} color={colors.success} />
                      <ThemedText style={[styles.factorText, { color: colors.text }]}>{f}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
              {dx.rulingOutFactors.length > 0 ? (
                <View style={styles.factorsSection}>
                  <ThemedText style={[styles.factorsLabel, { color: colors.error }]}>Ruling Out:</ThemedText>
                  {dx.rulingOutFactors.map((f, fIdx) => (
                    <View key={fIdx} style={styles.factorItem}>
                      <Feather name="minus-circle" size={12} color={colors.error} />
                      <ThemedText style={[styles.factorText, { color: colors.text }]}>{f}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };

  const renderInteractionsSection = () => {
    if (!result) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        {result.drugInteractions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <Feather name="check-circle" size={40} color={colors.success} />
            <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>No Drug Interactions</ThemedText>
            <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
              No known drug interactions detected for the current medication list.
            </ThemedText>
          </View>
        ) : null}
        {result.drugInteractions.map((interaction, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 80)}>
            <View style={[styles.interactionCard, { borderColor: getSeverityColor(interaction.severity), backgroundColor: colors.backgroundDefault }]}>
              <View style={styles.interactionHeader}>
                <Feather name={getSeverityIcon(interaction.severity)} size={18} color={getSeverityColor(interaction.severity)} />
                <ThemedText style={[styles.interactionSeverity, { color: getSeverityColor(interaction.severity) }]}>
                  {interaction.severity.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText style={[styles.interactionDrugs, { color: colors.text }]}>
                {interaction.drug1} + {interaction.drug2}
              </ThemedText>
              <ThemedText style={[styles.interactionDesc, { color: colors.textSecondary }]}>
                {interaction.description}
              </ThemedText>
              <View style={[styles.clinicalEffectBox, { backgroundColor: getSeverityColor(interaction.severity) + "10" }]}>
                <ThemedText style={[styles.clinicalEffectLabel, { color: getSeverityColor(interaction.severity) }]}>Clinical Effect:</ThemedText>
                <ThemedText style={[styles.clinicalEffectText, { color: colors.text }]}>{interaction.clinicalEffect}</ThemedText>
              </View>
              <View style={[styles.managementBox, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={[styles.managementLabel, { color: colors.primary }]}>Management:</ThemedText>
                <ThemedText style={[styles.managementText, { color: colors.text }]}>{interaction.management}</ThemedText>
              </View>
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };

  const renderTestsSection = () => {
    if (!result) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        {result.recommendedTests.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <Feather name="clipboard" size={40} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>No Test Recommendations</ThemedText>
            <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
              No additional diagnostic tests recommended at this time.
            </ThemedText>
          </View>
        ) : null}
        {result.recommendedTests.map((test, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 80)}>
            <View style={[styles.testCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
              <View style={styles.testHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.testName, { color: colors.text }]}>{test.testName}</ThemedText>
                  <ThemedText style={[styles.testCode, { color: colors.primary }]}>LOINC: {test.loincCode}</ThemedText>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[test.priority] || "#6B7280") + "18" }]}>
                  <ThemedText style={[styles.priorityText, { color: PRIORITY_COLORS[test.priority] || "#6B7280" }]}>
                    {test.priority.toUpperCase()}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.uscdiCategoryBadge, { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="grid" size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.uscdiCategoryText, { color: colors.textSecondary }]}>
                  USCDI v6: {test.uscdiCategory}
                </ThemedText>
              </View>
              <ThemedText style={[styles.testRationale, { color: colors.textSecondary }]}>
                {test.rationale}
              </ThemedText>
              {test.expectedFindings ? (
                <View style={[styles.expectedBox, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.expectedLabel, { color: colors.text }]}>Expected Findings:</ThemedText>
                  <ThemedText style={[styles.expectedText, { color: colors.textSecondary }]}>{test.expectedFindings}</ThemedText>
                </View>
              ) : null}
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };

  const renderPreventiveSection = () => {
    if (!result) return null;
    const statusColors: Record<string, string> = {
      overdue: "#DC2626",
      due_soon: "#D97706",
      current: "#16A34A",
    };
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        {result.preventiveCareGaps.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <Feather name="heart" size={40} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>No Preventive Care Gaps</ThemedText>
            <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
              Patient appears up to date on preventive care measures.
            </ThemedText>
          </View>
        ) : null}
        {result.preventiveCareGaps.map((gap, idx) => (
          <Animated.View key={idx} entering={FadeInDown.delay(idx * 80)}>
            <View style={[styles.preventiveCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
              <View style={styles.preventiveHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.preventiveMeasure, { color: colors.text }]}>{gap.measure}</ThemedText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: (statusColors[gap.status] || "#6B7280") + "18" }]}>
                  <ThemedText style={[styles.statusText, { color: statusColors[gap.status] || "#6B7280" }]}>
                    {gap.status.replace("_", " ").toUpperCase()}
                  </ThemedText>
                </View>
              </View>
              {gap.dueDate ? (
                <ThemedText style={[styles.dueDate, { color: colors.textSecondary }]}>Due: {gap.dueDate}</ThemedText>
              ) : null}
              <ThemedText style={[styles.preventiveRec, { color: colors.textSecondary }]}>{gap.recommendation}</ThemedText>
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "high": return "#DC2626";
      case "moderate": return "#D97706";
      case "low": return "#16A34A";
      default: return "#6B7280";
    }
  };

  const getRiskLevelIcon = (level: string): keyof typeof Feather.glyphMap => {
    switch (level) {
      case "high": return "alert-triangle";
      case "moderate": return "alert-circle";
      case "low": return "check-circle";
      default: return "info";
    }
  };

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    switch (category) {
      case "demographic": return "users";
      case "clinical": return "activity";
      case "behavioral": return "heart";
      case "lab": return "droplet";
      case "medication": return "package";
      case "family_history": return "git-branch";
      case "social": return "message-circle";
      case "environmental": return "wind";
      default: return "circle";
    }
  };

  const renderRiskSection = () => {
    if (riskMutation.isPending) {
      return <LoadingState message="Analyzing Risk Factors" />;
    }
    if (!riskResult) {
      return (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
          <Feather name="bar-chart-2" size={40} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>Risk Stratification</ThemedText>
          <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
            Enter a Patient ID and run analysis to generate predictive risk profiles for 6 chronic conditions.
          </ThemedText>
        </View>
      );
    }
    const highRisks = riskResult.riskProfiles.filter(r => r.riskLevel === "high").length;
    const modRisks = riskResult.riskProfiles.filter(r => r.riskLevel === "moderate").length;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        <View style={[styles.riskOverviewCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
          <View style={styles.riskOverviewHeader}>
            <View style={[styles.overallRiskBadge, { backgroundColor: getRiskLevelColor(riskResult.overallRiskLevel) + "18" }]}>
              <Feather name={getRiskLevelIcon(riskResult.overallRiskLevel)} size={18} color={getRiskLevelColor(riskResult.overallRiskLevel)} />
              <ThemedText style={[styles.overallRiskText, { color: getRiskLevelColor(riskResult.overallRiskLevel) }]}>
                Overall: {riskResult.overallRiskLevel.toUpperCase()} RISK
              </ThemedText>
            </View>
            <ThemedText style={[styles.riskModelVersion, { color: colors.textSecondary }]}>
              Model v{riskResult.modelVersion}
            </ThemedText>
          </View>
          <View style={styles.riskStatsRow}>
            <View style={[styles.riskStatItem, { backgroundColor: "#DC262610" }]}>
              <ThemedText style={[styles.riskStatNumber, { color: "#DC2626" }]}>{highRisks}</ThemedText>
              <ThemedText style={[styles.riskStatLabel, { color: "#DC2626" }]}>High</ThemedText>
            </View>
            <View style={[styles.riskStatItem, { backgroundColor: "#D9770610" }]}>
              <ThemedText style={[styles.riskStatNumber, { color: "#D97706" }]}>{modRisks}</ThemedText>
              <ThemedText style={[styles.riskStatLabel, { color: "#D97706" }]}>Moderate</ThemedText>
            </View>
            <View style={[styles.riskStatItem, { backgroundColor: "#16A34A10" }]}>
              <ThemedText style={[styles.riskStatNumber, { color: "#16A34A" }]}>{riskResult.riskProfiles.length - highRisks - modRisks}</ThemedText>
              <ThemedText style={[styles.riskStatLabel, { color: "#16A34A" }]}>Low</ThemedText>
            </View>
          </View>
        </View>

        {riskResult.riskProfiles.map((profile, idx) => (
          <Animated.View key={profile.conditionName} entering={FadeInDown.delay(idx * 80)}>
            <View style={[styles.riskProfileCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border, borderLeftColor: getRiskLevelColor(profile.riskLevel) }]}>
              <View style={styles.riskProfileHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.riskConditionName, { color: colors.text }]}>{profile.conditionName}</ThemedText>
                  <ThemedText style={[styles.riskIcd10, { color: colors.primary }]}>ICD-10: {profile.icd10Code}</ThemedText>
                </View>
                <View style={[styles.riskScoreBadge, { backgroundColor: getRiskLevelColor(profile.riskLevel) + "18" }]}>
                  <ThemedText style={[styles.riskScoreValue, { color: getRiskLevelColor(profile.riskLevel) }]}>
                    {profile.riskScore}
                  </ThemedText>
                  <ThemedText style={[styles.riskScoreMax, { color: getRiskLevelColor(profile.riskLevel) }]}>/100</ThemedText>
                </View>
              </View>

              <View style={styles.riskMeta}>
                <View style={[styles.riskMetaItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name="clock" size={12} color={colors.textSecondary} />
                  <ThemedText style={[styles.riskMetaText, { color: colors.textSecondary }]}>{profile.timeHorizon} horizon</ThemedText>
                </View>
                <View style={[styles.riskMetaItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name="percent" size={12} color={colors.textSecondary} />
                  <ThemedText style={[styles.riskMetaText, { color: colors.textSecondary }]}>
                    CI: {profile.confidenceInterval.lower}-{profile.confidenceInterval.upper}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.riskBar, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.riskBarFill, { width: `${profile.riskScore}%`, backgroundColor: getRiskLevelColor(profile.riskLevel) }]} />
              </View>

              {profile.factors.length > 0 ? (
                <View style={styles.riskFactorsSection}>
                  <ThemedText style={[styles.riskFactorsLabel, { color: colors.text }]}>Contributing Factors</ThemedText>
                  {profile.factors.map((factor, fIdx) => (
                    <View key={fIdx} style={[styles.riskFactorRow, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name={getCategoryIcon(factor.category)} size={14} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.riskFactorName, { color: colors.text }]}>{factor.factor}</ThemedText>
                        <ThemedText style={[styles.riskFactorCategory, { color: colors.textSecondary }]}>
                          {factor.category.replace("_", " ")} (+{factor.weight})
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {profile.aiRationale ? (
                <View style={[styles.aiRationaleBox, { backgroundColor: "#7C3AED10", borderColor: "#7C3AED30" }]}>
                  <View style={styles.aiRationaleHeader}>
                    <Feather name="cpu" size={14} color="#7C3AED" />
                    <ThemedText style={[styles.aiRationaleLabel, { color: "#7C3AED" }]}>AI Analysis</ThemedText>
                  </View>
                  <ThemedText style={[styles.aiRationaleText, { color: colors.text }]}>{profile.aiRationale}</ThemedText>
                </View>
              ) : null}

              {profile.recommendations.length > 0 ? (
                <View style={styles.riskRecsSection}>
                  <ThemedText style={[styles.riskRecsLabel, { color: colors.text }]}>Recommendations</ThemedText>
                  {profile.recommendations.map((rec, rIdx) => (
                    <View key={rIdx} style={styles.riskRecItem}>
                      <Feather name="chevron-right" size={14} color={colors.primary} />
                      <ThemedText style={[styles.riskRecText, { color: colors.textSecondary }]}>{rec}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        ))}

        <View style={[styles.disclaimerBanner, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
          <Feather name="info" size={16} color="#92400E" />
          <ThemedText style={[styles.disclaimerBannerText, { color: "#92400E" }]}>
            {riskResult.disclaimer}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderScreeningSection = () => {
    const statusColors: Record<string, string> = {
      overdue: "#DC2626",
      due_soon: "#D97706",
      current: "#16A34A",
    };
    const statusLabels: Record<string, string> = {
      overdue: "OVERDUE",
      due_soon: "DUE SOON",
      current: "CURRENT",
    };

    if (screeningMutation.isPending) {
      return <LoadingState message="Checking Guidelines" />;
    }
    if (!screeningResult) {
      return (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
          <Feather name="calendar" size={40} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyStateTitle, { color: colors.text }]}>Screening & Vaccination Alerts</ThemedText>
          <ThemedText style={[styles.emptyStateDesc, { color: colors.textSecondary }]}>
            Enter a Patient ID and run analysis to check for overdue screenings and vaccinations based on USPSTF and CDC guidelines.
          </ThemedText>
        </View>
      );
    }

    const { screeningAlerts, vaccinationAlerts, summary } = screeningResult;

    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        <View style={[styles.screeningSummaryCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
          <ThemedText style={[styles.screeningSummaryTitle, { color: colors.text }]}>Prevention Summary</ThemedText>
          <View style={styles.screeningSummaryRow}>
            <View style={[styles.screeningStat, { backgroundColor: "#DC262610" }]}>
              <ThemedText style={[styles.screeningStatNum, { color: "#DC2626" }]}>{summary.overdueScreenings}</ThemedText>
              <ThemedText style={[styles.screeningStatLabel, { color: "#DC2626" }]}>Overdue Screenings</ThemedText>
            </View>
            <View style={[styles.screeningStat, { backgroundColor: "#16A34A10" }]}>
              <ThemedText style={[styles.screeningStatNum, { color: "#16A34A" }]}>{summary.currentScreenings}</ThemedText>
              <ThemedText style={[styles.screeningStatLabel, { color: "#16A34A" }]}>Current</ThemedText>
            </View>
            <View style={[styles.screeningStat, { backgroundColor: "#EA580C10" }]}>
              <ThemedText style={[styles.screeningStatNum, { color: "#EA580C" }]}>{summary.overdueVaccinations}</ThemedText>
              <ThemedText style={[styles.screeningStatLabel, { color: "#EA580C" }]}>Vax Due</ThemedText>
            </View>
          </View>
        </View>

        {screeningAlerts.length > 0 ? (
          <View style={styles.screeningSectionGroup}>
            <View style={styles.screeningSectionHeader}>
              <Feather name="search" size={18} color={colors.primary} />
              <ThemedText style={[styles.screeningSectionTitle, { color: colors.text }]}>Screenings ({screeningAlerts.length})</ThemedText>
            </View>
            {screeningAlerts.map((alert, idx) => (
              <Animated.View key={alert.id} entering={FadeInDown.delay(idx * 60)}>
                <View style={[styles.screeningAlertCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border, borderLeftColor: statusColors[alert.status] || "#6B7280" }]}>
                  <View style={styles.screeningAlertHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.screeningAlertType, { color: colors.text }]}>{alert.screeningType}</ThemedText>
                      <ThemedText style={[styles.screeningAlertGuideline, { color: colors.textSecondary }]}>{alert.guidelineSource}</ThemedText>
                    </View>
                    <View style={[styles.screeningStatusBadge, { backgroundColor: (statusColors[alert.status] || "#6B7280") + "18" }]}>
                      <ThemedText style={[styles.screeningStatusText, { color: statusColors[alert.status] || "#6B7280" }]}>
                        {statusLabels[alert.status] || alert.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.screeningAlertMeta}>
                    <View style={[styles.screeningMetaChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="calendar" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.screeningMetaText, { color: colors.textSecondary }]}>Next: {alert.nextDue}</ThemedText>
                    </View>
                    <View style={[styles.screeningMetaChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="users" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.screeningMetaText, { color: colors.textSecondary }]}>Ages {alert.ageRange}</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.screeningFrequency, { color: colors.textSecondary }]}>{alert.recommendedFrequency}</ThemedText>
                  <ThemedText style={[styles.screeningRec, { color: colors.text }]}>{alert.recommendation}</ThemedText>
                  <View style={styles.screeningCodes}>
                    <ThemedText style={[styles.screeningCodeText, { color: colors.primary }]}>ICD-10: {alert.icd10Code}</ThemedText>
                    <ThemedText style={[styles.screeningCodeText, { color: colors.primary }]}>LOINC: {alert.loincCode}</ThemedText>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {vaccinationAlerts.length > 0 ? (
          <View style={styles.screeningSectionGroup}>
            <View style={styles.screeningSectionHeader}>
              <Feather name="shield" size={18} color="#EA580C" />
              <ThemedText style={[styles.screeningSectionTitle, { color: colors.text }]}>Vaccinations ({vaccinationAlerts.length})</ThemedText>
            </View>
            {vaccinationAlerts.map((vax, idx) => (
              <Animated.View key={vax.id} entering={FadeInDown.delay(idx * 60)}>
                <View style={[styles.screeningAlertCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border, borderLeftColor: statusColors[vax.status] || "#6B7280" }]}>
                  <View style={styles.screeningAlertHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.screeningAlertType, { color: colors.text }]}>{vax.vaccineName}</ThemedText>
                      <ThemedText style={[styles.screeningAlertGuideline, { color: colors.textSecondary }]}>{vax.guidelineSource}</ThemedText>
                    </View>
                    <View style={[styles.screeningStatusBadge, { backgroundColor: (statusColors[vax.status] || "#6B7280") + "18" }]}>
                      <ThemedText style={[styles.screeningStatusText, { color: statusColors[vax.status] || "#6B7280" }]}>
                        {statusLabels[vax.status] || vax.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.screeningAlertMeta}>
                    <View style={[styles.screeningMetaChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="calendar" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.screeningMetaText, { color: colors.textSecondary }]}>Next: {vax.nextDue}</ThemedText>
                    </View>
                    <View style={[styles.screeningMetaChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="users" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.screeningMetaText, { color: colors.textSecondary }]}>Ages {vax.ageRange}</ThemedText>
                    </View>
                    <View style={[styles.screeningMetaChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="hash" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.screeningMetaText, { color: colors.textSecondary }]}>{vax.vaccineCode}</ThemedText>
                    </View>
                  </View>
                  {vax.series.totalDoses > 1 ? (
                    <View style={[styles.seriesInfo, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="list" size={14} color={colors.primary} />
                      <ThemedText style={[styles.seriesText, { color: colors.text }]}>
                        {vax.series.isComplete ? "Series complete" : `Dose ${vax.series.doseNumber || "?"} of ${vax.series.totalDoses}`}
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText style={[styles.screeningRec, { color: colors.text }]}>{vax.recommendation}</ThemedText>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : null}

        <View style={[styles.disclaimerBanner, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
          <Feather name="info" size={16} color="#92400E" />
          <ThemedText style={[styles.disclaimerBannerText, { color: "#92400E" }]}>
            {screeningResult.disclaimer}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "input":
        return renderInputSection();
      case "alerts":
        return renderAlertsSection();
      case "diagnoses":
        return renderDiagnosesSection();
      case "interactions":
        return renderInteractionsSection();
      case "tests":
        return renderTestsSection();
      case "preventive":
        return renderPreventiveSection();
      case "risk":
        return renderRiskSection();
      case "screening":
        return renderScreeningSection();
      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.screenTitle, { color: colors.text }]}>Clinical Decision Support</ThemedText>
            <ThemedText style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              AI-powered diagnostic aid using USCDI v6 standards
            </ThemedText>
          </View>
          <Pressable
            testID="button-disclaimer"
            onPress={() => setShowDisclaimerModal(true)}
            style={[styles.disclaimerButton, { backgroundColor: colors.warning + "18" }]}
          >
            <Feather name="alert-circle" size={18} color={colors.warning} />
          </Pressable>
        </View>

        {result ? (
          <Animated.View entering={FadeInDown} style={[styles.resultSummary, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <View style={styles.resultSummaryRow}>
              <View style={[styles.resultStat, { backgroundColor: criticalCount > 0 ? "#DC262612" : "#16A34A12" }]}>
                <Feather name={criticalCount > 0 ? "alert-triangle" : "check-circle"} size={16} color={criticalCount > 0 ? "#DC2626" : "#16A34A"} />
                <ThemedText style={[styles.resultStatValue, { color: criticalCount > 0 ? "#DC2626" : "#16A34A" }]}>
                  {alertCount} Alert{alertCount !== 1 ? "s" : ""}
                </ThemedText>
              </View>
              <View style={[styles.resultStat, { backgroundColor: colors.primary + "12" }]}>
                <Feather name="activity" size={16} color={colors.primary} />
                <ThemedText style={[styles.resultStatValue, { color: colors.primary }]}>
                  {result.differentialDiagnoses.length} Dx
                </ThemedText>
              </View>
              <View style={[styles.resultStat, { backgroundColor: "#EA580C12" }]}>
                <Feather name="shield" size={16} color="#EA580C" />
                <ThemedText style={[styles.resultStatValue, { color: "#EA580C" }]}>
                  {result.drugInteractions.length} Interactions
                </ThemedText>
              </View>
              <View style={[styles.resultStat, { backgroundColor: "#7C3AED12" }]}>
                <Feather name="clipboard" size={16} color="#7C3AED" />
                <ThemedText style={[styles.resultStatValue, { color: "#7C3AED" }]}>
                  {result.recommendedTests.length} Tests
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionTabs} contentContainerStyle={styles.sectionTabsContent}>
          {renderSectionTab("input", "Input", "edit-3")}
          {renderSectionTab("alerts", "Alerts", "alert-triangle", alertCount)}
          {renderSectionTab("diagnoses", "Diagnoses", "activity")}
          {renderSectionTab("interactions", "Interactions", "shield")}
          {renderSectionTab("tests", "Tests", "clipboard")}
          {renderSectionTab("preventive", "Preventive", "heart")}
          {renderSectionTab("risk", "Risk", "bar-chart-2", riskResult?.riskProfiles.filter(r => r.riskLevel === "high").length)}
          {renderSectionTab("screening", "Screening", "calendar", screeningResult?.summary.overdueScreenings)}
        </ScrollView>

        {renderActiveSection()}

        {result ? (
          <View style={[styles.disclaimerBanner, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
            <Feather name="info" size={16} color="#92400E" />
            <ThemedText style={[styles.disclaimerBannerText, { color: "#92400E" }]}>
              {result.disclaimer}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <BaseModal
        visible={showDisclaimerModal}
        onClose={() => setShowDisclaimerModal(false)}
        title="Clinical Decision Support Notice"
        testID="modal-disclaimer"
      >
        <View style={[styles.disclaimerItem, { borderColor: colors.border }]}>
          <Feather name="shield" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.disclaimerItemTitle, { color: colors.text }]}>Evidence-Based Support</ThemedText>
            <ThemedText style={[styles.disclaimerItemDesc, { color: colors.textSecondary }]}>
              This system uses USCDI v6 data standards and AI analysis to provide evidence-based clinical suggestions.
            </ThemedText>
          </View>
        </View>
        <View style={[styles.disclaimerItem, { borderColor: colors.border }]}>
          <Feather name="alert-circle" size={20} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.disclaimerItemTitle, { color: colors.text }]}>Not a Diagnostic Tool</ThemedText>
            <ThemedText style={[styles.disclaimerItemDesc, { color: colors.textSecondary }]}>
              This system does not diagnose conditions or prescribe treatments. All suggestions require validation by a licensed healthcare provider.
            </ThemedText>
          </View>
        </View>
        <View style={[styles.disclaimerItem, { borderColor: colors.border }]}>
          <Feather name="user-check" size={20} color={colors.success} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.disclaimerItemTitle, { color: colors.text }]}>Provider Judgment Required</ThemedText>
            <ThemedText style={[styles.disclaimerItemDesc, { color: colors.textSecondary }]}>
              Clinical decision support is an aid, not a replacement. Always apply professional clinical judgment and consider the full clinical picture.
            </ThemedText>
          </View>
        </View>
        <View style={[styles.disclaimerItem, { borderColor: colors.border }]}>
          <Feather name="database" size={20} color={colors.info} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.disclaimerItemTitle, { color: colors.text }]}>Drug Interaction Database</ThemedText>
            <ThemedText style={[styles.disclaimerItemDesc, { color: colors.textSecondary }]}>
              Drug interaction checks use a curated knowledge base. Always verify with comprehensive drug interaction databases (e.g., Lexicomp, Clinical Pharmacology).
            </ThemedText>
          </View>
        </View>
        <View style={[styles.disclaimerItem, { borderColor: colors.border }]}>
          <Feather name="code" size={20} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.disclaimerItemTitle, { color: colors.text }]}>Standards Compliance</ThemedText>
            <ThemedText style={[styles.disclaimerItemDesc, { color: colors.textSecondary }]}>
              Uses ICD-10, LOINC, RxNorm codes per USCDI v6 and ONC HTI-1 guidelines. Recommendations reference USPSTF, AHA, ADA, and other clinical guidelines.
            </ThemedText>
          </View>
        </View>
        <Button
          testID="button-acknowledge-disclaimer"
          onPress={() => setShowDisclaimerModal(false)}
          fullWidth
          style={styles.acknowledgeButton}
        >
          I Understand
        </Button>
      </BaseModal>
      <UpgradePrompt {...promptProps} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  disclaimerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  resultSummary: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  resultSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  resultStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  resultStatValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTabs: {
    marginBottom: Spacing.md,
  },
  sectionTabsContent: {
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  sectionTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  contextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  contextChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  contextChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 48,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  drugCheckButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: 44,
    borderRadius: BorderRadius.md,
  },
  drugCheckResults: {
    marginTop: Spacing.md,
  },
  drugCheckSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  drugCheckSummaryText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptyStateDesc: {
    fontSize: 13,
    textAlign: "center",
  },
  alertCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  alertSeverityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertSeverityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  alertCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertCategoryText: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  alertDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  rationaleBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  rationaleLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  rationaleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  recommendationsList: {
    marginTop: Spacing.xs,
  },
  recommendationsLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  dxCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dxHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dxCondition: {
    fontSize: 15,
    fontWeight: "600",
  },
  dxCode: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  probabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  probabilityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  factorsSection: {
    marginTop: Spacing.sm,
  },
  factorsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  factorItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 3,
  },
  factorText: {
    fontSize: 13,
    flex: 1,
  },
  interactionCard: {
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  interactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  interactionSeverity: {
    fontSize: 12,
    fontWeight: "700",
  },
  interactionDrugs: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  interactionDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  clinicalEffectBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  clinicalEffectLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  clinicalEffectText: {
    fontSize: 13,
    lineHeight: 19,
  },
  managementBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  managementLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  managementText: {
    fontSize: 13,
    lineHeight: 19,
  },
  testCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  testHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  testName: {
    fontSize: 15,
    fontWeight: "600",
  },
  testCode: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  uscdiCategoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  uscdiCategoryText: {
    fontSize: 11,
    fontWeight: "500",
  },
  testRationale: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  expectedBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  expectedLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  expectedText: {
    fontSize: 13,
    lineHeight: 19,
  },
  preventiveCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  preventiveHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  preventiveMeasure: {
    fontSize: 15,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  dueDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  preventiveRec: {
    fontSize: 13,
    lineHeight: 19,
  },
  disclaimerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  disclaimerBannerText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  disclaimerItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  disclaimerItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  disclaimerItemDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  acknowledgeButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  riskOverviewCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  riskOverviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  overallRiskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
  },
  overallRiskText: {
    fontSize: 14,
    fontWeight: "700",
  },
  riskModelVersion: {
    fontSize: 11,
  },
  riskStatsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  riskStatItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  riskStatNumber: {
    fontSize: 22,
    fontWeight: "700",
  },
  riskStatLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  riskProfileCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  riskProfileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  riskConditionName: {
    fontSize: 16,
    fontWeight: "600",
  },
  riskIcd10: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  riskScoreBadge: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
  },
  riskScoreValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  riskScoreMax: {
    fontSize: 12,
    fontWeight: "500",
  },
  riskMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  riskMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riskMetaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  riskBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  riskBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  riskFactorsSection: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  riskFactorsLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  riskFactorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  riskFactorName: {
    fontSize: 13,
  },
  riskFactorCategory: {
    fontSize: 11,
    marginTop: 1,
  },
  aiRationaleBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  aiRationaleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  aiRationaleLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  aiRationaleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  riskRecsSection: {
    marginTop: Spacing.xs,
  },
  riskRecsLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  riskRecItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  riskRecText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  screeningSummaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  screeningSummaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  screeningSummaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  screeningStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  screeningStatNum: {
    fontSize: 22,
    fontWeight: "700",
  },
  screeningStatLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  screeningSectionGroup: {
    marginBottom: Spacing.md,
  },
  screeningSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  screeningSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  screeningAlertCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  screeningAlertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  screeningAlertType: {
    fontSize: 15,
    fontWeight: "600",
  },
  screeningAlertGuideline: {
    fontSize: 11,
    marginTop: 2,
  },
  screeningStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  screeningStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  screeningAlertMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  screeningMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  screeningMetaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  screeningFrequency: {
    fontSize: 12,
    marginBottom: 4,
  },
  screeningRec: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.xs,
  },
  screeningCodes: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: 4,
  },
  screeningCodeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  seriesInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 6,
    marginBottom: Spacing.sm,
  },
  seriesText: {
    fontSize: 13,
  },
});
