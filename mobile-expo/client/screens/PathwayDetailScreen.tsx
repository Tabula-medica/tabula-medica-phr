import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

type PathwayDetailParams = {
  PathwayDetail: {
    assignmentId: string;
  };
};

interface PathwayStep {
  id: string;
  title: string;
  description: string | null;
  stepType: string;
  orderIndex: number;
  phase: number;
  phaseName: string | null;
  durationDays: number | null;
  isMandatory: boolean;
  isMilestone: boolean;
  educationalContent: any;
  taskInstructions: any;
  assessmentQuestions: any[];
  pointsReward: number;
}

interface StepProgress {
  id: string;
  stepId: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  dueDate: string | null;
  assessmentResponses: any;
  assessmentScore: number | null;
  patientNotes: string | null;
  pointsEarned: number;
  adaptedContent: any;
}

interface PathwayNudge {
  id: string;
  nudgeType: string;
  title: string;
  message: string;
  priority: string;
  readAt: string | null;
  createdAt: string;
}

interface AssignmentDetail {
  id: string;
  pathwayId: string;
  status: string;
  currentPhase: number;
  progressPercentage: number;
  adherenceScore: number;
  engagementScore: number;
  stepsCompleted: number;
  totalPointsEarned: number;
  startDate: string | null;
  expectedEndDate: string | null;
  pathway: {
    id: string;
    title: string;
    description: string;
    condition: string;
    category: string;
    targetDurationDays: number;
    totalSteps: number;
    difficultyLevel: string;
    outcomes: any[];
  };
  steps: PathwayStep[];
  stepProgress: StepProgress[];
  nudges: PathwayNudge[];
}

