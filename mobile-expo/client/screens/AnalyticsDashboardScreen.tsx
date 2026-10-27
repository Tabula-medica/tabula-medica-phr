import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { MetricCard, StatsGrid } from "@/components/MetricCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface DashboardData {
  predictions: {
    recent: Array<{
      id: string;
      title: string;
      summary: string;
      confidence: number;
      riskLevel: string;
      category: string;
      timeframe: string;
    }>;
    highRiskCount: number;
  };
  anomalies: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  recentQueries: Array<{
    id: string;
    query: string;
    resultSummary: string;
    createdAt: string;
  }>;
  populationInsights: Array<{
    id: string;
    analysisType: string;
    insights: string[];
  }>;
  lastUpdated: string;
}

type ThemeColors = typeof Colors.light;

interface QuickActionCardProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  color: string;
  colors: ThemeColors;
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
  color,
  colors,
}: QuickActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionCard,
        { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <ThemedText type="body" style={{ fontWeight: "600", marginBottom: 4 }}>
        {title}
      </ThemedText>
      <ThemedText type="caption" style={{ color: colors.textSecondary }}>
        {subtitle}
      </ThemedText>
    </Pressable>
  );
}

interface PredictionCardProps {
  prediction: DashboardData["predictions"]["recent"][0];
  colors: ThemeColors;
  onPress?: () => void;
}

function PredictionCard({ prediction, colors, onPress }: PredictionCardProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical":
        return colors.error;
      case "high":
        return "#FF6B35";
      case "moderate":
        return colors.warning;
      default:
        return colors.success;
    }
  };

  const inner = (
    <>
      <View style={styles.predictionHeader}>
        <View
          style={[
            styles.riskBadge,
            { backgroundColor: `${getRiskColor(prediction.riskLevel)}15` },
          ]}
        >
          <ThemedText
            type="caption"
            style={{ color: getRiskColor(prediction.riskLevel) }}
          >
            {prediction.riskLevel?.toUpperCase() || "LOW"}
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: colors.textSecondary }}>
          {prediction.confidence}% confidence
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
        {prediction.title}
      </ThemedText>
      <ThemedText
        type="caption"
        numberOfLines={2}
        style={{ color: colors.textSecondary, marginTop: 4 }}
      >
        {prediction.summary}
      </ThemedText>
      <View style={styles.predictionFooter}>
        <ThemedText type="caption" style={{ color: colors.primary }}>
          {prediction.category} - {prediction.timeframe?.replace("_", " ")}
        </ThemedText>
        {onPress ? <Feather name="chevron-right" size={16} color={colors.textSecondary} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.predictionCard, { backgroundColor: colors.backgroundSecondary }]}>
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.predictionCard,
        { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {inner}
    </Pressable>
  );
}

