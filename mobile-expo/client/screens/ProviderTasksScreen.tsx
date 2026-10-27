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
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface ProviderTask {
  id: string;
  providerId: string;
  assigneeId?: string;
  patientId?: string;
  patientName?: string;
  title: string;
  description?: string;
  notes?: string;
  taskType: string;
  priority: string;
  status: string;
  dueDate?: string;
  reminderDate?: string;
  completedAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  recurrence?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  dueSoon: number;
  byPriority: { urgent: number; high: number; normal: number; low: number };
  byType: Record<string, number>;
}

const TASK_TYPES = [
  { value: "follow_up", label: "Follow Up", icon: "repeat" as const },
  { value: "review_results", label: "Review Results", icon: "file-text" as const },
  { value: "call_patient", label: "Call Patient", icon: "phone" as const },
  { value: "prescription_renewal", label: "Rx Renewal", icon: "clipboard" as const },
  { value: "referral", label: "Referral", icon: "send" as const },
  { value: "documentation", label: "Documentation", icon: "edit-3" as const },
  { value: "care_plan_update", label: "Care Plan", icon: "heart" as const },
  { value: "other", label: "Other", icon: "more-horizontal" as const },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "#EF4444" },
  { value: "high", label: "High", color: "#F59E0B" },
  { value: "normal", label: "Normal", color: "#3B82F6" },
  { value: "low", label: "Low", color: "#6B7280" },
];

