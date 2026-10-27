import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface PartnerMetrics {
  totalExchanges: number;
  successRate: number;
  errorCount: number;
  avgLatencyMs: number;
  lastExchange: string;
}

interface PartnerEndpoint {
  name: string;
  fhirVersion: string;
  authMethod: string;
  status: string;
  capabilities: string[];
}

interface Partner {
  id: string;
  name: string;
  type: string;
  status: string;
  exchangePurposes: string[];
  organizationCount: number;
  endpoints: PartnerEndpoint[];
  metrics: PartnerMetrics;
}

interface Exchange {
  id: string;
  queryId: string;
  type: string;
  direction: string;
  networkId: string;
  timestamp: string;
  exchangePurpose: string;
  status: string;
  errorCode?: string;
  documentCount: number;
  auditDetails: {
    requesterOrganization: string;
    consentVerified: boolean;
  };
}

interface ErrorInsight {
  code: string;
  description: string;
  count: number;
  lastSeen: string;
  affectedNetworks: string[];
  severity: string;
}

type TabKey = "partners" | "exchanges" | "errors";

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusDot({ status, theme }: { status: string; theme: any }) {
  const color =
    status === "active" || status === "success"
      ? theme.success
      : status === "error"
        ? theme.error
        : status === "maintenance"
          ? theme.warning
          : theme.textSecondary;
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

function LatencyBadge({ ms, theme }: { ms: number; theme: any }) {
  const color = ms < 200 ? theme.success : ms < 500 ? theme.warning : theme.error;
  return (
    <View style={[styles.latencyBadge, { backgroundColor: color + "18" }]}>
      <ThemedText style={[styles.latencyText, { color }]}>{ms}ms</ThemedText>
    </View>
  );
}

function SeverityBadge({ severity, theme }: { severity: string; theme: any }) {
  const color =
    severity === "high"
      ? theme.error
      : severity === "medium"
        ? theme.warning
        : theme.textSecondary;
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);
  return (
    <View style={[styles.severityBadge, { backgroundColor: color + "18" }]}>
      <ThemedText style={[styles.severityText, { color }]}>{label}</ThemedText>
    </View>
  );
}

