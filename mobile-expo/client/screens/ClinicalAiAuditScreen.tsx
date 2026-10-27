import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SkeletonBox } from "@/components/LoadingState";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useAccessibility } from "@/context/AccessibilityContext";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ConfidenceGauge } from "@/components/ConfidenceGauge";
import { ExplainabilityTooltip } from "@/components/ExplainabilityTooltip";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SourceReference {
  sourceSystem: string;
  documentId: string;
  excerpt: string;
  highlightRange: { start: number; end: number };
}

interface ExplainabilityFactor {
  factor: string;
  weight: number;
  direction: string;
}

interface AuditRecord {
  id: number;
  timestamp: string;
  patientId: string;
  requestPayload: any;
  aiSummary: string;
  modelVersion: string;
  status: string;
  confidenceScore: number;
  sourceReferences: SourceReference[];
  explainabilityFactors: ExplainabilityFactor[];
  verificationStatus: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  flagReason: string | null;
  feedbackNotes: string | null;
  category: string;
}

interface AuditStats {
  total: number;
  verified: number;
  flagged: number;
  pending: number;
  lowConfidence: number;
  avgConfidence: number;
  categories: string[];
}

type FilterType = "all" | "pending" | "verified" | "flagged" | "low-confidence";

const FILTER_OPTIONS: { key: FilterType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "all", label: "All", icon: "list" },
  { key: "pending", label: "Pending", icon: "clock" },
  { key: "verified", label: "Verified", icon: "check-circle" },
  { key: "flagged", label: "Flagged", icon: "flag" },
  { key: "low-confidence", label: "<80%", icon: "alert-triangle" },
];

const CATEGORY_LABELS: Record<string, string> = {
  hormone_assessment: "Hormone Assessment",
  bone_health: "Bone Health",
  cardiovascular: "Cardiovascular",
  cognitive: "Cognitive Function",
  sleep_vasomotor: "Sleep & Vasomotor",
  medication_safety: "Medication Safety",
  summary: "General Summary",
};

function getConfidenceColor(score: number, colors: any): string {
  if (score >= 90) return colors.success;
  if (score >= 80) return colors.info;
  return colors.warning;
}

function getStatusConfig(status: string, colors: any) {
  switch (status) {
    case "verified":
      return { color: colors.success, icon: "check-circle" as const, label: "Verified" };
    case "flagged":
      return { color: colors.error, icon: "flag" as const, label: "Flagged" };
    default:
      return { color: colors.warning, icon: "clock" as const, label: "Pending Review" };
  }
}

