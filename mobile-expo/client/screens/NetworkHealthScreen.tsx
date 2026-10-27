import React, { useState, useCallback } from "react";
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type Status = "healthy" | "degraded" | "critical" | "unknown";

interface EndpointData {
  id: string;
  endpointId: string;
  endpointName: string;
  networkId: string;
  networkName: string;
  networkType: string;
  baseUrl: string;
  connectionStatus: Status;
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  lastCheckedAt: string;
  consecutiveFailures: number;
  alertSentAt: string | null;
}

interface DashboardData {
  endpoints: EndpointData[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    critical: number;
    unknown: number;
    averageLatencyMs: number;
    lastCheckTime: string | null;
  };
}

type FilterType = "all" | "healthy" | "degraded" | "critical" | "qhin" | "ehr" | "aggregator";

const STATUS_CONFIG: Record<Status, { color: string; bg: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
  healthy: { color: "#22C55E", bg: "#22C55E15", icon: "check-circle", label: "Healthy" },
  degraded: { color: "#F59E0B", bg: "#F59E0B15", icon: "alert-triangle", label: "Degraded" },
  critical: { color: "#EF4444", bg: "#EF444415", icon: "x-circle", label: "Critical" },
  unknown: { color: "#6B7280", bg: "#6B728015", icon: "help-circle", label: "Unknown" },
};

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "degraded", label: "Degraded" },
  { key: "healthy", label: "Healthy" },
  { key: "qhin", label: "QHIN" },
  { key: "ehr", label: "EHR" },
  { key: "aggregator", label: "Aggregator" },
];

