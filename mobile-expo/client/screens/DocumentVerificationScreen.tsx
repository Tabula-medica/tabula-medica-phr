import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

type Tab = "queue" | "review" | "benchmark" | "audit" | "ranges";

interface QueueItem {
  id: string;
  extractionId: string;
  documentType: string;
  priority: "urgent" | "high" | "normal" | "low";
  reason: string;
  createdAt: string;
  status: string;
  conflictCount: number;
  lowConfidenceCount: number;
  impossibleValueCount: number;
}

interface ExtractionSummary {
  id: string;
  documentId: string;
  documentType: string;
  status: string;
  overallConfidence: number;
  conflictCount: number;
  fieldCount: number;
  createdAt: string;
  qualityGrade: string;
}

interface ExtractedField {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  confidence: number;
  source: string;
  rangeValidation?: {
    severity: string;
    message: string;
    expectedRange: string;
    needsReview: boolean;
  };
}

interface ConflictItem {
  field: string;
  modelAValue: string | number;
  modelBValue: string | number;
  resolved: boolean;
  resolvedValue?: string | number;
  resolvedBy?: string;
}

interface AuditEntryItem {
  timestamp: string;
  action: string;
  userId: string;
  field?: string;
  previousValue?: string | number;
  newValue?: string | number;
  reason?: string;
}

interface ExtractionDetail {
  id: string;
  documentType: string;
  status: string;
  quality: {
    dpi: number;
    grade: string;
    issues: string[];
    enhancementsApplied: string[];
    passesQualityGate: boolean;
  };
  modelA: {
    modelName: string;
    overallConfidence: number;
    processingTimeMs: number;
    rawText: string;
  };
  modelB: {
    modelName: string;
    overallConfidence: number;
    processingTimeMs: number;
    rawText: string;
  };
  consensusFields: ExtractedField[];
  conflicts: ConflictItem[];
  rangeValidations: Array<{
    code: string;
    name: string;
    value: number;
    unit: string;
    severity: string;
    message: string;
    expectedRange: string;
  }>;
  temporalValidations: Array<{
    field: string;
    severity: string;
    message: string;
  }>;
  overallConfidence: number;
  confidenceThreshold: number;
  auditTrail: AuditEntryItem[];
}

interface BenchmarkReport {
  period: string;
  sampleSize: number;
  characterErrorRate: number;
  wordErrorRate: number;
  fieldAccuracy: number;
  autoPassAccuracy: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  avgConfidence: number;
  processingTimeP50Ms: number;
  processingTimeP95Ms: number;
  modelComparison: {
    modelA: { accuracy: number; avgConfidence: number; name: string };
    modelB: { accuracy: number; avgConfidence: number; name: string };
  };
  byDocType: Array<{
    type: string;
    count: number;
    accuracy: number;
    avgConfidence: number;
  }>;
}

