import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

type TabKey = "patterns" | "anomalies" | "alerts";

interface HeatmapCell { hour: number; day: string; count: number }
interface DailyVolume { date: string; total: number; highRisk: number; breakGlass: number }
interface TopPatient { patientId: string; accessCount: number; lastAccessed: string; uniqueAccessors: number }
interface TopUser { userId: string; accessCount: number; avgRiskScore: number; lastActive: string }
interface ResourceEntry { resourceType: string; count: number; highRiskPct: number }
interface AlertEntry { id: string; type: string; description: string; severity: string; timestamp: string; userId: string }

interface AccessPatternsResponse {
  hourlyHeatmap: HeatmapCell[];
  dailyVolume: DailyVolume[];
  topPatients: TopPatient[];
  topUsers: TopUser[];
  resourceBreakdown: ResourceEntry[];
  recentAlerts: AlertEntry[];
}

interface AuditReport {
  totalAccesses: number;
  uniqueUsers: number;
  uniquePatients: number;
  highRiskCount: number;
  breakGlassCount: number;
  averageRiskScore: number;
}

interface PatientAuditLog {
  id: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId?: string;
  riskScore?: number;
  breakGlass?: boolean;
  accessReason?: string;
  createdAt: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: keyof typeof Feather.glyphMap }> = {
  critical: { color: "#DC2626", icon: "alert-octagon" },
  high: { color: "#EF4444", icon: "alert-triangle" },
  medium: { color: "#F59E0B", icon: "alert-circle" },
  low: { color: "#3B82F6", icon: "info" },
};

const RESOURCE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  health_record: "file-text",
  lab_result: "thermometer",
  medication: "package",
  condition: "heart",
  allergy: "alert-triangle",
  immunization: "shield",
  clinical_note: "edit-3",
  imaging: "image",
  vitals: "activity",
  procedure: "scissors",
  encounter: "calendar",
  insurance: "credit-card",
  demographic: "user",
  consent: "check-square",
  care_plan: "clipboard",
  document: "file",
  message: "mail",
  appointment: "clock",
};

function formatShortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminAuditVisualizationScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("patterns");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState(7);

  const { data: patterns, isLoading: patternsLoading, refetch: refetchPatterns } = useQuery<AccessPatternsResponse>({
    queryKey: [`/api/security/phi-audit/access-patterns?days=${timePeriod}`],
  });

  const { data: report, isLoading: reportLoading } = useQuery<AuditReport>({
    queryKey: ["/api/security/phi-audit/report"],
  });

  const { data: patientHistory, isLoading: patientHistoryLoading } = useQuery<PatientAuditLog[]>({
    queryKey: [`/api/security/phi-audit/patient/${selectedPatientId}`],
    enabled: !!selectedPatientId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchPatterns();
    setRefreshing(false);
  }, [refetchPatterns]);

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "patterns", label: "Access Patterns", icon: "bar-chart-2" },
    { key: "anomalies", label: "Anomalies", icon: "zap" },
    { key: "alerts", label: "Alerts", icon: "bell" },
  ];

  const isLoading = patternsLoading || reportLoading;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Analyzing access patterns...</Text>
      </View>
    );
  }

  const renderSummaryCards = () => {
    const totalAccesses = report?.totalAccesses ?? 0;
    const uniqueUsers = report?.uniqueUsers ?? 0;
    const uniquePatients = report?.uniquePatients ?? 0;
    const highRiskCount = report?.highRiskCount ?? 0;
    const breakGlassCount = report?.breakGlassCount ?? 0;
    const avgRisk = report?.averageRiskScore ?? 0;

    const cards = [
      { label: "Total Accesses", value: totalAccesses, icon: "eye" as const, color: "#3B82F6" },
      { label: "Unique Users", value: uniqueUsers, icon: "users" as const, color: "#10B981" },
      { label: "Patients Accessed", value: uniquePatients, icon: "user" as const, color: "#8B5CF6" },
      { label: "High Risk Events", value: highRiskCount, icon: "alert-triangle" as const, color: highRiskCount > 0 ? "#EF4444" : "#10B981" },
      { label: "Break-Glass", value: breakGlassCount, icon: "shield-off" as const, color: breakGlassCount > 0 ? "#F59E0B" : "#10B981" },
      { label: "Avg Risk Score", value: avgRisk, icon: "trending-up" as const, color: avgRisk > 30 ? "#F59E0B" : "#10B981" },
    ];

    return (
      <View style={styles.summaryGrid} testID="summary-cards">
        {cards.map((card) => (
          <View key={card.label} style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.summaryIcon, { backgroundColor: card.color + "15" }]}>
              <Feather name={card.icon} size={16} color={card.color} />
            </View>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{card.value}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{card.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderHeatmap = () => {
    const heatmap = patterns?.hourlyHeatmap ?? [];
    const maxCount = Math.max(...heatmap.map((h: any) => h.count), 1);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = [0, 3, 6, 9, 12, 15, 18, 21];

    const getCellColor = (count: number) => {
      if (count === 0) return theme.backgroundSecondary;
      const intensity = count / maxCount;
      if (intensity > 0.75) return "#DC2626";
      if (intensity > 0.5) return "#F59E0B";
      if (intensity > 0.25) return "#3B82F6";
      return "#10B981" + "60";
    };

    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]} testID="access-heatmap">
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Access Heatmap</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>PHI access frequency by day and hour</Text>
        <View style={styles.heatmapContainer}>
          <View style={styles.heatmapLabelsCol}>
            <View style={styles.heatmapCorner} />
            {days.map((day) => (
              <Text key={day} style={[styles.heatmapDayLabel, { color: theme.textSecondary }]}>{day}</Text>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.heatmapHourRow}>
                {hours.map((h) => (
                  <Text key={h} style={[styles.heatmapHourLabel, { color: theme.textSecondary }]}>
                    {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
                  </Text>
                ))}
              </View>
              {days.map((day) => (
                <View key={day} style={styles.heatmapRow}>
                  {hours.map((h) => {
                    const cell = heatmap.find((c: any) => c.day === day && c.hour === h);
                    const count = cell?.count || 0;
                    return (
                      <View key={h} style={[styles.heatmapCell, { backgroundColor: getCellColor(count) }]}>
                        {count > 0 ? (
                          <Text style={styles.heatmapCellText}>{count}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
        <View style={styles.heatmapLegend}>
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>Low</Text>
          <View style={[styles.legendDot, { backgroundColor: "#10B981" + "60" }]} />
          <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
          <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
          <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>High</Text>
        </View>
      </View>
    );
  };

  const renderDailyVolume = () => {
    const daily = patterns?.dailyVolume ?? [];
    const maxTotal = Math.max(...daily.map((d: any) => d.total), 1);

    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]} testID="daily-volume">
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Daily Access Volume</Text>
        <View style={styles.dailyChart}>
          {daily.map((d: any) => (
            <View key={d.date} style={styles.dailyBar}>
              <View style={styles.dailyBarStack}>
                {d.highRisk > 0 ? (
                  <View style={[styles.dailyBarSegment, {
                    height: `${Math.max((d.highRisk / maxTotal) * 100, 3)}%`,
                    backgroundColor: "#EF4444",
                  }]} />
                ) : null}
                <View style={[styles.dailyBarSegment, {
                  height: `${Math.max(((d.total - d.highRisk) / maxTotal) * 100, 3)}%`,
                  backgroundColor: "#3B82F6",
                }]} />
              </View>
              <Text style={[styles.dailyLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                {new Date(d.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.dailyLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#3B82F6" }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Normal</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>High Risk</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderResourceBreakdown = () => {
    const resources = patterns?.resourceBreakdown ?? [];
    const maxCount = Math.max(...resources.map((r: any) => r.count), 1);

    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]} testID="resource-breakdown">
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Resource Access Breakdown</Text>
        {resources.map((r: any) => (
          <View key={r.resourceType} style={styles.resourceRow}>
            <View style={styles.resourceLabel}>
              <Feather name={RESOURCE_ICONS[r.resourceType] || "file"} size={14} color={theme.primary} />
              <Text style={[styles.resourceName, { color: theme.text }]} numberOfLines={1}>
                {r.resourceType.replace(/_/g, " ")}
              </Text>
            </View>
            <View style={styles.resourceBarContainer}>
              <View style={[styles.resourceBar, { width: `${(r.count / maxCount) * 100}%`, backgroundColor: r.highRiskPct > 20 ? "#EF4444" : "#3B82F6" }]} />
            </View>
            <View style={styles.resourceStats}>
              <Text style={[styles.resourceCount, { color: theme.text }]}>{r.count}</Text>
              {r.highRiskPct > 0 ? (
                <Text style={[styles.resourceRisk, { color: "#EF4444" }]}>{r.highRiskPct}%</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTopPatients = () => {
    const patients = patterns?.topPatients ?? [];

    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]} testID="top-patients">
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Most Accessed Patients</Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Tap to view full access history</Text>
        {patients.length === 0 ? (
          <View style={styles.emptyMini}>
            <Feather name="users" size={24} color={theme.textSecondary} />
            <Text style={[styles.emptyMiniText, { color: theme.textSecondary }]}>No patient access data</Text>
          </View>
        ) : null}
        {patients.map((p: any) => (
          <Pressable
            key={p.patientId}
            style={[styles.patientRow, { borderBottomColor: theme.border }]}
            onPress={() => setSelectedPatientId(p.patientId)}
            testID={`patient-row-${p.patientId.slice(0, 8)}`}
            accessibilityRole="button"
            accessibilityLabel={`Patient ${formatShortId(p.patientId)}, ${p.accessCount} accesses by ${p.uniqueAccessors} users`}
            accessibilityHint="Tap to view full access history"
          >
            <View style={[styles.patientAvatar, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="user" size={16} color={theme.primary} />
            </View>
            <View style={styles.patientInfo}>
              <Text style={[styles.patientId, { color: theme.text }]}>Patient {formatShortId(p.patientId)}</Text>
              <Text style={[styles.patientMeta, { color: theme.textSecondary }]}>
                {p.accessCount} accesses | {p.uniqueAccessors} user{p.uniqueAccessors !== 1 ? "s" : ""} | {formatRelative(p.lastAccessed)}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>
    );
  };

  const renderTopUsers = () => {
    const users = patterns?.topUsers ?? [];

    return (
      <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]} testID="top-users">
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Top Accessors</Text>
        {users.length === 0 ? (
          <View style={styles.emptyMini}>
            <Feather name="user-check" size={24} color={theme.textSecondary} />
            <Text style={[styles.emptyMiniText, { color: theme.textSecondary }]}>No user access data</Text>
          </View>
        ) : null}
        {users.map((u: any, idx: number) => {
          const riskColor = u.avgRiskScore > 50 ? "#EF4444" : u.avgRiskScore > 20 ? "#F59E0B" : "#10B981";
          return (
            <View key={u.userId} style={[styles.userRow, { borderBottomColor: theme.border }]}>
              <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? theme.primary + "20" : theme.backgroundSecondary }]}>
                <Text style={[styles.rankText, { color: idx < 3 ? theme.primary : theme.textSecondary }]}>#{idx + 1}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userId, { color: theme.text }]}>{formatShortId(u.userId)}</Text>
                <Text style={[styles.userMeta, { color: theme.textSecondary }]}>
                  {u.accessCount} accesses | Last: {formatRelative(u.lastActive)}
                </Text>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: riskColor + "20" }]}>
                <Feather name="trending-up" size={10} color={riskColor} />
                <Text style={[styles.riskText, { color: riskColor }]}>{u.avgRiskScore}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderAnomaliesTab = () => {
    const alerts = patterns?.recentAlerts ?? [];
    const anomalyTypes: Record<string, { count: number; severity: string }> = {};
    for (const a of alerts) {
      if (!anomalyTypes[a.type]) anomalyTypes[a.type] = { count: 0, severity: a.severity };
      anomalyTypes[a.type].count++;
    }

    return (
      <View>
        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]} testID="anomaly-summary">
          <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">Anomaly Detection Summary</Text>
          {Object.keys(anomalyTypes).length === 0 ? (
            <View style={styles.noAnomalies}>
              <Feather name="check-circle" size={40} color="#10B981" />
              <Text style={[styles.noAnomaliesTitle, { color: theme.text }]}>No Anomalies Detected</Text>
              <Text style={[styles.noAnomaliesText, { color: theme.textSecondary }]}>
                All access patterns are within normal parameters
              </Text>
            </View>
          ) : null}
          {Object.entries(anomalyTypes).map(([type, data]) => {
            const config = SEVERITY_CONFIG[data.severity] || SEVERITY_CONFIG.low;
            return (
              <View key={type} style={styles.anomalyRow}>
                <View style={[styles.anomalyIcon, { backgroundColor: config.color + "15" }]}>
                  <Feather name={config.icon} size={16} color={config.color} />
                </View>
                <View style={styles.anomalyInfo}>
                  <Text style={[styles.anomalyType, { color: theme.text }]}>
                    {type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                  <Text style={[styles.anomalyCount, { color: theme.textSecondary }]}>{data.count} occurrence{data.count !== 1 ? "s" : ""}</Text>
                </View>
                <View style={[styles.severityChip, { backgroundColor: config.color + "20" }]}>
                  <Text style={[styles.severityText, { color: config.color }]}>{data.severity.toUpperCase()}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {renderResourceBreakdown()}
        {renderTopUsers()}
      </View>
    );
  };

  const renderAlertsTab = () => {
    const alerts = patterns?.recentAlerts ?? [];

    return (
      <View>
        {alerts.length === 0 ? (
          <View style={[styles.sectionCard, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.noAnomalies}>
              <Feather name="bell-off" size={40} color={theme.textSecondary} />
              <Text style={[styles.noAnomaliesTitle, { color: theme.text }]}>No Active Alerts</Text>
              <Text style={[styles.noAnomaliesText, { color: theme.textSecondary }]}>
                No suspicious PHI access events detected
              </Text>
            </View>
          </View>
        ) : null}
        {alerts.map((alert: any, idx: number) => {
          const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
          return (
            <View key={`${alert.id}-${idx}`} style={[styles.alertCard, { backgroundColor: theme.backgroundSecondary, borderLeftColor: config.color }]} testID={`alert-card-${idx}`}>
              <View style={styles.alertHeader}>
                <View style={[styles.alertIcon, { backgroundColor: config.color + "15" }]}>
                  <Feather name={config.icon} size={16} color={config.color} />
                </View>
                <View style={styles.alertHeaderInfo}>
                  <Text style={[styles.alertType, { color: theme.text }]}>
                    {alert.type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                  <Text style={[styles.alertTime, { color: theme.textSecondary }]}>{formatRelative(alert.timestamp)}</Text>
                </View>
                <View style={[styles.severityChip, { backgroundColor: config.color + "20" }]}>
                  <Text style={[styles.severityText, { color: config.color }]}>{alert.severity.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[styles.alertDesc, { color: theme.textSecondary }]}>{alert.description}</Text>
              <View style={styles.alertMeta}>
                <View style={[styles.metaTag, { backgroundColor: theme.primary + "10" }]}>
                  <Feather name="user" size={10} color={theme.primary} />
                  <Text style={[styles.metaTagText, { color: theme.primary }]}>{formatShortId(alert.userId)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderPatternsTab = () => (
    <View>
      {renderSummaryCards()}
      {renderHeatmap()}
      {renderDailyVolume()}
      {renderTopPatients()}
    </View>
  );

  const renderPatientHistoryModal = () => (
    <Modal visible={!!selectedPatientId} animationType="slide" transparent testID="patient-history-modal" accessibilityViewIsModal={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Patient Access History</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {selectedPatientId ? `Patient ${formatShortId(selectedPatientId)}` : ""}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedPatientId(null)}
              testID="button-close-patient-modal"
              accessibilityRole="button"
              accessibilityLabel="Close patient history"
              style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
            >
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          {patientHistoryLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={patientHistory || []}
              keyExtractor={(item, idx) => `${item.id}-${idx}`}
              renderItem={({ item }) => {
                const riskColor = item.riskScore! > 50 ? "#EF4444" : item.riskScore! > 20 ? "#F59E0B" : "#10B981";
                return (
                  <View style={[styles.historyItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.historyHeader}>
                      <View style={styles.historyAction}>
                        <Feather
                          name={item.breakGlass ? "shield-off" : RESOURCE_ICONS[item.resourceType] || "file"}
                          size={14}
                          color={item.breakGlass ? "#EF4444" : theme.primary}
                        />
                        <Text style={[styles.historyActionText, { color: theme.text }]}>
                          {item.action.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Text>
                      </View>
                      <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                        {formatRelative(item.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={[styles.historyResource, { color: theme.textSecondary }]}>
                        {item.resourceType.replace(/_/g, " ")}
                        {item.resourceId ? ` #${formatShortId(item.resourceId)}` : ""}
                      </Text>
                      <View style={styles.historyMeta}>
                        <View style={[styles.miniTag, { backgroundColor: riskColor + "15" }]}>
                          <Text style={[styles.miniTagText, { color: riskColor }]}>Risk: {item.riskScore! || 0}</Text>
                        </View>
                        {item.breakGlass ? (
                          <View style={[styles.miniTag, { backgroundColor: "#EF4444" + "15" }]}>
                            <Text style={[styles.miniTagText, { color: "#EF4444" }]}>BREAK-GLASS</Text>
                          </View>
                        ) : null}
                        {item.userId ? (
                          <View style={[styles.miniTag, { backgroundColor: theme.primary + "10" }]}>
                            <Text style={[styles.miniTagText, { color: theme.primary }]}>User: {formatShortId(item.userId)}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {item.accessReason ? (
                      <Text style={[styles.historyReason, { color: theme.textSecondary }]}>
                        Reason: {item.accessReason}
                      </Text>
                    ) : null}
                  </View>
                );
              }}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.lg }}
              ListEmptyComponent={
                <View style={styles.emptyHistory}>
                  <Feather name="clipboard" size={40} color={theme.textSecondary} />
                  <Text style={[styles.emptyHistoryText, { color: theme.textSecondary }]}>
                    No access history found for this patient
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.sm, paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        <View style={styles.periodRow}>
          {[7, 14, 30].map((d) => (
            <Pressable
              key={d}
              onPress={() => setTimePeriod(d)}
              style={[styles.periodChip, d === timePeriod ? { backgroundColor: theme.primary } : { backgroundColor: theme.backgroundSecondary }]}
              testID={`period-${d}d`}
              accessibilityRole="button"
              accessibilityLabel={`${d} day period`}
              accessibilityState={{ selected: d === timePeriod }}
            >
              <Text style={[styles.periodText, { color: d === timePeriod ? "#fff" : theme.textSecondary }]}>{d}d</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, activeTab === tab.key ? { borderBottomColor: theme.primary, borderBottomWidth: 2 } : null]}
              testID={`tab-${tab.key}`}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: activeTab === tab.key }}
            >
              <Feather name={tab.icon} size={16} color={activeTab === tab.key ? theme.primary : theme.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === tab.key ? theme.primary : theme.textSecondary }]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "patterns" ? renderPatternsTab() : null}
        {activeTab === "anomalies" ? renderAnomaliesTab() : null}
        {activeTab === "alerts" ? renderAlertsTab() : null}
      </ScrollView>

      {renderPatientHistoryModal()}

      <View style={[styles.complianceBanner, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="shield" size={12} color="#10B981" />
        <Text style={[styles.complianceBannerText, { color: theme.textSecondary }]}>
          HIPAA 164.312(b) Audit Controls | 7-year retention | Risk-scored
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: Spacing.md, fontSize: Typography.sizes.body },
  scrollContent: { paddingHorizontal: Spacing.md },
  periodRow: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm },
  periodChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full },
  periodText: { fontSize: Typography.sizes.caption, fontWeight: "600" },
  tabBar: { flexDirection: "row", marginBottom: Spacing.md, gap: Spacing.xs },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: Spacing.sm },
  tabText: { fontSize: Typography.sizes.caption, fontWeight: "600" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: { width: "30%", flexGrow: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: "center" },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: "800" },
  summaryLabel: { fontSize: 10, textAlign: "center", marginTop: 1 },
  sectionCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.sizes.subtitle, fontWeight: "700", marginBottom: 2 },
  sectionSubtitle: { fontSize: Typography.sizes.caption, marginBottom: Spacing.sm },
  heatmapContainer: { flexDirection: "row" },
  heatmapLabelsCol: { marginRight: 4 },
  heatmapCorner: { height: 18 },
  heatmapDayLabel: { height: 22, fontSize: 9, textAlignVertical: "center", lineHeight: 22 },
  heatmapHourRow: { flexDirection: "row", height: 18 },
  heatmapHourLabel: { width: 36, fontSize: 9, textAlign: "center" },
  heatmapRow: { flexDirection: "row", height: 22, gap: 1 },
  heatmapCell: { width: 35, height: 20, borderRadius: 3, justifyContent: "center", alignItems: "center" },
  heatmapCellText: { fontSize: 8, color: "#fff", fontWeight: "700" },
  heatmapLegend: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.xs, gap: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dailyChart: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 100, gap: 2 },
  dailyBar: { flex: 1, alignItems: "center" },
  dailyBarStack: { width: "100%", height: 80, justifyContent: "flex-end" },
  dailyBarSegment: { width: "100%", borderRadius: 2 },
  dailyLabel: { fontSize: 8, marginTop: 2 },
  dailyLegend: { flexDirection: "row", justifyContent: "center", gap: Spacing.md, marginTop: Spacing.xs },
  resourceRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 6 },
  resourceLabel: { flexDirection: "row", alignItems: "center", gap: 4, width: 100 },
  resourceName: { fontSize: 11, textTransform: "capitalize", flex: 1 },
  resourceBarContainer: { flex: 1, height: 8, backgroundColor: "rgba(128,128,128,0.1)", borderRadius: 4, overflow: "hidden" },
  resourceBar: { height: "100%", borderRadius: 4 },
  resourceStats: { width: 45, alignItems: "flex-end" },
  resourceCount: { fontSize: 11, fontWeight: "700" },
  resourceRisk: { fontSize: 9, fontWeight: "600" },
  patientRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  patientAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  patientInfo: { flex: 1 },
  patientId: { fontSize: Typography.sizes.body, fontWeight: "600" },
  patientMeta: { fontSize: Typography.sizes.caption, marginTop: 1 },
  emptyMini: { alignItems: "center", paddingVertical: Spacing.lg },
  emptyMiniText: { fontSize: Typography.sizes.caption, marginTop: Spacing.xs },
  userRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.sm },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  rankText: { fontSize: 11, fontWeight: "700" },
  userInfo: { flex: 1 },
  userId: { fontSize: Typography.sizes.body, fontWeight: "600" },
  userMeta: { fontSize: Typography.sizes.caption, marginTop: 1 },
  riskBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  riskText: { fontSize: 10, fontWeight: "700" },
  noAnomalies: { alignItems: "center", paddingVertical: Spacing.xl },
  noAnomaliesTitle: { fontSize: Typography.sizes.subtitle, fontWeight: "700", marginTop: Spacing.sm },
  noAnomaliesText: { fontSize: Typography.sizes.caption, marginTop: 2, textAlign: "center" },
  anomalyRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, gap: Spacing.sm },
  anomalyIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  anomalyInfo: { flex: 1 },
  anomalyType: { fontSize: Typography.sizes.body, fontWeight: "600" },
  anomalyCount: { fontSize: Typography.sizes.caption },
  severityChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  severityText: { fontSize: 9, fontWeight: "700" },
  alertCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderLeftWidth: 4 },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  alertIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  alertHeaderInfo: { flex: 1 },
  alertType: { fontSize: Typography.sizes.body, fontWeight: "600" },
  alertTime: { fontSize: 10 },
  alertDesc: { fontSize: Typography.sizes.caption, marginBottom: Spacing.xs },
  alertMeta: { flexDirection: "row", gap: 4 },
  metaTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  metaTagText: { fontSize: 10, fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, maxHeight: "85%", minHeight: "50%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.2)" },
  modalTitle: { fontSize: Typography.sizes.title, fontWeight: "700" },
  modalSubtitle: { fontSize: Typography.sizes.caption, marginTop: 2 },
  modalLoading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: Spacing.xl * 2 },
  historyItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyActionText: { fontSize: Typography.sizes.body, fontWeight: "600" },
  historyTime: { fontSize: 10 },
  historyDetails: { marginTop: 4 },
  historyResource: { fontSize: Typography.sizes.caption, textTransform: "capitalize" },
  historyMeta: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  miniTagText: { fontSize: 9, fontWeight: "600" },
  historyReason: { fontSize: Typography.sizes.caption, fontStyle: "italic", marginTop: 4 },
  emptyHistory: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyHistoryText: { fontSize: Typography.sizes.body, marginTop: Spacing.sm, textAlign: "center" },
  complianceBanner: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: Spacing.md, gap: 6 },
  complianceBannerText: { fontSize: 9, flex: 1 },
});
