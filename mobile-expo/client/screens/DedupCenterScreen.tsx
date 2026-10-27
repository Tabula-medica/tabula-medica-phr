import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, FadeInUp } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface MatchEvidence {
  field: string;
  value1: string;
  value2: string;
  matchType: "exact" | "fuzzy" | "partial";
  score: number;
}

interface DuplicateRecord {
  id: string;
  title: string;
  date: string;
  source: string;
  sourceType: "fhir" | "manual" | "tefca" | "aggregator";
  facility: string;
  loincCode?: string;
  snomedCode?: string;
  rxnormCode?: string;
  fhirResourceId?: string;
  importedAt?: string;
}

interface DuplicateGroup {
  id: string;
  type: string;
  matchReasons: MatchEvidence[];
  confidence: number;
  confidenceLabel: "high" | "medium" | "low";
  records: DuplicateRecord[];
  suggestedPrimary: string;
  duplicateExplanation: string;
}

interface MergeHistory {
  id: string;
  mergedAt: string;
  recordType: string;
  recordCount: number;
  canUndo: boolean;
  mergedRecordIds: string[];
}

const DEMO_DUPLICATES: DuplicateGroup[] = [
  {
    id: "dup-1",
    type: "lab",
    confidence: 95,
    confidenceLabel: "high",
    duplicateExplanation: "These records appear to be the same CBC test from the same visit. The LOINC code, facility, and date match exactly. Values are identical.",
    matchReasons: [
      { field: "LOINC Code", value1: "58410-2", value2: "58410-2", matchType: "exact", score: 100 },
      { field: "Facility", value1: "City Hospital", value2: "City Hospital", matchType: "exact", score: 100 },
      { field: "Date", value1: "2025-01-15", value2: "2025-01-15", matchType: "exact", score: 100 },
      { field: "Result Value", value1: "14.2 g/dL", value2: "14.2 g/dL", matchType: "exact", score: 100 },
    ],
    records: [
      { 
        id: "r1", 
        title: "CBC with Differential", 
        date: "2025-01-15", 
        source: "Epic MyChart", 
        sourceType: "fhir",
        facility: "City Hospital",
        loincCode: "58410-2",
        fhirResourceId: "Observation/cbc-12345",
        importedAt: "2025-01-15T10:30:00Z",
      },
      { 
        id: "r2", 
        title: "Complete Blood Count", 
        date: "2025-01-15", 
        source: "Patient Portal", 
        sourceType: "aggregator",
        facility: "City Hospital",
        loincCode: "58410-2",
        importedAt: "2025-01-16T08:15:00Z",
      },
    ],
    suggestedPrimary: "r1",
  },
  {
    id: "dup-2",
    type: "medication",
    confidence: 88,
    confidenceLabel: "high",
    duplicateExplanation: "Same medication (Lisinopril 10mg) from overlapping prescriptions. RxNorm codes match. The CVS record has more recent fill information.",
    matchReasons: [
      { field: "RxNorm Code", value1: "314076", value2: "314076", matchType: "exact", score: 100 },
      { field: "Medication Name", value1: "Lisinopril 10mg", value2: "Lisinopril 10 MG Tablet", matchType: "fuzzy", score: 92 },
      { field: "Prescriber", value1: "Dr. Smith", value2: "Smith, John MD", matchType: "fuzzy", score: 85 },
    ],
    records: [
      { 
        id: "r3", 
        title: "Lisinopril 10mg", 
        date: "2025-01-10", 
        source: "CVS Pharmacy", 
        sourceType: "aggregator",
        facility: "CVS",
        rxnormCode: "314076",
        importedAt: "2025-01-12T14:00:00Z",
      },
      { 
        id: "r4", 
        title: "Lisinopril 10 MG Tablet", 
        date: "2025-01-10", 
        source: "Epic MyChart", 
        sourceType: "fhir",
        facility: "Primary Care",
        rxnormCode: "314076",
        fhirResourceId: "MedicationRequest/med-67890",
        importedAt: "2025-01-11T09:45:00Z",
      },
    ],
    suggestedPrimary: "r3",
  },
  {
    id: "dup-3",
    type: "visit",
    confidence: 78,
    confidenceLabel: "medium",
    duplicateExplanation: "Likely the same annual physical. Same provider, same date, similar clinical notes. Title wording differs between sources.",
    matchReasons: [
      { field: "Provider", value1: "Dr. Johnson", value2: "Johnson, Emily MD", matchType: "fuzzy", score: 88 },
      { field: "Date", value1: "2024-12-01", value2: "2024-12-01", matchType: "exact", score: 100 },
      { field: "Facility", value1: "Primary Care Clinic", value2: "Primary Care Clinic", matchType: "exact", score: 100 },
      { field: "Visit Type", value1: "Annual Physical", value2: "Yearly Checkup", matchType: "fuzzy", score: 75 },
    ],
    records: [
      { 
        id: "r5", 
        title: "Annual Physical Exam", 
        date: "2024-12-01", 
        source: "Epic MyChart", 
        sourceType: "fhir",
        facility: "Primary Care Clinic",
        fhirResourceId: "Encounter/enc-11111",
        importedAt: "2024-12-02T11:00:00Z",
      },
      { 
        id: "r6", 
        title: "Yearly Checkup", 
        date: "2024-12-01", 
        source: "TEFCA Network", 
        sourceType: "tefca",
        facility: "Primary Care Clinic",
        importedAt: "2024-12-05T16:30:00Z",
      },
    ],
    suggestedPrimary: "r5",
  },
];