export default function DocumentVerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [selectedExtraction, setSelectedExtraction] = useState<string | null>(null);
  const [correctionField, setCorrectionField] = useState<string | null>(null);
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const { data: queueData, isLoading: queueLoading } = useQuery<{ queue: QueueItem[] }>({
    queryKey: ["/api/extraction/queue"],
  });

  const { data: listData, isLoading: listLoading } = useQuery<{ extractions: ExtractionSummary[] }>({
    queryKey: ["/api/extraction/list"],
  });

  const { data: detailData, isLoading: detailLoading } = useQuery<{ extraction: ExtractionDetail }>({
    queryKey: ["/api/extraction", selectedExtraction],
    enabled: !!selectedExtraction,
  });

  const { data: benchmarkData, isLoading: benchmarkLoading } = useQuery<{ report: BenchmarkReport }>({
    queryKey: ["/api/extraction/benchmark/report"],
    enabled: activeTab === "benchmark",
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/extraction/queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/extraction/list"] });
    queryClient.invalidateQueries({ queryKey: ["/api/extraction/benchmark/report"] });
    if (selectedExtraction) {
      queryClient.invalidateQueries({ queryKey: ["/api/extraction", selectedExtraction] });
    }
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/extraction/${id}/approve`),
    onSuccess: () => {
      invalidateAll();
      setSelectedExtraction(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/extraction/${id}/reject`, { reason: "Rejected by reviewer" }),
    onSuccess: () => {
      invalidateAll();
      setSelectedExtraction(null);
    },
  });

  const correctMutation = useMutation({
    mutationFn: (params: { id: string; fieldKey: string; correctedValue: string; reason: string }) =>
      apiRequest("POST", `/api/extraction/${params.id}/verify-field`, {
        fieldKey: params.fieldKey,
        correctedValue: params.correctedValue,
        reason: params.reason,
      }),
    onSuccess: () => {
      invalidateAll();
      setCorrectionField(null);
      setCorrectionValue("");
      setCorrectionReason("");
    },
  });

  const processMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/extraction/process", {
        documentId: `doc_${Date.now()}`,
        documentType: "lab_report",
        dpi: 300,
        fileSize: 2000000,
        format: "pdf",
      }),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const priorityColor = useCallback(
    (p: string) => {
      switch (p) {
        case "urgent": return "#DC2626";
        case "high": return "#F59E0B";
        case "normal": return theme.primary;
        case "low": return theme.textSecondary;
        default: return theme.textSecondary;
      }
    },
    [theme]
  );

  const statusColor = useCallback(
    (s: string) => {
      switch (s) {
        case "auto_passed": return theme.success;
        case "verified": return theme.success;
        case "needs_review": return "#F59E0B";
        case "conflict": return "#DC2626";
        case "rejected": return "#DC2626";
        case "manual_scan_required": return "#DC2626";
        default: return theme.textSecondary;
      }
    },
    [theme]
  );

  const severityColor = useCallback(
    (s: string) => {
      switch (s) {
        case "impossible": return "#DC2626";
        case "critical": return "#DC2626";
        case "warning": return "#F59E0B";
        case "pass": return theme.success;
        default: return theme.textSecondary;
      }
    },
    [theme]
  );

  const confidenceColor = useCallback(
    (c: number) => {
      if (c >= 0.95) return theme.success;
      if (c >= 0.85) return "#F59E0B";
      return "#DC2626";
    },
    [theme]
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const tabs: Array<{ key: Tab; label: string; icon: string }> = [
    { key: "queue", label: "Queue", icon: "inbox" },
    { key: "review", label: "Review", icon: "eye" },
    { key: "benchmark", label: "Accuracy", icon: "bar-chart-2" },
    { key: "audit", label: "History", icon: "clock" },
    { key: "ranges", label: "Ranges", icon: "thermometer" },
  ];

  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            { borderBottomColor: activeTab === tab.key ? theme.primary : "transparent" },
          ]}
          onPress={() => {
            setActiveTab(tab.key);
            setSelectedExtraction(null);
          }}
          testID={`tab-${tab.key}`}
        >
          <Feather
            name={tab.icon as any}
            size={16}
            color={activeTab === tab.key ? theme.primary : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabLabel,
              { color: activeTab === tab.key ? theme.primary : theme.textSecondary },
            ]}
          >
            {tab.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderQueueTab = () => {
    if (queueLoading) return <ActivityIndicator color={theme.primary} style={styles.loader} />;
    const queue = queueData?.queue ?? [];
    const pending = queue.filter((q) => q.status === "pending");

    return (
      <View>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryValue, { color: theme.primary }]}>
                {pending.length}
              </ThemedText>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Pending
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText
                style={[styles.summaryValue, { color: "#DC2626" }]}
              >
                {pending.filter((q) => q.priority === "urgent").length}
              </ThemedText>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Urgent
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryValue, { color: "#F59E0B" }]}>
                {pending.reduce((s, q) => s + q.conflictCount, 0)}
              </ThemedText>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Conflicts
              </ThemedText>
            </View>
          </View>
        </Card>

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Verification Queue</ThemedText>
          <TouchableOpacity
            style={[styles.processBtn, { backgroundColor: theme.primary }]}
            onPress={() => processMutation.mutate()}
            testID="button-process-new"
          >
            <Feather name="plus" size={14} color="#FFFFFF" />
            <ThemedText style={styles.processBtnText}>Process New</ThemedText>
          </TouchableOpacity>
        </View>

        {pending.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="check-circle" size={32} color={theme.success} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              All clear — no documents awaiting review
            </ThemedText>
          </Card>
        ) : null}

        {pending.map((item, idx) => (
          <Animated.View key={item.id} entering={FadeInDown.delay(idx * 60)}>
            <TouchableOpacity
              onPress={() => {
                setSelectedExtraction(item.extractionId);
                setActiveTab("review");
              }}
              testID={`queue-item-${idx}`}
            >
              <Card style={styles.queueCard}>
                <View style={styles.queueHeader}>
                  <View
                    style={[styles.priorityBadge, { backgroundColor: priorityColor(item.priority) }]}
                  >
                    <ThemedText style={styles.priorityText}>
                      {item.priority.toUpperCase()}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.queueType, { color: theme.textSecondary }]}>
                    {item.documentType.replace(/_/g, " ")}
                  </ThemedText>
                </View>
                <ThemedText style={styles.queueReason} numberOfLines={2}>
                  {item.reason}
                </ThemedText>
                <View style={styles.queueMeta}>
                  {item.conflictCount > 0 ? (
                    <View style={styles.metaChip}>
                      <Feather name="alert-triangle" size={12} color="#F59E0B" />
                      <ThemedText style={[styles.metaChipText, { color: "#F59E0B" }]}>
                        {item.conflictCount} conflicts
                      </ThemedText>
                    </View>
                  ) : null}
                  {item.impossibleValueCount > 0 ? (
                    <View style={styles.metaChip}>
                      <Feather name="x-circle" size={12} color="#DC2626" />
                      <ThemedText style={[styles.metaChipText, { color: "#DC2626" }]}>
                        {item.impossibleValueCount} impossible
                      </ThemedText>
                    </View>
                  ) : null}
                  {item.lowConfidenceCount > 0 ? (
                    <View style={styles.metaChip}>
                      <Feather name="alert-circle" size={12} color="#F59E0B" />
                      <ThemedText style={[styles.metaChipText, { color: "#F59E0B" }]}>
                        {item.lowConfidenceCount} low conf
                      </ThemedText>
                    </View>
                  ) : null}
                  <ThemedText style={[styles.queueTime, { color: theme.textSecondary }]}>
                    {formatDate(item.createdAt)}
                  </ThemedText>
                </View>
              </Card>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderReviewTab = () => {
    if (!selectedExtraction) {
      if (listLoading) return <ActivityIndicator color={theme.primary} style={styles.loader} />;
      const items = listData?.extractions ?? [];

      return (
        <View>
          <ThemedText style={styles.sectionTitle}>All Extractions</ThemedText>
          {items.map((item, idx) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(idx * 40)}>
              <TouchableOpacity
                onPress={() => setSelectedExtraction(item.id)}
                testID={`extraction-item-${idx}`}
              >
                <Card style={styles.listCard}>
                  <View style={styles.listHeader}>
                    <View
                      style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]}
                    />
                    <ThemedText style={styles.listType}>
                      {item.documentType.replace(/_/g, " ")}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.listConfidence,
                        { color: confidenceColor(item.overallConfidence) },
                      ]}
                    >
                      {(item.overallConfidence * 100).toFixed(1)}%
                    </ThemedText>
                  </View>
                  <View style={styles.listMeta}>
                    <ThemedText style={[styles.listStatus, { color: statusColor(item.status) }]}>
                      {item.status.replace(/_/g, " ")}
                    </ThemedText>
                    <ThemedText style={[styles.listFields, { color: theme.textSecondary }]}>
                      {item.fieldCount} fields
                    </ThemedText>
                    {item.conflictCount > 0 ? (
                      <ThemedText style={[styles.listConflicts, { color: "#F59E0B" }]}>
                        {item.conflictCount} conflicts
                      </ThemedText>
                    ) : null}
                  </View>
                </Card>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      );
    }

    if (detailLoading) return <ActivityIndicator color={theme.primary} style={styles.loader} />;
    const ext = detailData?.extraction;
    if (!ext) return null;

    return (
      <View>
        <TouchableOpacity
          onPress={() => setSelectedExtraction(null)}
          style={styles.backBtn}
          testID="button-back"
        >
          <Feather name="arrow-left" size={18} color={theme.primary} />
          <ThemedText style={[styles.backText, { color: theme.primary }]}>All Extractions</ThemedText>
        </TouchableOpacity>

        <Card style={styles.detailHeaderCard}>
          <View style={styles.detailHeaderRow}>
            <View>
              <ThemedText style={styles.detailType}>
                {ext.documentType.replace(/_/g, " ")}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(ext.status) + "20" }]}>
                <ThemedText style={[styles.statusBadgeText, { color: statusColor(ext.status) }]}>
                  {ext.status.replace(/_/g, " ").toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <View style={styles.confCircle}>
              <ThemedText
                style={[styles.confValue, { color: confidenceColor(ext.overallConfidence) }]}
              >
                {(ext.overallConfidence * 100).toFixed(1)}%
              </ThemedText>
              <ThemedText style={[styles.confLabel, { color: theme.textSecondary }]}>
                confidence
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.qualityCard}>
          <ThemedText style={styles.cardTitle}>Document Quality</ThemedText>
          <View style={styles.qualityRow}>
            <View style={styles.qualityItem}>
              <ThemedText style={[styles.qualityVal, { color: theme.primary }]}>
                {ext.quality.dpi}
              </ThemedText>
              <ThemedText style={[styles.qualityLbl, { color: theme.textSecondary }]}>DPI</ThemedText>
            </View>
            <View style={styles.qualityItem}>
              <ThemedText
                style={[
                  styles.qualityVal,
                  {
                    color:
                      ext.quality.grade === "high"
                        ? theme.success
                        : ext.quality.grade === "acceptable"
                        ? "#F59E0B"
                        : "#DC2626",
                  },
                ]}
              >
                {ext.quality.grade}
              </ThemedText>
              <ThemedText style={[styles.qualityLbl, { color: theme.textSecondary }]}>Grade</ThemedText>
            </View>
            <View style={styles.qualityItem}>
              <ThemedText style={[styles.qualityVal, { color: theme.primary }]}>
                {ext.quality.enhancementsApplied.length}
              </ThemedText>
              <ThemedText style={[styles.qualityLbl, { color: theme.textSecondary }]}>
                Enhancements
              </ThemedText>
            </View>
          </View>
          {ext.quality.issues.length > 0 ? (
            <View style={[styles.issueBox, { backgroundColor: "#FEF3C7" }]}>
              {ext.quality.issues.map((issue, i) => (
                <View key={i} style={styles.issueRow}>
                  <Feather name="alert-triangle" size={12} color="#F59E0B" />
                  <ThemedText style={[styles.issueText, { color: "#92400E" }]}>{issue}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Card style={styles.modelsCard}>
          <ThemedText style={styles.cardTitle}>Multi-Model Comparison</ThemedText>
          <View style={styles.modelRow}>
            <View style={[styles.modelBox, { borderColor: theme.border }]}>
              <ThemedText style={[styles.modelName, { color: theme.primary }]}>
                {ext.modelA.modelName}
              </ThemedText>
              <ThemedText style={[styles.modelConf, { color: confidenceColor(ext.modelA.overallConfidence) }]}>
                {(ext.modelA.overallConfidence * 100).toFixed(1)}%
              </ThemedText>
              <ThemedText style={[styles.modelTime, { color: theme.textSecondary }]}>
                {ext.modelA.processingTimeMs}ms
              </ThemedText>
            </View>
            <View style={styles.vsContainer}>
              <ThemedText style={[styles.vsText, { color: theme.textSecondary }]}>VS</ThemedText>
            </View>
            <View style={[styles.modelBox, { borderColor: theme.border }]}>
              <ThemedText style={[styles.modelName, { color: theme.primary }]}>
                {ext.modelB.modelName}
              </ThemedText>
              <ThemedText style={[styles.modelConf, { color: confidenceColor(ext.modelB.overallConfidence) }]}>
                {(ext.modelB.overallConfidence * 100).toFixed(1)}%
              </ThemedText>
              <ThemedText style={[styles.modelTime, { color: theme.textSecondary }]}>
                {ext.modelB.processingTimeMs}ms
              </ThemedText>
            </View>
          </View>
        </Card>

        {ext.conflicts.length > 0 ? (
          <Card style={[styles.conflictsCard, { borderLeftColor: "#DC2626" }]}>
            <ThemedText style={styles.cardTitle}>
              <Feather name="alert-triangle" size={16} color="#DC2626" /> Conflicts ({ext.conflicts.length})
            </ThemedText>
            {ext.conflicts.map((c, i) => (
              <View key={i} style={[styles.conflictRow, { borderBottomColor: theme.border }]}>
                <ThemedText style={styles.conflictField}>{c.field.replace(/_/g, " ")}</ThemedText>
                <View style={styles.conflictValues}>
                  <View style={[styles.conflictVal, { backgroundColor: "#DBEAFE" }]}>
                    <ThemedText style={[styles.conflictValLabel, { color: "#1E40AF" }]}>Model A</ThemedText>
                    <ThemedText style={{ color: "#1E40AF" }}>{String(c.modelAValue)}</ThemedText>
                  </View>
                  <View style={[styles.conflictVal, { backgroundColor: "#FEE2E2" }]}>
                    <ThemedText style={[styles.conflictValLabel, { color: "#991B1B" }]}>Model B</ThemedText>
                    <ThemedText style={{ color: "#991B1B" }}>{String(c.modelBValue)}</ThemedText>
                  </View>
                </View>
                {c.resolved ? (
                  <View style={[styles.resolvedBadge, { backgroundColor: theme.success + "20" }]}>
                    <Feather name="check" size={12} color={theme.success} />
                    <ThemedText style={{ color: theme.success, fontSize: 12, marginLeft: 4 }}>
                      Resolved: {String(c.resolvedValue)} ({c.resolvedBy})
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.fieldsCard}>
          <ThemedText style={styles.cardTitle}>Extracted Fields ({ext.consensusFields.length})</ThemedText>
          {ext.consensusFields.map((field, i) => {
            const isLowConf = field.confidence < ext.confidenceThreshold;
            const hasRangeIssue = field.rangeValidation && field.rangeValidation.severity !== "pass";
            const isEditing = correctionField === field.key;

            return (
              <View
                key={i}
                style={[
                  styles.fieldRow,
                  { borderBottomColor: theme.border },
                  hasRangeIssue ? { borderLeftWidth: 3, borderLeftColor: severityColor(field.rangeValidation?.severity ?? "pass") } : {},
                ]}
              >
                <View style={styles.fieldHeader}>
                  <ThemedText style={styles.fieldLabel}>{field.label}</ThemedText>
                  <ThemedText
                    style={[styles.fieldConf, { color: confidenceColor(field.confidence) }]}
                  >
                    {(field.confidence * 100).toFixed(1)}%
                  </ThemedText>
                </View>
                <View style={styles.fieldValueRow}>
                  <ThemedText style={[styles.fieldValue, isLowConf ? { color: "#F59E0B" } : {}]}>
                    {String(field.value)}
                    {field.unit ? ` ${field.unit}` : ""}
                  </ThemedText>
                  <View style={[styles.sourceBadge, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText style={[styles.sourceText, { color: theme.textSecondary }]}>
                      {field.source}
                    </ThemedText>
                  </View>
                </View>
                {hasRangeIssue ? (
                  <View style={styles.rangeAlert}>
                    <Feather
                      name="alert-circle"
                      size={12}
                      color={severityColor(field.rangeValidation?.severity ?? "pass")}
                    />
                    <ThemedText
                      style={[
                        styles.rangeAlertText,
                        { color: severityColor(field.rangeValidation?.severity ?? "pass") },
                      ]}
                    >
                      {field.rangeValidation?.message}
                    </ThemedText>
                  </View>
                ) : null}
                {isEditing ? (
                  <View style={styles.editArea}>
                    <TextInput
                      style={[styles.editInput, { borderColor: theme.border, color: theme.text }]}
                      value={correctionValue}
                      onChangeText={setCorrectionValue}
                      placeholder="Corrected value"
                      placeholderTextColor={theme.textSecondary}
                      testID="input-correction-value"
                    />
                    <TextInput
                      style={[styles.editInput, { borderColor: theme.border, color: theme.text }]}
                      value={correctionReason}
                      onChangeText={setCorrectionReason}
                      placeholder="Reason for correction"
                      placeholderTextColor={theme.textSecondary}
                      testID="input-correction-reason"
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: theme.success }]}
                        onPress={() =>
                          correctMutation.mutate({
                            id: ext.id,
                            fieldKey: field.key,
                            correctedValue: correctionValue,
                            reason: correctionReason,
                          })
                        }
                        testID="button-save-correction"
                      >
                        <ThemedText style={styles.editBtnText}>Save</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: theme.textSecondary }]}
                        onPress={() => setCorrectionField(null)}
                        testID="button-cancel-correction"
                      >
                        <ThemedText style={styles.editBtnText}>Cancel</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.correctBtn}
                    onPress={() => {
                      setCorrectionField(field.key);
                      setCorrectionValue(String(field.value));
                      setCorrectionReason("");
                    }}
                    testID={`button-correct-${field.key}`}
                  >
                    <Feather name="edit-2" size={12} color={theme.primary} />
                    <ThemedText style={[styles.correctBtnText, { color: theme.primary }]}>
                      Correct
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </Card>

        {ext.temporalValidations.length > 0 ? (
          <Card style={styles.temporalCard}>
            <ThemedText style={styles.cardTitle}>Temporal Integrity</ThemedText>
            {ext.temporalValidations.map((t, i) => (
              <View key={i} style={styles.temporalRow}>
                <Feather
                  name={t.severity === "pass" ? "check-circle" : t.severity === "error" ? "x-circle" : "alert-circle"}
                  size={14}
                  color={t.severity === "pass" ? theme.success : t.severity === "error" ? "#DC2626" : "#F59E0B"}
                />
                <ThemedText style={styles.temporalText}>{t.message}</ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        {ext.status !== "verified" && ext.status !== "rejected" ? (
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.approveBtn, { backgroundColor: theme.success }]}
              onPress={() => approveMutation.mutate(ext.id)}
              testID="button-approve"
            >
              <Feather name="check" size={18} color="#FFFFFF" />
              <ThemedText style={styles.actionBtnText}>Approve</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rejectBtn, { backgroundColor: "#DC2626" }]}
              onPress={() => rejectMutation.mutate(ext.id)}
              testID="button-reject"
            >
              <Feather name="x" size={18} color="#FFFFFF" />
              <ThemedText style={styles.actionBtnText}>Reject</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderBenchmarkTab = () => {
    if (benchmarkLoading) return <ActivityIndicator color={theme.primary} style={styles.loader} />;
    const report = benchmarkData?.report;
    if (!report) return null;

    return (
      <View>
        <Card style={styles.benchHeader}>
          <ThemedText style={styles.benchTitle}>Golden Dataset Benchmark</ThemedText>
          <ThemedText style={[styles.benchPeriod, { color: theme.textSecondary }]}>
            {report.period} ({report.sampleSize} documents)
          </ThemedText>
        </Card>

        <Card style={styles.benchCard}>
          <ThemedText style={styles.cardTitle}>Accuracy Metrics</ThemedText>
          <View style={styles.benchGrid}>
            <View style={styles.benchItem}>
              <ThemedText style={[styles.benchValue, { color: theme.success }]}>
                {report.fieldAccuracy.toFixed(2)}%
              </ThemedText>
              <ThemedText style={[styles.benchLabel, { color: theme.textSecondary }]}>
                Field Accuracy
              </ThemedText>
            </View>
            <View style={styles.benchItem}>
              <ThemedText style={[styles.benchValue, { color: theme.primary }]}>
                {report.characterErrorRate.toFixed(4)}%
              </ThemedText>
              <ThemedText style={[styles.benchLabel, { color: theme.textSecondary }]}>CER</ThemedText>
            </View>
            <View style={styles.benchItem}>
              <ThemedText style={[styles.benchValue, { color: theme.primary }]}>
                {report.wordErrorRate.toFixed(4)}%
              </ThemedText>
              <ThemedText style={[styles.benchLabel, { color: theme.textSecondary }]}>WER</ThemedText>
            </View>
            <View style={styles.benchItem}>
              <ThemedText style={[styles.benchValue, { color: theme.success }]}>
                {report.autoPassAccuracy.toFixed(1)}%
              </ThemedText>
              <ThemedText style={[styles.benchLabel, { color: theme.textSecondary }]}>
                Auto-Pass Rate
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.benchCard}>
          <ThemedText style={styles.cardTitle}>Model Comparison</ThemedText>
          <View style={styles.modelCompRow}>
            <View style={[styles.modelCompBox, { borderColor: "#3B82F6" }]}>
              <ThemedText style={[styles.modelCompName, { color: "#3B82F6" }]}>
                {report.modelComparison.modelA.name}
              </ThemedText>
              <ThemedText style={styles.modelCompAcc}>
                {report.modelComparison.modelA.accuracy.toFixed(2)}%
              </ThemedText>
              <ThemedText style={[styles.modelCompConf, { color: theme.textSecondary }]}>
                Avg Conf: {(report.modelComparison.modelA.avgConfidence * 100).toFixed(1)}%
              </ThemedText>
            </View>
            <View style={[styles.modelCompBox, { borderColor: "#8B5CF6" }]}>
              <ThemedText style={[styles.modelCompName, { color: "#8B5CF6" }]}>
                {report.modelComparison.modelB.name}
              </ThemedText>
              <ThemedText style={styles.modelCompAcc}>
                {report.modelComparison.modelB.accuracy.toFixed(2)}%
              </ThemedText>
              <ThemedText style={[styles.modelCompConf, { color: theme.textSecondary }]}>
                Avg Conf: {(report.modelComparison.modelB.avgConfidence * 100).toFixed(1)}%
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.benchCard}>
          <ThemedText style={styles.cardTitle}>Performance</ThemedText>
          <View style={styles.perfRow}>
            <View style={styles.perfItem}>
              <ThemedText style={[styles.perfValue, { color: theme.primary }]}>
                {report.processingTimeP50Ms}ms
              </ThemedText>
              <ThemedText style={[styles.perfLabel, { color: theme.textSecondary }]}>P50 Latency</ThemedText>
            </View>
            <View style={styles.perfItem}>
              <ThemedText style={[styles.perfValue, { color: "#F59E0B" }]}>
                {report.processingTimeP95Ms}ms
              </ThemedText>
              <ThemedText style={[styles.perfLabel, { color: theme.textSecondary }]}>P95 Latency</ThemedText>
            </View>
            <View style={styles.perfItem}>
              <ThemedText style={[styles.perfValue, { color: theme.primary }]}>
                {(report.avgConfidence * 100).toFixed(1)}%
              </ThemedText>
              <ThemedText style={[styles.perfLabel, { color: theme.textSecondary }]}>Avg Confidence</ThemedText>
            </View>
          </View>
        </Card>

        {report.byDocType.length > 0 ? (
          <Card style={styles.benchCard}>
            <ThemedText style={styles.cardTitle}>By Document Type</ThemedText>
            {report.byDocType.map((dt, i) => (
              <View key={i} style={[styles.docTypeRow, { borderBottomColor: theme.border }]}>
                <ThemedText style={styles.docTypeName}>{dt.type.replace(/_/g, " ")}</ThemedText>
                <View style={styles.docTypeStats}>
                  <ThemedText style={[styles.docTypeCount, { color: theme.textSecondary }]}>
                    {dt.count} docs
                  </ThemedText>
                  <ThemedText style={[styles.docTypeAcc, { color: confidenceColor(dt.accuracy / 100) }]}>
                    {dt.accuracy}%
                  </ThemedText>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={[styles.benchCard, { borderLeftWidth: 3, borderLeftColor: "#3B82F6" }]}>
          <ThemedText style={styles.cardTitle}>Compliance Note</ThemedText>
          <ThemedText style={[styles.complianceText, { color: theme.textSecondary }]}>
            Monthly audit: Random sample of 100 auto-passed records verified by medical professional.
            CER and WER metrics calculated per CLSI C28-A3 methodology. Results reported to compliance officer.
          </ThemedText>
        </Card>
      </View>
    );
  };

  const renderAuditTab = () => {
    if (listLoading) return <ActivityIndicator color={theme.primary} style={styles.loader} />;
    const items = listData?.extractions ?? [];

    const statusCounts: Record<string, number> = {};
    items.forEach((it) => {
      statusCounts[it.status] = (statusCounts[it.status] || 0) + 1;
    });

    return (
      <View>
        <Card style={styles.summaryCard}>
          <ThemedText style={styles.cardTitle}>Processing History</ThemedText>
          <View style={styles.statusGrid}>
            {Object.entries(statusCounts).map(([status, count]) => (
              <View key={status} style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
                <ThemedText style={styles.statusName}>{status.replace(/_/g, " ")}</ThemedText>
                <ThemedText style={[styles.statusCount, { color: theme.primary }]}>{count}</ThemedText>
              </View>
            ))}
          </View>
        </Card>

        {items.slice(0, 15).map((item, idx) => (
          <Animated.View key={item.id} entering={FadeInDown.delay(idx * 30)}>
            <TouchableOpacity
              onPress={() => {
                setSelectedExtraction(item.id);
                setActiveTab("review");
              }}
            >
              <Card style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                  <View style={styles.historyInfo}>
                    <ThemedText style={styles.historyType}>
                      {item.documentType.replace(/_/g, " ")}
                    </ThemedText>
                    <ThemedText style={[styles.historyStatus, { color: statusColor(item.status) }]}>
                      {item.status.replace(/_/g, " ")}
                    </ThemedText>
                  </View>
                  <View style={styles.historyRight}>
                    <ThemedText
                      style={[styles.historyConf, { color: confidenceColor(item.overallConfidence) }]}
                    >
                      {(item.overallConfidence * 100).toFixed(1)}%
                    </ThemedText>
                    <ThemedText style={[styles.historyTime, { color: theme.textSecondary }]}>
                      {formatDate(item.createdAt)}
                    </ThemedText>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderRangesTab = () => {
    const rangeCategories = [
      { cat: "vital", label: "Vital Signs", icon: "heart" },
      { cat: "metabolic", label: "Metabolic", icon: "activity" },
      { cat: "hematology", label: "Hematology", icon: "droplet" },
      { cat: "chemistry", label: "Chemistry", icon: "layers" },
      { cat: "renal", label: "Renal", icon: "filter" },
      { cat: "hepatic", label: "Hepatic", icon: "database" },
      { cat: "endocrine", label: "Endocrine", icon: "zap" },
    ];

    return (
      <View>
        <Card style={styles.rangesHeader}>
          <ThemedText style={styles.cardTitle}>Clinical Range Reference</ThemedText>
          <ThemedText style={[styles.rangesSubtitle, { color: theme.textSecondary }]}>
            30 validated physiological ranges used for sanity checking extracted values
          </ThemedText>
        </Card>
        {rangeCategories.map((cat) => (
          <Card key={cat.cat} style={styles.rangeCatCard}>
            <View style={styles.rangeCatHeader}>
              <Feather name={cat.icon as any} size={16} color={theme.primary} />
              <ThemedText style={[styles.rangeCatTitle, { color: theme.primary }]}>
                {cat.label}
              </ThemedText>
            </View>
            <ThemedText style={[styles.rangeCatDesc, { color: theme.textSecondary }]}>
              {cat.cat === "vital" ? "BP, HR, RR, Temp, SpO2, Weight, Height" :
               cat.cat === "metabolic" ? "Glucose, HbA1c, Cholesterol, LDL, HDL, Triglycerides" :
               cat.cat === "hematology" ? "Hemoglobin, WBC, Platelets, INR" :
               cat.cat === "chemistry" ? "Potassium, Sodium, Albumin, Calcium" :
               cat.cat === "renal" ? "Creatinine, eGFR, BUN" :
               cat.cat === "hepatic" ? "ALT, AST, Bilirubin" :
               "TSH"}
            </ThemedText>
            <View style={styles.rangeLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
                <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Normal</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Warning</ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Critical/Impossible</ThemedText>
              </View>
            </View>
          </Card>
        ))}
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "queue": return renderQueueTab();
      case "review": return renderReviewTab();
      case "benchmark": return renderBenchmarkTab();
      case "audit": return renderAuditTab();
      case "ranges": return renderRangesTab();
      default: return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.sm,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerArea}>
          <View style={[styles.internalBadge, { backgroundColor: "#DC2626" }]}>
            <Feather name="shield" size={10} color="#FFFFFF" />
            <ThemedText style={styles.internalBadgeText}>HIPAA VERIFIED</ThemedText>
          </View>
        </View>
        {renderTabs()}
        {renderContent()}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: { flexDirection: "row", justifyContent: "flex-end", marginBottom: Spacing.sm },
  internalBadge: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, gap: 4,
  },
  internalBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  tabBar: { flexDirection: "row", marginBottom: Spacing.md },
  tab: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14,
    marginRight: 4, borderBottomWidth: 2, gap: 6,
  },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  loader: { marginTop: 60 },
  summaryCard: { marginBottom: Spacing.md, padding: Spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontSize: 28, fontWeight: "700" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.sm },
  processBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, gap: 4,
  },
  processBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  emptyCard: { padding: Spacing.xl, alignItems: "center", gap: 12, marginBottom: Spacing.md },
  emptyText: { fontSize: 14, textAlign: "center" },
  queueCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  queueHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priorityText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  queueType: { fontSize: 12, textTransform: "capitalize" },
  queueReason: { fontSize: 13, marginBottom: 8 },
  queueMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { fontSize: 11, fontWeight: "600" },
  queueTime: { fontSize: 11, marginLeft: "auto" },
  listCard: { marginBottom: Spacing.xs, padding: Spacing.sm },
  listHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  listType: { flex: 1, fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  listConfidence: { fontSize: 14, fontWeight: "700" },
  listMeta: { flexDirection: "row", gap: 12, marginTop: 4, marginLeft: 16 },
  listStatus: { fontSize: 12, textTransform: "capitalize" },
  listFields: { fontSize: 12 },
  listConflicts: { fontSize: 12, fontWeight: "600" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.md },
  backText: { fontSize: 14, fontWeight: "600" },
  detailHeaderCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  detailHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailType: { fontSize: 18, fontWeight: "700", textTransform: "capitalize", marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  confCircle: { alignItems: "center" },
  confValue: { fontSize: 24, fontWeight: "700" },
  confLabel: { fontSize: 10 },
  qualityCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.sm },
  qualityRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: Spacing.sm },
  qualityItem: { alignItems: "center" },
  qualityVal: { fontSize: 18, fontWeight: "700", textTransform: "capitalize" },
  qualityLbl: { fontSize: 11, marginTop: 2 },
  issueBox: { padding: 10, borderRadius: 8, gap: 6 },
  issueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  issueText: { fontSize: 12, flex: 1 },
  modelsCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  modelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modelBox: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  modelName: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  modelConf: { fontSize: 20, fontWeight: "700" },
  modelTime: { fontSize: 11, marginTop: 2 },
  vsContainer: { paddingHorizontal: 4 },
  vsText: { fontSize: 12, fontWeight: "700" },
  conflictsCard: { marginBottom: Spacing.sm, padding: Spacing.md, borderLeftWidth: 3 },
  conflictRow: { paddingVertical: 10, borderBottomWidth: 1 },
  conflictField: { fontSize: 14, fontWeight: "600", textTransform: "capitalize", marginBottom: 6 },
  conflictValues: { flexDirection: "row", gap: 8, marginBottom: 6 },
  conflictVal: { flex: 1, padding: 8, borderRadius: 8, alignItems: "center" },
  conflictValLabel: { fontSize: 10, fontWeight: "600", marginBottom: 2 },
  resolvedBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  fieldsCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  fieldRow: { paddingVertical: 10, borderBottomWidth: 1, paddingLeft: 6 },
  fieldHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  fieldConf: { fontSize: 12, fontWeight: "600" },
  fieldValueRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  fieldValue: { fontSize: 15, fontWeight: "500" },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sourceText: { fontSize: 10, fontWeight: "600" },
  rangeAlert: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  rangeAlertText: { fontSize: 11, flex: 1 },
  correctBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  correctBtnText: { fontSize: 12, fontWeight: "600" },
  editArea: { marginTop: 8, gap: 8 },
  editInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  editActions: { flexDirection: "row", gap: 8 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  editBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  temporalCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  temporalRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  temporalText: { fontSize: 13, flex: 1 },
  actionBar: { flexDirection: "row", gap: 12, marginTop: Spacing.md, marginBottom: Spacing.xl },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  actionBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  benchHeader: { marginBottom: Spacing.sm, padding: Spacing.md },
  benchTitle: { fontSize: 18, fontWeight: "700" },
  benchPeriod: { fontSize: 13, marginTop: 4 },
  benchCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  benchGrid: { flexDirection: "row", flexWrap: "wrap" },
  benchItem: { width: "50%", alignItems: "center", paddingVertical: 10 },
  benchValue: { fontSize: 22, fontWeight: "700" },
  benchLabel: { fontSize: 11, marginTop: 2 },
  modelCompRow: { flexDirection: "row", gap: 10 },
  modelCompBox: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, alignItems: "center" },
  modelCompName: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  modelCompAcc: { fontSize: 20, fontWeight: "700" },
  modelCompConf: { fontSize: 11, marginTop: 4 },
  perfRow: { flexDirection: "row", justifyContent: "space-around" },
  perfItem: { alignItems: "center" },
  perfValue: { fontSize: 18, fontWeight: "700" },
  perfLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  docTypeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1 },
  docTypeName: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  docTypeStats: { flexDirection: "row", gap: 12, alignItems: "center" },
  docTypeCount: { fontSize: 12 },
  docTypeAcc: { fontSize: 14, fontWeight: "700" },
  complianceText: { fontSize: 13, lineHeight: 20 },
  statusGrid: { gap: 8 },
  statusItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusName: { flex: 1, fontSize: 13, textTransform: "capitalize" },
  statusCount: { fontSize: 16, fontWeight: "700" },
  historyCard: { marginBottom: Spacing.xs, padding: Spacing.sm },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyInfo: { flex: 1 },
  historyType: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  historyStatus: { fontSize: 11, textTransform: "capitalize" },
  historyRight: { alignItems: "flex-end" },
  historyConf: { fontSize: 14, fontWeight: "700" },
  historyTime: { fontSize: 10, marginTop: 2 },
  rangesHeader: { marginBottom: Spacing.sm, padding: Spacing.md },
  rangesSubtitle: { fontSize: 13, marginTop: 4 },
  rangeCatCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  rangeCatHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  rangeCatTitle: { fontSize: 14, fontWeight: "700" },
  rangeCatDesc: { fontSize: 12, marginBottom: 8 },
  rangeLegend: { flexDirection: "row", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
});
