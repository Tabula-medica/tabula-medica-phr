import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeIn, FadeInDown, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type ViewMode = "preview" | "edit";

interface NoteData {
  id: string;
  noteType: string;
  status: string;
  title: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  reviewOfSystems?: string;
  physicalExamination?: string;
  assessment?: string;
  plan?: string;
  fullNoteContent?: string;
  aiGeneratedContent?: any;
  createdAt: string;
  signedAt?: string;
}

interface ContextData {
  noteId: string;
  noteType: string;
  status: string;
  createdAt: string;
  qualityMetrics?: {
    completenessScore?: number;
    accuracyScore?: number;
    dataSourcesCited?: number;
    governanceCompliant?: boolean;
    phiFieldsRedacted?: number;
  };
  codeSuggestions?: Array<{ code: string; description: string; system: string }>;
  dataPoints: Array<{
    label: string;
    value: string;
    date?: string;
    type: string;
  }>;
}

export default function AIDocumentReviewScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProp<{ params: { noteId: string } }, "params">>();
  const { theme: colors, isDark } = useTheme();

  const noteId = route.params?.noteId;

  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [editedContent, setEditedContent] = useState("");
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: note, isLoading: noteLoading, refetch: refetchNote } = useQuery<NoteData>({
    queryKey: ["/api/clinical-documentation/notes", noteId],
    enabled: !!noteId,
  });

  const { data: contextData, isLoading: contextLoading } = useQuery<ContextData>({
    queryKey: [`/api/clinical-documentation/notes/${noteId}/context`],
    enabled: !!noteId && showContextPanel,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (hasEdits && editedContent) {
        body.finalizedContent = editedContent;
      }
      return apiRequest("POST", `/api/clinical-documentation/notes/${noteId}/approve`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes", noteId] });
      navigation.goBack();
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchNote();
    setRefreshing(false);
  }, [refetchNote]);

  const getFullContent = useCallback(() => {
    if (!note) return "";
    if (note.fullNoteContent) return note.fullNoteContent;
    const sections = [];
    if (note.title) sections.push(`# ${note.title}`);
    if (note.chiefComplaint) sections.push(`## Chief Complaint\n${note.chiefComplaint}`);
    if (note.historyOfPresentIllness) sections.push(`## History of Present Illness\n${note.historyOfPresentIllness}`);
    if (note.reviewOfSystems) sections.push(`## Review of Systems\n${note.reviewOfSystems}`);
    if (note.physicalExamination) sections.push(`## Physical Examination\n${note.physicalExamination}`);
    if (note.assessment) sections.push(`## Assessment\n${note.assessment}`);
    if (note.plan) sections.push(`## Plan\n${note.plan}`);
    return sections.join("\n\n");
  }, [note]);

  const handleSwitchToEdit = useCallback(() => {
    if (!hasEdits) {
      setEditedContent(getFullContent());
    }
    setViewMode("edit");
  }, [hasEdits, getFullContent]);

  const handleContentChange = useCallback((text: string) => {
    setEditedContent(text);
    setHasEdits(true);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return colors.warning;
      case "approved": case "signed": return colors.success;
      case "review": return colors.info;
      default: return colors.textSecondary;
    }
  };

  const getTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "lab": return "activity";
      case "vital": return "heart";
      case "medication": return "thermometer";
      case "appointment": return "calendar";
      default: return "file-text";
    }
  };

  if (noteLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading document...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!note) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color={colors.error} />
          <ThemedText style={[styles.errorText, { color: colors.error }]}>
            Document not found
          </ThemedText>
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
            testID="button-go-back"
          >
            <ThemedText style={{ color: "#FFFFFF" }}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const qualityMetrics = contextData?.qualityMetrics || (note.aiGeneratedContent as any)?.qualityMetrics;

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.sm }]}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.safetyBanner}>
        <View style={[styles.disclaimerBar, { backgroundColor: isDark ? "#7C3A1D" : "#FEF3C7" }]}>
          <Feather name="alert-triangle" size={16} color={isDark ? "#FBBF24" : "#B45309"} />
          <ThemedText style={[styles.disclaimerText, { color: isDark ? "#FDE68A" : "#92400E" }]}>
            AI-generated draft - Review thoroughly before approval. Not medical advice.
          </ThemedText>
        </View>
      </Animated.View>

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <ThemedText style={[styles.noteTitle, { color: colors.text }]} numberOfLines={1}>
            {note.title || "Untitled Note"}
          </ThemedText>
          <View style={styles.metaRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(note.status) + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(note.status) }]} />
              <ThemedText style={[styles.statusText, { color: getStatusColor(note.status) }]}>
                {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.noteType, { color: colors.textSecondary }]}>
              {note.noteType?.toUpperCase() || "NOTE"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setShowContextPanel(true)}
            testID="button-show-context"
          >
            <Feather name="sidebar" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.viewToggle}>
        <Pressable
          style={[
            styles.toggleBtn,
            viewMode === "preview" ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundSecondary },
          ]}
          onPress={() => setViewMode("preview")}
          testID="button-preview-mode"
        >
          <Feather name="eye" size={14} color={viewMode === "preview" ? "#FFFFFF" : colors.textSecondary} />
          <ThemedText
            style={[
              styles.toggleText,
              { color: viewMode === "preview" ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            Preview
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.toggleBtn,
            viewMode === "edit" ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundSecondary },
          ]}
          onPress={handleSwitchToEdit}
          testID="button-edit-mode"
        >
          <Feather name="edit-2" size={14} color={viewMode === "edit" ? "#FFFFFF" : colors.textSecondary} />
          <ThemedText
            style={[
              styles.toggleText,
              { color: viewMode === "edit" ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            Edit
          </ThemedText>
        </Pressable>
        {hasEdits ? (
          <View style={[styles.editBadge, { backgroundColor: colors.warning }]}>
            <ThemedText style={styles.editBadgeText}>Edited</ThemedText>
          </View>
        ) : null}
      </View>

      {qualityMetrics ? (
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <Card style={styles.qualityCard}>
            <View style={styles.qualityHeader}>
              <Feather name="bar-chart-2" size={14} color={colors.primary} />
              <ThemedText style={[styles.qualityTitle, { color: colors.text }]}>Quality Score</ThemedText>
            </View>
            <View style={styles.qualityMetrics}>
              {qualityMetrics.completenessScore != null ? (
                <View style={styles.metricItem}>
                  <ThemedText style={[styles.metricValue, { color: colors.primary }]}>
                    {Math.round(qualityMetrics.completenessScore * 100)}%
                  </ThemedText>
                  <ThemedText style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Complete
                  </ThemedText>
                </View>
              ) : null}
              {qualityMetrics.accuracyScore != null ? (
                <View style={styles.metricItem}>
                  <ThemedText style={[styles.metricValue, { color: colors.success }]}>
                    {Math.round(qualityMetrics.accuracyScore * 100)}%
                  </ThemedText>
                  <ThemedText style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Accuracy
                  </ThemedText>
                </View>
              ) : null}
              {qualityMetrics.dataSourcesCited != null ? (
                <View style={styles.metricItem}>
                  <ThemedText style={[styles.metricValue, { color: colors.info }]}>
                    {qualityMetrics.dataSourcesCited}
                  </ThemedText>
                  <ThemedText style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Sources
                  </ThemedText>
                </View>
              ) : null}
              {qualityMetrics.governanceCompliant != null ? (
                <View style={styles.metricItem}>
                  <Feather
                    name={qualityMetrics.governanceCompliant ? "check-circle" : "x-circle"}
                    size={20}
                    color={qualityMetrics.governanceCompliant ? colors.success : colors.error}
                  />
                  <ThemedText style={[styles.metricLabel, { color: colors.textSecondary }]}>
                    Compliant
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </Card>
        </Animated.View>
      ) : null}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        testID="scroll-document-content"
      >
        {viewMode === "preview" ? (
          <Animated.View entering={FadeIn.duration(200)}>
            {note.chiefComplaint ? (
              <SectionBlock title="Chief Complaint" content={note.chiefComplaint} colors={colors} icon="alert-circle" />
            ) : null}
            {note.historyOfPresentIllness ? (
              <SectionBlock title="History of Present Illness" content={note.historyOfPresentIllness} colors={colors} icon="clock" />
            ) : null}
            {note.reviewOfSystems ? (
              <SectionBlock title="Review of Systems" content={note.reviewOfSystems} colors={colors} icon="list" />
            ) : null}
            {note.physicalExamination ? (
              <SectionBlock title="Physical Examination" content={note.physicalExamination} colors={colors} icon="search" />
            ) : null}
            {note.assessment ? (
              <SectionBlock title="Assessment" content={note.assessment} colors={colors} icon="clipboard" />
            ) : null}
            {note.plan ? (
              <SectionBlock title="Plan" content={note.plan} colors={colors} icon="check-square" />
            ) : null}
            {!note.chiefComplaint && !note.assessment && note.fullNoteContent ? (
              <SectionBlock title="Document Content" content={note.fullNoteContent} colors={colors} icon="file-text" />
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)}>
            <TextInput
              style={[
                styles.editArea,
                {
                  color: colors.text,
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}
              value={editedContent}
              onChangeText={handleContentChange}
              multiline
              textAlignVertical="top"
              placeholder="Edit document content..."
              placeholderTextColor={colors.textSecondary}
              testID="input-document-edit"
            />
          </Animated.View>
        )}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.backgroundDefault,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + Spacing.sm,
          },
        ]}
      >
        {note.status === "draft" || note.status === "review" ? (
          <View style={styles.bottomActions}>
            <Pressable
              style={[styles.actionBtn, styles.rejectBtn, { borderColor: colors.error }]}
              onPress={() => navigation.goBack()}
              testID="button-discard"
            >
              <Feather name="x" size={16} color={colors.error} />
              <ThemedText style={[styles.actionBtnText, { color: colors.error }]}>
                Discard
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.success }]}
              onPress={() => setShowApproveConfirm(true)}
              disabled={approveMutation.isPending}
              testID="button-approve"
            >
              {approveMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <ThemedText style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
                    Approve & Sign
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.bottomActions}>
            <View style={[styles.signedBadge, { backgroundColor: colors.success + "20" }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <ThemedText style={[styles.signedText, { color: colors.success }]}>
                Approved & Signed
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={showApproveConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowApproveConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
            <View style={[styles.modalIcon, { backgroundColor: colors.success + "20" }]}>
              <Feather name="check-circle" size={32} color={colors.success} />
            </View>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              Approve Document?
            </ThemedText>
            <ThemedText style={[styles.modalDesc, { color: colors.textSecondary }]}>
              By approving, you confirm that you have reviewed this AI-generated draft and accept responsibility for its clinical accuracy.
              {hasEdits ? " Your edits will be saved." : ""}
            </ThemedText>
            <View style={[styles.disclaimerBox, { backgroundColor: isDark ? "#7C3A1D" : "#FEF3C7" }]}>
              <Feather name="info" size={14} color={isDark ? "#FBBF24" : "#B45309"} />
              <ThemedText style={[styles.disclaimerBoxText, { color: isDark ? "#FDE68A" : "#92400E" }]}>
                This document was generated by AI and should not replace clinical judgment.
              </ThemedText>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => setShowApproveConfirm(false)}
                testID="button-cancel-approve"
              >
                <ThemedText style={{ color: colors.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.success }]}
                onPress={() => {
                  setShowApproveConfirm(false);
                  approveMutation.mutate();
                }}
                testID="button-confirm-approve"
              >
                {approveMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={{ color: "#FFFFFF" }}>Approve & Sign</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showContextPanel}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContextPanel(false)}
      >
        <View style={styles.contextOverlay}>
          <Pressable style={styles.contextBackdrop} onPress={() => setShowContextPanel(false)} />
          <Animated.View
            entering={FadeInRight.duration(300)}
            style={[
              styles.contextPanel,
              {
                backgroundColor: colors.backgroundDefault,
                paddingTop: insets.top + Spacing.md,
                paddingBottom: insets.bottom + Spacing.md,
              },
            ]}
          >
            <View style={styles.contextHeader}>
              <ThemedText style={[styles.contextTitle, { color: colors.text }]}>
                Clinical Context
              </ThemedText>
              <Pressable onPress={() => setShowContextPanel(false)} testID="button-close-context">
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {contextLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : contextData ? (
              <ScrollView style={styles.contextScroll} showsVerticalScrollIndicator={false}>
                {contextData.qualityMetrics ? (
                  <Card style={styles.contextCard}>
                    <ThemedText style={[styles.contextSectionTitle, { color: colors.text }]}>
                      Quality Metrics
                    </ThemedText>
                    {contextData.qualityMetrics.completenessScore != null ? (
                      <ContextRow
                        label="Completeness"
                        value={`${Math.round(contextData.qualityMetrics.completenessScore * 100)}%`}
                        colors={colors}
                      />
                    ) : null}
                    {contextData.qualityMetrics.accuracyScore != null ? (
                      <ContextRow
                        label="Accuracy"
                        value={`${Math.round(contextData.qualityMetrics.accuracyScore * 100)}%`}
                        colors={colors}
                      />
                    ) : null}
                    {contextData.qualityMetrics.phiFieldsRedacted != null ? (
                      <ContextRow
                        label="PHI Fields Redacted"
                        value={String(contextData.qualityMetrics.phiFieldsRedacted)}
                        colors={colors}
                      />
                    ) : null}
                  </Card>
                ) : null}

                {contextData.codeSuggestions && contextData.codeSuggestions.length > 0 ? (
                  <Card style={styles.contextCard}>
                    <ThemedText style={[styles.contextSectionTitle, { color: colors.text }]}>
                      Suggested Codes
                    </ThemedText>
                    {contextData.codeSuggestions.map((code, i) => (
                      <View key={i} style={[styles.codeRow, { borderBottomColor: colors.border }]}>
                        <View style={[styles.codeBadge, { backgroundColor: colors.primary + "20" }]}>
                          <ThemedText style={[styles.codeText, { color: colors.primary }]}>
                            {code.code}
                          </ThemedText>
                        </View>
                        <ThemedText style={[styles.codeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                          {code.description}
                        </ThemedText>
                      </View>
                    ))}
                  </Card>
                ) : null}

                {contextData.dataPoints.length > 0 ? (
                  <>
                    {["lab", "vital", "medication", "appointment"].map((type) => {
                      const items = contextData.dataPoints.filter((d) => d.type === type);
                      if (items.length === 0) return null;
                      const typeLabels: Record<string, string> = {
                        lab: "Recent Labs",
                        vital: "Recent Vitals",
                        medication: "Active Medications",
                        appointment: "Upcoming Appointments",
                      };
                      return (
                        <Card key={type} style={styles.contextCard}>
                          <View style={styles.contextCardHeader}>
                            <Feather name={getTypeIcon(type)} size={14} color={colors.primary} />
                            <ThemedText style={[styles.contextSectionTitle, { color: colors.text }]}>
                              {typeLabels[type]}
                            </ThemedText>
                          </View>
                          {items.map((item, i) => (
                            <View key={i} style={[styles.dataPointRow, { borderBottomColor: colors.border }]}>
                              <ThemedText style={[styles.dataPointLabel, { color: colors.text }]}>
                                {item.label}
                              </ThemedText>
                              <ThemedText style={[styles.dataPointValue, { color: colors.textSecondary }]} numberOfLines={1}>
                                {item.value}
                              </ThemedText>
                            </View>
                          ))}
                        </Card>
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.emptyContext}>
                    <Feather name="inbox" size={32} color={colors.textSecondary} />
                    <ThemedText style={[styles.emptyContextText, { color: colors.textSecondary }]}>
                      No clinical context data available
                    </ThemedText>
                  </View>
                )}
              </ScrollView>
            ) : null}
          </Animated.View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function SectionBlock({
  title,
  content,
  colors,
  icon,
}: {
  title: string;
  content: string;
  colors: any;
  icon: keyof typeof Feather.glyphMap;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(250)}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + "15" }]}>
            <Feather name={icon} size={14} color={colors.primary} />
          </View>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{title}</ThemedText>
        </View>
        <ThemedText style={[styles.sectionContent, { color: colors.text }]}>{content}</ThemedText>
      </Card>
    </Animated.View>
  );
}

function ContextRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.contextRow}>
      <ThemedText style={[styles.contextLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
      <ThemedText style={[styles.contextValue, { color: colors.text }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 15,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  safetyBanner: {
    paddingHorizontal: Spacing.md,
  },
  disclaimerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  disclaimerText: {
    fontSize: 12,
    flex: 1,
    fontWeight: "500",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  noteType: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    gap: 6,
    marginBottom: Spacing.xs,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  editBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  editBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  qualityCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  qualityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  qualityTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  qualityMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  metricItem: {
    alignItems: "center",
    gap: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  metricLabel: {
    fontSize: 11,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  sectionCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  editArea: {
    minHeight: 400,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bottomActions: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  rejectBtn: {
    borderWidth: 1.5,
  },
  approveBtn: {},
  actionBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  signedBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  signedText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    width: "100%",
  },
  disclaimerBoxText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  contextOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  contextBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  contextPanel: {
    width: "80%",
    maxWidth: 340,
    paddingHorizontal: Spacing.md,
  },
  contextHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  contextScroll: {
    flex: 1,
  },
  contextCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  contextCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  contextSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  contextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  contextLabel: {
    fontSize: 13,
  },
  contextValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  codeDesc: {
    flex: 1,
    fontSize: 12,
  },
  dataPointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dataPointLabel: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  dataPointValue: {
    fontSize: 12,
    maxWidth: "50%",
    textAlign: "right",
  },
  emptyContext: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: 8,
  },
  emptyContextText: {
    fontSize: 14,
  },
});