const DEMO_HISTORY: MergeHistory[] = [
  { id: "m1", mergedAt: "2025-01-28", recordType: "Immunization", recordCount: 2, canUndo: true, mergedRecordIds: ["imm1", "imm2"] },
  { id: "m2", mergedAt: "2025-01-20", recordType: "Lab Result", recordCount: 3, canUndo: true, mergedRecordIds: ["lab1", "lab2", "lab3"] },
];

export default function DedupCenterScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [refreshing, setRefreshing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>(DEMO_DUPLICATES);
  const [mergeHistory, setMergeHistory] = useState<MergeHistory[]>(DEMO_HISTORY);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DuplicateGroup | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleMerge = (group: DuplicateGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Merge Records",
      `Merge ${group.records.length} duplicate ${group.type} records into one?\n\nThe primary record will be kept and enhanced with data from duplicates. This action can be undone within 30 days.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Merge",
          onPress: () => {
            setDuplicates(prev => prev.filter(d => d.id !== group.id));
            setMergeHistory(prev => [
              {
                id: `m-${Date.now()}`,
                mergedAt: new Date().toISOString().split("T")[0],
                recordType: group.type,
                recordCount: group.records.length,
                canUndo: true,
                mergedRecordIds: group.records.map(r => r.id),
              },
              ...prev,
            ]);
            setDetailModal(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleKeepSeparate = (groupId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Keep Records Separate",
      "Mark these as distinct records (not duplicates). They will not be suggested for merging again unless data changes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Keep Separate",
          onPress: () => {
            setDuplicates(prev => prev.filter(d => d.id !== groupId));
            setDetailModal(null);
          },
        },
      ]
    );
  };

  const handleNotSure = (group: DuplicateGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Mark as Uncertain",
      "We'll keep this suggestion but move it to the bottom of your review list. You can revisit it later or we'll prompt you again when more data is available.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "OK",
          onPress: () => {
            setDuplicates(prev => {
              const filtered = prev.filter(d => d.id !== group.id);
              return [...filtered, group];
            });
            setDetailModal(null);
          },
        },
      ]
    );
  };

  const handleUndo = (mergeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Undo Merge",
      "Restore the original separate records? This will recreate the individual records as they existed before merging.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo",
          onPress: () => {
            setMergeHistory(prev => prev.filter(m => m.id !== mergeId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "lab": return "activity";
      case "medication": return "package";
      case "visit": return "user";
      case "immunization": return "shield";
      case "imaging": return "image";
      case "vital": return "heart";
      default: return "file";
    }
  };

  const getSourceIcon = (sourceType: string): keyof typeof Feather.glyphMap => {
    switch (sourceType) {
      case "fhir": return "database";
      case "manual": return "edit-3";
      case "tefca": return "globe";
      case "aggregator": return "layers";
      default: return "file";
    }
  };

  const getConfidenceColor = (label: "high" | "medium" | "low") => {
    switch (label) {
      case "high": return colors.success;
      case "medium": return colors.warning;
      case "low": return colors.error;
    }
  };

  const getMatchTypeColor = (matchType: "exact" | "fuzzy" | "partial") => {
    switch (matchType) {
      case "exact": return colors.success;
      case "fuzzy": return colors.warning;
      case "partial": return colors.textSecondary;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderMatchEvidence = (evidence: MatchEvidence[]) => (
    <View style={styles.evidenceList}>
      <ThemedText type="caption" style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>
        WHY IT'S A DUPLICATE
      </ThemedText>
      {evidence.map((e, i) => (
        <View key={i} style={[styles.evidenceRow, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.evidenceField}>
            <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{e.field}</ThemedText>
          </View>
          <View style={styles.evidenceValues}>
            <ThemedText style={{ fontSize: 12 }} numberOfLines={1}>{e.value1}</ThemedText>
            <View style={[styles.matchBadge, { backgroundColor: getMatchTypeColor(e.matchType) + "20" }]}>
              <ThemedText style={{ fontSize: 10, color: getMatchTypeColor(e.matchType), fontWeight: "600" }}>
                {e.matchType === "exact" ? "EXACT" : e.matchType === "fuzzy" ? `${e.score}%` : "PARTIAL"}
              </ThemedText>
            </View>
            <ThemedText style={{ fontSize: 12 }} numberOfLines={1}>{e.value2}</ThemedText>
          </View>
        </View>
      ))}
    </View>
  );

  const renderProvenanceBadge = (record: DuplicateRecord) => (
    <View style={[styles.provenanceBadge, { backgroundColor: colors.backgroundSecondary }]}>
      <Feather name={getSourceIcon(record.sourceType)} size={12} color={colors.textSecondary} />
      <ThemedText style={{ fontSize: 10, color: colors.textSecondary, marginLeft: 4 }}>
        {record.sourceType === "fhir" ? "FHIR" : 
         record.sourceType === "manual" ? "Manual" :
         record.sourceType === "tefca" ? "TEFCA" : "Aggregator"}
      </ThemedText>
    </View>
  );

  const renderDetailModal = () => {
    if (!detailModal) return null;
    const group = detailModal;

    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModal(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setDetailModal(null)} style={styles.modalClose}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
            <ThemedText type="h3">Duplicate Review</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView 
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.confidenceCard, { backgroundColor: colors.backgroundDefault }]}>
              <View style={[styles.confidenceCircle, { borderColor: getConfidenceColor(group.confidenceLabel) }]}>
                <ThemedText style={{ fontSize: 24, fontWeight: "700", color: getConfidenceColor(group.confidenceLabel) }}>
                  {group.confidence}%
                </ThemedText>
                <ThemedText style={{ fontSize: 10, color: colors.textSecondary }}>MATCH</ThemedText>
              </View>
              <View style={styles.confidenceInfo}>
                <ThemedText type="h4" style={{ textTransform: "capitalize" }}>
                  {group.confidenceLabel} Confidence Duplicate
                </ThemedText>
                <ThemedText style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  {group.duplicateExplanation}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
              <Feather name="info" size={16} color={colors.primary} />
              <ThemedText style={{ color: colors.primary, fontSize: 12, flex: 1 }}>
                Confidence scores are informational. You decide what to merge.
              </ThemedText>
            </View>

            <ThemedText type="caption" style={{ color: colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              RECORDS TO COMPARE
            </ThemedText>

            {group.records.map((record, i) => (
              <View
                key={record.id}
                style={[
                  styles.recordCard,
                  { backgroundColor: colors.backgroundDefault },
                  record.id === group.suggestedPrimary && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <View style={styles.recordHeader}>
                  <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Feather name={getTypeIcon(group.type)} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.recordInfo}>
                    <ThemedText style={{ fontWeight: "600" }}>{record.title}</ThemedText>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {formatDate(record.date)} | {record.facility}
                    </ThemedText>
                  </View>
                  {record.id === group.suggestedPrimary && (
                    <View style={[styles.keepBadge, { backgroundColor: colors.primary }]}>
                      <ThemedText style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>SUGGESTED</ThemedText>
                    </View>
                  )}
                </View>

                <View style={styles.recordMeta}>
                  {renderProvenanceBadge(record)}
                  <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>
                    Source: {record.source}
                  </ThemedText>
                </View>

                {record.loincCode || record.rxnormCode || record.snomedCode ? (
                  <View style={[styles.codeRow, { backgroundColor: colors.backgroundSecondary }]}>
                    {record.loincCode ? (
                      <View style={styles.codeChip}>
                        <ThemedText style={{ fontSize: 10, color: colors.textSecondary }}>LOINC: {record.loincCode}</ThemedText>
                      </View>
                    ) : null}
                    {record.rxnormCode ? (
                      <View style={styles.codeChip}>
                        <ThemedText style={{ fontSize: 10, color: colors.textSecondary }}>RxNorm: {record.rxnormCode}</ThemedText>
                      </View>
                    ) : null}
                    {record.snomedCode ? (
                      <View style={styles.codeChip}>
                        <ThemedText style={{ fontSize: 10, color: colors.textSecondary }}>SNOMED: {record.snomedCode}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {record.importedAt ? (
                  <ThemedText style={{ fontSize: 10, color: colors.textSecondary, marginTop: Spacing.xs }}>
                    Imported: {new Date(record.importedAt).toLocaleString()}
                  </ThemedText>
                ) : null}
              </View>
            ))}

            {renderMatchEvidence(group.matchReasons)}

            <View style={[styles.aiSuggestionCard, { backgroundColor: `${colors.info}10`, borderColor: colors.info }]}>
              <View style={styles.aiHeader}>
                <Feather name="cpu" size={16} color={colors.info} />
                <ThemedText style={{ color: colors.info, fontWeight: "600", marginLeft: Spacing.xs }}>
                  AI Analysis
                </ThemedText>
              </View>
              <ThemedText style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}>
                {group.confidence >= 90 
                  ? "These records appear to be duplicates with high confidence. The clinical codes, dates, and values match exactly. Merging is recommended."
                  : group.confidence >= 75
                  ? "These records have similar characteristics but some differences. Review the highlighted fields carefully before deciding."
                  : "These records have some overlap but significant differences. Consider keeping them separate unless you can confirm they represent the same clinical event."
                }
              </ThemedText>
              {group.confidence >= 85 ? (
                <View style={[styles.aiRecommendation, { backgroundColor: `${colors.success}15` }]}>
                  <Feather name="check-circle" size={14} color={colors.success} />
                  <ThemedText style={{ color: colors.success, fontSize: 12, fontWeight: "600", marginLeft: 4 }}>
                    Recommended: Merge these records
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.aiRecommendation, { backgroundColor: `${colors.warning}15` }]}>
                  <Feather name="alert-circle" size={14} color={colors.warning} />
                  <ThemedText style={{ color: colors.warning, fontSize: 12, fontWeight: "600", marginLeft: 4 }}>
                    Recommended: Review carefully before merging
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleNotSure(group)}
              >
                <Feather name="help-circle" size={18} color={colors.textSecondary} />
                <ThemedText style={{ color: colors.textSecondary, marginLeft: Spacing.xs }}>Not Sure</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => handleKeepSeparate(group.id)}
              >
                <Feather name="x" size={18} color={colors.warning} />
                <ThemedText style={{ color: colors.warning, marginLeft: Spacing.xs }}>Keep Separate</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleMerge(group)}
              >
                <Feather name="git-merge" size={18} color="#fff" />
                <ThemedText style={{ color: "#fff", marginLeft: Spacing.xs, fontWeight: "600" }}>Merge</ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderPendingTab = () => (
    <View style={styles.section}>
      {duplicates.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault }]}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.success}15` }]}>
            <Feather name="check-circle" size={48} color={colors.success} />
          </View>
          <ThemedText type="h3" style={styles.emptyTitle}>All Clean!</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            No duplicate records found. Your health data is unified and organized.
          </ThemedText>
        </View>
      ) : (
        <>
          <View style={[styles.summaryCard, { backgroundColor: colors.backgroundDefault }]}>
            <View style={[styles.summaryIcon, { backgroundColor: `${colors.warning}15` }]}>
              <Feather name="copy" size={24} color={colors.warning} />
            </View>
            <View style={styles.summaryText}>
              <ThemedText type="h3">We found {duplicates.length} potential duplicates</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>
                Review and merge to keep your records unified
              </ThemedText>
            </View>
          </View>

          <View style={[styles.trustBanner, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
            <Feather name="shield" size={16} color={colors.primary} />
            <ThemedText style={{ color: colors.primary, fontSize: 12, flex: 1 }}>
              Confidence scores help identify matches. You always have final say on merging.
            </ThemedText>
          </View>

          {duplicates.map((group, index) => (
            <Animated.View
              key={group.id}
              entering={FadeInDown.delay(index * 50)}
            >
              <Pressable 
                style={[styles.duplicateCard, { backgroundColor: colors.backgroundDefault }]}
                onPress={() => setDetailModal(group)}
              >
                <View style={styles.duplicateHeader}>
                  <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Feather name={getTypeIcon(group.type)} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.duplicateInfo}>
                    <ThemedText type="h4" style={{ textTransform: "capitalize" }}>
                      {group.records.length} {group.type} records
                    </ThemedText>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                      {group.records.map(r => r.source).join(" + ")}
                    </ThemedText>
                  </View>
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(group.confidenceLabel) + "15" }]}>
                    <ThemedText style={{ color: getConfidenceColor(group.confidenceLabel), fontSize: 14, fontWeight: "700" }}>
                      {group.confidence}%
                    </ThemedText>
                    <ThemedText style={{ color: getConfidenceColor(group.confidenceLabel), fontSize: 9, textTransform: "uppercase" }}>
                      {group.confidenceLabel}
                    </ThemedText>
                  </View>
                </View>

                <View style={[styles.explanationBox, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={2}>
                    {group.duplicateExplanation}
                  </ThemedText>
                </View>

                <View style={styles.recordPreview}>
                  {group.records.slice(0, 2).map((record, i) => (
                    <View key={record.id} style={styles.recordPreviewItem}>
                      {renderProvenanceBadge(record)}
                      <ThemedText style={{ fontSize: 12 }} numberOfLines={1}>{record.title}</ThemedText>
                    </View>
                  ))}
                </View>

                <View style={styles.cardFooter}>
                  <ThemedText style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                    Review details
                  </ThemedText>
                  <Feather name="chevron-right" size={18} color={colors.primary} />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </>
      )}
    </View>
  );

  const renderHistoryTab = () => (
    <View style={styles.section}>
      {mergeHistory.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundDefault }]}>
          <Feather name="clock" size={48} color={colors.textSecondary} />
          <ThemedText type="h3" style={styles.emptyTitle}>No Merge History</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Merged records will appear here. You can undo merges within 30 days.
          </ThemedText>
        </View>
      ) : (
        mergeHistory.map((merge, index) => (
          <Animated.View
            key={merge.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.historyCard, { backgroundColor: colors.backgroundDefault }]}
          >
            <View style={[styles.historyIcon, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="git-merge" size={20} color={colors.success} />
            </View>
            <View style={styles.historyInfo}>
              <ThemedText style={{ fontWeight: "500" }}>
                {merge.recordCount} {merge.recordType} records merged
              </ThemedText>
              <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>
                {merge.mergedAt}
              </ThemedText>
            </View>
            {merge.canUndo ? (
              <Pressable
                style={[styles.undoButton, { borderColor: colors.warning }]}
                onPress={() => handleUndo(merge.id)}
              >
                <Feather name="rotate-ccw" size={16} color={colors.warning} />
                <ThemedText style={{ color: colors.warning, marginLeft: 4, fontWeight: "600" }}>Undo</ThemedText>
              </Pressable>
            ) : null}
          </Animated.View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View entering={FadeIn.delay(100)}>
          <View style={styles.header}>
            <ThemedText type="h1">Deduplication Center</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Keep your unified health record clean and accurate
            </ThemedText>
          </View>

          <View style={[styles.tabsContainer, { backgroundColor: colors.backgroundDefault }]}>
            <Pressable
              style={[styles.tab, activeTab === "pending" && { backgroundColor: `${colors.primary}20` }]}
              onPress={() => setActiveTab("pending")}
            >
              <Feather name="layers" size={18} color={activeTab === "pending" ? colors.primary : colors.textSecondary} />
              <ThemedText style={[styles.tabText, { color: activeTab === "pending" ? colors.primary : colors.textSecondary }]}>
                Review ({duplicates.length})
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "history" && { backgroundColor: `${colors.primary}20` }]}
              onPress={() => setActiveTab("history")}
            >
              <Feather name="clock" size={18} color={activeTab === "history" ? colors.primary : colors.textSecondary} />
              <ThemedText style={[styles.tabText, { color: activeTab === "history" ? colors.primary : colors.textSecondary }]}>
                History ({mergeHistory.length})
              </ThemedText>
            </Pressable>
          </View>

          {activeTab === "pending" ? renderPendingTab() : renderHistoryTab()}
        </Animated.View>
      </ScrollView>

      {renderDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: 15,
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    gap: Spacing.md,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
  },
  trustBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  duplicateCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  duplicateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  duplicateInfo: {
    flex: 1,
  },
  confidenceBadge: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  explanationBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  recordPreview: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  recordPreviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  provenanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    textAlign: "center",
    fontSize: 14,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  historyInfo: {
    flex: 1,
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  confidenceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  confidenceCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  confidenceInfo: {
    flex: 1,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  recordCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  recordHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recordInfo: {
    flex: 1,
  },
  keepBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  recordMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  codeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  codeChip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  evidenceList: {
    marginTop: Spacing.lg,
  },
  evidenceRow: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  evidenceField: {
    marginBottom: Spacing.xs,
  },
  evidenceValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  matchBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  aiSuggestionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  aiRecommendation: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
});