export default function AnalyticsDashboardScreen() {
  const { theme: colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/analytics/dashboard"],
  });

  const generatePredictionsMutation = useMutation({
    mutationFn: async (params: { category: string; timeframe: string }) => {
      return apiRequest("POST", "/api/analytics/predictions", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const detectAnomaliesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/analytics/anomalies/detect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    setRefreshing(false);
  }, [queryClient]);

  const handleAskQuestion = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("NaturalLanguageQuery");
  };

  const handleGeneratePredictions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    generatePredictionsMutation.mutate({ category: "general", timeframe: "next_month" });
  };

  const handleDetectAnomalies = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    detectAnomaliesMutation.mutate();
  };

  const handleViewAnomalies = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleDetectAnomalies();
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.md }}>
          Loading analytics...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <ThemedText type="h2" style={{ marginBottom: Spacing.sm }}>
        AI Health Insights
      </ThemedText>
      <ThemedText
        type="body"
        style={{ color: colors.textSecondary, marginBottom: Spacing.lg }}
      >
        Powered by advanced AI to analyze your health data
      </ThemedText>

      <View style={styles.quickActionsRow}>
        <QuickActionCard
          icon="message-circle"
          title="Ask a Question"
          subtitle="Natural language search"
          onPress={handleAskQuestion}
          color={colors.primary}
          colors={colors}
        />
        <QuickActionCard
          icon="trending-up"
          title="Generate Predictions"
          subtitle="Health trend analysis"
          onPress={handleGeneratePredictions}
          color="#8B5CF6"
          colors={colors}
        />
      </View>

      <View style={styles.quickActionsRow}>
        <QuickActionCard
          icon="alert-triangle"
          title="Detect Anomalies"
          subtitle="Find data issues"
          onPress={handleDetectAnomalies}
          color={colors.warning}
          colors={colors}
        />
        <QuickActionCard
          icon="users"
          title="Population Analysis"
          subtitle="At-risk identification"
          onPress={() => navigation.navigate("AnalyticsDashboard" as any)}
          color={colors.success}
          colors={colors}
        />
      </View>

      <ThemedText type="h3" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
        Data Quality Overview
      </ThemedText>

      <StatsGrid>
        <MetricCard label="Total Issues" value={dashboard?.anomalies.total || 0} icon="alert-circle" color={colors.textSecondary} />
        <MetricCard label="Critical" value={dashboard?.anomalies.critical || 0} icon="x-circle" color={colors.error} />
        <MetricCard label="Warnings" value={dashboard?.anomalies.warning || 0} icon="alert-triangle" color={colors.warning} />
      </StatsGrid>

      {(dashboard?.anomalies.total || 0) > 0 ? (
        <Pressable
          onPress={handleViewAnomalies}
          style={({ pressed }) => [
            styles.viewAllButton,
            { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <ThemedText type="body" style={{ fontWeight: "600", color: colors.primary }}>
            View All Anomalies
          </ThemedText>
          <Feather name="arrow-right" size={18} color={colors.primary} />
        </Pressable>
      ) : null}

      <ThemedText type="h3" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
        Recent Predictions
      </ThemedText>

      {(dashboard?.predictions.recent.length || 0) > 0 ? (
        dashboard?.predictions.recent.map((prediction) => (
          <PredictionCard
            key={prediction.id}
            prediction={prediction}
            colors={colors}
          />
        ))
      ) : (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundSecondary }]}>
          <Feather name="bar-chart-2" size={32} color={colors.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: colors.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}
          >
            No predictions yet. Tap "Generate Predictions" to analyze your health trends.
          </ThemedText>
        </View>
      )}

      {dashboard?.predictions.highRiskCount && dashboard.predictions.highRiskCount > 0 ? (
        <View style={[styles.alertBanner, { backgroundColor: `${colors.error}15` }]}>
          <Feather name="alert-circle" size={20} color={colors.error} />
          <ThemedText type="body" style={{ fontWeight: "600", color: colors.error, marginLeft: Spacing.sm }}>
            {dashboard.predictions.highRiskCount} high-risk prediction{dashboard.predictions.highRiskCount > 1 ? "s" : ""} require attention
          </ThemedText>
        </View>
      ) : null}

      <ThemedText type="h3" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
        Recent Queries
      </ThemedText>

      {(dashboard?.recentQueries.length || 0) > 0 ? (
        dashboard?.recentQueries.map((query) => (
          <View
            key={query.id}
            style={[styles.queryCard, { backgroundColor: colors.backgroundSecondary }]}
          >
            <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
              "{query.query}"
            </ThemedText>
            <ThemedText
              type="caption"
              numberOfLines={2}
              style={{ color: colors.textSecondary, marginTop: 4 }}
            >
              {query.resultSummary || "No results"}
            </ThemedText>
          </View>
        ))
      ) : (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundSecondary }]}>
          <Feather name="message-circle" size={32} color={colors.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: colors.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}
          >
            No queries yet. Ask a question about your health data to get started.
          </ThemedText>
        </View>
      )}

      <ThemedText
        type="caption"
        style={{
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: Spacing.xl,
        }}
      >
        Last updated: {dashboard?.lastUpdated ? new Date(dashboard.lastUpdated).toLocaleString() : "N/A"}
      </ThemedText>

      <View style={[styles.disclaimerBox, { backgroundColor: `${colors.warning}10` }]}>
        <Feather name="info" size={16} color={colors.warning} />
        <ThemedText type="caption" style={{ color: colors.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
          AI insights are for educational purposes only. Always consult healthcare providers for medical decisions.
        </ThemedText>
      </View>
    </ScrollView>
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
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  quickActionCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  predictionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  predictionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  predictionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  queryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
});