export default function TEFCAHubScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("partners");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [filterNetwork, setFilterNetwork] = useState<string | null>(null);

  const partnersQuery = useQuery({
    queryKey: ["/api/tefca/hub/partners"],
    queryFn: async () => {
      const { data } = await axiosInstance.get("/api/tefca/hub/partners");
      return data as { partners: Partner[]; stats: any };
    },
  });

  const exchangesQuery = useQuery({
    queryKey: ["/api/tefca/hub/exchanges", filterNetwork],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (filterNetwork) params.networkId = filterNetwork;
      const { data } = await axiosInstance.get("/api/tefca/hub/exchanges", { params });
      return data as { exchanges: Exchange[]; total: number };
    },
  });

  const errorsQuery = useQuery({
    queryKey: ["/api/tefca/hub/errors"],
    queryFn: async () => {
      const { data } = await axiosInstance.get("/api/tefca/hub/errors");
      return data as {
        errors: ErrorInsight[];
        summary: { totalErrors: number; errorRate: number; mostCommonError: string; highSeverityCount: number };
      };
    },
  });

  const onRefresh = useCallback(() => {
    partnersQuery.refetch();
    exchangesQuery.refetch();
    errorsQuery.refetch();
  }, []);

  const handleTabPress = useCallback((tab: TabKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  }, []);

  const handlePartnerPress = useCallback((partner: Partner) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPartner(partner);
  }, []);

  const handleFilterByNetwork = useCallback((networkId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilterNetwork(networkId);
    setActiveTab("exchanges");
    setSelectedPartner(null);
  }, []);

  const stats = partnersQuery.data?.stats;

  const renderStatsBar = () => {
    if (!stats) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.statValue, { color: theme.primary }]}>
              {stats.activeQHINs}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Active QHINs
            </ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.statValue, { color: theme.success }]}>
              {stats.totalOrganizations > 1000000
                ? `${(stats.totalOrganizations / 1000000).toFixed(1)}M`
                : stats.totalOrganizations > 1000
                  ? `${(stats.totalOrganizations / 1000).toFixed(0)}K`
                  : stats.totalOrganizations}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Organizations
            </ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.statValue, { color: theme.info }]}>
              {stats.supportedPurposes?.length || 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Purposes
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => {
    const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
      { key: "partners", label: "Partners", icon: "globe" },
      { key: "exchanges", label: "Exchanges", icon: "repeat" },
      { key: "errors", label: "Errors", icon: "alert-triangle" },
    ];
    return (
      <View style={styles.tabContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? theme.primary + "15" : "transparent",
                  borderColor: isActive ? theme.primary : "transparent",
                },
              ]}
              onPress={() => handleTabPress(tab.key)}
            >
              <Feather
                name={tab.icon}
                size={16}
                color={isActive ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: isActive ? theme.primary : theme.textSecondary },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderPartnerCard = ({ item, index }: { item: Partner; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Card
        elevation={1}
        onPress={() => handlePartnerPress(item)}
        style={styles.cardSpacing}
      >
        <View style={styles.partnerHeader}>
          <View style={styles.partnerTitleRow}>
            <StatusDot status={item.status} theme={theme} />
            <ThemedText style={styles.partnerName}>{item.name}</ThemedText>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: theme.primary + "15" }]}>
            <ThemedText style={[styles.typeBadgeText, { color: theme.primary }]}>
              {item.type.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricValue, { color: theme.text }]}>
              {item.metrics.totalExchanges}
            </ThemedText>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
              Exchanges
            </ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText
              style={[
                styles.metricValue,
                {
                  color:
                    item.metrics.successRate >= 98
                      ? theme.success
                      : item.metrics.successRate >= 90
                        ? theme.warning
                        : theme.error,
                },
              ]}
            >
              {item.metrics.successRate}%
            </ThemedText>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
              Success
            </ThemedText>
          </View>
          <View style={styles.metricItem}>
            <LatencyBadge ms={item.metrics.avgLatencyMs} theme={theme} />
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
              Avg Latency
            </ThemedText>
          </View>
          <View style={styles.metricItem}>
            <ThemedText style={[styles.metricValue, { color: theme.error }]}>
              {item.metrics.errorCount}
            </ThemedText>
            <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
              Errors
            </ThemedText>
          </View>
        </View>

        <View style={[styles.lastExchangeRow, { borderTopColor: theme.border }]}>
          <Feather name="clock" size={12} color={theme.textSecondary} />
          <ThemedText style={[styles.lastExchangeText, { color: theme.textSecondary }]}>
            Last exchange: {formatRelativeTime(item.metrics.lastExchange)}
          </ThemedText>
          <Pressable
            testID={`view-logs-${item.id}`}
            onPress={() => handleFilterByNetwork(item.id)}
            hitSlop={8}
          >
            <ThemedText style={[styles.viewLogsLink, { color: theme.primary }]}>
              View Logs
            </ThemedText>
          </Pressable>
        </View>
      </Card>
    </Animated.View>
  );

  const renderExchangeRow = ({ item, index }: { item: Exchange; index: number }) => {
    const dirIcon: keyof typeof Feather.glyphMap =
      item.direction === "outbound" ? "arrow-up-right" : "arrow-down-left";
    const dirColor = item.direction === "outbound" ? theme.primary : theme.success;
    return (
      <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
        <View
          style={[
            styles.exchangeRow,
            { backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border },
          ]}
        >
          <View style={styles.exchangeLeft}>
            <View style={[styles.directionIcon, { backgroundColor: dirColor + "15" }]}>
              <Feather name={dirIcon} size={14} color={dirColor} />
            </View>
            <View style={styles.exchangeInfo}>
              <View style={styles.exchangeTitleRow}>
                <ThemedText style={styles.exchangeType}>
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </ThemedText>
                <StatusDot status={item.status} theme={theme} />
              </View>
              <ThemedText style={[styles.exchangeNetwork, { color: theme.textSecondary }]}>
                {item.networkId} - {item.exchangePurpose.replace(/_/g, " ")}
              </ThemedText>
              {item.errorCode ? (
                <ThemedText style={[styles.exchangeError, { color: theme.error }]}>
                  {item.errorCode}
                </ThemedText>
              ) : null}
            </View>
          </View>
          <View style={styles.exchangeRight}>
            <ThemedText style={[styles.exchangeTime, { color: theme.textSecondary }]}>
              {formatDateTime(item.timestamp)}
            </ThemedText>
            {item.documentCount > 0 ? (
              <View style={styles.docCountRow}>
                <Feather name="file" size={11} color={theme.textSecondary} />
                <ThemedText style={[styles.docCountText, { color: theme.textSecondary }]}>
                  {item.documentCount}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderErrorCard = ({ item, index }: { item: ErrorInsight; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Card elevation={1} style={styles.cardSpacing}>
        <View style={styles.errorHeader}>
          <View style={styles.errorTitleRow}>
            <Feather
              name="alert-circle"
              size={16}
              color={
                item.severity === "high"
                  ? theme.error
                  : item.severity === "medium"
                    ? theme.warning
                    : theme.textSecondary
              }
            />
            <ThemedText style={styles.errorCode}>{item.code}</ThemedText>
          </View>
          <View style={styles.errorBadgeRow}>
            <SeverityBadge severity={item.severity} theme={theme} />
            <View style={[styles.countBadge, { backgroundColor: theme.error + "15" }]}>
              <ThemedText style={[styles.countText, { color: theme.error }]}>
                {item.count}x
              </ThemedText>
            </View>
          </View>
        </View>
        <ThemedText style={[styles.errorDescription, { color: theme.textSecondary }]}>
          {item.description}
        </ThemedText>
        <View style={[styles.errorFooter, { borderTopColor: theme.border }]}>
          <View style={styles.networksRow}>
            <Feather name="share-2" size={11} color={theme.textSecondary} />
            <ThemedText style={[styles.networksText, { color: theme.textSecondary }]}>
              {item.affectedNetworks.join(", ")}
            </ThemedText>
          </View>
          <ThemedText style={[styles.lastSeenText, { color: theme.textSecondary }]}>
            {formatRelativeTime(item.lastSeen)}
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );

  const renderPartnerDetail = () => {
    if (!selectedPartner) return null;
    const p = selectedPartner;
    return (
      <Modal
        visible={true}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPartner(null)}
      >
        <ThemedView style={[styles.modalContainer, { paddingTop: insets.top + Spacing.md }]}>
          <View style={styles.modalHeader}>
            <Pressable
              testID="close-partner-detail"
              onPress={() => setSelectedPartner(null)}
              hitSlop={12}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={styles.modalTitle}>{p.name}</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={[1]}
            keyExtractor={() => "detail"}
            renderItem={() => (
              <View style={styles.detailContent}>
                <View style={styles.detailSection}>
                  <ThemedText style={styles.sectionTitle}>Connection Info</ThemedText>
                  <View style={[styles.detailCard, { backgroundColor: theme.backgroundSecondary }]}>
                    <DetailRow label="Status" value={p.status} theme={theme} />
                    <DetailRow label="Type" value={p.type.toUpperCase()} theme={theme} />
                    <DetailRow
                      label="Organizations"
                      value={p.organizationCount.toLocaleString()}
                      theme={theme}
                    />
                    <DetailRow
                      label="Exchange Purposes"
                      value={p.exchangePurposes.map((ep) => ep.replace(/_/g, " ")).join(", ")}
                      theme={theme}
                    />
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <ThemedText style={styles.sectionTitle}>Performance Metrics</ThemedText>
                  <View style={styles.metricsGrid}>
                    <MetricBox
                      label="Total Exchanges"
                      value={p.metrics.totalExchanges.toString()}
                      color={theme.primary}
                      theme={theme}
                    />
                    <MetricBox
                      label="Success Rate"
                      value={`${p.metrics.successRate}%`}
                      color={p.metrics.successRate >= 95 ? theme.success : theme.warning}
                      theme={theme}
                    />
                    <MetricBox
                      label="Avg Latency"
                      value={`${p.metrics.avgLatencyMs}ms`}
                      color={
                        p.metrics.avgLatencyMs < 300
                          ? theme.success
                          : p.metrics.avgLatencyMs < 500
                            ? theme.warning
                            : theme.error
                      }
                      theme={theme}
                    />
                    <MetricBox
                      label="Errors"
                      value={p.metrics.errorCount.toString()}
                      color={p.metrics.errorCount > 10 ? theme.error : theme.textSecondary}
                      theme={theme}
                    />
                  </View>
                </View>

                {p.endpoints.length > 0 ? (
                  <View style={styles.detailSection}>
                    <ThemedText style={styles.sectionTitle}>Endpoints</ThemedText>
                    {p.endpoints.map((ep, i) => (
                      <View
                        key={i}
                        style={[styles.endpointCard, { backgroundColor: theme.backgroundSecondary }]}
                      >
                        <View style={styles.endpointHeader}>
                          <StatusDot status={ep.status} theme={theme} />
                          <ThemedText style={styles.endpointName}>{ep.name}</ThemedText>
                        </View>
                        <View style={styles.endpointTags}>
                          <View style={[styles.tag, { backgroundColor: theme.primary + "15" }]}>
                            <ThemedText style={[styles.tagText, { color: theme.primary }]}>
                              {ep.fhirVersion}
                            </ThemedText>
                          </View>
                          <View style={[styles.tag, { backgroundColor: theme.info + "15" }]}>
                            <ThemedText style={[styles.tagText, { color: theme.info }]}>
                              {ep.authMethod}
                            </ThemedText>
                          </View>
                        </View>
                        <View style={styles.capabilitiesRow}>
                          {ep.capabilities.map((cap, ci) => (
                            <View
                              key={ci}
                              style={[styles.capTag, { backgroundColor: theme.backgroundTertiary }]}
                            >
                              <ThemedText
                                style={[styles.capTagText, { color: theme.textSecondary }]}
                              >
                                {cap}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Pressable
                  testID="view-partner-exchanges"
                  style={[styles.viewExchangesBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleFilterByNetwork(p.id)}
                >
                  <Feather name="list" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.viewExchangesBtnText}>
                    View Exchange Logs
                  </ThemedText>
                </Pressable>
              </View>
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          />
        </ThemedView>
      </Modal>
    );
  };

  const renderFilterBar = () => {
    if (activeTab !== "exchanges") return null;
    return (
      <View style={styles.filterBar}>
        <Pressable
          testID="filter-all-networks"
          style={[
            styles.filterChip,
            {
              backgroundColor: filterNetwork === null ? theme.primary + "15" : theme.backgroundSecondary,
              borderColor: filterNetwork === null ? theme.primary : "transparent",
            },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFilterNetwork(null);
          }}
        >
          <ThemedText
            style={[
              styles.filterChipText,
              { color: filterNetwork === null ? theme.primary : theme.textSecondary },
            ]}
          >
            All Networks
          </ThemedText>
        </Pressable>
        {(partnersQuery.data?.partners || []).slice(0, 4).map((p) => (
          <Pressable
            key={p.id}
            testID={`filter-${p.id}`}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterNetwork === p.id ? theme.primary + "15" : theme.backgroundSecondary,
                borderColor: filterNetwork === p.id ? theme.primary : "transparent",
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFilterNetwork(p.id);
            }}
          >
            <ThemedText
              style={[
                styles.filterChipText,
                { color: filterNetwork === p.id ? theme.primary : theme.textSecondary },
              ]}
            >
              {p.name.length > 14 ? p.name.substring(0, 12) + "..." : p.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderErrorSummary = () => {
    const summary = errorsQuery.data?.summary;
    if (!summary) return null;
    return (
      <Animated.View entering={FadeInDown}>
        <View style={styles.errorSummaryRow}>
          <View style={[styles.errorSummaryBox, { backgroundColor: theme.error + "12" }]}>
            <ThemedText style={[styles.errorSummaryValue, { color: theme.error }]}>
              {summary.totalErrors}
            </ThemedText>
            <ThemedText style={[styles.errorSummaryLabel, { color: theme.textSecondary }]}>
              Total Errors
            </ThemedText>
          </View>
          <View style={[styles.errorSummaryBox, { backgroundColor: theme.warning + "12" }]}>
            <ThemedText style={[styles.errorSummaryValue, { color: theme.warning }]}>
              {summary.errorRate}%
            </ThemedText>
            <ThemedText style={[styles.errorSummaryLabel, { color: theme.textSecondary }]}>
              Error Rate
            </ThemedText>
          </View>
          <View style={[styles.errorSummaryBox, { backgroundColor: theme.error + "12" }]}>
            <ThemedText style={[styles.errorSummaryValue, { color: theme.error }]}>
              {summary.highSeverityCount}
            </ThemedText>
            <ThemedText style={[styles.errorSummaryLabel, { color: theme.textSecondary }]}>
              High Severity
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    );
  };

  const isLoading =
    (activeTab === "partners" && partnersQuery.isLoading) ||
    (activeTab === "exchanges" && exchangesQuery.isLoading) ||
    (activeTab === "errors" && errorsQuery.isLoading);

  const isRefreshing =
    partnersQuery.isRefetching || exchangesQuery.isRefetching || errorsQuery.isRefetching;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        testID="tefca-hub-list"
        data={
          activeTab === "partners"
            ? partnersQuery.data?.partners || []
            : activeTab === "exchanges"
              ? exchangesQuery.data?.exchanges || []
              : errorsQuery.data?.errors || []
        }
        keyExtractor={(item: any) => item.id || item.code}
        renderItem={
          activeTab === "partners"
            ? (renderPartnerCard as any)
            : activeTab === "exchanges"
              ? (renderExchangeRow as any)
              : (renderErrorCard as any)
        }
        ListHeaderComponent={
          <View>
            {renderStatsBar()}
            {renderTabs()}
            {activeTab === "exchanges" ? renderFilterBar() : null}
            {activeTab === "errors" ? renderErrorSummary() : null}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyContainer}>
              <Feather
                name={
                  activeTab === "partners"
                    ? "globe"
                    : activeTab === "exchanges"
                      ? "repeat"
                      : "check-circle"
                }
                size={48}
                color={theme.textSecondary}
              />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {activeTab === "partners"
                  ? "No TEFCA partners found"
                  : activeTab === "exchanges"
                    ? "No exchange logs available"
                    : "No errors recorded"}
              </ThemedText>
            </View>
          )
        }
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {renderPartnerDetail()}
    </ThemedView>
  );
}

function DetailRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

function MetricBox({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: string;
  color: string;
  theme: any;
}) {
  return (
    <View style={[styles.metricBox, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText style={[styles.metricBoxValue, { color }]}>{value}</ThemedText>
      <ThemedText style={[styles.metricBoxLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  cardSpacing: {
    marginBottom: Spacing.sm,
  },
  partnerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  partnerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  metricItem: {
    alignItems: "center",
    gap: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  metricLabel: {
    fontSize: 10,
  },
  latencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  latencyText: {
    fontSize: 13,
    fontWeight: "700",
  },
  lastExchangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  lastExchangeText: {
    fontSize: 12,
    flex: 1,
  },
  viewLogsLink: {
    fontSize: 12,
    fontWeight: "600",
  },
  exchangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  exchangeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  directionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exchangeInfo: {
    flex: 1,
  },
  exchangeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exchangeType: {
    fontSize: 14,
    fontWeight: "600",
  },
  exchangeNetwork: {
    fontSize: 12,
    marginTop: 1,
  },
  exchangeError: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  exchangeRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  exchangeTime: {
    fontSize: 11,
  },
  docCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  docCountText: {
    fontSize: 11,
  },
  filterBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  errorSummaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorSummaryBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorSummaryValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  errorSummaryLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  errorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  errorTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorCode: {
    fontSize: 15,
    fontWeight: "700",
  },
  errorBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  severityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
  },
  errorDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  errorFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  networksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  networksText: {
    fontSize: 11,
    flexShrink: 1,
  },
  lastSeenText: {
    fontSize: 11,
  },
  loadingContainer: {
    paddingVertical: Spacing["4xl"],
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  detailContent: {
    paddingHorizontal: Spacing.md,
  },
  detailSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  detailCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  metricBox: {
    width: "47%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  metricBoxValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  metricBoxLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  endpointCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  endpointHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  endpointName: {
    fontSize: 14,
    fontWeight: "600",
  },
  endpointTags: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  capabilitiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  capTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  capTagText: {
    fontSize: 10,
  },
  viewExchangesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  viewExchangesBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
