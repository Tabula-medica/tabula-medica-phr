import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Path, Circle, Line, Rect, G, Text as SvgText } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";
import { LoadingState, BaseModal, FormInput, Button } from "@/components/ui";

interface HealthGoal {
  id: string;
  userId: string;
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
  stats?: { totalEntries: number; completedEntries: number; avgValue: number };
  recentProgress?: GoalProgress[];
}

interface GoalProgress {
  id: string;
  goalId: string;
  date: string;
  value: number;
  notes: string | null;
  isCompleted: boolean;
}

interface AISuggestion {
  title: string;
  description: string;
  category: string;
  targetValue: number;
  targetUnit: string;
  frequency: string;
  rationale: string;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; gradient: string[] }> = {
  exercise: { icon: "activity", color: "#10B981", gradient: ["#10B981", "#34D399"] },
  nutrition: { icon: "coffee", color: "#F97316", gradient: ["#F97316", "#FB923C"] },
  medication: { icon: "heart", color: "#8B5CF6", gradient: ["#8B5CF6", "#A78BFA"] },
  weight: { icon: "trending-down", color: "#0066CC", gradient: ["#0066CC", "#4A9EFF"] },
  sleep: { icon: "moon", color: "#6366F1", gradient: ["#6366F1", "#818CF8"] },
  mental_health: { icon: "smile", color: "#EC4899", gradient: ["#EC4899", "#F472B6"] },
  vitals: { icon: "thermometer", color: "#14B8A6", gradient: ["#14B8A6", "#2DD4BF"] },
  custom: { icon: "target", color: "#6B7280", gradient: ["#6B7280", "#9CA3AF"] },
};

