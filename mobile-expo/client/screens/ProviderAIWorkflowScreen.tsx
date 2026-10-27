import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const DEMO_PATIENT = {
  patientId: "demo-patient-001",
  patientName: "Robert Thompson",
  demographics: { age: 65, gender: "male", dob: "1960-08-15", mrn: "MRN-2024-0847" },
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
};

type ActivePanel = "suggestions" | "summary" | "documents" | "assistant";

interface Suggestion {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  rationale: string;
  actionLabel: string;
  actionType: string;
  relatedData: string[];
  confidence: number;
}

interface DocumentResult {
  id: string;
  documentType: string;
  title: string;
  sections: Array<{ heading: string; content: string; confidence: number }>;
  summary: string;
  codingSuggestions: Array<{ code: string; type: string; description: string; confidence: number }>;
  nextSteps: Array<{ action: string; priority: string; timeframe: string }>;
  qualityScore: number;
  disclaimer: string;
  generatedAt: string;
}

interface SummaryResult {
  id: string;
  title: string;
  narrativeSummary: string;
  keyFindings: Array<{ finding: string; significance: string; source: string }>;
  assessmentPlan: Array<{ problem: string; assessment: string; plan: string }>;
  codingSuggestions: Array<{ code: string; type: string; description: string; confidence: number }>;
  qualityScore: number;
  disclaimer: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: Array<{ source: string; detail: string }>;
  suggestedActions?: Array<{ action: string; type: string }>;
  timestamp: string;
}

const DATA_POINTS = [
  { key: "conditions", label: "Conditions", icon: "activity" as const },
  { key: "medications", label: "Medications", icon: "package" as const },
  { key: "vitals", label: "Vitals", icon: "heart" as const },
  { key: "labs", label: "Lab Results", icon: "thermometer" as const },
  { key: "allergies", label: "Allergies", icon: "alert-triangle" as const },
  { key: "visits", label: "Recent Visits", icon: "calendar" as const },
];

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "#DC2626";
    case "high": return "#EF4444";
    case "urgent": return "#EF4444";
    case "moderate": return "#F59E0B";
    case "routine": return "#10B981";
    case "low": return "#3B82F6";
    default: return "#6B7280";
  }
}

function getTypeIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case "alert": return "alert-triangle";
    case "recommendation": return "check-circle";
    case "documentation": return "file-text";
    case "follow_up": return "calendar";
    case "coding": return "hash";
    default: return "info";
  }
}

function getRiskColor(level: string): string {
  switch (level) {
    case "critical": return "#DC2626";
    case "high": return "#EF4444";
    case "moderate": return "#F59E0B";
    case "low": return "#10B981";
    default: return "#6B7280";
  }
}

