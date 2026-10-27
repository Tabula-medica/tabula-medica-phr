import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Path, Circle, Line, G, Text as SvgText, Rect } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { LoadingState, BaseModal, FormInput, Button } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";
import { apiRequest } from "@/lib/query-client";

interface Milestone {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  targetUnit: string;
  isCompleted: boolean;
  completedAt: string | null;
  order: number;
}

interface GoalProgress {
  id: string;
  goalId: string;
  date: string;
  value: number;
  notes: string | null;
  isCompleted: boolean;
}

interface HealthGoal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  targetValue: number | null;
  targetUnit: string | null;
  frequency: string;
  startDate: string;
  endDate: string | null;
  isAiSuggested: boolean;
  aiRationale: string | null;
  status: string;
  currentStreak: number;
  longestStreak: number;
  progress?: GoalProgress[];
  stats?: { totalEntries: number; completedEntries: number; avgValue: number };
}

interface Feedback {
  message: string;
  tips: string[];
  encouragementLevel: string;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  exercise: { icon: "activity", color: "#10B981" },
  nutrition: { icon: "coffee", color: "#F97316" },
  medication: { icon: "heart", color: "#8B5CF6" },
  weight: { icon: "trending-down", color: "#0066CC" },
  sleep: { icon: "moon", color: "#6366F1" },
  mental_health: { icon: "smile", color: "#EC4899" },
  vitals: { icon: "thermometer", color: "#14B8A6" },
  custom: { icon: "target", color: "#6B7280" },
};

