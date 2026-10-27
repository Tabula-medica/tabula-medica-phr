import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MatchCandidate {
  id: string;
  sourceRecordId: string;
  targetRecordId: string;
  matchScore: number;
  matchedFields: {
    field: string;
    sourceValue: string;
    targetValue: string;
    similarity: number;
  }[];
  sourceRecord: {
    id: string;
    title: string;
    type: string;
    date: string;
    provider?: string;
    facility?: string;
  };
  targetRecord: {
    id: string;
    title: string;
    type: string;
    date: string;
    provider?: string;
    facility?: string;
  };
  status: "pending" | "merged" | "rejected" | "deferred";
  createdAt: string;
}

interface PatientMatchReviewProps {
  candidates: MatchCandidate[];
  onReviewComplete?: () => void;
}

export default function PatientMatchReview({ 
  candidates, 
  onReviewComplete 
}: PatientMatchReviewProps) {
  const { theme: colors } = useTheme();
  const queryClient = useQueryClient();
  const [selectedCandidate, setSelectedCandidate] = useState<MatchCandidate | null>(null);
  const [showModal, setShowModal] = useState(false);

  const mergeRecordsMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await apiRequest("POST", `/api/deduplication/merge/${candidateId}`);
      return await res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medical-journey"] });
      setShowModal(false);
      setSelectedCandidate(null);
      onReviewComplete?.();
    },
  });

  const rejectMergeMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await apiRequest("POST", `/api/deduplication/reject/${candidateId}`);
      return await res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/candidates"] });
      setShowModal(false);
      setSelectedCandidate(null);
      onReviewComplete?.();
    },
  });

  const deferReviewMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await apiRequest("POST", `/api/deduplication/defer/${candidateId}`);
      return await res.json();
    },
    onSuccess: () => {
      Haptics.selectionAsync();
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/candidates"] });
      setShowModal(false);
      setSelectedCandidate(null);
    },
  });

  const pendingCandidates = candidates.filter(c => 
    c.status === "pending" && c.matchScore >= 80 && c.matchScore < 95
  );

  if (pendingCandidates.length === 0) {
    return null;
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return colors.success;
    if (score >= 85) return colors.warning;
    return "#f59e0b";
  };

  const handleOpenReview = (candidate: MatchCandidate) => {
    setSelectedCandidate(candidate);
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const isProcessing = 
    mergeRecordsMutation.isPending || 
    rejectMergeMutation.isPending || 
    deferReviewMutation.isPending;

  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(200)}
        style={[styles.container, { backgroundColor: colors.warning + "15", borderColor: colors.warning }]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.alertIcon, { backgroundColor: colors.warning + "20" }]}>
              <Feather name="alert-triangle" size={18} color={colors.warning} />
            </View>
            <View>
              <ThemedText style={[styles.title, { color: colors.text }]}>
                Patient Safety Review Required
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                {pendingCandidates.length} potential duplicate{pendingCandidates.length !== 1 ? "s" : ""} detected
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.candidateList}>
          {pendingCandidates.slice(0, 3).map((candidate) => (
            <Pressable
              key={candidate.id}
              onPress={() => handleOpenReview(candidate)}
              style={[styles.candidateCard, { backgroundColor: colors.backgroundSecondary }]}
            >
              <View style={styles.candidateInfo}>
                <ThemedText style={[styles.candidateTitle, { color: colors.text }]} numberOfLines={1}>
                  {candidate.sourceRecord.title}
                </ThemedText>
                <View style={styles.candidateMeta}>
                  <ThemedText style={[styles.candidateDate, { color: colors.textSecondary }]}>
                    vs {candidate.targetRecord.title}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.scoreContainer}>
                <View style={[styles.scoreBadge, { backgroundColor: getMatchScoreColor(candidate.matchScore) + "20" }]}>
                  <ThemedText style={[styles.scoreText, { color: getMatchScoreColor(candidate.matchScore) }]}>
                    {Math.round(candidate.matchScore)}%
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textSecondary} />
              </View>
            </Pressable>
          ))}
        </View>

        {pendingCandidates.length > 3 ? (
          <ThemedText style={[styles.moreText, { color: colors.textSecondary }]}>
            +{pendingCandidates.length - 3} more to review
          </ThemedText>
        ) : null}
      </Animated.View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              Review Match
            </ThemedText>
            <Pressable onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>

          {selectedCandidate ? (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
              <View style={[styles.matchScoreCard, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={[styles.matchScoreLabel, { color: colors.textSecondary }]}>
                  Match Confidence
                </ThemedText>
                <View style={styles.matchScoreRow}>
                  <ThemedText style={[styles.matchScoreValue, { color: getMatchScoreColor(selectedCandidate.matchScore) }]}>
                    {Math.round(selectedCandidate.matchScore)}%
                  </ThemedText>
                  <ThemedText style={[styles.matchScoreHint, { color: colors.textSecondary }]}>
                    {selectedCandidate.matchScore >= 90 ? "High confidence" : 
                     selectedCandidate.matchScore >= 85 ? "Moderate confidence" : "Review carefully"}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.recordsComparison}>
                <View style={[styles.recordCard, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={[styles.recordBadge, { backgroundColor: colors.primary + "20" }]}>
                    <ThemedText style={[styles.recordBadgeText, { color: colors.primary }]}>
                      NEW RECORD
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.recordTitle, { color: colors.text }]}>
                    {selectedCandidate.sourceRecord.title}
                  </ThemedText>
                  <ThemedText style={[styles.recordMeta, { color: colors.textSecondary }]}>
                    {selectedCandidate.sourceRecord.type} • {new Date(selectedCandidate.sourceRecord.date).toLocaleDateString()}
                  </ThemedText>
                  {selectedCandidate.sourceRecord.provider ? (
                    <ThemedText style={[styles.recordProvider, { color: colors.textSecondary }]}>
                      {selectedCandidate.sourceRecord.provider}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.vsContainer}>
                  <View style={[styles.vsLine, { backgroundColor: colors.border }]} />
                  <View style={[styles.vsBadge, { backgroundColor: colors.backgroundSecondary }]}>
                    <ThemedText style={[styles.vsText, { color: colors.textSecondary }]}>VS</ThemedText>
                  </View>
                  <View style={[styles.vsLine, { backgroundColor: colors.border }]} />
                </View>

                <View style={[styles.recordCard, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={[styles.recordBadge, { backgroundColor: colors.success + "20" }]}>
                    <ThemedText style={[styles.recordBadgeText, { color: colors.success }]}>
                      EXISTING RECORD
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.recordTitle, { color: colors.text }]}>
                    {selectedCandidate.targetRecord.title}
                  </ThemedText>
                  <ThemedText style={[styles.recordMeta, { color: colors.textSecondary }]}>
                    {selectedCandidate.targetRecord.type} • {new Date(selectedCandidate.targetRecord.date).toLocaleDateString()}
                  </ThemedText>
                  {selectedCandidate.targetRecord.provider ? (
                    <ThemedText style={[styles.recordProvider, { color: colors.textSecondary }]}>
                      {selectedCandidate.targetRecord.provider}
                    </ThemedText>
                  ) : null}
                </View>
              </View>

              {selectedCandidate.matchedFields?.length > 0 ? (
                <View style={[styles.fieldsSection, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.fieldsSectionTitle, { color: colors.text }]}>
                    Matched Fields
                  </ThemedText>
                  {selectedCandidate.matchedFields.map((field, index) => (
                    <View key={index} style={styles.fieldRow}>
                      <ThemedText style={[styles.fieldName, { color: colors.textSecondary }]}>
                        {field.field}
                      </ThemedText>
                      <View style={styles.fieldValues}>
                        <ThemedText style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
                          {field.sourceValue}
                        </ThemedText>
                        <Feather name="arrow-right" size={12} color={colors.textSecondary} />
                        <ThemedText style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
                          {field.targetValue}
                        </ThemedText>
                      </View>
                      <View style={[styles.fieldSimilarity, { backgroundColor: getMatchScoreColor(field.similarity) + "20" }]}>
                        <ThemedText style={[styles.fieldSimilarityText, { color: getMatchScoreColor(field.similarity) }]}>
                          {Math.round(field.similarity)}%
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.actionButtons}>
                <Pressable
                  onPress={() => mergeRecordsMutation.mutate(selectedCandidate.id)}
                  disabled={isProcessing}
                  style={[styles.mergeButton, { backgroundColor: colors.success }]}
                >
                  {mergeRecordsMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="git-merge" size={18} color="#fff" />
                      <ThemedText style={styles.buttonText}>Merge Records</ThemedText>
                    </>
                  )}
                </Pressable>

                <View style={styles.secondaryButtons}>
                  <Pressable
                    onPress={() => rejectMergeMutation.mutate(selectedCandidate.id)}
                    disabled={isProcessing}
                    style={[styles.rejectButton, { backgroundColor: colors.error + "15", borderColor: colors.error }]}
                  >
                    {rejectMergeMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <>
                        <Feather name="x-circle" size={16} color={colors.error} />
                        <ThemedText style={[styles.secondaryButtonText, { color: colors.error }]}>
                          Not a Match
                        </ThemedText>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => deferReviewMutation.mutate(selectedCandidate.id)}
                    disabled={isProcessing}
                    style={[styles.deferButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  >
                    {deferReviewMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                      <>
                        <Feather name="clock" size={16} color={colors.textSecondary} />
                        <ThemedText style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                          Decide Later
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={[styles.safetyNote, { backgroundColor: colors.warning + "10" }]}>
                <Feather name="shield" size={16} color={colors.warning} />
                <ThemedText style={[styles.safetyNoteText, { color: colors.warning }]}>
                  Merging combines these records permanently. This action supports patient safety by preventing duplicate entries.
                </ThemedText>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
  },
  candidateList: {
    gap: Spacing.sm,
  },
  candidateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  candidateInfo: {
    flex: 1,
    gap: 2,
  },
  candidateTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  candidateMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  candidateDate: {
    fontSize: 12,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "600",
  },
  moreText: {
    fontSize: 12,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  matchScoreCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  matchScoreLabel: {
    fontSize: 12,
    textTransform: "uppercase",
  },
  matchScoreRow: {
    alignItems: "center",
    gap: 4,
  },
  matchScoreValue: {
    fontSize: 48,
    fontWeight: "700",
  },
  matchScoreHint: {
    fontSize: 13,
  },
  recordsComparison: {
    gap: Spacing.sm,
  },
  recordCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  recordBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  recordBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  recordMeta: {
    fontSize: 13,
  },
  recordProvider: {
    fontSize: 12,
  },
  vsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  vsLine: {
    flex: 1,
    height: 1,
  },
  vsBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  vsText: {
    fontSize: 12,
    fontWeight: "600",
  },
  fieldsSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  fieldsSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  fieldName: {
    width: 80,
    fontSize: 12,
  },
  fieldValues: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  fieldValue: {
    flex: 1,
    fontSize: 13,
  },
  fieldSimilarity: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  fieldSimilarityText: {
    fontSize: 10,
    fontWeight: "600",
  },
  actionButtons: {
    gap: Spacing.md,
  },
  mergeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  deferButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  safetyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  safetyNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