const STATUSES = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const RECURRENCE_OPTIONS = [
  { value: "", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

function getTaskTypeInfo(type: string) {
  return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[7];
}

function getPriorityInfo(priority: string) {
  return PRIORITIES.find(p => p.value === priority) || PRIORITIES[2];
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days < 7) return `Due in ${days}d`;
  return formatDate(dateStr);
}

function isOverdue(task: ProviderTask) {
  if (!task.dueDate || task.status === "completed" || task.status === "cancelled") return false;
  return new Date(task.dueDate) < new Date();
}

export default function ProviderTasksScreen() {
  const { theme: colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProviderTask | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newTaskType, setNewTaskType] = useState("follow_up");
  const [newPriority, setNewPriority] = useState("normal");
  const [newPatientName, setNewPatientName] = useState("");
  const [newRecurrence, setNewRecurrence] = useState("");
  const [newComment, setNewComment] = useState("");

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (typeFilter !== "all") params.set("taskType", typeFilter);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [statusFilter, priorityFilter, typeFilter, searchQuery]);

  const { data: tasks = [], isLoading, refetch } = useQuery<ProviderTask[]>({
    queryKey: ["/api/provider-dashboard/tasks", statusFilter, priorityFilter, typeFilter, searchQuery],
    queryFn: async () => {
      const response = await axiosInstance.get(`/api/provider-dashboard/tasks${buildQueryString()}`);
      return response.data;
    },
  });

  const { data: stats } = useQuery<TaskStats>({
    queryKey: ["/api/provider-dashboard/tasks/stats"],
    queryFn: async () => {
      const response = await axiosInstance.get("/api/provider-dashboard/tasks/stats");
      return response.data;
    },
  });

  const { data: comments = [] } = useQuery<TaskComment[]>({
    queryKey: ["/api/provider-dashboard/tasks", selectedTask?.id, "comments"],
    queryFn: async () => {
      if (!selectedTask) return [];
      const response = await axiosInstance.get(`/api/provider-dashboard/tasks/${selectedTask.id}/comments`);
      return response.data;
    },
    enabled: !!selectedTask,
  });

  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const response = await axiosInstance.post("/api/provider-dashboard/tasks", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/tasks"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetCreateForm();
      setShowCreateModal(false);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axiosInstance.patch(`/api/provider-dashboard/tasks/${id}`, data);
      return response.data;
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/tasks"] });
      if (selectedTask) setSelectedTask(updatedTask);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/api/provider-dashboard/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/tasks"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDetailModal(false);
      setSelectedTask(null);
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const response = await axiosInstance.post(`/api/provider-dashboard/tasks/${taskId}/comments`, { content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-dashboard/tasks", selectedTask?.id, "comments"] });
      setNewComment("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewNotes("");
    setNewTaskType("follow_up");
    setNewPriority("normal");
    setNewPatientName("");
    setNewRecurrence("");
  };

  const handleCreateTask = () => {
    if (!newTitle.trim()) return;
    createTask.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      notes: newNotes.trim() || undefined,
      taskType: newTaskType,
      priority: newPriority,
      patientName: newPatientName.trim() || undefined,
      recurrence: newRecurrence || undefined,
    });
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ id: taskId, data: { status: newStatus } });
  };

  const handleOpenDetail = (task: ProviderTask) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    if (typeFilter !== "all") count++;
    return count;
  }, [statusFilter, priorityFilter, typeFilter]);

  const renderStatsBar = () => {
    if (!stats) return null;
    return (
      <Animated.View entering={FadeIn.duration(400)} style={[styles.statsRow]}>
        <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.statValue, { color: colors.primary }]}>{stats.pending + stats.inProgress}</ThemedText>
          <ThemedText style={styles.statLabel}>Active</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: stats.overdue > 0 ? "#FEE2E2" : colors.backgroundSecondary }]}>
          <ThemedText style={[styles.statValue, { color: stats.overdue > 0 ? "#EF4444" : colors.text }]}>{stats.overdue}</ThemedText>
          <ThemedText style={styles.statLabel}>Overdue</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: stats.dueSoon > 0 ? "#FEF3C7" : colors.backgroundSecondary }]}>
          <ThemedText style={[styles.statValue, { color: stats.dueSoon > 0 ? "#D97706" : colors.text }]}>{stats.dueSoon}</ThemedText>
          <ThemedText style={styles.statLabel}>Due Soon</ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.statValue, { color: "#10B981" }]}>{stats.completed}</ThemedText>
          <ThemedText style={styles.statLabel}>Done</ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderSearchBar = () => (
    <View style={styles.searchRow}>
      <View style={[styles.searchInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="input-task-search"
          accessibilityLabel="Search tasks"
          style={[styles.searchText, { color: colors.text }]}
          placeholder="Search tasks..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery("")} testID="button-clear-search" accessibilityRole="button" accessibilityLabel="Clear search">
            <Feather name="x" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        testID="button-toggle-filters"
        accessibilityRole="button"
        accessibilityLabel={`Toggle filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ""}`}
        accessibilityState={{ expanded: showFilters }}
        style={[styles.filterButton, { backgroundColor: activeFilterCount > 0 ? colors.primary : colors.backgroundSecondary }]}
        onPress={() => {
          setShowFilters(!showFilters);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Feather name="filter" size={18} color={activeFilterCount > 0 ? "#FFFFFF" : colors.text} />
        {activeFilterCount > 0 ? (
          <View style={styles.filterBadge}>
            <ThemedText style={styles.filterBadgeText}>{activeFilterCount}</ThemedText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  const renderFilters = () => {
    if (!showFilters) return null;
    return (
      <Animated.View entering={FadeInDown.duration(300)} style={[styles.filtersContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <ThemedText style={styles.filterTitle}>Status</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {STATUSES.map(s => (
            <Pressable
              key={s.value}
              testID={`button-filter-status-${s.value}`}
              accessibilityRole="radio"
              accessibilityLabel={`Status: ${s.label}`}
              accessibilityState={{ selected: statusFilter === s.value }}
              style={[styles.filterChip, statusFilter === s.value ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundTertiary }]}
              onPress={() => setStatusFilter(s.value)}
            >
              <ThemedText style={[styles.filterChipText, statusFilter === s.value ? { color: "#FFF" } : { color: colors.text }]}>{s.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <ThemedText style={[styles.filterTitle, { marginTop: Spacing.md }]}>Priority</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pressable
            testID="button-filter-priority-all"
            accessibilityRole="radio"
            accessibilityLabel="Priority: All"
            accessibilityState={{ selected: priorityFilter === "all" }}
            style={[styles.filterChip, priorityFilter === "all" ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundTertiary }]}
            onPress={() => setPriorityFilter("all")}
          >
            <ThemedText style={[styles.filterChipText, priorityFilter === "all" ? { color: "#FFF" } : { color: colors.text }]}>All</ThemedText>
          </Pressable>
          {PRIORITIES.map(p => (
            <Pressable
              key={p.value}
              testID={`button-filter-priority-${p.value}`}
              accessibilityRole="radio"
              accessibilityLabel={`Priority: ${p.label}`}
              accessibilityState={{ selected: priorityFilter === p.value }}
              style={[styles.filterChip, priorityFilter === p.value ? { backgroundColor: p.color } : { backgroundColor: colors.backgroundTertiary }]}
              onPress={() => setPriorityFilter(p.value)}
            >
              <ThemedText style={[styles.filterChipText, priorityFilter === p.value ? { color: "#FFF" } : { color: colors.text }]}>{p.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <ThemedText style={[styles.filterTitle, { marginTop: Spacing.md }]}>Type</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pressable
            testID="button-filter-type-all"
            accessibilityRole="radio"
            accessibilityLabel="Type: All"
            accessibilityState={{ selected: typeFilter === "all" }}
            style={[styles.filterChip, typeFilter === "all" ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundTertiary }]}
            onPress={() => setTypeFilter("all")}
          >
            <ThemedText style={[styles.filterChipText, typeFilter === "all" ? { color: "#FFF" } : { color: colors.text }]}>All</ThemedText>
          </Pressable>
          {TASK_TYPES.map(t => (
            <Pressable
              key={t.value}
              testID={`button-filter-type-${t.value}`}
              accessibilityRole="radio"
              accessibilityLabel={`Type: ${t.label}`}
              accessibilityState={{ selected: typeFilter === t.value }}
              style={[styles.filterChip, typeFilter === t.value ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundTertiary }]}
              onPress={() => setTypeFilter(t.value)}
            >
              <ThemedText style={[styles.filterChipText, typeFilter === t.value ? { color: "#FFF" } : { color: colors.text }]}>{t.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {activeFilterCount > 0 ? (
          <Pressable
            testID="button-clear-filters"
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
            style={[styles.clearFiltersButton, { borderColor: colors.border }]}
            onPress={() => { setStatusFilter("all"); setPriorityFilter("all"); setTypeFilter("all"); }}
          >
            <Feather name="x" size={14} color={colors.textSecondary} />
            <ThemedText style={[styles.clearFiltersText, { color: colors.textSecondary }]}>Clear filters</ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  };

  const renderTaskCard = ({ item: task }: { item: ProviderTask }) => {
    const typeInfo = getTaskTypeInfo(task.taskType);
    const priorityInfo = getPriorityInfo(task.priority);
    const overdue = isOverdue(task);

    return (
      <Animated.View entering={FadeInDown.duration(300)}>
        <Pressable
          testID={`card-task-${task.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${task.title}, ${typeInfo.label}, ${priorityInfo.label} priority, ${task.status.replace("_", " ")}${overdue ? ", overdue" : ""}`}
          style={[
            styles.taskCard,
            {
              backgroundColor: colors.backgroundDefault,
              borderColor: overdue ? "#EF4444" : colors.border,
              borderLeftColor: priorityInfo.color,
              borderLeftWidth: 4,
            },
          ]}
          onPress={() => handleOpenDetail(task)}
        >
          <View style={styles.taskCardHeader}>
            <View style={styles.taskCardLeft}>
              <View style={[styles.typeIconContainer, { backgroundColor: `${priorityInfo.color}15` }]}>
                <Feather name={typeInfo.icon} size={16} color={priorityInfo.color} />
              </View>
              <View style={styles.taskCardTitleArea}>
                <ThemedText style={[styles.taskTitle, task.status === "completed" ? styles.taskTitleCompleted : null]} numberOfLines={1}>
                  {task.title}
                </ThemedText>
                <View style={styles.taskMeta}>
                  <ThemedText style={[styles.taskTypeLabel, { color: colors.textSecondary }]}>{typeInfo.label}</ThemedText>
                  {task.patientName ? (
                    <>
                      <ThemedText style={[styles.taskMetaDot, { color: colors.textSecondary }]}>{" \u00B7 "}</ThemedText>
                      <Feather name="user" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.taskPatientName, { color: colors.textSecondary }]}> {task.patientName}</ThemedText>
                    </>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.taskCardRight}>
              {task.status !== "completed" && task.status !== "cancelled" ? (
                <Pressable
                  testID={`button-complete-task-${task.id}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Mark ${task.title} as completed`}
                  accessibilityState={{ checked: false }}
                  style={[styles.checkButton, { borderColor: priorityInfo.color }]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleStatusChange(task.id, "completed");
                  }}
                >
                  <Feather name="check" size={14} color={priorityInfo.color} />
                </Pressable>
              ) : (
                <View style={[styles.checkButtonDone, { backgroundColor: "#10B981" }]}>
                  <Feather name="check" size={14} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>

          {task.description ? (
            <ThemedText style={[styles.taskDescription, { color: colors.textSecondary }]} numberOfLines={2}>
              {task.description}
            </ThemedText>
          ) : null}

          <View style={styles.taskFooter}>
            {task.dueDate ? (
              <View style={[styles.dueDateChip, overdue ? { backgroundColor: "#FEE2E2" } : { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="calendar" size={12} color={overdue ? "#EF4444" : colors.textSecondary} />
                <ThemedText style={[styles.dueDateText, { color: overdue ? "#EF4444" : colors.textSecondary }]}>
                  {formatRelative(task.dueDate)}
                </ThemedText>
              </View>
            ) : null}
            {task.recurrence ? (
              <View style={[styles.recurrenceChip, { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="repeat" size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.recurrenceText, { color: colors.textSecondary }]}>{task.recurrence}</ThemedText>
              </View>
            ) : null}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) + "20" }]}>
              <ThemedText style={[styles.statusText, { color: getStatusColor(task.status) }]}>
                {task.status.replace("_", " ")}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderCreateModal = () => (
    <Modal visible={showCreateModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>New Task</ThemedText>
            <Pressable testID="button-close-create" accessibilityRole="button" accessibilityLabel="Close create task modal" onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.inputLabel}>Title *</ThemedText>
            <TextInput
              testID="input-task-title"
              accessibilityLabel="Task title"
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              placeholder="Task title"
              placeholderTextColor={colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <ThemedText style={styles.inputLabel}>Description</ThemedText>
            <TextInput
              testID="input-task-description"
              accessibilityLabel="Task description"
              style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              placeholder="Task description"
              placeholderTextColor={colors.textSecondary}
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={3}
            />

            <ThemedText style={styles.inputLabel}>Task Type</ThemedText>
            <View style={styles.typeGrid}>
              {TASK_TYPES.map(t => (
                <Pressable
                  key={t.value}
                  testID={`button-type-${t.value}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Task type: ${t.label}`}
                  accessibilityState={{ selected: newTaskType === t.value }}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: newTaskType === t.value ? colors.primary : colors.backgroundSecondary,
                      borderColor: newTaskType === t.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setNewTaskType(t.value)}
                >
                  <Feather name={t.icon} size={16} color={newTaskType === t.value ? "#FFFFFF" : colors.text} />
                  <ThemedText style={[styles.typeOptionText, { color: newTaskType === t.value ? "#FFFFFF" : colors.text }]}>
                    {t.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.inputLabel}>Priority</ThemedText>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => (
                <Pressable
                  key={p.value}
                  testID={`button-priority-${p.value}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Priority: ${p.label}`}
                  accessibilityState={{ selected: newPriority === p.value }}
                  style={[
                    styles.priorityOption,
                    { backgroundColor: newPriority === p.value ? p.color : colors.backgroundSecondary, borderColor: p.color },
                  ]}
                  onPress={() => setNewPriority(p.value)}
                >
                  <ThemedText style={[styles.priorityOptionText, { color: newPriority === p.value ? "#FFFFFF" : p.color }]}>
                    {p.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.inputLabel}>Patient Name</ThemedText>
            <TextInput
              testID="input-patient-name"
              accessibilityLabel="Patient name"
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              placeholder="Associated patient (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newPatientName}
              onChangeText={setNewPatientName}
            />

            <ThemedText style={styles.inputLabel}>Internal Notes</ThemedText>
            <TextInput
              testID="input-task-notes"
              accessibilityLabel="Internal notes"
              style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              placeholder="Internal notes (optional)"
              placeholderTextColor={colors.textSecondary}
              value={newNotes}
              onChangeText={setNewNotes}
              multiline
              numberOfLines={2}
            />

            <ThemedText style={styles.inputLabel}>Recurrence</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {RECURRENCE_OPTIONS.map(r => (
                <Pressable
                  key={r.value}
                  testID={`button-recurrence-${r.value || "none"}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`Recurrence: ${r.label}`}
                  accessibilityState={{ selected: newRecurrence === r.value }}
                  style={[
                    styles.filterChip,
                    { backgroundColor: newRecurrence === r.value ? colors.primary : colors.backgroundSecondary },
                  ]}
                  onPress={() => setNewRecurrence(r.value)}
                >
                  <ThemedText style={[styles.filterChipText, { color: newRecurrence === r.value ? "#FFFFFF" : colors.text }]}>
                    {r.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ height: Spacing.xl }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              testID="button-cancel-create"
              accessibilityRole="button"
              accessibilityLabel="Cancel creating task"
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => { setShowCreateModal(false); resetCreateForm(); }}
            >
              <ThemedText style={{ color: colors.text }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              testID="button-submit-create"
              accessibilityRole="button"
              accessibilityLabel="Create task"
              accessibilityState={{ disabled: !newTitle.trim() || createTask.isPending }}
              style={[styles.createButton, { backgroundColor: colors.primary, opacity: newTitle.trim() ? 1 : 0.5 }]}
              onPress={handleCreateTask}
              disabled={!newTitle.trim() || createTask.isPending}
            >
              {createTask.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.createButtonText}>Create Task</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderDetailModal = () => {
    if (!selectedTask) return null;
    const typeInfo = getTaskTypeInfo(selectedTask.taskType);
    const priorityInfo = getPriorityInfo(selectedTask.priority);
    const overdue = isOverdue(selectedTask);

    return (
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Task Details</ThemedText>
              <Pressable testID="button-close-detail" accessibilityRole="button" accessibilityLabel="Close task details" onPress={() => { setShowDetailModal(false); setSelectedTask(null); }}>
                <Feather name="x" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.detailHeader, { borderLeftColor: priorityInfo.color }]}>
                <View style={[styles.typeIconContainer, { backgroundColor: `${priorityInfo.color}15` }]}>
                  <Feather name={typeInfo.icon} size={20} color={priorityInfo.color} />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText style={styles.detailTitle}>{selectedTask.title}</ThemedText>
                  <View style={styles.detailBadges}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedTask.status) + "20" }]}>
                      <ThemedText style={[styles.statusText, { color: getStatusColor(selectedTask.status) }]}>
                        {selectedTask.status.replace("_", " ")}
                      </ThemedText>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: `${priorityInfo.color}20` }]}>
                      <ThemedText style={[styles.priorityBadgeText, { color: priorityInfo.color }]}>{priorityInfo.label}</ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              {selectedTask.description ? (
                <View style={styles.detailSection}>
                  <ThemedText style={styles.detailSectionTitle}>Description</ThemedText>
                  <ThemedText style={[styles.detailText, { color: colors.textSecondary }]}>{selectedTask.description}</ThemedText>
                </View>
              ) : null}

              {selectedTask.notes ? (
                <View style={styles.detailSection}>
                  <ThemedText style={styles.detailSectionTitle}>Internal Notes</ThemedText>
                  <ThemedText style={[styles.detailText, { color: colors.textSecondary }]}>{selectedTask.notes}</ThemedText>
                </View>
              ) : null}

              <View style={[styles.detailInfoGrid, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                {selectedTask.patientName ? (
                  <View style={styles.detailInfoItem}>
                    <Feather name="user" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Patient</ThemedText>
                    <ThemedText style={styles.detailInfoValue}>{selectedTask.patientName}</ThemedText>
                  </View>
                ) : null}
                {selectedTask.dueDate ? (
                  <View style={styles.detailInfoItem}>
                    <Feather name="calendar" size={14} color={overdue ? "#EF4444" : colors.textSecondary} />
                    <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Due Date</ThemedText>
                    <ThemedText style={[styles.detailInfoValue, overdue ? { color: "#EF4444" } : null]}>{formatDate(selectedTask.dueDate)}</ThemedText>
                  </View>
                ) : null}
                {selectedTask.recurrence ? (
                  <View style={styles.detailInfoItem}>
                    <Feather name="repeat" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Recurrence</ThemedText>
                    <ThemedText style={styles.detailInfoValue}>{selectedTask.recurrence}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.detailInfoItem}>
                  <Feather name="clock" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Created</ThemedText>
                  <ThemedText style={styles.detailInfoValue}>{formatDate(selectedTask.createdAt)}</ThemedText>
                </View>
              </View>

              {selectedTask.status !== "completed" && selectedTask.status !== "cancelled" ? (
                <View style={styles.statusActions}>
                  <ThemedText style={styles.detailSectionTitle}>Update Status</ThemedText>
                  <View style={styles.statusButtonRow}>
                    {selectedTask.status !== "in_progress" ? (
                      <Pressable
                        testID="button-status-in-progress"
                        accessibilityRole="button"
                        accessibilityLabel="Start task"
                        style={[styles.statusActionButton, { backgroundColor: "#3B82F620", borderColor: "#3B82F6" }]}
                        onPress={() => handleStatusChange(selectedTask.id, "in_progress")}
                      >
                        <Feather name="play" size={14} color="#3B82F6" />
                        <ThemedText style={{ color: "#3B82F6", marginLeft: Spacing.xs }}>Start</ThemedText>
                      </Pressable>
                    ) : null}
                    <Pressable
                      testID="button-status-completed"
                      accessibilityRole="button"
                      accessibilityLabel="Complete task"
                      style={[styles.statusActionButton, { backgroundColor: "#10B98120", borderColor: "#10B981" }]}
                      onPress={() => handleStatusChange(selectedTask.id, "completed")}
                    >
                      <Feather name="check-circle" size={14} color="#10B981" />
                      <ThemedText style={{ color: "#10B981", marginLeft: Spacing.xs }}>Complete</ThemedText>
                    </Pressable>
                    <Pressable
                      testID="button-status-cancelled"
                      accessibilityRole="button"
                      accessibilityLabel="Cancel task"
                      style={[styles.statusActionButton, { backgroundColor: "#6B728020", borderColor: "#6B7280" }]}
                      onPress={() => handleStatusChange(selectedTask.id, "cancelled")}
                    >
                      <Feather name="x-circle" size={14} color="#6B7280" />
                      <ThemedText style={{ color: "#6B7280", marginLeft: Spacing.xs }}>Cancel</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.commentsSection}>
                <ThemedText style={styles.detailSectionTitle}>Comments ({comments.length})</ThemedText>
                {comments.map(c => (
                  <View key={c.id} style={[styles.commentCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <ThemedText style={[styles.commentText, { color: colors.text }]}>{c.content}</ThemedText>
                    <ThemedText style={[styles.commentDate, { color: colors.textSecondary }]}>{formatDate(c.createdAt)}</ThemedText>
                  </View>
                ))}
                <View style={[styles.commentInputRow, { borderColor: colors.border }]}>
                  <TextInput
                    testID="input-comment"
                    accessibilityLabel="Add a comment"
                    style={[styles.commentInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.textSecondary}
                    value={newComment}
                    onChangeText={setNewComment}
                  />
                  <Pressable
                    testID="button-submit-comment"
                    accessibilityRole="button"
                    accessibilityLabel="Send comment"
                    style={[styles.commentSendButton, { backgroundColor: newComment.trim() ? colors.primary : colors.backgroundTertiary }]}
                    onPress={() => {
                      if (newComment.trim() && selectedTask) {
                        addComment.mutate({ taskId: selectedTask.id, content: newComment.trim() });
                      }
                    }}
                    disabled={!newComment.trim() || addComment.isPending}
                  >
                    <Feather name="send" size={16} color={newComment.trim() ? "#FFFFFF" : colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                testID="button-delete-task"
                accessibilityRole="button"
                accessibilityLabel="Delete task"
                style={[styles.deleteButton, { borderColor: "#EF4444" }]}
                onPress={() => deleteTask.mutate(selectedTask.id)}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
                <ThemedText style={{ color: "#EF4444", marginLeft: Spacing.sm }}>Delete Task</ThemedText>
              </Pressable>

              <View style={{ height: Spacing["3xl"] }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="clipboard" size={48} color={colors.textSecondary} />
      <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No tasks found</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {activeFilterCount > 0 ? "Try adjusting your filters" : "Create your first task to get started"}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing["4xl"] + 80 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} />}
        showsVerticalScrollIndicator={false}
      >
        {renderStatsBar()}
        <View style={styles.content}>
          {renderSearchBar()}
          {renderFilters()}

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : tasks.length > 0 ? (
            tasks.map((task) => renderTaskCard({ item: task }))
          ) : (
            renderEmptyState()
          )}
        </View>
      </ScrollView>

      <Pressable
        testID="button-create-task"
        accessibilityRole="button"
        accessibilityLabel="Create new task"
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + Spacing.xl }]}
        onPress={() => {
          setShowCreateModal(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      {renderCreateModal()}
      {renderDetailModal()}
    </ThemedView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending": return "#F59E0B";
    case "in_progress": return "#3B82F6";
    case "completed": return "#10B981";
    case "cancelled": return "#6B7280";
    default: return "#6B7280";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  statValue: {
    ...Typography.h2,
  },
  statLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchText: {
    flex: 1,
    ...Typography.body,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  filtersContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  filterTitle: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  clearFiltersText: {
    ...Typography.caption,
  },
  taskCard: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  taskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  taskCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCardTitleArea: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  taskTitle: {
    ...Typography.h4,
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  taskTypeLabel: {
    ...Typography.caption,
  },
  taskMetaDot: {
    ...Typography.caption,
  },
  taskPatientName: {
    ...Typography.caption,
  },
  taskCardRight: {},
  checkButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkButtonDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  taskDescription: {
    ...Typography.small,
    marginTop: Spacing.sm,
    marginLeft: 52,
  },
  taskFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    marginLeft: 52,
    gap: Spacing.sm,
  },
  dueDateChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  dueDateText: {
    ...Typography.caption,
  },
  recurrenceChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  recurrenceText: {
    ...Typography.caption,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  fab: {
    position: "absolute",
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      default: {
        elevation: 6,
      },
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "90%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h2,
  },
  modalBody: {
    paddingHorizontal: Spacing.xl,
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  inputLabel: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  typeOptionText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  priorityRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priorityOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  priorityOptionText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  createButton: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  createButtonText: {
    color: "#FFFFFF",
    ...Typography.body,
    fontWeight: "600",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderLeftWidth: 4,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  detailBadges: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  priorityBadgeText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  detailSection: {
    marginBottom: Spacing.lg,
  },
  detailSectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  detailText: {
    ...Typography.body,
    lineHeight: 22,
  },
  detailInfoGrid: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  detailInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailInfoLabel: {
    ...Typography.caption,
    width: 80,
  },
  detailInfoValue: {
    ...Typography.body,
    flex: 1,
    fontWeight: "500",
  },
  statusActions: {
    marginBottom: Spacing.lg,
  },
  statusButtonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  statusActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  commentsSection: {
    marginBottom: Spacing.lg,
  },
  commentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  commentText: {
    ...Typography.small,
  },
  commentDate: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
  commentInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.small,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  loadingContainer: {
    paddingVertical: Spacing["5xl"],
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
});