export default function NetworkHealthScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

  const { data: dashboard, isLoading, isRefetching } = useQuery<DashboardData>({
    queryKey: ["/api/network-health/dashboard"],
    refetchInterval: 30000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/network-health/refresh");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/network-health/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    refreshMutation.mutate();
  }, [refreshMutation]);

  const filteredEndpoints = (dashboard?.endpoints || []).filter((ep) => {
    if (filter === "all") return true;
    if (filter === "healthy" || filter === "degraded" || filter === "critical") {
      return ep.connectionStatus === filter;
    }
    return ep.networkType === filter;
  });

  const summary = dashboard?.summary;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundDefault }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshMutation.isPending}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading network status...
          </ThemedText>
        </View>
      ) : (
        <>
          {summary ? (
            <>
              <View style={styles.trafficLightRow}>
                <TrafficLight
                  testID="status-healthy"
                  count={summary.healthy}
                  label="Healthy"
                  color="#22C55E"
                  total={summary.total}
                  colors={colors}
                  isDark={isDark}
                />
                <TrafficLight
                  testID="status-degraded"
                  count={summary.degraded}
                  label="Degraded"
                  color="#F59E0B"
                  total={summary.total}
                  colors={colors}
                  isDark={isDark}
                />
                <TrafficLight
                  testID="status-critical"
                  count={summary.critical}
                  label="Critical"
                  color="#EF4444"
                  total={summary.total}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              <View style={[styles.statsBar, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary, borderColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Feather name="activity" size={14} color={colors.primary} />
                  <ThemedText style={[styles.statValue, { color: colors.text }]}>{summary.averageLatencyMs}ms</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Latency</ThemedText>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Feather name="server" size={14} color={colors.primary} />
                  <ThemedText style={[styles.statValue, { color: colors.text }]}>{summary.total}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Endpoints</ThemedText>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Feather name="clock" size={14} color={colors.primary} />
                  <ThemedText style={[styles.statValue, { color: colors.text }]}>
                    {summary.lastCheckTime ? formatTimeAgo(summary.lastCheckTime) : "Never"}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Last Check</ThemedText>
                </View>
              </View>
            </>
          ) : null}

          <Pressable
            testID="refresh-btn"
            style={[styles.refreshBtn, { backgroundColor: colors.primary }]}
            onPress={handleRefresh}
            disabled={refreshMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Refresh all endpoint health checks"
          >
            {refreshMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="refresh-cw" size={16} color="#FFF" />
                <ThemedText style={styles.refreshBtnText}>Run Health Check</ThemedText>
              </>
            )}
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterContent}
          >
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  testID={`filter-${f.key}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.primary : isDark ? "rgba(255,255,255,0.06)" : colors.backgroundSecondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${f.label}`}
                >
                  <ThemedText style={[styles.filterText, { color: active ? "#FFF" : colors.text }]}>
                    {f.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {filteredEndpoints.length} Endpoint{filteredEndpoints.length !== 1 ? "s" : ""}
          </ThemedText>

          {filteredEndpoints.map((ep) => (
            <EndpointCard
              key={ep.endpointId}
              endpoint={ep}
              expanded={expandedEndpoint === ep.endpointId}
              onToggle={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setExpandedEndpoint(expandedEndpoint === ep.endpointId ? null : ep.endpointId);
              }}
              colors={colors}
              isDark={isDark}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function TrafficLight({ testID, count, label, color, total, colors, isDark }: {
  testID: string;
  count: number;
  label: string;
  color: string;
  total: number;
  colors: any;
  isDark: boolean;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  const isActive = count > 0;
  return (
    <View
      testID={testID}
      style={[
        styles.trafficLight,
        {
          backgroundColor: isActive ? color + "12" : isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary,
          borderColor: isActive ? color + "40" : colors.border,
        },
      ]}
    >
      <View style={[styles.trafficDot, { backgroundColor: isActive ? color : colors.border, shadowColor: isActive ? color : "transparent", shadowOpacity: isActive ? 0.6 : 0, shadowRadius: 8, elevation: isActive ? 4 : 0 }]} />
      <ThemedText style={[styles.trafficCount, { color: isActive ? color : colors.textSecondary }]}>
        {count}
      </ThemedText>
      <ThemedText style={[styles.trafficLabel, { color: colors.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.trafficPct, { color: colors.textSecondary }]}>
        {percentage}%
      </ThemedText>
    </View>
  );
}

function EndpointCard({ endpoint, expanded, onToggle, colors, isDark }: {
  endpoint: EndpointData;
  expanded: boolean;
  onToggle: () => void;
  colors: any;
  isDark: boolean;
}) {
  const status = STATUS_CONFIG[endpoint.connectionStatus] || STATUS_CONFIG.unknown;
  const typeLabel = endpoint.networkType === "qhin" ? "QHIN" : endpoint.networkType === "ehr" ? "EHR" : "Aggregator";

  return (
    <Pressable
      testID={`endpoint-${endpoint.endpointId}`}
      style={[
        styles.endpointCard,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary,
          borderColor: colors.border,
          borderLeftColor: status.color,
          borderLeftWidth: 3,
        },
      ]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${endpoint.endpointName} - ${status.label}`}
    >
      <View style={styles.endpointHeader}>
        <View style={styles.endpointLeft}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.endpointName, { color: colors.text }]} numberOfLines={1}>
              {endpoint.endpointName}
            </ThemedText>
            <ThemedText style={[styles.networkName, { color: colors.textSecondary }]} numberOfLines={1}>
              {endpoint.networkName}
            </ThemedText>
          </View>
        </View>
        <View style={styles.endpointRight}>
          <View style={[styles.typeBadge, { backgroundColor: colors.border + "60" }]}>
            <ThemedText style={[styles.typeText, { color: colors.textSecondary }]}>{typeLabel}</ThemedText>
          </View>
          {endpoint.latencyMs !== null ? (
            <ThemedText style={[styles.latencyText, { color: getLatencyColor(endpoint.latencyMs) }]}>
              {endpoint.latencyMs}ms
            </ThemedText>
          ) : null}
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
        </View>
      </View>

      {expanded ? (
        <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
          <DetailRow label="Status" value={status.label} valueColor={status.color} colors={colors} />
          <DetailRow label="URL" value={endpoint.baseUrl} colors={colors} />
          <DetailRow label="HTTP Status" value={endpoint.statusCode ? String(endpoint.statusCode) : "N/A"} colors={colors} />
          <DetailRow label="Latency" value={endpoint.latencyMs !== null ? `${endpoint.latencyMs}ms` : "N/A"} valueColor={endpoint.latencyMs !== null ? getLatencyColor(endpoint.latencyMs) : undefined} colors={colors} />
          <DetailRow label="Last Checked" value={formatTimeAgo(endpoint.lastCheckedAt)} colors={colors} />
          <DetailRow label="Consecutive Failures" value={String(endpoint.consecutiveFailures)} valueColor={endpoint.consecutiveFailures > 0 ? "#EF4444" : "#22C55E"} colors={colors} />
          {endpoint.errorMessage ? (
            <View style={[styles.errorBanner, { backgroundColor: "#EF444410", borderColor: "#EF444430" }]}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <ThemedText style={[styles.errorText, { color: "#EF4444" }]}>{endpoint.errorMessage}</ThemedText>
            </View>
          ) : null}
          {endpoint.alertSentAt ? (
            <View style={[styles.alertBanner, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B30" }]}>
              <Feather name="bell" size={14} color="#F59E0B" />
              <ThemedText style={[styles.alertText, { color: "#F59E0B" }]}>
                Alert sent {formatTimeAgo(endpoint.alertSentAt)}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function DetailRow({ label, value, valueColor, colors }: {
  label: string;
  value: string;
  valueColor?: string;
  colors: any;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
      <ThemedText style={[styles.detailValue, { color: valueColor || colors.text }]} numberOfLines={1}>{value}</ThemedText>
    </View>
  );
}

function getLatencyColor(ms: number): string {
  if (ms < 300) return "#22C55E";
  if (ms < 1000) return "#F59E0B";
  return "#EF4444";
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  trafficLightRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  trafficLight: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  trafficDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 4,
  },
  trafficCount: {
    fontSize: 24,
    fontWeight: "800",
  },
  trafficLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  trafficPct: {
    fontSize: 10,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  statItem: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  refreshBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterContent: {
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  endpointCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  endpointHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  endpointLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  endpointName: {
    fontSize: 14,
    fontWeight: "600",
  },
  networkName: {
    fontSize: 11,
  },
  endpointRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  typeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  latencyText: {
    fontSize: 12,
    fontWeight: "700",
  },
  expandedSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: 4,
  },
  alertText: {
    fontSize: 12,
    flex: 1,
  },
});
