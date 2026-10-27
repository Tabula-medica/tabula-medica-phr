import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const DEMO_PATIENT: any = {
  patientId: "demo-patient-001",
  patientName: "Robert Thompson",
  demographics: { age: 65, gender: "male" },
  conditions: [
    { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2018-03-15", severity: "moderate" },
    { name: "Essential Hypertension", status: "active", onsetDate: "2015-06-22", severity: "moderate" },
    { name: "Hyperlipidemia", status: "active", onsetDate: "2019-01-10" },
    { name: "Chronic Kidney Disease Stage 3", status: "active", onsetDate: "2022-08-01", severity: "moderate" },
  ],
  medications: [
    { name: "Metformin", dosage: "1000mg", frequency: "twice daily", startDate: "2018-04-01" },
    { name: "Lisinopril", dosage: "20mg", frequency: "once daily", startDate: "2015-07-01" },
    { name: "Atorvastatin", dosage: "40mg", frequency: "once daily", startDate: "2019-02-01" },
    { name: "Amlodipine", dosage: "5mg", frequency: "once daily", startDate: "2020-03-15" },
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
  ],
  labResults: [
    { name: "HbA1c", value: 8.2, unit: "%", referenceRange: "4.0-5.6", date: "2024-01-20", flag: "high" },
    { name: "eGFR", value: 42, unit: "mL/min", referenceRange: ">60", date: "2024-01-20", flag: "low" },
    { name: "Creatinine", value: 1.8, unit: "mg/dL", referenceRange: "0.7-1.3", date: "2024-01-20", flag: "high" },
    { name: "LDL Cholesterol", value: 145, unit: "mg/dL", referenceRange: "<100", date: "2024-01-20", flag: "high" },
    { name: "Potassium", value: 5.2, unit: "mEq/L", referenceRange: "3.5-5.0", date: "2024-01-20", flag: "high" },
  ],
  recentVisits: [
    { date: "2024-02-15", type: "Follow-up", provider: "Dr. Sarah Chen", summary: "Diabetes management review. A1c elevated." },
    { date: "2024-01-20", type: "Lab Review", provider: "Dr. Sarah Chen", summary: "Annual labs completed. CKD staging reviewed." },
  ],
  upcomingAppointments: [
    { date: "2024-04-15", type: "Follow-up", provider: "Dr. Sarah Chen" },
  ],
};

const NOTE_TYPES = [
  { value: "progress_note", label: "Progress Note" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "care_plan_update", label: "Care Plan Update" },
  { value: "consultation_note", label: "Consultation Note" },
];

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent": case "critical": return "#EF4444";
    case "high": return "#F97316";
    case "moderate": return "#F59E0B";
    case "routine": case "low": return "#3B82F6";
    default: return "#6B7280";
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical": return "#EF4444";
    case "high": return "#F97316";
    case "moderate": return "#F59E0B";
    case "low": return "#3B82F6";
    default: return "#6B7280";
  }
}

function getTypeIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case "lab_order": return "activity";
    case "appointment": return "calendar";
    case "referral": return "send";
    case "medication_review": return "package";
    case "screening": return "search";
    case "monitoring": return "eye";
    default: return "clipboard";
  }
}

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  switch (category) {
    case "vital_change": return "heart";
    case "lab_abnormality": return "activity";
    case "medication_concern": return "package";
    case "gap_in_care": return "alert-circle";
    case "deterioration_risk": return "trending-down";
    case "overdue_screening": return "clock";
    default: return "alert-triangle";
  }
}

function getTrendInfo(trend: string): { icon: keyof typeof Feather.glyphMap; color: string } {
  switch (trend) {
    case "worsening": return { icon: "arrow-down", color: "#EF4444" };
    case "improving": return { icon: "arrow-up", color: "#10B981" };
    case "stable": return { icon: "minus", color: "#6B7280" };
    case "new": return { icon: "star", color: "#3B82F6" };
    default: return { icon: "minus", color: "#6B7280" };
  }
}

