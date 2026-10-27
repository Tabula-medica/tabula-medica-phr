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
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { MetricCard, StatsGrid } from "@/components/MetricCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface DashboardWidget {
  id: string;
  widgetType: string;
  title: string;
  position: number;
  size: string;
  isVisible: boolean;
  settings: any;
}

interface DashboardInsights {
  aiInsights: {
    pendingCaseReviews: number;
    completedCaseReviews: number;
    recentReviews: any[];
  };
  pathwayProgress: {
    totalPatients: number;
    totalPathways: number;
    averageAdherence: number;
    byStatus: {
      active: number;
      completed: number;
      paused: number;
    };
  };
  adherenceSummary: {
    averageScore: number;
    atRisk: number;
    onTrack: number;
  };
}

interface ProviderTask {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  status: string;
  dueDate: string | null;
  patientId: string | null;
}

const WIDGET_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  quick_stats: "bar-chart-2",
  ai_insights: "cpu",
  pathway_progress: "trending-up",
  adherence_summary: "check-circle",
  case_review_alerts: "alert-circle",
  upcoming_tasks: "calendar",
  patient_alerts: "bell",
  recent_activity: "activity",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#6B7280",
  normal: "#3B82F6",
  high: "#F59E0B",
  urgent: "#EF4444",
};

