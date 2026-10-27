import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface PathwayAssignment {
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
  lastActivityAt: string | null;
  pathway?: {
    id: string;
    title: string;
    description: string;
    condition: string;
    category: string;
    targetDurationDays: number;
    difficultyLevel: string;
    totalSteps: number;
  };
  steps?: any[];
  stepProgress?: any[];
  nudges?: any[];
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

export default function CarePathwaysScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const { theme: colors } = useTheme();

  const { data: assignments, isLoading, refetch } = useQuery<PathwayAssignment[]>({
    queryKey: ["/api/user/pathway-assignments"],
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return colors.success;
      case "completed":
        return colors.primary;
      case "paused":
        return colors.warning;
      case "abandoned":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getAdherenceColor = (score: number) => {
    if (score >= 80) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.error;
  };

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    switch (category) {
      case "chronic_management":
        return "activity";
      case "acute_care":
        return "zap";
      case "preventive":
        return "shield";
      case "rehabilitation":
        return "trending-up";
      case "mental_health":
        return "heart";
      default:
        return "clipboard";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderProgressBar = (percentage: number) => (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${Math.min(100, percentage)}%`,
              backgroundColor: percentage >= 75 ? colors.success : colors.primary,
            },
          ]}
        />
      </View>
      <ThemedText style={[styles.progressText, { color: colors.text }]}>{percentage}%</ThemedText>
    </View>
  );

  const renderNudgeBadge = (nudges: PathwayNudge[] | undefined) => {
    const unreadCount = nudges?.filter((n) => !n.readAt).length || 0;
    if (unreadCount === 0) return null;

    return (
      <View style={[styles.nudgeBadge, { backgroundColor: colors.error }]}>
        <ThemedText style={styles.nudgeBadgeText}>{unreadCount}</ThemedText>
      </View>
    );
  };

  const renderAssignmentCard = (assignment: PathwayAssignment) => (
    <Pressable
      key={assignment.id}
      onPress={() =>
        navigation.navigate("PathwayDetail", { assignmentId: assignment.id })
      }
      testID={`pathway-assignment-${assignment.id}`}
    >
      <Card style={styles.assignmentCard}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: `${colors.primary}20` },
            ]}
          >
            <Feather
              name={getCategoryIcon(assignment.pathway?.category || "")}
              size={24}
              color={colors.primary}
            />
          </View>
          <View style={styles.cardHeaderText}>
            <View style={styles.titleRow}>
              <ThemedText type="h4" numberOfLines={1} style={styles.pathwayTitle}>
                {assignment.pathway?.title || "Care Pathway"}
              </ThemedText>
              {renderNudgeBadge(assignment.nudges)}
            </View>
            <ThemedText style={[styles.conditionText, { color: colors.textSecondary }]}>
              {assignment.pathway?.condition}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(assignment.status)}20` },
            ]}
          >
            <ThemedText
              style={[styles.statusText, { color: getStatusColor(assignment.status) }]}
            >
              {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.progressSection}>
          <ThemedText style={[styles.progressLabel, { color: colors.textSecondary }]}>Progress</ThemedText>
          {renderProgressBar(assignment.progressPercentage)}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
              {assignment.stepsCompleted}/{assignment.pathway?.totalSteps || 0} steps
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather
              name="heart"
              size={16}
              color={getAdherenceColor(assignment.adherenceScore)}
            />
            <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
              {assignment.adherenceScore}% adherence
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="star" size={16} color={colors.warning} />
            <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>
              {assignment.totalPointsEarned} pts
            </ThemedText>
          </View>
        </View>

        <View style={styles.dateRow}>
          <ThemedText style={[styles.dateText, { color: colors.textSecondary }]}>
            Started: {formatDate(assignment.startDate)}
          </ThemedText>
          <ThemedText style={[styles.dateText, { color: colors.textSecondary }]}>
            Expected: {formatDate(assignment.expectedEndDate)}
          </ThemedText>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <ThemedText style={[styles.phaseText, { color: colors.textSecondary }]}>
            Phase {assignment.currentPhase} •{" "}
            {assignment.pathway?.difficultyLevel || "Standard"}
          </ThemedText>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );

  const activeAssignments = assignments?.filter((a) => a.status === "active") || [];
  const pendingAssignments = assignments?.filter((a) => a.status === "pending") || [];
  const completedAssignments = assignments?.filter(
    (a) => a.status === "completed" || a.status === "graduated"
  ) || [];

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your care pathways...</ThemedText>
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
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {!assignments || assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="map" size={48} color={colors.textSecondary} />
            </View>
            <ThemedText type="h3" style={styles.emptyTitle}>
              No Care Pathways Yet
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              Your healthcare provider can assign personalized care pathways to help
              you manage your health conditions. Check back soon or contact your
              provider.
            </ThemedText>
          </View>
        ) : (
          <>
            {activeAssignments.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="play-circle" size={20} color={colors.success} />
                  <ThemedText type="h3" style={styles.sectionTitle}>
                    Active Pathways
                  </ThemedText>
                </View>
                {activeAssignments.map(renderAssignmentCard)}
              </View>
            ) : null}

            {pendingAssignments.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="clock" size={20} color={colors.warning} />
                  <ThemedText type="h3" style={styles.sectionTitle}>
                    Pending Pathways
                  </ThemedText>
                </View>
                {pendingAssignments.map(renderAssignmentCard)}
              </View>
            ) : null}

            {completedAssignments.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="award" size={20} color={colors.primary} />
                  <ThemedText type="h3" style={styles.sectionTitle}>
                    Completed Pathways
                  </ThemedText>
                </View>
                {completedAssignments.map(renderAssignmentCard)}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
  },
  assignmentCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pathwayTitle: {
    flex: 1,
  },
  conditionText: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  nudgeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  nudgeBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    width: 40,
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 13,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  dateText: {
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  phaseText: {
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
});