export default function PathwayDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProp<PathwayDetailParams, "PathwayDetail">>();
  const { assignmentId } = route.params;
  const { theme: colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStep, setSelectedStep] = useState<PathwayStep | null>(null);
  const [stepNotes, setStepNotes] = useState("");

  const { data: assignment, isLoading, refetch } = useQuery<AssignmentDetail>({
    queryKey: ["/api/pathway-assignments", assignmentId],
  });

  const updateProgress = useMutation({
    mutationFn: async ({ progressId, status, notes }: { progressId: string; status: string; notes?: string }) => {
      const res = await axiosInstance.patch(`/api/step-progress/${progressId}`, {
        status,
        patientNotes: notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathway-assignments", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/pathway-assignments"] });
      setSelectedStep(null);
      setStepNotes("");
    },
  });

  const markNudgeRead = useMutation({
    mutationFn: async (nudgeId: string) => {
      const res = await axiosInstance.patch(`/api/pathway-nudges/${nudgeId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pathway-assignments", assignmentId] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getStepProgress = (stepId: string): StepProgress | undefined => {
    return assignment?.stepProgress.find((p) => p.stepId === stepId);
  };

  const getStepStatusIcon = (status: string): keyof typeof Feather.glyphMap => {
    switch (status) {
      case "completed":
        return "check-circle";
      case "in_progress":
        return "clock";
      case "available":
        return "play-circle";
      case "missed":
        return "x-circle";
      case "skipped":
        return "skip-forward";
      default:
        return "lock";
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return colors.success;
      case "in_progress":
        return colors.primary;
      case "available":
        return colors.warning;
      case "missed":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStepTypeIcon = (stepType: string): keyof typeof Feather.glyphMap => {
    switch (stepType) {
      case "education":
        return "book-open";
      case "task":
        return "check-square";
      case "assessment":
        return "clipboard";
      case "appointment":
        return "calendar";
      case "medication":
        return "heart";
      case "monitoring":
        return "activity";
      case "lifestyle":
        return "sun";
      case "milestone":
        return "award";
      default:
        return "circle";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const handleStepAction = (step: PathwayStep) => {
    const progress = getStepProgress(step.id);
    if (!progress || progress.status === "locked") return;

    setSelectedStep(step);
    setStepNotes(progress.patientNotes || "");
  };

  const handleCompleteStep = () => {
    if (!selectedStep) return;
    const progress = getStepProgress(selectedStep.id);
    if (!progress) return;

    updateProgress.mutate({
      progressId: progress.id,
      status: "completed",
      notes: stepNotes,
    });
  };

  const handleStartStep = () => {
    if (!selectedStep) return;
    const progress = getStepProgress(selectedStep.id);
    if (!progress) return;

    updateProgress.mutate({
      progressId: progress.id,
      status: "in_progress",
    });
  };

  const groupedSteps = assignment?.steps.reduce((acc, step) => {
    const phase = step.phase || 1;
    if (!acc[phase]) {
      acc[phase] = { name: step.phaseName || `Phase ${phase}`, steps: [] };
    }
    acc[phase].steps.push(step);
    return acc;
  }, {} as Record<number, { name: string; steps: PathwayStep[] }>) || {};

  const unreadNudges = assignment?.nudges.filter((n) => !n.readAt) || [];

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading pathway details...
        </ThemedText>
      </ThemedView>
    );
  }

  if (!assignment) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Feather name="alert-circle" size={48} color={colors.error} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          Pathway not found
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.headerCard}>
          <ThemedText type="h2">{assignment.pathway.title}</ThemedText>
          <ThemedText style={[styles.conditionText, { color: colors.textSecondary }]}>
            {assignment.pathway.condition}
          </ThemedText>
          
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <ThemedText style={[styles.progressLabel, { color: colors.textSecondary }]}>
                Overall Progress
              </ThemedText>
              <ThemedText style={[styles.progressValue, { color: colors.primary }]}>
                {assignment.progressPercentage}%
              </ThemedText>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${assignment.progressPercentage}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <ThemedText style={styles.statValue}>{assignment.stepsCompleted}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Completed
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="heart" size={20} color={colors.primary} />
              <ThemedText style={styles.statValue}>{assignment.adherenceScore}%</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Adherence
              </ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: `${colors.warning}15` }]}>
              <Feather name="star" size={20} color={colors.warning} />
              <ThemedText style={styles.statValue}>{assignment.totalPointsEarned}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Points
              </ThemedText>
            </View>
          </View>
        </Card>

        {unreadNudges.length > 0 ? (
          <View style={styles.nudgesSection}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Notifications
            </ThemedText>
            {unreadNudges.map((nudge) => (
              <Card
                key={nudge.id}
                style={{
                  ...styles.nudgeCard,
                  borderLeftColor: nudge.priority === "high" ? colors.error : colors.primary,
                }}
              >
                <View style={styles.nudgeHeader}>
                  <Feather
                    name={nudge.nudgeType === "encouragement" ? "smile" : "bell"}
                    size={20}
                    color={nudge.priority === "high" ? colors.error : colors.primary}
                  />
                  <ThemedText type="h4" style={styles.nudgeTitle}>
                    {nudge.title}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.nudgeMessage, { color: colors.textSecondary }]}>
                  {nudge.message}
                </ThemedText>
                <Pressable
                  style={[styles.dismissButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => markNudgeRead.mutate(nudge.id)}
                >
                  <ThemedText style={[styles.dismissText, { color: colors.primary }]}>
                    Dismiss
                  </ThemedText>
                </Pressable>
              </Card>
            ))}
          </View>
        ) : null}

        <View style={styles.stepsSection}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Pathway Steps
          </ThemedText>

          {Object.entries(groupedSteps).map(([phase, { name, steps }]) => (
            <View key={phase} style={styles.phaseSection}>
              <View style={styles.phaseHeader}>
                <View style={[styles.phaseIndicator, { backgroundColor: colors.primary }]} />
                <ThemedText type="h4" style={styles.phaseName}>
                  {name}
                </ThemedText>
              </View>

              {steps.map((step) => {
                const progress = getStepProgress(step.id);
                const status = progress?.status || "locked";
                const isActionable = status === "available" || status === "in_progress";

                return (
                  <Pressable
                    key={step.id}
                    onPress={() => isActionable && handleStepAction(step)}
                    disabled={!isActionable}
                    style={({ pressed }) => [
                      styles.stepCard,
                      { backgroundColor: pressed && isActionable ? colors.backgroundSecondary : colors.backgroundDefault },
                      { borderColor: colors.border },
                    ]}
                    testID={`step-${step.id}`}
                  >
                    <View
                      style={[
                        styles.stepIcon,
                        { backgroundColor: `${getStepStatusColor(status)}20` },
                      ]}
                    >
                      <Feather
                        name={getStepTypeIcon(step.stepType)}
                        size={20}
                        color={getStepStatusColor(status)}
                      />
                    </View>

                    <View style={styles.stepContent}>
                      <View style={styles.stepTitleRow}>
                        <ThemedText
                          style={[
                            styles.stepTitle,
                            status === "locked" && { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {step.title}
                        </ThemedText>
                        {step.isMilestone ? (
                          <Feather name="award" size={16} color={colors.warning} />
                        ) : null}
                      </View>
                      <ThemedText
                        style={[styles.stepDescription, { color: colors.textSecondary }]}
                        numberOfLines={2}
                      >
                        {step.description || `${step.stepType} step`}
                      </ThemedText>
                      {progress?.dueDate ? (
                        <ThemedText style={[styles.stepDue, { color: colors.textSecondary }]}>
                          Due: {formatDate(progress.dueDate)}
                        </ThemedText>
                      ) : null}
                    </View>

                    <View style={styles.stepStatus}>
                      <Feather
                        name={getStepStatusIcon(status)}
                        size={24}
                        color={getStepStatusColor(status)}
                      />
                      {step.pointsReward > 0 && status !== "completed" ? (
                        <ThemedText style={[styles.pointsLabel, { color: colors.textSecondary }]}>
                          +{step.pointsReward}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedStep}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedStep(null)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">{selectedStep?.title}</ThemedText>
            <Pressable onPress={() => setSelectedStep(null)}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {selectedStep?.description}
            </ThemedText>

            {selectedStep?.educationalContent ? (
              <Card style={styles.contentCard}>
                <ThemedText type="h4">Educational Content</ThemedText>
                <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.sm }}>
                  {selectedStep.educationalContent.body || selectedStep.educationalContent.title}
                </ThemedText>
              </Card>
            ) : null}

            {selectedStep?.taskInstructions ? (
              <Card style={styles.contentCard}>
                <ThemedText type="h4">Task Instructions</ThemedText>
                <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.sm }}>
                  {selectedStep.taskInstructions.instructions}
                </ThemedText>
                {selectedStep.taskInstructions.frequency ? (
                  <ThemedText style={{ color: colors.primary, marginTop: Spacing.xs }}>
                    Frequency: {selectedStep.taskInstructions.frequency}
                  </ThemedText>
                ) : null}
              </Card>
            ) : null}

            <View style={styles.notesSection}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
                Your Notes
              </ThemedText>
              <TextInput
                style={[
                  styles.notesInput,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Add notes about this step..."
                placeholderTextColor={colors.textSecondary}
                multiline
                value={stepNotes}
                onChangeText={setStepNotes}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            {getStepProgress(selectedStep?.id || "")?.status === "available" ? (
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleStartStep}
                disabled={updateProgress.isPending}
              >
                {updateProgress.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="play" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.actionButtonText}>Start Step</ThemedText>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={handleCompleteStep}
                disabled={updateProgress.isPending}
              >
                {updateProgress.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.actionButtonText}>Mark Complete</ThemedText>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {},
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  conditionText: {
    fontSize: 14,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  progressSection: {
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    fontSize: 14,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
  },
  nudgesSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  nudgeCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
  },
  nudgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  nudgeTitle: {},
  nudgeMessage: {
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  dismissButton: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "500",
  },
  stepsSection: {},
  phaseSection: {
    marginBottom: Spacing.lg,
  },
  phaseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  phaseIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  phaseName: {},
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  stepContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  stepTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  stepDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  stepDue: {
    fontSize: 11,
    marginTop: 4,
  },
  stepStatus: {
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
  pointsLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  contentCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  notesSection: {
    marginTop: Spacing.lg,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