function ProgressChart({ data, targetValue, color, width, height }: {
  data: GoalProgress[];
  targetValue: number | null;
  color: string;
  width: number;
  height: number;
}) {
  if (data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <Feather name="bar-chart-2" size={32} color="#9CA3AF" />
        <ThemedText type="caption" style={{ color: "#9CA3AF", marginTop: 8 }}>No progress data yet</ThemedText>
      </View>
    );
  }

  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const values = sortedData.map(d => d.value);
  const maxVal = Math.max(...values, targetValue || 0) * 1.1;
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const padding = { top: 20, right: 16, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = sortedData.map((d, i) => {
    const x = padding.left + (i / Math.max(sortedData.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { x, y, value: d.value, date: d.date, isCompleted: d.isCompleted };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`
    : "";

  const targetY = targetValue
    ? padding.top + chartHeight - ((targetValue - minVal) / range) * chartHeight
    : null;

  const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)];

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {yLabels.map((label, i) => {
        const y = padding.top + chartHeight - (label / maxVal) * chartHeight;
        return (
          <G key={i}>
            <Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(0,0,0,0.1)" strokeWidth={1} strokeDasharray="4,4" />
            <SvgText x={padding.left - 8} y={y + 4} fontSize={10} fill="#9CA3AF" textAnchor="end">{label}</SvgText>
          </G>
        );
      })}

      {/* Target line */}
      {targetY !== null ? (
        <G>
          <Line x1={padding.left} y1={targetY} x2={width - padding.right} y2={targetY} stroke={color} strokeWidth={2} strokeDasharray="8,4" />
          <SvgText x={width - padding.right + 4} y={targetY + 4} fontSize={10} fill={color}>Target</SvgText>
        </G>
      ) : null}

      {/* Area fill */}
      <Path d={areaPath} fill={color} fillOpacity={0.1} />

      {/* Line */}
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={6} fill={p.isCompleted ? color : "#FFFFFF"} stroke={color} strokeWidth={2} />
        </G>
      ))}

      {/* X-axis labels */}
      {points.length <= 7 ? points.map((p, i) => {
        const date = new Date(p.date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        return (
          <SvgText key={i} x={p.x} y={height - 10} fontSize={10} fill="#9CA3AF" textAnchor="middle">{label}</SvgText>
        );
      }) : null}
    </Svg>
  );
}

function StatCard({ icon, value, label, color, isDark }: {
  icon: string;
  value: string | number;
  label: string;
  color: string;
  isDark: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <ThemedText type="h3">{value}</ThemedText>
      <ThemedText type="small" style={{ color: "#9CA3AF" }}>{label}</ThemedText>
    </View>
  );
}

export default function GoalDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { goalId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [showLogModal, setShowLogModal] = useState(false);
  const [logValue, setLogValue] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneValue, setNewMilestoneValue] = useState("");

  const { data: goal, isLoading } = useQuery<HealthGoal>({
    queryKey: ["/api/health-goals", goalId],
  });

  const { data: milestonesData, refetch: refetchMilestones } = useQuery<{ milestones: Milestone[] }>({
    queryKey: [`/api/health-goals/${goalId}/milestones`],
  });

  const { data: feedbackData, isLoading: feedbackLoading, refetch: fetchFeedback } = useQuery<{ feedback: Feedback; stats: any; streak: any }>({
    queryKey: ["/api/health-goals", goalId, "feedback"],
    enabled: false,
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: { title: string; targetValue: number; targetUnit: string }) => {
      const response = await apiRequest("POST", `/api/health-goals/${goalId}/milestones`, data);
      return response.json();
    },
    onSuccess: () => {
      refetchMilestones();
      setShowMilestoneModal(false);
      setNewMilestoneTitle("");
      setNewMilestoneValue("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, isCompleted }: { milestoneId: string; isCompleted: boolean }) => {
      const response = await apiRequest("PATCH", `/api/health-goals/${goalId}/milestones/${milestoneId}`, { isCompleted });
      return response.json();
    },
    onSuccess: () => {
      refetchMilestones();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const logProgressMutation = useMutation({
    mutationFn: async ({ value, notes }: { value: number; notes?: string }) => {
      const response = await axiosInstance.post(`/api/health-goals/${goalId}/progress`, { value, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals", goalId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals"] });
      setShowLogModal(false);
      setLogValue("");
      setLogNotes("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (data: Partial<HealthGoal>) => {
      const response = await axiosInstance.patch(`/api/health-goals/${goalId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals", goalId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleLogProgress = () => {
    if (!logValue) return;
    logProgressMutation.mutate({
      value: parseInt(logValue),
      notes: logNotes || undefined,
    });
  };

  const handlePauseResume = () => {
    if (!goal) return;
    const newStatus = goal.status === "active" ? "paused" : "active";
    updateGoalMutation.mutate({ status: newStatus });
  };

  const handleComplete = () => {
    Alert.alert(
      "Complete Goal",
      "Are you sure you want to mark this goal as completed?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Complete", onPress: () => updateGoalMutation.mutate({ status: "completed" }) },
      ]
    );
  };

  if (isLoading || !goal) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LoadingState message="Loading goal details..." fullScreen />
      </View>
    );
  }

  const config = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.custom;
  const completionRate = goal.stats && goal.stats.totalEntries > 0
    ? Math.round((goal.stats.completedEntries / goal.stats.totalEntries) * 100)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Goal Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.goalHeader}>
          <View style={[styles.categoryBadgeLarge, { backgroundColor: config.color + "20" }]}>
            <Feather name={config.icon as any} size={28} color={config.color} />
          </View>
          <ThemedText type="h2" style={{ marginTop: Spacing.md }}>{goal.title}</ThemedText>
          {goal.description ? (
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              {goal.description}
            </ThemedText>
          ) : null}
          <View style={styles.goalMeta}>
            <View style={styles.metaItem}>
              <Feather name="target" size={14} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {goal.targetValue} {goal.targetUnit} {goal.frequency}
              </ThemedText>
            </View>
            {goal.isAiSuggested ? (
              <View style={[styles.aiBadge, { backgroundColor: "#8B5CF620" }]}>
                <Feather name="cpu" size={12} color="#8B5CF6" />
                <ThemedText type="small" style={{ color: "#8B5CF6", marginLeft: 4 }}>AI Suggested</ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsGrid}>
          <StatCard icon="zap" value={goal.currentStreak} label="Current Streak" color="#F59E0B" isDark={isDark} />
          <StatCard icon="award" value={goal.longestStreak} label="Best Streak" color="#10B981" isDark={isDark} />
          <StatCard icon="check-circle" value={`${completionRate}%`} label="Completion" color={config.color} isDark={isDark} />
          <StatCard icon="bar-chart-2" value={goal.stats?.avgValue || 0} label="Average" color="#6366F1" isDark={isDark} />
        </Animated.View>

        {/* Progress Chart */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.chartSection, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Progress Over Time</ThemedText>
          <ProgressChart
            data={goal.progress || []}
            targetValue={goal.targetValue}
            color={config.color}
            width={340}
            height={200}
          />
        </Animated.View>

        {/* Milestones Section */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={[styles.milestonesSection, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
          <View style={styles.milestoneHeader}>
            <ThemedText type="h3">Milestones</ThemedText>
            <Pressable
              onPress={() => setShowMilestoneModal(true)}
              testID="button-add-milestone"
              style={[styles.addMilestoneBtn, { backgroundColor: `${config.color}15` }]}
            >
              <Feather name="plus" size={16} color={config.color} />
              <ThemedText type="small" style={{ color: config.color, marginLeft: 4, fontWeight: "600" }}>Add</ThemedText>
            </Pressable>
          </View>
          {(milestonesData?.milestones || []).length > 0 ? (
            <>
              <View style={styles.milestoneProgress}>
                <View style={[styles.milestoneProgressBg, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.milestoneProgressFill,
                      {
                        backgroundColor: config.color,
                        width: `${((milestonesData?.milestones || []).filter(m => m.isCompleted).length / Math.max((milestonesData?.milestones || []).length, 1)) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {(milestonesData?.milestones || []).filter(m => m.isCompleted).length} of {(milestonesData?.milestones || []).length} completed
                </ThemedText>
              </View>
              {(milestonesData?.milestones || []).map((milestone, index) => (
                <Pressable
                  key={milestone.id}
                  onPress={() => {
                    toggleMilestoneMutation.mutate({ milestoneId: milestone.id, isCompleted: !milestone.isCompleted });
                  }}
                  testID={`milestone-${index}`}
                  style={styles.milestoneItem}
                >
                  <Feather
                    name={milestone.isCompleted ? "check-circle" : "circle"}
                    size={20}
                    color={milestone.isCompleted ? "#10B981" : theme.textSecondary}
                  />
                  <View style={styles.milestoneItemInfo}>
                    <ThemedText
                      type="body"
                      style={milestone.isCompleted ? { textDecorationLine: "line-through", color: theme.textSecondary } : undefined}
                    >
                      {milestone.title}
                    </ThemedText>
                    {milestone.targetValue > 0 ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        Target: {milestone.targetValue} {milestone.targetUnit}
                      </ThemedText>
                    ) : null}
                  </View>
                  {milestone.completedAt ? (
                    <ThemedText type="small" style={{ color: "#10B981", fontSize: 10 }}>
                      {new Date(milestone.completedAt).toLocaleDateString()}
                    </ThemedText>
                  ) : null}
                </Pressable>
              ))}
            </>
          ) : (
            <View style={styles.emptyMilestones}>
              <Feather name="flag" size={24} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                Break your goal into milestones to track progress step by step
              </ThemedText>
            </View>
          )}
        </Animated.View>

        {/* AI Feedback Section */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={[styles.feedbackSection, { backgroundColor: isDark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.08)" }]}>
          <View style={styles.feedbackHeader}>
            <Feather name="message-circle" size={20} color="#8B5CF6" />
            <ThemedText type="h3" style={{ marginLeft: 8 }}>AI Coach</ThemedText>
          </View>
          {feedbackData?.feedback ? (
            <View>
              <ThemedText type="body" style={{ lineHeight: 22 }}>{feedbackData.feedback.message}</ThemedText>
              {feedbackData.feedback.tips?.length > 0 ? (
                <View style={styles.tipsContainer}>
                  {feedbackData.feedback.tips.map((tip, i) => (
                    <View key={i} style={styles.tipItem}>
                      <Feather name="check" size={14} color="#10B981" />
                      <ThemedText type="caption" style={{ marginLeft: 8, flex: 1 }}>{tip}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable onPress={() => fetchFeedback()} style={styles.getFeedbackButton}>
              {feedbackLoading ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <>
                  <Feather name="cpu" size={16} color="#8B5CF6" />
                  <ThemedText type="body" style={{ color: "#8B5CF6", marginLeft: 8 }}>Get Personalized Feedback</ThemedText>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>

        {/* Recent Progress */}
        {goal.progress && goal.progress.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.progressList}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Recent Entries</ThemedText>
            {goal.progress.slice(0, 5).map((entry) => (
              <View key={entry.id} style={[styles.progressEntry, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
                <View style={styles.progressEntryLeft}>
                  <Feather
                    name={entry.isCompleted ? "check-circle" : "circle"}
                    size={18}
                    color={entry.isCompleted ? "#10B981" : theme.textSecondary}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <ThemedText type="body">{entry.value} {goal.targetUnit}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {new Date(entry.date).toLocaleDateString()}
                    </ThemedText>
                  </View>
                </View>
                {entry.notes ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1, textAlign: "right" }} numberOfLines={1}>
                    {entry.notes}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </Animated.View>
        ) : null}

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.actionButtons}>
          <Button
            onPress={() => setShowLogModal(true)}
            icon="plus"
            fullWidth
            style={{ backgroundColor: config.color, marginBottom: Spacing.md }}
          >
            Log Progress
          </Button>
          <View style={styles.secondaryButtons}>
            <Button
              variant="outline"
              onPress={handlePauseResume}
              icon={goal.status === "active" ? "pause" : "play"}
              size="md"
              style={{ flex: 1, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}
            >
              {goal.status === "active" ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="outline"
              onPress={handleComplete}
              icon="check"
              size="md"
              style={{ flex: 1, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}
            >
              Complete
            </Button>
          </View>
        </Animated.View>

        {/* AI Rationale */}
        {goal.aiRationale ? (
          <Animated.View entering={FadeInDown.delay(600).duration(400)} style={[styles.rationaleSection, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 4 }}>Why this goal was suggested:</ThemedText>
            <ThemedText type="body" style={{ lineHeight: 20 }}>{goal.aiRationale}</ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      <BaseModal
        visible={showMilestoneModal}
        onClose={() => setShowMilestoneModal(false)}
        title="Add Milestone"
        scrollable={false}
        testID="modal-add-milestone"
      >
        <FormInput
          label="Milestone Title"
          testID="input-milestone-title"
          value={newMilestoneTitle}
          onChangeText={setNewMilestoneTitle}
          placeholder="e.g., Reach 5,000 steps consistently"
        />

        <FormInput
          label="Target Value (optional)"
          testID="input-milestone-value"
          value={newMilestoneValue}
          onChangeText={setNewMilestoneValue}
          placeholder="0"
          keyboardType="numeric"
        />

        <Button
          testID="button-save-milestone"
          onPress={() => {
            if (!newMilestoneTitle.trim()) return;
            createMilestoneMutation.mutate({
              title: newMilestoneTitle,
              targetValue: newMilestoneValue ? parseInt(newMilestoneValue) : 0,
              targetUnit: goal?.targetUnit || "",
            });
          }}
          disabled={createMilestoneMutation.isPending || !newMilestoneTitle.trim()}
          loading={createMilestoneMutation.isPending}
          fullWidth
          style={{ backgroundColor: config.color }}
        >
          Add Milestone
        </Button>
      </BaseModal>

      <BaseModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Log Progress"
        scrollable={false}
        testID="modal-log-progress"
      >
        <FormInput
          label={`Value ${goal.targetUnit ? `(${goal.targetUnit})` : ""}`}
          value={logValue}
          onChangeText={setLogValue}
          placeholder={goal.targetValue?.toString() || "0"}
          keyboardType="numeric"
        />

        <FormInput
          label="Notes (optional)"
          value={logNotes}
          onChangeText={setLogNotes}
          placeholder="How did it go?"
        />

        <Button
          onPress={handleLogProgress}
          disabled={logProgressMutation.isPending || !logValue}
          loading={logProgressMutation.isPending}
          fullWidth
          style={{ backgroundColor: config.color }}
        >
          Save Progress
        </Button>
      </BaseModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  goalHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  categoryBadgeLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  goalMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  chartSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  feedbackSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  tipsContainer: {
    marginTop: Spacing.md,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  getFeedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  progressList: {
    marginBottom: Spacing.lg,
  },
  progressEntry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  progressEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButtons: {
    marginBottom: Spacing.lg,
  },
  secondaryButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  rationaleSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  milestonesSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  addMilestoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  milestoneProgress: {
    marginBottom: Spacing.md,
  },
  milestoneProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  milestoneProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  milestoneItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  milestoneItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  emptyMilestones: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
});