function AuditSkeleton({ cardBg, reducedMotion }: { cardBg: string; reducedMotion: boolean }) {
  const skeletonProps = reducedMotion ? { style: { opacity: 0.5 } as any } : {};
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading audit data">
      <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: cardBg, alignItems: "center" }}>
            <SkeletonBox width={32} height={20} borderRadius={BorderRadius.xs} {...skeletonProps} />
            <View style={{ height: 6 }} />
            <SkeletonBox width="80%" height={12} borderRadius={BorderRadius.xs} {...skeletonProps} />
          </View>
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ backgroundColor: cardBg, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <SkeletonBox width="60%" height={16} borderRadius={BorderRadius.xs} {...skeletonProps} />
            <SkeletonBox width={50} height={24} borderRadius={12} {...skeletonProps} />
          </View>
          <SkeletonBox width="100%" height={14} borderRadius={BorderRadius.xs} {...skeletonProps} />
          <View style={{ height: 6 }} />
          <SkeletonBox width="85%" height={14} borderRadius={BorderRadius.xs} {...skeletonProps} />
          <View style={{ height: Spacing.md }} />
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <SkeletonBox width={70} height={30} borderRadius={BorderRadius.sm} {...skeletonProps} />
            <SkeletonBox width={70} height={30} borderRadius={BorderRadius.sm} {...skeletonProps} />
            <SkeletonBox width={50} height={30} borderRadius={BorderRadius.sm} {...skeletonProps} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ClinicalAiAuditScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { settings } = useAccessibility();
  const reducedMotion = settings.reducedMotion;
  const isHighContrast = settings.highContrast;
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedSources, setSelectedSources] = useState<SourceReference[]>([]);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagTargetId, setFlagTargetId] = useState<number | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [showWhyTooltip, setShowWhyTooltip] = useState<number | null>(null);

  const cardBg = colors.backgroundDefault;
  const detailBg = colors.backgroundSecondary;
  const borderColor = colors.border;
  const cardBorder = isHighContrast ? 1 : 0;

  const { data: records, isLoading } = useQuery<AuditRecord[]>({
    queryKey: ["/api/clinical-ai-audit"],
  });

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ["/api/clinical-ai-audit/statistics"],
  });

  const invalidateAuditQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/clinical-ai-audit"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clinical-ai-audit/statistics"] });
  };

  const verifyMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/clinical-ai-audit/${id}/verify`, {});
    },
    onSuccess: () => {
      invalidateAuditQueries();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const flagMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      await apiRequest("POST", `/api/clinical-ai-audit/${id}/flag`, { reason });
    },
    onSuccess: () => {
      invalidateAuditQueries();
      setShowFlagModal(false);
      setFlagReason("");
      setFlagTargetId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/clinical-ai-audit/${id}/reset`, {});
    },
    onSuccess: () => {
      invalidateAuditQueries();
    },
  });

  const animateLayout = useCallback(() => {
    if (!reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [reducedMotion]);

  const filteredRecords = (records || []).filter((r) => {
    switch (filter) {
      case "pending": return r.verificationStatus === "pending";
      case "verified": return r.verificationStatus === "verified";
      case "flagged": return r.verificationStatus === "flagged";
      case "low-confidence": return r.confidenceScore < 80;
      default: return true;
    }
  });

  const toggleExpand = (id: number) => {
    animateLayout();
    setExpandedId(expandedId === id ? null : id);
    setShowWhyTooltip(null);
  };

  const openSourceModal = (sources: SourceReference[]) => {
    setSelectedSources(sources);
    setShowSourceModal(true);
  };

  const openFlagModal = (id: number) => {
    setFlagTargetId(id);
    setFlagReason("");
    setShowFlagModal(true);
  };

  const entryAnim = (delay: number) => reducedMotion ? undefined : FadeInDown.delay(delay);

  const renderStatCard = (value: number | string, label: string, color: string, index: number) => (
    <Animated.View key={label} entering={entryAnim(index * 60)} style={[styles.statCard, { backgroundColor: cardBg, borderColor, borderWidth: cardBorder }]}>
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
    </Animated.View>
  );

  const renderAuditCard = (record: AuditRecord, index: number) => {
    const isExpanded = expandedId === record.id;
    const confidenceColor = getConfidenceColor(record.confidenceScore, colors);
    const statusConfig = getStatusConfig(record.verificationStatus, colors);
    const isLowConfidence = record.confidenceScore < 80;
    const showingWhyTooltip = showWhyTooltip === record.id;

    return (
      <Animated.View key={record.id} entering={entryAnim(200 + index * 80)}>
        <View style={[
          styles.auditCard,
          { backgroundColor: cardBg, borderColor, borderWidth: cardBorder },
          isLowConfidence ? { borderLeftWidth: 3, borderLeftColor: colors.warning } : null,
        ]}>
          <Pressable
            testID={`audit-card-${record.id}`}
            onPress={() => toggleExpand(record.id)}
            accessibilityRole="button"
            accessibilityLabel={`AI audit record. ${CATEGORY_LABELS[record.category] || record.category}. Confidence ${record.confidenceScore}%. Status: ${statusConfig.label}`}
            accessibilityState={{ expanded: isExpanded }}
            accessibilityHint={isExpanded ? "Double tap to collapse" : "Double tap to expand details"}
            style={styles.accordionHeader}
          >
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.categoryRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: confidenceColor + "15" }]}>
                    <ThemedText style={[styles.categoryBadgeText, { color: confidenceColor }]}>
                      {CATEGORY_LABELS[record.category] || record.category}
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "15" }]}>
                    <Feather name={statusConfig.icon} size={10} color={statusConfig.color} accessibilityElementsHidden />
                    <ThemedText style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.timestampText, { color: colors.textSecondary }]}>
                  {new Date(record.timestamp).toLocaleString()}
                </ThemedText>
              </View>

              <ExplainabilityTooltip
                insights={record.explainabilityFactors.map(
                  (f) => `${f.factor} (${Math.round(f.weight * 100)}% weight, ${f.direction})`
                )}
              >
                <ConfidenceGauge score={record.confidenceScore} />
              </ExplainabilityTooltip>
            </View>

            <ThemedText style={[styles.summaryText, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
              {record.aiSummary}
            </ThemedText>

            <View style={styles.modelRow}>
              <Feather name="cpu" size={11} color={colors.textSecondary} accessibilityElementsHidden />
              <ThemedText style={[styles.modelText, { color: colors.textSecondary }]}>{record.modelVersion}</ThemedText>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} accessibilityElementsHidden />
            </View>
          </Pressable>

          {isExpanded ? (
            <View style={[styles.expandedContent, { borderTopColor: borderColor }]}>
              <View style={styles.actionRow}>
                <Pressable
                  testID={`source-btn-${record.id}`}
                  style={[styles.actionButton, { backgroundColor: colors.info + "15" }]}
                  onPress={() => openSourceModal(record.sourceReferences)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${record.sourceReferences.length} source references`}
                >
                  <Feather name="link" size={14} color={colors.info} accessibilityElementsHidden />
                  <ThemedText style={[styles.actionButtonText, { color: colors.info }]}>
                    Source ({record.sourceReferences.length})
                  </ThemedText>
                </Pressable>

                <Pressable
                  testID={`why-btn-${record.id}`}
                  style={[styles.actionButton, { backgroundColor: "#8B5CF6" + "15" }]}
                  onPress={() => {
                    animateLayout();
                    setShowWhyTooltip(showingWhyTooltip ? null : record.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Show explainability factors"
                >
                  <Feather name="help-circle" size={14} color="#8B5CF6" accessibilityElementsHidden />
                  <ThemedText style={[styles.actionButtonText, { color: "#8B5CF6" }]}>Why?</ThemedText>
                </Pressable>

                {record.verificationStatus === "pending" ? (
                  <>
                    <Pressable
                      testID={`verify-btn-${record.id}`}
                      style={[styles.actionButton, { backgroundColor: colors.success + "15" }]}
                      onPress={() => verifyMutation.mutate(record.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Verify this AI output"
                    >
                      <Feather name="check" size={14} color={colors.success} accessibilityElementsHidden />
                      <ThemedText style={[styles.actionButtonText, { color: colors.success }]}>Verify</ThemedText>
                    </Pressable>
                    <Pressable
                      testID={`flag-btn-${record.id}`}
                      style={[styles.actionButton, { backgroundColor: colors.error + "15" }]}
                      onPress={() => openFlagModal(record.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Flag this AI output for review"
                    >
                      <Feather name="flag" size={14} color={colors.error} accessibilityElementsHidden />
                      <ThemedText style={[styles.actionButtonText, { color: colors.error }]}>Flag</ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    testID={`reset-btn-${record.id}`}
                    style={[styles.actionButton, { backgroundColor: colors.textSecondary + "15" }]}
                    onPress={() => resetMutation.mutate(record.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Reset verification status"
                  >
                    <Feather name="rotate-ccw" size={14} color={colors.textSecondary} accessibilityElementsHidden />
                    <ThemedText style={[styles.actionButtonText, { color: colors.textSecondary }]}>Reset</ThemedText>
                  </Pressable>
                )}
              </View>

              {showingWhyTooltip ? (
                <View style={[styles.whyTooltip, { backgroundColor: detailBg, borderColor }]} accessibilityRole="list" accessibilityLabel="Explainability factors">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm }}>
                    <Feather name="zap" size={14} color="#8B5CF6" accessibilityElementsHidden />
                    <ThemedText style={[styles.whyTitle, { color: colors.text }]}>Top Contributing Factors</ThemedText>
                  </View>
                  {record.explainabilityFactors.map((factor, fi) => {
                    const barWidth = Math.round(factor.weight * 100);
                    const factorColor = factor.direction === "negative" ? colors.success : factor.direction === "moderate" ? colors.warning : colors.error;
                    return (
                      <View key={fi} style={styles.factorRow} accessibilityRole={"text" as any} accessibilityLabel={`${factor.factor}, weight ${barWidth}%`}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={[styles.factorName, { color: colors.text }]}>{factor.factor}</ThemedText>
                          <View style={[styles.factorBarContainer, { backgroundColor: colors.border }]}>
                            <View style={[styles.factorBar, { width: `${barWidth}%`, backgroundColor: factorColor }]} />
                          </View>
                        </View>
                        <ThemedText style={[styles.factorWeight, { color: factorColor }]}>{barWidth}%</ThemedText>
                      </View>
                    );
                  })}
                  <ThemedText style={[styles.whyDisclaimer, { color: colors.textSecondary }]}>
                    SHAP-based feature attribution. Weights indicate relative influence on prediction.
                  </ThemedText>
                </View>
              ) : null}

              {record.verificationStatus === "verified" && record.verifiedBy ? (
                <View style={[styles.verificationInfo, { backgroundColor: colors.success + "08", borderColor: colors.success + "20" }]}>
                  <Feather name="user-check" size={14} color={colors.success} accessibilityElementsHidden />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.verifiedByText, { color: colors.success }]}>
                      Verified by {record.verifiedBy}
                    </ThemedText>
                    {record.verifiedAt ? (
                      <ThemedText style={[styles.verifiedAtText, { color: colors.textSecondary }]}>
                        {new Date(record.verifiedAt).toLocaleString()}
                      </ThemedText>
                    ) : null}
                    {record.feedbackNotes ? (
                      <ThemedText style={[styles.feedbackText, { color: colors.text }]}>
                        {record.feedbackNotes}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {record.verificationStatus === "flagged" ? (
                <View style={[styles.verificationInfo, { backgroundColor: colors.error + "08", borderColor: colors.error + "20" }]}>
                  <Feather name="alert-circle" size={14} color={colors.error} accessibilityElementsHidden />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.verifiedByText, { color: colors.error }]}>
                      Flagged by {record.verifiedBy}
                    </ThemedText>
                    {record.flagReason ? (
                      <ThemedText style={[styles.flagReasonText, { color: colors.text }]}>
                        Reason: {record.flagReason}
                      </ThemedText>
                    ) : null}
                    {record.feedbackNotes ? (
                      <ThemedText style={[styles.feedbackText, { color: colors.text }]}>
                        RLHF Feedback: {record.feedbackNotes}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.headerSection} accessibilityRole="header">
          <View style={[styles.headerIconContainer, { backgroundColor: "#3B82F620" }]} accessibilityElementsHidden>
            <Feather name="shield" size={28} color="#3B82F6" />
          </View>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Clinical AI Audit</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Confidence scoring, source grounding, and human-in-the-loop verification
          </ThemedText>
        </View>

        {isLoading ? (
          <AuditSkeleton cardBg={cardBg} reducedMotion={reducedMotion} />
        ) : (
          <>
            {stats ? (
              <View style={styles.statsRow}>
                {renderStatCard(stats.total, "Total", colors.info, 0)}
                {renderStatCard(stats.verified, "Verified", colors.success, 1)}
                {renderStatCard(stats.flagged, "Flagged", colors.error, 2)}
                {renderStatCard(`${stats.avgConfidence}%`, "Avg Conf.", "#8B5CF6", 3)}
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContainer}>
              {FILTER_OPTIONS.map((opt) => {
                const isActive = filter === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    testID={`filter-${opt.key}`}
                    style={[
                      styles.filterChip,
                      { backgroundColor: isActive ? colors.info + "20" : detailBg },
                      isHighContrast && isActive ? { borderWidth: 2, borderColor: colors.info } : null,
                    ]}
                    onPress={() => setFilter(opt.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`Filter: ${opt.label}`}
                  >
                    <Feather name={opt.icon} size={13} color={isActive ? colors.info : colors.textSecondary} accessibilityElementsHidden />
                    <ThemedText style={[styles.filterText, { color: isActive ? colors.info : colors.textSecondary }]}>{opt.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ThemedText style={[styles.resultCount, { color: colors.textSecondary }]}>
              {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
            </ThemedText>

            {filteredRecords.map((record, index) => renderAuditCard(record, index))}

            <View style={[styles.disclaimerCard, { borderColor: colors.info + "30", backgroundColor: detailBg }]} accessibilityRole="text">
              <Feather name="info" size={14} color={colors.info} accessibilityElementsHidden />
              <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                All AI outputs are subject to clinician review. Flagged items feed into the RLHF pipeline for model improvement. Confidence scores are computed via Med-Gemini calibrated uncertainty estimation.
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showSourceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: isDark ? "#1a1a1a" : "#FFFFFF" }]}>
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Source References</ThemedText>
            <Pressable
              testID="close-source-modal"
              onPress={() => setShowSourceModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Close source references"
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ThemedText style={[styles.sourceExplanation, { color: colors.textSecondary }]}>
              These are the exact clinical records the AI grounded its summary on. Highlighted text shows the specific data points used.
            </ThemedText>
            {selectedSources.map((source, index) => (
              <View key={index} style={[styles.sourceCard, { backgroundColor: cardBg, borderColor, borderWidth: 1 }]}>
                <View style={styles.sourceHeaderRow}>
                  <View style={[styles.sourceSystemBadge, { backgroundColor: colors.info + "15" }]}>
                    <Feather name="database" size={12} color={colors.info} accessibilityElementsHidden />
                    <ThemedText style={[styles.sourceSystemText, { color: colors.info }]}>{source.sourceSystem}</ThemedText>
                  </View>
                  <ThemedText style={[styles.sourceDocId, { color: colors.textSecondary }]}>{source.documentId}</ThemedText>
                </View>
                <View style={[styles.sourceExcerptBox, { backgroundColor: isDark ? "#1a2332" : "#FFF7ED", borderColor: colors.warning + "30" }]}>
                  <ThemedText style={[styles.sourceExcerptLabel, { color: colors.warning }]}>GROUNDED EXCERPT</ThemedText>
                  <ThemedText style={[styles.sourceExcerptText, { color: colors.text }]}>
                    {source.excerpt.substring(0, source.highlightRange.start)}
                    <ThemedText style={[styles.highlightedText, { backgroundColor: colors.warning + "30", color: colors.text }]}>
                      {source.excerpt.substring(source.highlightRange.start, source.highlightRange.end)}
                    </ThemedText>
                    {source.excerpt.substring(source.highlightRange.end)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showFlagModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFlagModal(false)}
      >
        <View style={styles.flagModalOverlay}>
          <View style={[styles.flagModalContent, { backgroundColor: isDark ? "#1a1a1a" : "#FFFFFF" }]}>
            <ThemedText style={[styles.flagModalTitle, { color: colors.text }]}>Flag AI Output</ThemedText>
            <ThemedText style={[styles.flagModalSubtitle, { color: colors.textSecondary }]}>
              Your feedback will be used for RLHF (reinforcement learning from human feedback) to improve future model accuracy.
            </ThemedText>
            <TextInput
              testID="flag-reason-input"
              style={[styles.flagInput, { backgroundColor: detailBg, color: colors.text, borderColor }]}
              placeholder="Describe what the AI got wrong..."
              placeholderTextColor={colors.textSecondary}
              value={flagReason}
              onChangeText={setFlagReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.flagModalActions}>
              <Pressable
                testID="cancel-flag-btn"
                style={[styles.flagCancelButton, { borderColor }]}
                onPress={() => setShowFlagModal(false)}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.flagCancelText, { color: colors.textSecondary }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                testID="submit-flag-btn"
                style={[styles.flagSubmitButton, { backgroundColor: colors.error, opacity: flagReason.trim().length > 0 ? 1 : 0.5 }]}
                onPress={() => {
                  if (flagTargetId && flagReason.trim()) {
                    flagMutation.mutate({ id: flagTargetId, reason: flagReason.trim() });
                  }
                }}
                disabled={flagReason.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel="Submit flag with feedback"
              >
                <Feather name="flag" size={14} color="#FFFFFF" accessibilityElementsHidden />
                <ThemedText style={styles.flagSubmitText}>Submit Flag</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  headerSection: { alignItems: "center", marginBottom: Spacing.lg },
  headerIconContainer: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", marginTop: Spacing.sm },
  headerSubtitle: { fontSize: 14, textAlign: "center", marginTop: Spacing.xs, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }, android: { elevation: 1 } }),
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  filterScroll: { marginBottom: Spacing.md },
  filterContainer: { gap: Spacing.xs },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    minHeight: 36,
  },
  filterText: { fontSize: 13, fontWeight: "600" },
  resultCount: { fontSize: 12, marginBottom: Spacing.sm },
  accordionHeader: { minHeight: 44 },
  auditCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: Spacing.sm },
  categoryRow: { flexDirection: "row", gap: Spacing.xs, flexWrap: "wrap", marginBottom: 4 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.xs },
  categoryBadgeText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.xs },
  statusBadgeText: { fontSize: 10, fontWeight: "600" },
  timestampText: { fontSize: 11 },
  summaryText: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  modelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  modelText: { fontSize: 11, flex: 1 },
  expandedContent: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.md },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    minHeight: 36,
  },
  actionButtonText: { fontSize: 12, fontWeight: "600" },
  whyTooltip: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: Spacing.md },
  whyTitle: { fontSize: 13, fontWeight: "700" },
  factorRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  factorName: { fontSize: 12, marginBottom: 3 },
  factorBarContainer: { height: 6, borderRadius: 3, width: "100%" },
  factorBar: { height: 6, borderRadius: 3 },
  factorWeight: { fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
  whyDisclaimer: { fontSize: 10, marginTop: Spacing.xs, fontStyle: "italic" },
  verificationInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  verifiedByText: { fontSize: 12, fontWeight: "600" },
  verifiedAtText: { fontSize: 11, marginTop: 2 },
  feedbackText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  flagReasonText: { fontSize: 12, lineHeight: 18, marginTop: 4, fontStyle: "italic" },
  disclaimerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalCloseButton: { padding: Spacing.xs, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  modalContent: { padding: Spacing.lg },
  sourceExplanation: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.lg },
  sourceCard: { borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.md },
  sourceHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  sourceSystemBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.xs },
  sourceSystemText: { fontSize: 12, fontWeight: "600" },
  sourceDocId: { fontSize: 10, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  sourceExcerptBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1 },
  sourceExcerptLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  sourceExcerptText: { fontSize: 13, lineHeight: 20 },
  highlightedText: { fontWeight: "600" },
  flagModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.xl },
  flagModalContent: { borderRadius: BorderRadius.lg, padding: Spacing.xl },
  flagModalTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.xs },
  flagModalSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: Spacing.lg },
  flagInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
  flagModalActions: { flexDirection: "row", gap: Spacing.sm },
  flagCancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  flagCancelText: { fontSize: 14, fontWeight: "600" },
  flagSubmitButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 44,
  },
  flagSubmitText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
});