export default function ClinicalWorkflowScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [activeTab, setActiveTab] = useState<"followups" | "notes" | "alerts">("followups");

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [noteType, setNoteType] = useState("progress_note");
  const [additionalContext, setAdditionalContext] = useState("");
  const [noteResult, setNoteResult] = useState<any>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [showNoteTypePicker, setShowNoteTypePicker] = useState(false);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<number>>(new Set());

  const [copied, setCopied] = useState(false);

  const handleGenerateSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/clinical-workflow/follow-up-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientData: DEMO_PATIENT }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setSuggestions(data.suggestions || data || []);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setSuggestionsError(err.message || "Failed to generate suggestions");
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  const handleGenerateNote = useCallback(async () => {
    setNoteLoading(true);
    setNoteError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/clinical-workflow/generate-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientData: DEMO_PATIENT,
          noteType,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setNoteResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setNoteError(err.message || "Failed to generate note");
    } finally {
      setNoteLoading(false);
    }
  }, [noteType, additionalContext]);

  const handleAnalyzeAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/clinical-workflow/smart-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientData: DEMO_PATIENT }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      const alertsList = data.alerts || data || [];
      const sorted = [...alertsList].sort((a: any, b: any) => {
        const order: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
        return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
      });
      setAlerts(sorted);
      setAcknowledgedAlerts(new Set());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setAlertsError(err.message || "Failed to analyze alerts");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const handleCopyNote = useCallback(async () => {
    if (!noteResult) return;
    const sections = noteResult.sections || noteResult.note?.sections || [];
    const text = sections.map((s: any) => `${s.heading || s.title}\n${s.content}`).join("\n\n");
    await Clipboard.setStringAsync(text || JSON.stringify(noteResult, null, 2));
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [noteResult]);

  const handleAcknowledgeAlert = useCallback((index: number) => {
    setAcknowledgedAlerts((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const selectedNoteTypeLabel = NOTE_TYPES.find((t) => t.value === noteType)?.label || "Progress Note";

  const renderTabs = () => (
    <View style={[styles.tabBar, { borderBottomColor: colors.textSecondary + "30" }]}>
      <Pressable
        testID="tab-followups"
        style={[styles.tab, activeTab === "followups" ? { borderBottomWidth: 2, borderBottomColor: colors.primary } : null]}
        onPress={() => { setActiveTab("followups"); Haptics.selectionAsync(); }}
      >
        <ThemedText style={[styles.tabText, { color: activeTab === "followups" ? colors.primary : colors.textSecondary }]}>
          {"Follow-ups"}
        </ThemedText>
      </Pressable>
      <Pressable
        testID="tab-notes"
        style={[styles.tab, activeTab === "notes" ? { borderBottomWidth: 2, borderBottomColor: colors.primary } : null]}
        onPress={() => { setActiveTab("notes"); Haptics.selectionAsync(); }}
      >
        <ThemedText style={[styles.tabText, { color: activeTab === "notes" ? colors.primary : colors.textSecondary }]}>
          {"Draft Notes"}
        </ThemedText>
      </Pressable>
      <Pressable
        testID="tab-alerts"
        style={[styles.tab, activeTab === "alerts" ? { borderBottomWidth: 2, borderBottomColor: colors.primary } : null]}
        onPress={() => { setActiveTab("alerts"); Haptics.selectionAsync(); }}
      >
        <ThemedText style={[styles.tabText, { color: activeTab === "alerts" ? colors.primary : colors.textSecondary }]}>
          {"Smart Alerts"}
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderSuggestionCard = (item: any, index: number) => {
    const priorityColor = getPriorityColor(item.priority);
    const iconName = getTypeIcon(item.type || item.suggestionType);
    const actionItems = item.actionItems || item.actions || [];
    const relatedConditions = item.relatedConditions || [];

    return (
      <Animated.View key={index} entering={FadeInDown.delay(index * 80).duration(300)} testID={`card-suggestion-${index}`}>
        <Card style={styles.resultCard}>
          <View style={styles.cardTopRow}>
            <View style={[styles.typeIconContainer, { backgroundColor: priorityColor + "15" }]}>
              <Feather name={iconName} size={18} color={priorityColor} />
            </View>
            <View style={styles.cardTitleArea}>
              <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
              <ThemedText style={styles.badgeText}>{(item.priority || "").toUpperCase()}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]}>
            {item.description}
          </ThemedText>

          {item.rationale ? (
            <ThemedText style={[styles.rationaleText, { color: colors.textSecondary }]}>
              {item.rationale}
            </ThemedText>
          ) : null}

          <View style={styles.metaRow}>
            {item.timeframe ? (
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>{item.timeframe}</ThemedText>
              </View>
            ) : null}
            {item.confidence != null ? (
              <View style={styles.metaItem}>
                <Feather name="bar-chart-2" size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>{item.confidence}%</ThemedText>
              </View>
            ) : null}
          </View>

          {actionItems.length > 0 ? (
            <View style={styles.actionItemsContainer}>
              {actionItems.map((action: string, i: number) => (
                <View key={i} style={styles.actionItem}>
                  <ThemedText style={[styles.bulletPoint, { color: colors.primary }]}>{"\u2022"}</ThemedText>
                  <ThemedText style={[styles.actionItemText, { color: colors.text }]}>{action}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {relatedConditions.length > 0 ? (
            <View style={styles.tagsContainer}>
              {relatedConditions.map((cond: string, i: number) => (
                <View key={i} style={[styles.conditionTag, { backgroundColor: colors.primary + "15" }]}>
                  <ThemedText style={[styles.conditionTagText, { color: colors.primary }]}>{cond}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderFollowupsTab = () => (
    <View style={styles.tabContent}>
      <Pressable
        testID="button-generate-suggestions"
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleGenerateSuggestions}
        disabled={suggestionsLoading}
      >
        {suggestionsLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="zap" size={18} color="#FFFFFF" />
        )}
        <ThemedText style={styles.actionButtonText}>
          {suggestionsLoading ? "Generating..." : "Generate Suggestions"}
        </ThemedText>
      </Pressable>

      {suggestionsError ? (
        <View style={[styles.errorContainer, { backgroundColor: "#FEE2E2" }]}>
          <Feather name="alert-circle" size={16} color="#EF4444" />
          <ThemedText style={styles.errorText}>{suggestionsError}</ThemedText>
        </View>
      ) : null}

      {suggestionsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>{"Generating..."}</ThemedText>
        </View>
      ) : suggestions.length > 0 ? (
        suggestions.map((item, index) => renderSuggestionCard(item, index))
      ) : (
        <View style={styles.emptyState}>
          <Feather name="clipboard" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            {"Tap the button above to analyze patient data"}
          </ThemedText>
        </View>
      )}
    </View>
  );

  const renderNotesTab = () => {
    const sections = noteResult?.sections || noteResult?.note?.sections || [];
    const qualityScore = noteResult?.qualityScore || noteResult?.note?.qualityScore;
    const warnings = noteResult?.warnings || noteResult?.note?.warnings || [];
    const disclaimer = noteResult?.disclaimer || noteResult?.note?.disclaimer;

    return (
      <View style={styles.tabContent}>
        <Pressable
          style={[styles.noteTypeSelector, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => setShowNoteTypePicker(!showNoteTypePicker)}
        >
          <ThemedText style={{ color: colors.text }}>{selectedNoteTypeLabel}</ThemedText>
          <Feather name={showNoteTypePicker ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
        </Pressable>

        {showNoteTypePicker ? (
          <Animated.View entering={FadeInDown.duration(200)} style={[styles.pickerDropdown, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            {NOTE_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[styles.pickerOption, noteType === type.value ? { backgroundColor: colors.primary + "15" } : null]}
                onPress={() => {
                  setNoteType(type.value);
                  setShowNoteTypePicker(false);
                }}
              >
                <ThemedText style={[styles.pickerOptionText, { color: noteType === type.value ? colors.primary : colors.text }]}>
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

        <TextInput
          style={[styles.contextInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
          placeholder="Additional context (optional)"
          placeholderTextColor={colors.textSecondary}
          value={additionalContext}
          onChangeText={setAdditionalContext}
          multiline
          numberOfLines={3}
        />

        <Pressable
          testID="button-generate-note"
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleGenerateNote}
          disabled={noteLoading}
        >
          {noteLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="file-text" size={18} color="#FFFFFF" />
          )}
          <ThemedText style={styles.actionButtonText}>
            {noteLoading ? "Generating..." : "Generate Draft"}
          </ThemedText>
        </Pressable>

        {noteError ? (
          <View style={[styles.errorContainer, { backgroundColor: "#FEE2E2" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={styles.errorText}>{noteError}</ThemedText>
          </View>
        ) : null}

        {noteLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>{"Generating..."}</ThemedText>
          </View>
        ) : noteResult ? (
          <Animated.View entering={FadeInDown.duration(300)} testID="card-note-result">
            <Card style={styles.resultCard}>
              {qualityScore != null ? (
                <View style={styles.qualityScoreRow}>
                  <Feather name="award" size={16} color={colors.primary} />
                  <ThemedText style={[styles.qualityScoreText, { color: colors.primary }]}>
                    {"Quality Score: "}{qualityScore}
                  </ThemedText>
                </View>
              ) : null}

              {warnings.length > 0 ? (
                <View style={styles.warningsContainer}>
                  {warnings.map((warning: string, i: number) => (
                    <View key={i} style={[styles.warningItem, { backgroundColor: "#FEF3C7" }]}>
                      <Feather name="alert-triangle" size={14} color="#D97706" />
                      <ThemedText style={styles.warningText}>{warning}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {sections.map((section: any, i: number) => (
                <View key={i} style={styles.noteSection}>
                  <ThemedText style={[styles.noteSectionHeading, { color: colors.text }]}>
                    {section.heading || section.title}
                  </ThemedText>
                  <ThemedText style={[styles.noteSectionContent, { color: colors.textSecondary }]}>
                    {section.content}
                  </ThemedText>
                </View>
              ))}

              {disclaimer ? (
                <View style={[styles.disclaimerContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name="info" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                    {disclaimer}
                  </ThemedText>
                </View>
              ) : null}

              <Pressable
                style={[styles.copyButton, { backgroundColor: copied ? "#10B981" : colors.primary }]}
                onPress={handleCopyNote}
              >
                <Feather name={copied ? "check" : "copy"} size={16} color="#FFFFFF" />
                <ThemedText style={styles.copyButtonText}>{copied ? "Copied" : "Copy"}</ThemedText>
              </Pressable>
            </Card>
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              {"Select a note type and tap Generate Draft"}
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  const renderAlertCard = (item: any, index: number) => {
    const severityColor = getSeverityColor(item.severity);
    const categoryIcon = getCategoryIcon(item.category);
    const isAcknowledged = acknowledgedAlerts.has(index);
    const trendInfo = item.trend ? getTrendInfo(item.trend) : null;

    return (
      <Animated.View key={index} entering={FadeInDown.delay(index * 80).duration(300)} testID={`card-alert-${index}`}>
        <Card
          style={isAcknowledged ? { ...styles.resultCard, opacity: 0.5 } : styles.resultCard}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.typeIconContainer, { backgroundColor: severityColor + "15" }]}>
              <Feather name={categoryIcon} size={18} color={severityColor} />
            </View>
            <View style={styles.cardTitleArea}>
              <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: severityColor }]}>
              <ThemedText style={styles.badgeText}>{(item.severity || "").toUpperCase()}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]}>
            {item.description}
          </ThemedText>

          {item.currentValue != null || item.previousValue != null ? (
            <View style={[styles.valueComparison, { backgroundColor: colors.backgroundSecondary }]}>
              {item.previousValue != null ? (
                <View style={styles.valueBlock}>
                  <ThemedText style={[styles.valueLabel, { color: colors.textSecondary }]}>{"Previous"}</ThemedText>
                  <ThemedText style={[styles.valueText, { color: colors.text }]}>{String(item.previousValue)}</ThemedText>
                </View>
              ) : null}
              {item.currentValue != null ? (
                <View style={styles.valueBlock}>
                  <ThemedText style={[styles.valueLabel, { color: colors.textSecondary }]}>{"Current"}</ThemedText>
                  <ThemedText style={[styles.valueText, { color: severityColor }]}>{String(item.currentValue)}</ThemedText>
                </View>
              ) : null}
              {trendInfo ? (
                <View style={styles.valueBlock}>
                  <ThemedText style={[styles.valueLabel, { color: colors.textSecondary }]}>{"Trend"}</ThemedText>
                  <View style={styles.trendRow}>
                    <Feather name={trendInfo.icon} size={14} color={trendInfo.color} />
                    <ThemedText style={[styles.trendText, { color: trendInfo.color }]}>{item.trend}</ThemedText>
                  </View>
                </View>
              ) : null}
            </View>
          ) : trendInfo ? (
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Feather name={trendInfo.icon} size={14} color={trendInfo.color} />
                <ThemedText style={[styles.trendText, { color: trendInfo.color }]}>{item.trend}</ThemedText>
              </View>
            </View>
          ) : null}

          {item.recommendedAction ? (
            <View style={[styles.recommendedActionBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <Feather name="check-circle" size={14} color={colors.primary} />
              <ThemedText style={[styles.recommendedActionText, { color: colors.primary }]}>
                {item.recommendedAction}
              </ThemedText>
            </View>
          ) : null}

          {!isAcknowledged ? (
            <Pressable
              style={[styles.acknowledgeButton, { borderColor: colors.border }]}
              onPress={() => handleAcknowledgeAlert(index)}
            >
              <Feather name="check" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.acknowledgeText, { color: colors.textSecondary }]}>{"Acknowledge"}</ThemedText>
            </Pressable>
          ) : (
            <View style={[styles.acknowledgedBadge, { backgroundColor: "#10B981" + "15" }]}>
              <Feather name="check-circle" size={14} color="#10B981" />
              <ThemedText style={[styles.acknowledgedText, { color: "#10B981" }]}>{"Acknowledged"}</ThemedText>
            </View>
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderAlertsTab = () => (
    <View style={styles.tabContent}>
      <Pressable
        testID="button-analyze-alerts"
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleAnalyzeAlerts}
        disabled={alertsLoading}
      >
        {alertsLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="shield" size={18} color="#FFFFFF" />
        )}
        <ThemedText style={styles.actionButtonText}>
          {alertsLoading ? "Analyzing..." : "Analyze Patient"}
        </ThemedText>
      </Pressable>

      {alertsError ? (
        <View style={[styles.errorContainer, { backgroundColor: "#FEE2E2" }]}>
          <Feather name="alert-circle" size={16} color="#EF4444" />
          <ThemedText style={styles.errorText}>{alertsError}</ThemedText>
        </View>
      ) : null}

      {alertsLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>{"Generating..."}</ThemedText>
        </View>
      ) : alerts.length > 0 ? (
        alerts.map((item, index) => renderAlertCard(item, index))
      ) : (
        <View style={styles.emptyState}>
          <Feather name="shield" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            {"Tap the button above to analyze patient data"}
          </ThemedText>
        </View>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <ThemedText style={styles.screenTitle}>{"Clinical Workflow"}</ThemedText>
          <ThemedText style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            {"AI-driven clinical workflow enhancements"}
          </ThemedText>
        </Animated.View>

        {renderTabs()}

        {activeTab === "followups" ? renderFollowupsTab() : null}
        {activeTab === "notes" ? renderNotesTab() : null}
        {activeTab === "alerts" ? renderAlertsTab() : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  screenSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: Spacing.lg,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabContent: {
    minHeight: 200,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    flex: 1,
  },
  resultCard: {
    marginBottom: Spacing.md,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  cardTitleArea: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  rationaleText: {
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  actionItemsContainer: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    gap: 6,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionItemText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.xs,
  },
  conditionTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  conditionTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  noteTypeSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  pickerDropdown: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  pickerOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  pickerOptionText: {
    fontSize: 14,
  },
  contextInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: Spacing.md,
  },
  qualityScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  qualityScoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
  warningsContainer: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  warningText: {
    color: "#D97706",
    fontSize: 12,
    flex: 1,
  },
  noteSection: {
    marginBottom: Spacing.md,
  },
  noteSectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  noteSectionContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  disclaimerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  disclaimerText: {
    fontSize: 11,
    fontStyle: "italic",
    flex: 1,
    lineHeight: 16,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  valueComparison: {
    flexDirection: "row",
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.lg,
  },
  valueBlock: {
    flex: 1,
    alignItems: "center",
  },
  valueLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  valueText: {
    fontSize: 15,
    fontWeight: "700",
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: "500",
  },
  recommendedActionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  recommendedActionText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  acknowledgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  acknowledgeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  acknowledgedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  acknowledgedText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