export default function ProviderAIWorkflowScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const navigation = useNavigation<any>();

  const [activePanel, setActivePanel] = useState<ActivePanel>("suggestions");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [selectedDataPoints, setSelectedDataPoints] = useState<Set<string>>(new Set(["conditions", "medications", "vitals", "labs"]));
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [visitContext, setVisitContext] = useState("");

  const [documentResult, setDocumentResult] = useState<DocumentResult | null>(null);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const isAnyLoading = isAnalyzing || isSummarizing || isGeneratingDoc || isChatLoading;
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (isAnyLoading) {
      pulseOpacity.value = withRepeat(withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulseOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isAnyLoading]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handleCopyText = useCallback(async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const getTabCount = useCallback((key: ActivePanel): number | null => {
    switch (key) {
      case "suggestions": {
        const suggestions = analysisResult?.proactiveSuggestions || [];
        return suggestions.length > 0 ? suggestions.length : null;
      }
      case "summary":
        return summaryResult ? 1 : null;
      case "documents":
        return documentResult ? 1 : null;
      case "assistant":
        return chatMessages.length > 0 ? chatMessages.length : null;
      default:
        return null;
    }
  }, [analysisResult, summaryResult, documentResult, chatMessages]);

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await apiRequest("POST", "/api/provider-workflow/analyze", { patientContext: DEMO_PATIENT });
      const data = await res.json();
      setAnalysisResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setAnalysisError(err.message || "Failed to analyze");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleSummarize = useCallback(async () => {
    setIsSummarizing(true);
    try {
      const res = await apiRequest("POST", "/api/provider-workflow/summarize-note", {
        patientContext: DEMO_PATIENT,
        selectedDataPoints: Array.from(selectedDataPoints),
        visitContext: visitContext || undefined,
      });
      const data = await res.json();
      setSummaryResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error("Summary error:", err);
    } finally {
      setIsSummarizing(false);
    }
  }, [selectedDataPoints, visitContext]);

  const handleGenerateDocument = useCallback(async (documentType: string) => {
    setIsGeneratingDoc(true);
    setShowDocModal(false);
    try {
      const res = await apiRequest("POST", "/api/provider-workflow/quick-document", {
        patientContext: DEMO_PATIENT,
        documentType,
      });
      const data = await res.json();
      setDocumentResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      console.error("Document error:", err);
    } finally {
      setIsGeneratingDoc(false);
    }
  }, []);

  const handleAskAssistant = useCallback(async () => {
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);
    try {
      const res = await apiRequest("POST", "/api/provider-workflow/ask", {
        patientContext: DEMO_PATIENT,
        question: userMessage.content,
      });
      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_resp`,
        role: "assistant",
        content: data.answer,
        references: data.references,
        suggestedActions: data.suggestedActions,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: "assistant",
        content: "Unable to process your question. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput]);

  const toggleDataPoint = (key: string) => {
    setSelectedDataPoints(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSection = (heading: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });
  };

  const tabs: { key: ActivePanel; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "suggestions", label: "Insights", icon: "zap" },
    { key: "summary", label: "Summarize", icon: "file-text" },
    { key: "documents", label: "Documents", icon: "clipboard" },
    { key: "assistant", label: "Ask AI", icon: "message-circle" },
  ];

  const renderAIStatusBar = () => (
    <Animated.View entering={FadeIn.duration(200)}>
      <View style={[styles.aiStatusBar, { backgroundColor: isAnyLoading ? colors.primary + "10" : colors.success + "10", borderColor: isAnyLoading ? colors.primary + "30" : colors.success + "30" }]}>
        {isAnyLoading ? (
          <>
            <Animated.View style={[styles.statusDot, { backgroundColor: colors.primary }, pulseAnimatedStyle]} />
            <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: Spacing.sm, fontSize: 12 }}>
              Processing...
            </ThemedText>
          </>
        ) : (
          <>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <ThemedText type="small" style={{ color: colors.success, fontWeight: "600", marginLeft: Spacing.sm, fontSize: 12 }}>
              AI Ready
            </ThemedText>
          </>
        )}
        <View style={{ flex: 1 }} />
        <Feather name="cpu" size={12} color={isAnyLoading ? colors.primary : colors.success} />
      </View>
    </Animated.View>
  );

  const renderPatientBanner = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card elevation={1} style={styles.patientBanner}>
        <View style={styles.bannerRow}>
          <View style={[styles.patientAvatar, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="user" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="body" style={{ fontWeight: "700" }}>
              {DEMO_PATIENT.patientName}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {DEMO_PATIENT.demographics.age}y {DEMO_PATIENT.demographics.gender} | MRN: {DEMO_PATIENT.demographics.mrn}
            </ThemedText>
          </View>
          {analysisResult?.patientSnapshot ? (
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(analysisResult.patientSnapshot.riskLevel) + "18" }]}>
              <Feather name="shield" size={12} color={getRiskColor(analysisResult.patientSnapshot.riskLevel)} />
              <ThemedText type="small" style={{ color: getRiskColor(analysisResult.patientSnapshot.riskLevel), fontWeight: "600", marginLeft: 4, textTransform: "capitalize" }}>
                {analysisResult.patientSnapshot.riskLevel}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {analysisResult?.patientSnapshot ? (
          <View style={[styles.snapshotRow, { borderTopColor: colors.border }]}>
            <View style={styles.snapshotItem}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Active Issues</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700" }}>{analysisResult.patientSnapshot.activeIssues}</ThemedText>
            </View>
            <View style={[styles.snapshotDivider, { backgroundColor: colors.border }]} />
            <View style={styles.snapshotItem}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Pending</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700" }}>{analysisResult.patientSnapshot.pendingActions}</ThemedText>
            </View>
            <View style={[styles.snapshotDivider, { backgroundColor: colors.border }]} />
            <View style={[styles.snapshotItem, { flex: 2 }]}>
              <ThemedText type="small" style={{ color: colors.textSecondary }}>Last Visit</ThemedText>
              <ThemedText type="small" numberOfLines={1} style={{ fontWeight: "600" }}>{analysisResult.patientSnapshot.lastVisitSummary}</ThemedText>
            </View>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );

  const renderTabs = () => (
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
      {tabs.map(tab => {
        const count = getTabCount(tab.key);
        return (
          <Pressable
            key={tab.key}
            testID={`tab-${tab.key}`}
            style={[styles.tabItem, activePanel === tab.key ? { borderBottomColor: colors.primary } : { borderBottomColor: "transparent" }]}
            onPress={() => {
              setActivePanel(tab.key);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Feather name={tab.icon} size={16} color={activePanel === tab.key ? colors.primary : colors.textSecondary} />
            <ThemedText type="small" style={{ color: activePanel === tab.key ? colors.primary : colors.textSecondary, marginLeft: 4, fontWeight: activePanel === tab.key ? "600" : "400" }}>
              {tab.label}
            </ThemedText>
            {count !== null ? (
              <View style={[styles.tabBadge, { backgroundColor: activePanel === tab.key ? colors.primary : colors.textSecondary }]}>
                <ThemedText type="small" style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700" }}>{count}</ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  const renderSuggestionsPanel = () => {
    if (isAnalyzing) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            Analyzing patient chart for proactive insights...
          </ThemedText>
        </View>
      );
    }

    if (analysisError) {
      return (
        <Card elevation={1} style={styles.errorCard}>
          <Feather name="alert-triangle" size={20} color={colors.error} />
          <ThemedText type="small" style={{ color: colors.error, marginLeft: Spacing.sm, flex: 1 }}>{analysisError}</ThemedText>
        </Card>
      );
    }

    if (!analysisResult) {
      return (
        <View style={styles.centeredContent}>
          <Feather name="zap" size={48} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <ThemedText type="body" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            AI will analyze the patient chart and proactively surface alerts, recommendations, and documentation opportunities
          </ThemedText>
          <Pressable testID="button-analyze" onPress={handleAnalyze} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Feather name="play" size={16} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>Analyze Chart</ThemedText>
          </Pressable>
        </View>
      );
    }

    const suggestions: Suggestion[] = analysisResult.proactiveSuggestions || [];

    return (
      <View>
        <View style={styles.sectionHeader}>
          <ThemedText type="body" style={{ fontWeight: "700" }}>
            Proactive Insights ({suggestions.length})
          </ThemedText>
          <Pressable testID="button-refresh-analyze" onPress={handleAnalyze} style={[styles.smallButton, { backgroundColor: colors.primary + "15" }]} accessibilityRole="button" accessibilityLabel="Refresh analysis">
            <Feather name="refresh-cw" size={14} color={colors.primary} />
          </Pressable>
        </View>
        {suggestions.map((s, idx) => (
          <Animated.View key={s.id} entering={FadeInDown.delay(idx * 60).duration(300)}>
            <Card elevation={1} style={styles.suggestionCard}>
              <View style={styles.suggestionHeader}>
                <View style={[styles.typeIcon, { backgroundColor: getPriorityColor(s.priority) + "15" }]}>
                  <Feather name={getTypeIcon(s.type)} size={16} color={getPriorityColor(s.priority)} />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>{s.title}</ThemedText>
                  <View style={styles.badgeRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(s.priority) + "18" }]}>
                      <ThemedText type="small" style={{ color: getPriorityColor(s.priority), fontWeight: "600", fontSize: 10, textTransform: "uppercase" }}>
                        {s.priority}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: colors.textSecondary, marginLeft: Spacing.xs }}>
                      {s.confidence}% confidence
                    </ThemedText>
                  </View>
                </View>
              </View>
              <ThemedText type="small" style={{ color: colors.text, marginTop: Spacing.sm }}>{s.description}</ThemedText>
              <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.xs, fontStyle: "italic" }}>{s.rationale}</ThemedText>
              <Pressable
                testID={`action-${s.id}`}
                onPress={() => {
                  if (s.actionType === "generate_document") {
                    setActivePanel("documents");
                    setShowDocModal(true);
                  } else if (s.actionType === "run_analysis") {
                    setActivePanel("summary");
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.actionChip, { backgroundColor: colors.primary + "12" }]}
              >
                <Feather name="arrow-right" size={14} color={colors.primary} />
                <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: 4 }}>{s.actionLabel}</ThemedText>
              </Pressable>
            </Card>
          </Animated.View>
        ))}
        <Pressable
          testID="button-view-automation"
          onPress={() => {
            navigation.navigate("AutomatedDataEntry");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[styles.deepLinkButton, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}
        >
          <Feather name="settings" size={14} color={colors.primary} />
          <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: Spacing.sm }}>View in Automation</ThemedText>
          <View style={{ flex: 1 }} />
          <Feather name="external-link" size={14} color={colors.primary} />
        </Pressable>
      </View>
    );
  };

  const renderSummaryPanel = () => (
    <View>
      <Card elevation={1} style={styles.controlCard}>
        <ThemedText type="body" style={{ fontWeight: "700", marginBottom: Spacing.sm }}>Select Data Points</ThemedText>
        <View style={styles.chipGrid}>
          {DATA_POINTS.map(dp => (
            <Pressable
              key={dp.key}
              testID={`datapoint-${dp.key}`}
              onPress={() => toggleDataPoint(dp.key)}
              style={[
                styles.dataChip,
                selectedDataPoints.has(dp.key)
                  ? { backgroundColor: colors.primary + "18", borderColor: colors.primary }
                  : { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
              ]}
            >
              <Feather name={dp.icon} size={14} color={selectedDataPoints.has(dp.key) ? colors.primary : colors.textSecondary} />
              <ThemedText type="small" style={{ marginLeft: 4, color: selectedDataPoints.has(dp.key) ? colors.primary : colors.textSecondary, fontWeight: selectedDataPoints.has(dp.key) ? "600" : "400" }}>
                {dp.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <TextInput
          testID="input-visit-context"
          style={[styles.contextInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
          placeholder="Optional: Add visit context (e.g., 'Follow-up for diabetes management')"
          placeholderTextColor={colors.textSecondary}
          value={visitContext}
          onChangeText={setVisitContext}
          multiline
          numberOfLines={2}
        />
        <Pressable
          testID="button-summarize"
          onPress={handleSummarize}
          disabled={isSummarizing || selectedDataPoints.size === 0}
          style={[styles.primaryButton, { backgroundColor: isSummarizing ? colors.textSecondary : colors.primary, opacity: selectedDataPoints.size === 0 ? 0.5 : 1 }]}
        >
          {isSummarizing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="cpu" size={16} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>Generate Summary</ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      {summaryResult ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card elevation={1} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <ThemedText type="body" style={{ fontWeight: "700", flex: 1 }}>{summaryResult.title}</ThemedText>
              <View style={[styles.qualityBadge, { backgroundColor: summaryResult.qualityScore >= 80 ? "#10B98120" : "#F59E0B20" }]}>
                <ThemedText type="small" style={{ color: summaryResult.qualityScore >= 80 ? "#10B981" : "#F59E0B", fontWeight: "700" }}>
                  {summaryResult.qualityScore}%
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" style={{ color: colors.text, marginTop: Spacing.sm, lineHeight: 20 }}>{summaryResult.narrativeSummary}</ThemedText>

            {summaryResult.keyFindings.length > 0 ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ fontWeight: "700", marginBottom: Spacing.xs }}>Key Findings</ThemedText>
                {summaryResult.keyFindings.map((f, i) => (
                  <View key={i} style={[styles.findingRow, { borderLeftColor: colors.primary }]}>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>{f.finding}</ThemedText>
                    <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 11 }}>{f.significance} ({f.source})</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {summaryResult.assessmentPlan.length > 0 ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ fontWeight: "700", marginBottom: Spacing.xs }}>Assessment & Plan</ThemedText>
                {summaryResult.assessmentPlan.map((ap, i) => (
                  <View key={i} style={[styles.apRow, { backgroundColor: colors.backgroundSecondary }]}>
                    <ThemedText type="small" style={{ fontWeight: "700", color: colors.primary }}>{ap.problem}</ThemedText>
                    <ThemedText type="small" style={{ color: colors.text, marginTop: 2 }}>{ap.assessment}</ThemedText>
                    <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: 2, fontStyle: "italic" }}>{ap.plan}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {summaryResult.codingSuggestions.length > 0 ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ fontWeight: "700", marginBottom: Spacing.xs }}>Coding Suggestions</ThemedText>
                <View style={styles.codeGrid}>
                  {summaryResult.codingSuggestions.map((cs, i) => (
                    <View key={i} style={[styles.codeChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <ThemedText type="small" style={{ fontWeight: "700", color: colors.primary }}>{cs.code}</ThemedText>
                      <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>{cs.type}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.deepLinkRow}>
              <Pressable
                testID="button-copy-summary"
                onPress={() => handleCopyText(summaryResult.narrativeSummary, "summary")}
                style={[styles.copyButton, { backgroundColor: copiedField === "summary" ? colors.success + "15" : colors.backgroundSecondary }]}
              >
                <Feather name={copiedField === "summary" ? "check" : "copy"} size={14} color={copiedField === "summary" ? colors.success : colors.primary} />
                <ThemedText type="small" style={{ color: copiedField === "summary" ? colors.success : colors.primary, fontWeight: "600", marginLeft: 4 }}>
                  {copiedField === "summary" ? "Copied" : "Copy Summary"}
                </ThemedText>
              </Pressable>
              <Pressable
                testID="button-view-patient-summary"
                onPress={() => {
                  navigation.navigate("HomeTab", { screen: "MyHealthSummary" } as never);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.copyButton, { backgroundColor: colors.primary + "10" }]}
              >
                <Feather name="user" size={14} color={colors.primary} />
                <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: 4 }}>View Patient Summary</ThemedText>
              </Pressable>
            </View>

            <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.md, fontSize: 10, fontStyle: "italic" }}>
              {summaryResult.disclaimer}
            </ThemedText>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );

  const DOC_TYPES = [
    { type: "soap_note", label: "SOAP Note", icon: "file-text" as const, desc: "Subjective, Objective, Assessment, Plan", time: "~15s" },
    { type: "progress_note", label: "Progress Note", icon: "edit-3" as const, desc: "Visit progress documentation", time: "~15s" },
    { type: "history_and_physical", label: "H&P", icon: "clipboard" as const, desc: "History and Physical", time: "~20s" },
    { type: "discharge_summary", label: "Discharge Summary", icon: "log-out" as const, desc: "Discharge documentation", time: "~20s" },
    { type: "referral_letter", label: "Referral Letter", icon: "send" as const, desc: "Specialist referral", time: "~15s" },
    { type: "consultation_note", label: "Consultation Note", icon: "message-square" as const, desc: "Specialist consultation", time: "~18s" },
  ];

  const renderDocumentsPanel = () => (
    <View>
      <View style={styles.sectionHeader}>
        <ThemedText type="body" style={{ fontWeight: "700" }}>Quick Document Generation</ThemedText>
      </View>

      {isGeneratingDoc ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
            Generating clinical document with AI...
          </ThemedText>
        </View>
      ) : documentResult ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card elevation={1} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "700" }}>{documentResult.title}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, textTransform: "uppercase", fontSize: 10 }}>
                  {documentResult.documentType.replace(/_/g, " ")}
                </ThemedText>
              </View>
              <View style={[styles.qualityBadge, { backgroundColor: documentResult.qualityScore >= 80 ? "#10B98120" : "#F59E0B20" }]}>
                <ThemedText type="small" style={{ color: documentResult.qualityScore >= 80 ? "#10B981" : "#F59E0B", fontWeight: "700" }}>
                  Q: {documentResult.qualityScore}%
                </ThemedText>
              </View>
            </View>

            <ThemedText type="small" style={{ color: colors.text, marginTop: Spacing.sm }}>{documentResult.summary}</ThemedText>

            {documentResult.sections.map((section, idx) => {
              const isExpanded = expandedSections.has(section.heading);
              return (
                <Pressable key={idx} onPress={() => toggleSection(section.heading)} style={[styles.sectionItem, { borderColor: colors.border }]}>
                  <View style={styles.sectionItemHeader}>
                    <ThemedText type="small" style={{ fontWeight: "600", flex: 1 }}>{section.heading}</ThemedText>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10, marginRight: 4 }}>{section.confidence}%</ThemedText>
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} />
                    </View>
                  </View>
                  {isExpanded ? (
                    <ThemedText type="small" style={{ color: colors.text, marginTop: Spacing.xs, lineHeight: 20 }}>{section.content}</ThemedText>
                  ) : null}
                </Pressable>
              );
            })}

            {documentResult.codingSuggestions.length > 0 ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ fontWeight: "700", marginBottom: Spacing.xs }}>Suggested Codes</ThemedText>
                <View style={styles.codeGrid}>
                  {documentResult.codingSuggestions.map((cs, i) => (
                    <View key={i} style={[styles.codeChip, { backgroundColor: colors.backgroundSecondary }]}>
                      <ThemedText type="small" style={{ fontWeight: "700", color: colors.primary }}>{cs.code}</ThemedText>
                      <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>{cs.description}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {documentResult.nextSteps.length > 0 ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ fontWeight: "700", marginBottom: Spacing.xs }}>Next Steps</ThemedText>
                {documentResult.nextSteps.map((ns, i) => (
                  <View key={i} style={styles.nextStepRow}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(ns.priority) }]} />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>{ns.action}</ThemedText>
                      <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10 }}>{ns.timeframe}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.deepLinkRow}>
              <Pressable
                testID="button-copy-document"
                onPress={() => handleCopyText(documentResult.summary + "\n\n" + documentResult.sections.map(s => s.heading + "\n" + s.content).join("\n\n"), "document")}
                style={[styles.copyButton, { backgroundColor: copiedField === "document" ? colors.success + "15" : colors.backgroundSecondary }]}
              >
                <Feather name={copiedField === "document" ? "check" : "copy"} size={14} color={copiedField === "document" ? colors.success : colors.primary} />
                <ThemedText type="small" style={{ color: copiedField === "document" ? colors.success : colors.primary, fontWeight: "600", marginLeft: 4 }}>
                  {copiedField === "document" ? "Copied" : "Copy Document"}
                </ThemedText>
              </Pressable>
              <Pressable
                testID="button-open-soap-creator"
                onPress={() => {
                  navigation.navigate("AISOAPNote");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.copyButton, { backgroundColor: colors.primary + "10" }]}
              >
                <Feather name="file-text" size={14} color={colors.primary} />
                <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: 4 }}>Open in SOAP Creator</ThemedText>
              </Pressable>
            </View>

            <Pressable testID="button-new-document" onPress={() => { setDocumentResult(null); setExpandedSections(new Set()); }} style={[styles.outlineButton, { borderColor: colors.primary }]}>
              <Feather name="plus" size={14} color={colors.primary} />
              <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: 4 }}>Generate Another</ThemedText>
            </Pressable>

            <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.sm, fontSize: 10, fontStyle: "italic" }}>
              {documentResult.disclaimer}
            </ThemedText>
          </Card>
        </Animated.View>
      ) : (
        <View style={styles.docGrid}>
          {DOC_TYPES.map((doc, idx) => (
            <Animated.View key={doc.type} entering={FadeInDown.delay(idx * 50).duration(250)} style={styles.docGridItem}>
              <Pressable testID={`doc-${doc.type}`} onPress={() => handleGenerateDocument(doc.type)} style={[styles.docCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
                <View style={[styles.docIconCircle, { backgroundColor: colors.primary + "12" }]}>
                  <Feather name={doc.icon} size={22} color={colors.primary} />
                </View>
                <ThemedText type="small" style={{ fontWeight: "700", marginTop: Spacing.sm, textAlign: "center" }}>{doc.label}</ThemedText>
                <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: "center", fontSize: 11, marginTop: 2 }}>{doc.desc}</ThemedText>
                <ThemedText type="small" style={{ color: colors.primary, marginTop: Spacing.xs, fontSize: 10 }}>{doc.time}</ThemedText>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );

  const renderAssistantPanel = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.sectionHeader}>
        <ThemedText type="body" style={{ fontWeight: "700" }}>Chart-Aware AI Assistant</ThemedText>
      </View>

      {chatMessages.length === 0 ? (
        <View style={styles.centeredContent}>
          <Feather name="message-circle" size={40} color={colors.textSecondary} style={{ opacity: 0.4 }} />
          <ThemedText type="small" style={{ color: colors.textSecondary, marginTop: Spacing.md, textAlign: "center", lineHeight: 20 }}>
            Ask questions about this patient's chart. The AI has full context of conditions, medications, labs, vitals, and visit history.
          </ThemedText>
          <View style={styles.quickQuestions}>
            {["What are the most concerning lab trends?", "Summarize medication interactions", "What screenings are overdue?"].map(q => (
              <Pressable key={q} testID={`quick-q-${q.slice(0, 10)}`} onPress={() => { setChatInput(q); }} style={[styles.quickQ, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                <ThemedText type="small" style={{ color: colors.primary }}>{q}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View>
          {chatMessages.map((msg, idx) => (
            <Animated.View key={msg.id} entering={FadeInUp.delay(idx === chatMessages.length - 1 ? 100 : 0).duration(250)}>
              <View style={[styles.chatBubble, msg.role === "user" ? { alignSelf: "flex-end", backgroundColor: colors.primary + "15" } : { alignSelf: "flex-start", backgroundColor: colors.backgroundSecondary }]}>
                {msg.role === "assistant" ? (
                  <View style={styles.assistantLabel}>
                    <Feather name="cpu" size={12} color={colors.primary} />
                    <ThemedText type="small" style={{ color: colors.primary, fontWeight: "600", marginLeft: 4, fontSize: 10 }}>AI Assistant</ThemedText>
                  </View>
                ) : null}
                <ThemedText type="small" style={{ color: colors.text, lineHeight: 20 }}>{msg.content}</ThemedText>
                {msg.references && msg.references.length > 0 ? (
                  <View style={{ marginTop: Spacing.xs }}>
                    {msg.references.map((ref, i) => (
                      <View key={i} style={styles.refRow}>
                        <Feather name="link" size={10} color={colors.textSecondary} />
                        <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 10, marginLeft: 4 }}>{ref.source}: {ref.detail}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
                {msg.suggestedActions && msg.suggestedActions.length > 0 ? (
                  <View style={[styles.suggestedActionsRow, { borderTopColor: colors.border }]}>
                    {msg.suggestedActions.map((sa, i) => (
                      <View key={i} style={[styles.suggestedAction, { backgroundColor: colors.primary + "10" }]}>
                        <Feather name="arrow-right" size={10} color={colors.primary} />
                        <ThemedText type="small" style={{ color: colors.primary, fontSize: 10, marginLeft: 2 }}>{sa.action}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ))}
          {isChatLoading ? (
            <View style={[styles.chatBubble, { alignSelf: "flex-start", backgroundColor: colors.backgroundSecondary }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.chatInputRow, { backgroundColor: colors.backgroundDefault, borderTopColor: colors.border }]}>
        <TextInput
          testID="input-chat"
          style={[styles.chatInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
          placeholder="Ask about this patient..."
          placeholderTextColor={colors.textSecondary}
          value={chatInput}
          onChangeText={setChatInput}
          onSubmitEditing={handleAskAssistant}
          returnKeyType="send"
        />
        <Pressable
          testID="button-send-chat"
          onPress={handleAskAssistant}
          disabled={isChatLoading || !chatInput.trim()}
          style={[styles.sendButton, { backgroundColor: chatInput.trim() ? colors.primary : colors.textSecondary }]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: isChatLoading || !chatInput.trim() }}
        >
          <Feather name="send" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl + 60, paddingHorizontal: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {renderAIStatusBar()}
        {renderPatientBanner()}
        {renderTabs()}

        {activePanel === "suggestions" ? renderSuggestionsPanel() : null}
        {activePanel === "summary" ? renderSummaryPanel() : null}
        {activePanel === "documents" ? renderDocumentsPanel() : null}
        {activePanel === "assistant" ? renderAssistantPanel() : null}
      </ScrollView>

      <Modal visible={showDocModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>Select Document Type</ThemedText>
              <Pressable testID="button-close-doc-modal" onPress={() => setShowDocModal(false)}>
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={DOC_TYPES}
              keyExtractor={item => item.type}
              renderItem={({ item }) => (
                <Pressable testID={`modal-doc-${item.type}`} onPress={() => { handleGenerateDocument(item.type); setShowDocModal(false); }} style={[styles.modalDocItem, { borderBottomColor: colors.border }]}>
                  <View style={[styles.docIconSmall, { backgroundColor: colors.primary + "12" }]}>
                    <Feather name={item.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>{item.label}</ThemedText>
                    <ThemedText type="small" style={{ color: colors.textSecondary }}>{item.desc}</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: colors.primary }}>{item.time}</ThemedText>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  patientBanner: { marginBottom: Spacing.sm, padding: Spacing.md },
  bannerRow: { flexDirection: "row", alignItems: "center" },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  riskBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  snapshotRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1 },
  snapshotItem: { flex: 1, alignItems: "center" },
  snapshotDivider: { width: 1, height: 30 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginBottom: Spacing.md },
  tabItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderBottomWidth: 2 },
  centeredContent: { alignItems: "center", paddingVertical: Spacing.xl * 2, paddingHorizontal: Spacing.lg },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.lg },
  smallButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  suggestionCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  suggestionHeader: { flexDirection: "row", alignItems: "flex-start" },
  typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  actionChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  errorCard: { padding: Spacing.md, flexDirection: "row", alignItems: "center" },
  controlCard: { marginBottom: Spacing.md, padding: Spacing.md },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  dataChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1 },
  contextInput: { marginTop: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm, fontSize: 14, minHeight: 50, textAlignVertical: "top" },
  resultCard: { marginBottom: Spacing.md, padding: Spacing.md },
  resultHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  qualityBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.md },
  findingRow: { borderLeftWidth: 3, paddingLeft: Spacing.sm, marginBottom: Spacing.sm, paddingVertical: 4 },
  apRow: { padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: Spacing.xs },
  codeGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  codeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  docGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  docGridItem: { width: "48%" },
  docCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: "center" },
  docIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  sectionItem: { borderWidth: 1, borderRadius: BorderRadius.sm, padding: Spacing.sm, marginTop: Spacing.sm },
  sectionItemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nextStepRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  outlineButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  chatBubble: { maxWidth: "85%", padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  assistantLabel: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  refRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  suggestedActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1 },
  suggestedAction: { flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 3, borderRadius: BorderRadius.sm },
  chatInputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, marginTop: Spacing.md },
  chatInput: { flex: 1, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 14, marginRight: Spacing.sm },
  sendButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  quickQuestions: { marginTop: Spacing.lg, gap: Spacing.sm, width: "100%" },
  quickQ: { padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: "60%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  modalDocItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, borderBottomWidth: 1 },
  docIconSmall: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  aiStatusBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tabBadge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", marginLeft: 4, paddingHorizontal: 4 },
  deepLinkButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  deepLinkRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  copyButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md },
});
