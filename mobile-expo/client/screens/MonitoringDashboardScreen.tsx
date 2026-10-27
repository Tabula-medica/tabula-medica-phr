import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import { MetricCard, StatsGrid } from "@/components/MetricCard";

interface MetricsSummary {
  totalRequests: number;
  errorCount: number;
  avgLatency: number;
  byEndpoint: Record<string, { count: number; errors: number; avgLatency: number }>;
}

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  isResolved: boolean;
  createdAt: string;
}

interface TimeSeriesData {
  hour: string;
  requests: number;
  errors: number;
  avgLatency: number;
}

export default function MonitoringDashboardScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState(24);

  const { data: metricsData, isLoading: metricsLoading, refetch } = useQuery<{
    summary: MetricsSummary;
    timeSeriesData: TimeSeriesData[];
  }>({
    queryKey: ["/api/fhir/monitoring/metrics", String(selectedPeriod)],
  });

  const { data: alertsData } = useQuery<{
    alerts: Alert[];
    unresolvedCount: number;
  }>({
    queryKey: ["/api/fhir/monitoring/alerts"],
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/fhir/monitoring/alerts/${alertId}/resolve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/monitoring/alerts"] });
    },
  });

  const summary = metricsData?.summary;
  const alerts = alertsData?.alerts || [];
  const unresolvedAlerts = alerts.filter(a => !a.isResolved);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return theme.error;
      case "error":
        return theme.error;
      case "warning":
        return theme.warning;
      default:
        return theme.primary;
    }
  };

  if (metricsLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => refetch()} />
      }
    >
      <View style={styles.periodSelector}>
        {[6, 24, 72, 168].map(hours => (
          <Pressable
            key={hours}
            style={[
              styles.periodButton,
              { backgroundColor: selectedPeriod === hours ? theme.primary : theme.backgroundSecondary },
            ]}
            onPress={() => setSelectedPeriod(hours)}
          >
            <Text
              style={[
                styles.periodButtonText,
                { color: selectedPeriod === hours ? "#FFF" : theme.text },
              ]}
            >
              {hours === 168 ? "7d" : `${hours}h`}
            </Text>
          </Pressable>
        ))}
      </View>

      <StatsGrid>
        <MetricCard value={summary?.totalRequests || 0} label="Total Requests" color={theme.primary} />
        <MetricCard value={summary?.errorCount || 0} label="Errors" color={theme.error} />
        <MetricCard value={`${summary?.avgLatency || 0}ms`} label="Avg Latency" color={theme.success} />
        <MetricCard value={`${summary?.totalRequests && summary?.errorCount ? ((summary.errorCount / summary.totalRequests) * 100).toFixed(1) : 0}%`} label="Error Rate" color={theme.warning} />
      </StatsGrid>

      <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Active Alerts
          </Text>
          {unresolvedAlerts.length > 0 ? (
            <View style={[styles.alertBadge, { backgroundColor: theme.error }]}>
              <Text style={styles.alertBadgeText}>{unresolvedAlerts.length}</Text>
            </View>
          ) : null}
        </View>

        {unresolvedAlerts.length === 0 ? (
          <View style={styles.emptyAlerts}>
            <Feather name="check-circle" size={32} color={theme.success} />
            <Text style={[styles.emptyAlertsText, { color: theme.textSecondary }]}>
              No active alerts
            </Text>
          </View>
        ) : (
          unresolvedAlerts.slice(0, 5).map(alert => (
            <View
              key={alert.id}
              style={[styles.alertItem, { borderLeftColor: getSeverityColor(alert.severity) }]}
            >
              <View style={styles.alertContent}>
                <View style={styles.alertHeader}>
                  <Text style={[styles.alertTitle, { color: theme.text }]}>{alert.title}</Text>
                  <Text
                    style={[
                      styles.alertSeverity,
                      { color: getSeverityColor(alert.severity) },
                    ]}
                  >
                    {alert.severity.toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                  {alert.message}
                </Text>
                <Text style={[styles.alertTime, { color: theme.textSecondary }]}>
                  {new Date(alert.createdAt).toLocaleString()}
                </Text>
              </View>
              <Pressable
                style={[styles.resolveButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => resolveAlertMutation.mutate(alert.id)}
              >
                <Feather name="check" size={16} color={theme.success} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Endpoint Performance
        </Text>

        {Object.entries(summary?.byEndpoint || {}).length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No endpoint data available yet
          </Text>
        ) : (
          Object.entries(summary?.byEndpoint || {}).map(([endpoint, data]) => (
            <View key={endpoint} style={styles.endpointRow}>
              <View style={styles.endpointInfo}>
                <Text style={[styles.endpointName, { color: theme.text }]} numberOfLines={1}>
                  {endpoint}
                </Text>
                <View style={styles.endpointStats}>
                  <Text style={[styles.endpointStat, { color: theme.textSecondary }]}>
                    {data.count} requests
                  </Text>
                  <Text style={[styles.endpointStat, { color: theme.error }]}>
                    {data.errors} errors
                  </Text>
                  <Text style={[styles.endpointStat, { color: theme.success }]}>
                    {data.avgLatency}ms avg
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={{ height: Spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  periodButtonText: {
    ...Typography.small,
    fontWeight: "600",
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  alertBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  alertBadgeText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 12,
  },
  emptyAlerts: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyAlertsText: {
    ...Typography.body,
    marginTop: Spacing.sm,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderLeftWidth: 4,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertTitle: {
    ...Typography.h4,
    flex: 1,
  },
  alertSeverity: {
    fontSize: 10,
    fontWeight: "700",
  },
  alertMessage: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  alertTime: {
    fontSize: 11,
    marginTop: Spacing.xs,
  },
  resolveButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  endpointRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  endpointInfo: {
    flex: 1,
  },
  endpointName: {
    ...Typography.body,
    fontWeight: "500",
  },
  endpointStats: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  endpointStat: {
    fontSize: 12,
  },
});