function MiniChart({ data, color, width = 80, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) {
    return (
      <View style={{ width, height, justifyContent: "center", alignItems: "center" }}>
        <ThemedText type="small" style={{ color: "#9CA3AF" }}>No data</ThemedText>
      </View>
    );
  }

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((val - minVal) / range) * chartHeight;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  return (
    <Svg width={width} height={height}>
      <Path d={points} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProgressRing({ progress, size = 48, strokeWidth = 4, color }: { progress: number; size?: number; color: string; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(0,0,0,0.1)" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function GoalCard({ goal, onPress, onLogProgress, theme, isDark }: {
  goal: HealthGoal;
  onPress: () => void;
  onLogProgress: () => void;
  theme: any;
  isDark: boolean;
}) {
  const config = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.custom;
  const completionRate = goal.stats && goal.stats.totalEntries > 0
    ? Math.round((goal.stats.completedEntries / goal.stats.totalEntries) * 100)
    : 0;
  const chartData = goal.recentProgress?.map(p => p.value) || [];

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <Pressable
        onPress={onPress}
        style={[
          styles.goalCard,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + "20" }]}>
            <Feather name={config.icon as any} size={16} color={config.color} />
          </View>
          <View style={styles.cardTitleSection}>
            <ThemedText type="h3" numberOfLines={1}>{goal.title}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {goal.targetValue ? `${goal.targetValue} ${goal.targetUnit} ${goal.frequency}` : goal.frequency}
            </ThemedText>
          </View>
          {goal.isAiSuggested ? (
            <View style={[styles.aiBadge, { backgroundColor: "#8B5CF620" }]}>
              <Feather name="cpu" size={12} color="#8B5CF6" />
            </View>
          ) : null}
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <ProgressRing progress={completionRate} color={config.color} />
            <View style={styles.statText}>
              <ThemedText type="h3">{completionRate}%</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Complete</ThemedText>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.streakBadge, { backgroundColor: "#F5920B20" }]}>
              <Feather name="zap" size={16} color="#F59E0B" />
            </View>
            <View style={styles.statText}>
              <ThemedText type="h3">{goal.currentStreak}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Streak</ThemedText>
            </View>
          </View>
          <View style={styles.chartContainer}>
            <MiniChart data={chartData} color={config.color} />
          </View>
        </View>

        <Pressable
          onPress={(e) => { e.stopPropagation(); onLogProgress(); }}
          style={[styles.logButton, { backgroundColor: config.color }]}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: 6 }}>Log Progress</ThemedText>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export default function HealthGoalsScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<HealthGoal | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [logValue, setLogValue] = useState("");
  const [logNotes, setLogNotes] = useState("");

  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "exercise",
    targetValue: "",
    targetUnit: "",
    frequency: "daily",
  });

  const { data: goals = [], isLoading } = useQuery<HealthGoal[]>({
    queryKey: ["/api/health-goals"],
  });

  const { data: suggestionsData, isLoading: suggestionsLoading, refetch: fetchSuggestions } = useQuery<{ suggestions: AISuggestion[] }>({
    queryKey: ["/api/health-goals/suggestions"],
    enabled: false,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const response = await axiosInstance.post("/api/health-goals", goalData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals"] });
      setShowCreateModal(false);
      setNewGoal({ title: "", description: "", category: "exercise", targetValue: "", targetUnit: "", frequency: "daily" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const logProgressMutation = useMutation({
    mutationFn: async ({ goalId, value, notes }: { goalId: string; value: number; notes?: string }) => {
      const response = await axiosInstance.post(`/api/health-goals/${goalId}/progress`, { value, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals"] });
      setShowLogModal(false);
      setSelectedGoal(null);
      setLogValue("");
      setLogNotes("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCreateGoal = () => {
    if (!newGoal.title.trim()) {
      Alert.alert("Error", "Please enter a goal title");
      return;
    }
    createGoalMutation.mutate({
      ...newGoal,
      targetValue: newGoal.targetValue ? parseInt(newGoal.targetValue) : null,
      startDate: new Date().toISOString(),
    });
  };

  const handleLogProgress = () => {
    if (!selectedGoal || !logValue) return;
    logProgressMutation.mutate({
      goalId: selectedGoal.id,
      value: parseInt(logValue),
      notes: logNotes || undefined,
    });
  };

  const handleAddSuggestion = (suggestion: AISuggestion) => {
    createGoalMutation.mutate({
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category,
      targetValue: suggestion.targetValue,
      targetUnit: suggestion.targetUnit,
      frequency: suggestion.frequency,
      isAiSuggested: true,
      aiRationale: suggestion.rationale,
      startDate: new Date().toISOString(),
    });
    setShowSuggestions(false);
  };

  const handleGetSuggestions = async () => {
    setShowSuggestions(true);
    await fetchSuggestions();
  };

  const activeGoals = goals.filter(g => g.status === "active");
  const completedGoals = goals.filter(g => g.status === "completed");
  
  const totalStreak = activeGoals.reduce((sum, g) => sum + (g.currentStreak || 0), 0);
  const avgCompletion = activeGoals.length > 0 
    ? Math.round(activeGoals.reduce((sum, g) => {
        const rate = g.stats && g.stats.totalEntries > 0 
          ? (g.stats.completedEntries / g.stats.totalEntries) * 100 
          : 0;
        return sum + rate;
      }, 0) / activeGoals.length)
    : 0;
  const categoryCounts = activeGoals.reduce((acc, g) => {
    acc[g.category] = (acc[g.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View>
              <ThemedText type="h2">My Health Goals</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {activeGoals.length} active goal{activeGoals.length !== 1 ? "s" : ""}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleGetSuggestions}
              style={[styles.aiButton, { backgroundColor: "#8B5CF620" }]}
            >
              <Feather name="cpu" size={16} color="#8B5CF6" />
              <ThemedText type="caption" style={{ color: "#8B5CF6", marginLeft: 6 }}>AI Suggest</ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {activeGoals.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.dashboardSection}>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
                <ProgressRing progress={avgCompletion} size={56} strokeWidth={5} color={theme.primary} />
                <View style={styles.statCardContent}>
                  <ThemedText type="h2">{avgCompletion}%</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Avg. Completion</ThemedText>
                </View>
              </View>
              <View style={[styles.statCard, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
                <View style={[styles.streakIcon, { backgroundColor: "#F59E0B20" }]}>
                  <Feather name="zap" size={24} color="#F59E0B" />
                </View>
                <View style={styles.statCardContent}>
                  <ThemedText type="h2">{totalStreak}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Total Streaks</ThemedText>
                </View>
              </View>
            </View>

            <View style={[styles.categoryBreakdown, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" }]}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Goal Categories</ThemedText>
              <View style={styles.categoryBars}>
                {Object.entries(categoryCounts).map(([category, count]) => {
                  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.custom;
                  const percentage = (count / activeGoals.length) * 100;
                  return (
                    <View key={category} style={styles.categoryBar}>
                      <View style={styles.categoryBarHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Feather name={config.icon as any} size={14} color={config.color} />
                          <ThemedText type="small" style={{ marginLeft: 6, textTransform: "capitalize" }}>
                            {category.replace("_", " ")}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>{count}</ThemedText>
                      </View>
                      <View style={[styles.barBackground, { backgroundColor: theme.border }]}>
                        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: config.color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        ) : null}

        {isLoading ? (
          <LoadingState message="Loading goals..." />
        ) : activeGoals.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="target" size={32} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ marginTop: Spacing.lg }}>No Goals Yet</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
              Set personalized health goals to track your progress and stay motivated.
            </ThemedText>
            <Button variant="primary" icon="cpu" onPress={handleGetSuggestions} style={{ backgroundColor: "#8B5CF6", marginTop: Spacing.lg }}>Get AI Suggestions</Button>
          </Animated.View>
        ) : (
          <View style={styles.goalsContainer}>
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onPress={() => navigation.navigate("GoalDetail", { goalId: goal.id })}
                onLogProgress={() => { setSelectedGoal(goal); setShowLogModal(true); }}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </View>
        )}

        {completedGoals.length > 0 ? (
          <View style={styles.completedSection}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>Completed Goals</ThemedText>
            {completedGoals.slice(0, 3).map((goal) => (
              <View key={goal.id} style={[styles.completedCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
                <Feather name="check-circle" size={18} color="#10B981" />
                <ThemedText type="body" style={{ marginLeft: 10, flex: 1 }}>{goal.title}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => setShowCreateModal(true)}
        style={[styles.fab, { backgroundColor: theme.primary }]}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <BaseModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Goal">
        <FormInput
          label="Goal Title"
          value={newGoal.title}
          onChangeText={(v) => setNewGoal({ ...newGoal, title: v })}
          placeholder="e.g., Walk 10,000 steps daily"
        />

        <FormInput
          label="Description (optional)"
          value={newGoal.description}
          onChangeText={(v) => setNewGoal({ ...newGoal, description: v })}
          placeholder="Why is this goal important to you?"
          multiline
          numberOfLines={3}
        />

        <View style={styles.formGroup}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 6 }}>Category</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <Pressable
                key={key}
                onPress={() => setNewGoal({ ...newGoal, category: key })}
                style={[
                  styles.categoryOption,
                  {
                    backgroundColor: newGoal.category === key ? config.color + "20" : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                    borderColor: newGoal.category === key ? config.color : "transparent",
                  },
                ]}
              >
                <Feather name={config.icon as any} size={16} color={config.color} />
                <ThemedText type="small" style={{ marginLeft: 6, textTransform: "capitalize" }}>{key.replace("_", " ")}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <FormInput
              label="Target Value"
              value={newGoal.targetValue}
              onChangeText={(v) => setNewGoal({ ...newGoal, targetValue: v })}
              placeholder="10000"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <FormInput
              label="Unit"
              value={newGoal.targetUnit}
              onChangeText={(v) => setNewGoal({ ...newGoal, targetUnit: v })}
              placeholder="steps"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 6 }}>Frequency</ThemedText>
          <View style={styles.frequencyRow}>
            {["daily", "weekly", "monthly"].map((freq) => (
              <Pressable
                key={freq}
                onPress={() => setNewGoal({ ...newGoal, frequency: freq })}
                style={[
                  styles.frequencyOption,
                  {
                    backgroundColor: newGoal.frequency === freq ? theme.primary : isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                  },
                ]}
              >
                <ThemedText type="body" style={{ color: newGoal.frequency === freq ? "#FFFFFF" : theme.text, textTransform: "capitalize" }}>{freq}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <Button
          variant="primary"
          loading={createGoalMutation.isPending}
          disabled={createGoalMutation.isPending}
          onPress={handleCreateGoal}
          fullWidth
          style={{ marginTop: Spacing.md }}
        >
          Create Goal
        </Button>
      </BaseModal>

      <BaseModal
        visible={showLogModal}
        onClose={() => { setShowLogModal(false); setSelectedGoal(null); }}
        title="Log Progress"
        scrollable={false}
      >
        {selectedGoal ? (
          <View>
            <View style={[styles.selectedGoalInfo, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
              <Feather name={(CATEGORY_CONFIG[selectedGoal.category]?.icon || "target") as any} size={20} color={CATEGORY_CONFIG[selectedGoal.category]?.color || theme.primary} />
              <ThemedText type="body" style={{ marginLeft: 10, flex: 1 }}>{selectedGoal.title}</ThemedText>
            </View>

            <FormInput
              label={`Value ${selectedGoal.targetUnit ? `(${selectedGoal.targetUnit})` : ""}`}
              value={logValue}
              onChangeText={setLogValue}
              placeholder={selectedGoal.targetValue?.toString() || "0"}
              keyboardType="numeric"
            />

            <FormInput
              label="Notes (optional)"
              value={logNotes}
              onChangeText={setLogNotes}
              placeholder="How did it go?"
            />

            <Button
              variant="primary"
              loading={logProgressMutation.isPending}
              disabled={logProgressMutation.isPending || !logValue}
              onPress={handleLogProgress}
              fullWidth
              style={{ marginTop: Spacing.md }}
            >
              Save Progress
            </Button>
          </View>
        ) : null}
      </BaseModal>

      <BaseModal visible={showSuggestions} onClose={() => setShowSuggestions(false)} title="AI Goal Suggestions">
        {suggestionsLoading ? (
          <LoadingState message="Analyzing your health data..." />
        ) : suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 ? (
          <View>
            {suggestionsData.suggestions.map((suggestion, index) => {
              const config = CATEGORY_CONFIG[suggestion.category] || CATEGORY_CONFIG.custom;
              return (
                <Pressable
                  key={index}
                  onPress={() => handleAddSuggestion(suggestion)}
                  style={[styles.suggestionCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}
                >
                  <View style={styles.suggestionHeader}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + "20" }]}>
                      <Feather name={config.icon as any} size={16} color={config.color} />
                    </View>
                    <View style={styles.suggestionInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>{suggestion.title}</ThemedText>
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {suggestion.targetValue} {suggestion.targetUnit} {suggestion.frequency}
                      </ThemedText>
                    </View>
                    <Feather name="plus-circle" size={24} color={theme.primary} />
                  </View>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 8 }}>
                    {suggestion.rationale}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.suggestionsEmpty}>
            <Feather name="info" size={24} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 8 }}>
              No suggestions available. Add more health records to get personalized goals.
            </ThemedText>
          </View>
        )}
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
  headerSection: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dashboardSection: {
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  statCardContent: {
    marginLeft: Spacing.md,
  },
  streakIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryBreakdown: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  categoryBars: {
    gap: Spacing.sm,
  },
  categoryBar: {
    marginBottom: 4,
  },
  categoryBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  barBackground: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  goalsContainer: {
    gap: Spacing.md,
  },
  goalCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardTitleSection: {
    flex: 1,
  },
  aiBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    marginLeft: 8,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginHorizontal: Spacing.md,
  },
  streakBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  chartContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  completedSection: {
    marginTop: Spacing.xl,
  },
  completedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formRow: {
    flexDirection: "row",
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginRight: 8,
    borderWidth: 1,
  },
  frequencyRow: {
    flexDirection: "row",
    gap: 8,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  selectedGoalInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  suggestionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionsEmpty: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
});