export default function ProviderDashboardScreen() {
  const { theme } = useTheme();
  const colors = theme;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [newTaskType, setNewTaskType] = useState("follow_up");

  const { data: widgets = [], isLoading: loadingWidgets, refetch: refetchWidgets } = useQuery<DashboardWidget[]>({
    queryKey: ["/api/provider-dashboard/widgets"],
  });

  const { data: insights, isLoading: loadingInsights, refetch: refetchInsights } = useQuery<DashboardInsights>({
    queryKey: ["/api/provider-dashboard/insights"],
  });

  const { data: tasks = [], isLoading: loadingTasks, refetch: refetchTasks } = useQuery<ProviderTask[]>({
    queryKey: ["/api/provider-dashboard/tasks"],
  });

  const updateWidgetMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; isVisible?: boolean; position?: number }) => {
      const response = await axiosInstance.patch(`/api/provider-dashboard/widgets/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/widgets"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axiosInstance.post("/api/provider-dashboard/tasks", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/tasks"] });
      setShowAddTaskModal(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("normal");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string }) => {
      const response = await axiosInstance.patch(`/api/provider-dashboard/tasks/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/tasks"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchWidgets(), refetchInsights(), refetchTasks()]);
    setRefreshing(false);
  }, [refetchWidgets, refetchInsights, refetchTasks]);

  const visibleWidgets = widgets.filter(w => w.isVisible).sort((a, b) => a.position - b.position);
  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");

  const renderQuickStats = () => (
    <Animated.View entering={FadeInDown.delay(100)}>
      <StatsGrid>
        <MetricCard value={insights?.pathwayProgress.totalPatients || 0} label="Active Patients" icon="users" color={colors.primary} />
        <MetricCard value={insights?.pathwayProgress.totalPathways || 0} label="Care Pathways" icon="trending-up" color="#10B981" />
        <MetricCard value={insights?.aiInsights.pendingCaseReviews || 0} label="Pending Reviews" icon="alert-circle" color="#F59E0B" />
        <MetricCard value={`${insights?.adherenceSummary.averageScore || 0}%`} label="Avg Adherence" icon="check-circle" color="#8B5CF6" />
      </StatsGrid>
    </Animated.View>
  );

  const renderAIInsightsWidget = () => (
    <Animated.View entering={FadeInDown.delay(200)} style={[styles.widgetCard, { backgroundColor: colors.backgroundRootDefault }]}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Feather name="cpu" size={20} color={colors.primary} />
          <ThemedText style={[styles.widgetTitle, { color: colors.text }]}>AI Insights</ThemedText>
        </View>
      </View>

      <View style={styles.insightGrid}>
        <View style={[styles.insightItem, { borderColor: colors.border }]}>
          <ThemedText style={[styles.insightValue, { color: "#F59E0B" }]}>
            {insights?.aiInsights.pendingCaseReviews || 0}
          </ThemedText>
          <ThemedText style={[styles.insightLabel, { color: colors.textSecondary }]}>
            Pending Reviews
          </ThemedText>
        </View>
        <View style={[styles.insightItem, { borderColor: colors.border }]}>
          <ThemedText style={[styles.insightValue, { color: "#10B981" }]}>
            {insights?.aiInsights.completedCaseReviews || 0}
          </ThemedText>
          <ThemedText style={[styles.insightLabel, { color: colors.textSecondary }]}>
            Completed
          </ThemedText>
        </View>
      </View>

      {insights?.aiInsights.recentReviews && insights.aiInsights.recentReviews.length > 0 ? (
        <View style={styles.recentList}>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Recent Case Reviews
          </ThemedText>
          {insights.aiInsights.recentReviews.slice(0, 3).map((review: any, index: number) => (
            <View key={review.id || index} style={[styles.recentItem, { borderBottomColor: colors.border }]}>
              <View style={styles.recentItemContent}>
                <ThemedText style={[styles.recentItemTitle, { color: colors.text }]} numberOfLines={1}>
                  {review.primaryDiagnosis || "Case Review"}
                </ThemedText>
                <ThemedText style={[styles.recentItemMeta, { color: colors.textSecondary }]}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { 
                backgroundColor: review.status === "completed" ? "#10B981" + "20" : "#F59E0B" + "20" 
              }]}>
                <ThemedText style={[styles.statusText, { 
                  color: review.status === "completed" ? "#10B981" : "#F59E0B" 
                }]}>
                  {review.status}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );

  const renderPathwayProgressWidget = () => (
    <Animated.View entering={FadeInDown.delay(300)} style={[styles.widgetCard, { backgroundColor: colors.backgroundRootDefault }]}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Feather name="trending-up" size={20} color="#10B981" />
          <ThemedText style={[styles.widgetTitle, { color: colors.text }]}>Pathway Progress</ThemedText>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <View style={[styles.progressIndicator, { backgroundColor: "#10B981" }]} />
          <ThemedText style={[styles.progressLabel, { color: colors.text }]}>Active</ThemedText>
          <ThemedText style={[styles.progressValue, { color: colors.textSecondary }]}>
            {insights?.pathwayProgress.byStatus.active || 0}
          </ThemedText>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressIndicator, { backgroundColor: "#3B82F6" }]} />
          <ThemedText style={[styles.progressLabel, { color: colors.text }]}>Completed</ThemedText>
          <ThemedText style={[styles.progressValue, { color: colors.textSecondary }]}>
            {insights?.pathwayProgress.byStatus.completed || 0}
          </ThemedText>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressIndicator, { backgroundColor: "#6B7280" }]} />
          <ThemedText style={[styles.progressLabel, { color: colors.text }]}>Paused</ThemedText>
          <ThemedText style={[styles.progressValue, { color: colors.textSecondary }]}>
            {insights?.pathwayProgress.byStatus.paused || 0}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.adherenceBar, { backgroundColor: colors.backgroundRootDefault + "80" }]}>
        <View style={[styles.adherenceFill, { 
          width: `${insights?.pathwayProgress.averageAdherence || 0}%`,
          backgroundColor: colors.primary 
        }]} />
      </View>
      <ThemedText style={[styles.adherenceLabel, { color: colors.textSecondary }]}>
        Average Adherence: {insights?.pathwayProgress.averageAdherence || 0}%
      </ThemedText>
    </Animated.View>
  );

  const renderAdherenceSummaryWidget = () => (
    <Animated.View entering={FadeInDown.delay(400)} style={[styles.widgetCard, { backgroundColor: colors.backgroundRootDefault }]}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Feather name="check-circle" size={20} color="#8B5CF6" />
          <ThemedText style={[styles.widgetTitle, { color: colors.text }]}>Patient Adherence</ThemedText>
        </View>
      </View>

      <View style={styles.adherenceGrid}>
        <View style={[styles.adherenceCard, { backgroundColor: "#10B981" + "10" }]}>
          <Feather name="check" size={24} color="#10B981" />
          <ThemedText style={[styles.adherenceCardValue, { color: "#10B981" }]}>
            {insights?.adherenceSummary.onTrack || 0}
          </ThemedText>
          <ThemedText style={[styles.adherenceCardLabel, { color: colors.textSecondary }]}>
            On Track
          </ThemedText>
        </View>
        <View style={[styles.adherenceCard, { backgroundColor: "#EF4444" + "10" }]}>
          <Feather name="alert-triangle" size={24} color="#EF4444" />
          <ThemedText style={[styles.adherenceCardValue, { color: "#EF4444" }]}>
            {insights?.adherenceSummary.atRisk || 0}
          </ThemedText>
          <ThemedText style={[styles.adherenceCardLabel, { color: colors.textSecondary }]}>
            At Risk
          </ThemedText>
        </View>
      </View>
    </Animated.View>
  );

  const renderCaseReviewAlertsWidget = () => (
    <Animated.View entering={FadeInDown.delay(500)} style={[styles.widgetCard, { backgroundColor: colors.backgroundRootDefault }]}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Feather name="alert-circle" size={20} color="#F59E0B" />
          <ThemedText style={[styles.widgetTitle, { color: colors.text }]}>Case Review Alerts</ThemedText>
        </View>
      </View>

      {insights?.aiInsights.pendingCaseReviews && insights.aiInsights.pendingCaseReviews > 0 ? (
        <View style={[styles.alertBanner, { backgroundColor: "#F59E0B" + "15" }]}>
          <Feather name="alert-circle" size={20} color="#F59E0B" />
          <ThemedText style={[styles.alertText, { color: "#F59E0B" }]}>
            {insights.aiInsights.pendingCaseReviews} case{insights.aiInsights.pendingCaseReviews !== 1 ? "s" : ""} awaiting review
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.emptyState]}>
          <Feather name="check-circle" size={32} color="#10B981" />
          <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            All case reviews completed
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );

  const renderUpcomingTasksWidget = () => (
    <Animated.View entering={FadeInDown.delay(600)} style={[styles.widgetCard, { backgroundColor: colors.backgroundRootDefault }]}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetTitleRow}>
          <Feather name="calendar" size={20} color="#3B82F6" />
          <ThemedText style={[styles.widgetTitle, { color: colors.text }]}>Upcoming Tasks</ThemedText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            testID="button-view-all-tasks"
            onPress={() => (navigation as any).navigate("ProviderTasks")}
            style={{ paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <ThemedText style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>View All</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddTaskModal(true)}
          >
            <Feather name="plus" size={16} color="#fff" />
          </Pressable>
        </View>
      </View>

      {pendingTasks.length > 0 ? (
        <View style={styles.taskList}>
          {pendingTasks.slice(0, 5).map((task) => (
            <View key={task.id} style={[styles.taskItem, { borderBottomColor: colors.border }]}>
              <Pressable
                style={[styles.taskCheckbox, { 
                  borderColor: PRIORITY_COLORS[task.priority] || colors.border 
                }]}
                onPress={() => updateTaskMutation.mutate({ id: task.id, status: "completed" })}
              >
                {task.status === "completed" ? (
                  <Feather name="check" size={14} color={colors.primary} />
                ) : null}
              </Pressable>
              <View style={styles.taskContent}>
                <ThemedText style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                  {task.title}
                </ThemedText>
                {task.dueDate ? (
                  <ThemedText style={[styles.taskDue, { color: colors.textSecondary }]}>
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </ThemedText>
                ) : null}
              </View>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={32} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            No pending tasks
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.widgetType) {
      case "quick_stats":
        return renderQuickStats();
      case "ai_insights":
        return renderAIInsightsWidget();
      case "pathway_progress":
        return renderPathwayProgressWidget();
      case "adherence_summary":
        return renderAdherenceSummaryWidget();
      case "case_review_alerts":
        return renderCaseReviewAlertsWidget();
      case "upcoming_tasks":
        return renderUpcomingTasksWidget();
      default:
        return null;
    }
  };

  const isLoading = loadingWidgets || loadingInsights || loadingTasks;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn} style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Provider Dashboard</ThemedText>
          <View style={styles.headerActions}>
            <Pressable
              testID="button-open-ai-workflow"
              style={[styles.customizeButton, { backgroundColor: colors.recordMedication + "15" }]}
              onPress={() => navigation.navigate("ProviderAIWorkflow")}
            >
              <Feather name="zap" size={20} color={colors.recordMedication} />
            </Pressable>
            <Pressable
              testID="button-open-cds"
              style={[styles.customizeButton, { backgroundColor: colors.primary + "15" }]}
              onPress={() => navigation.navigate("ClinicalDecisionSupport")}
            >
              <Feather name="cpu" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              testID="button-open-lab-ordering"
              style={[styles.customizeButton, { backgroundColor: colors.recordLab + "15" }]}
              onPress={() => navigation.navigate("LabOrdering")}
            >
              <Feather name="clipboard" size={20} color={colors.recordLab} />
            </Pressable>
            <Pressable
              style={[styles.customizeButton, { backgroundColor: colors.backgroundRootDefault }]}
              onPress={() => setShowCustomizeModal(true)}
            >
              <Feather name="settings" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </Animated.View>

        {isLoading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          visibleWidgets.map((widget) => (
            <View key={widget.id}>{renderWidget(widget)}</View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showCustomizeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCustomizeModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Customize Dashboard</ThemedText>
            <Pressable onPress={() => setShowCustomizeModal(false)}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            {widgets.map((widget) => (
              <View key={widget.id} style={[styles.widgetToggle, { borderBottomColor: colors.border }]}>
                <View style={styles.widgetToggleInfo}>
                  <Feather 
                    name={WIDGET_ICONS[widget.widgetType] || "square"} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <ThemedText style={[styles.widgetToggleName, { color: colors.text }]}>
                    {widget.title}
                  </ThemedText>
                </View>
                <Switch
                  value={widget.isVisible}
                  onValueChange={(value) => 
                    updateWidgetMutation.mutate({ id: widget.id, isVisible: value })
                  }
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={widget.isVisible ? colors.primary : colors.textSecondary}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showAddTaskModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddTaskModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Add Task</ThemedText>
            <Pressable onPress={() => setShowAddTaskModal(false)}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Title</ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.backgroundRootDefault,
                borderColor: colors.border,
                color: colors.text 
              }]}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="Enter task title"
              placeholderTextColor={colors.textSecondary}
            />

            <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: colors.backgroundRootDefault,
                borderColor: colors.border,
                color: colors.text 
              }]}
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              placeholder="Enter description (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />

            <ThemedText style={[styles.inputLabel, { color: colors.textSecondary }]}>Priority</ThemedText>
            <View style={styles.priorityOptions}>
              {["low", "normal", "high", "urgent"].map((priority) => (
                <Pressable
                  key={priority}
                  style={[
                    styles.priorityOption,
                    { borderColor: PRIORITY_COLORS[priority] },
                    newTaskPriority === priority && { backgroundColor: PRIORITY_COLORS[priority] + "20" },
                  ]}
                  onPress={() => setNewTaskPriority(priority)}
                >
                  <ThemedText style={[
                    styles.priorityOptionText,
                    { color: newTaskPriority === priority ? PRIORITY_COLORS[priority] : colors.textSecondary }
                  ]}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (newTaskTitle.trim()) {
                  createTaskMutation.mutate({
                    title: newTaskTitle,
                    description: newTaskDescription || null,
                    taskType: newTaskType,
                    priority: newTaskPriority,
                  });
                }
              }}
            >
              {createTaskMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.submitButtonText}>Add Task</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  customizeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  loader: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
  },
  widgetCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  widgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  widgetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  insightGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  insightItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  insightValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  insightLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentList: {
    marginTop: Spacing.sm,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  recentItemContent: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  recentItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  progressSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLabel: {
    flex: 1,
    fontSize: 14,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  adherenceBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: Spacing.xs,
  },
  adherenceFill: {
    height: "100%",
    borderRadius: 4,
  },
  adherenceLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  adherenceGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  adherenceCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  adherenceCardValue: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  adherenceCardLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  alertText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  taskList: {
    gap: 0,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  taskDue: {
    fontSize: 12,
    marginTop: 2,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: Spacing.md,
  },
  widgetToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  widgetToggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  widgetToggleName: {
    fontSize: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  priorityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  priorityOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  priorityOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  submitButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
