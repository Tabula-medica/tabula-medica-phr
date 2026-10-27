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
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  SlideInRight,
} from "react-native-reanimated";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Colors, Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const theme = Colors.light;

interface AlertStats {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
}

interface ComplianceAlert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  category: string;
  status: string;
  thresholdValue?: number;
  actualValue?: number;
  timeWindow?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: any;
}

interface DeduplicationMetrics {
  totalMerges: number;
  totalRejections: number;
  mergeRate: number;
  rejectionRate: number;
  averageMergeRate: number;
  isAnomalous: boolean;
}

interface PhiAccessMetrics {
  totalAccesses: number;
  uniqueUsers: number;
  uniquePatients: number;
  afterHoursAccesses: number;
  isAnomalous: boolean;
  anomalyReasons: string[];
}

interface DashboardData {
  stats: AlertStats;
  recentAlerts: ComplianceAlert[];
  deduplicationMetrics: DeduplicationMetrics;
  phiAccessMetrics: PhiAccessMetrics;
  outstandingReviews: number;
}

const severityColors: Record<string, string> = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#D97706",
  low: "#059669",
};

const statusColors: Record<string, string> = {
  open: "#DC2626",
  acknowledged: "#D97706",
  investigating: "#2563EB",
  resolved: "#059669",
  dismissed: "#6B7280",
};

const categoryIcons: Record<string, keyof typeof Feather.glyphMap> = {
  deduplication: "git-merge",
  phi_access: "eye",
  access_review: "user-check",
  data_export: "download",
  authentication: "lock",
};

export default function ComplianceAlertsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: dashboardData, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/compliance/dashboard"],
  });

  const { data: compliance2026 } = useQuery<any>({
    queryKey: ["/api/compliance/2026-status"],
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: string; resolution?: string }) => {
      const response = await apiRequest("PATCH", `/api/compliance/alerts/${id}`, { status, resolution });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/dashboard"] });
      setSelectedAlert(null);
    },
  });

  const runChecksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/compliance/run-checks");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/dashboard"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filteredAlerts = dashboardData?.recentAlerts.filter((alert) => {
    if (selectedFilter === "all") return true;
    if (["critical", "high", "medium", "low"].includes(selectedFilter)) {
      return alert.severity === selectedFilter;
    }
    return alert.status === selectedFilter;
  }) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getSeverityIcon = (severity: string): keyof typeof Feather.glyphMap => {
    switch (severity) {
      case "critical": return "alert-octagon";
      case "high": return "alert-triangle";
      case "medium": return "alert-circle";
      default: return "info";
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading compliance data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.headerSection}>
            <View>
              <Text style={styles.title}>Compliance Alerts</Text>
              <Text style={styles.subtitle}>Monitor anomalies and compliance status</Text>
            </View>
            <Pressable 
              style={styles.runChecksButton}
              onPress={() => runChecksMutation.mutate()}
              disabled={runChecksMutation.isPending}
            >
              {runChecksMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#FFFFFF" />
                  <Text style={styles.runChecksText}>Run Checks</Text>
                </>
              )}
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.statsGrid}
        >
          <View style={styles.statsRow}>
            <StatsCard
              icon="alert-circle"
              label="Open Alerts"
              value={dashboardData?.stats.open || 0}
              color="#DC2626"
              delay={0}
            />
            <StatsCard
              icon="eye"
              label="Acknowledged"
              value={dashboardData?.stats.acknowledged || 0}
              color="#D97706"
              delay={100}
            />
          </View>
          <View style={styles.statsRow}>
            <StatsCard
              icon="check-circle"
              label="Resolved"
              value={dashboardData?.stats.resolved || 0}
              color="#059669"
              delay={200}
            />
            <StatsCard
              icon="user-check"
              label="Pending Reviews"
              value={dashboardData?.outstandingReviews || 0}
              color="#2563EB"
              delay={300}
            />
          </View>
        </Animated.View>

        <Animated.View 
          entering={FadeInDown.delay(300).duration(400)}
          style={styles.metricsSection}
        >
          <Text style={styles.sectionTitle}>Compliance Metrics</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Deduplication"
              icon="git-merge"
              metrics={[
                { label: "Merge Rate", value: `${(dashboardData?.deduplicationMetrics.mergeRate || 0).toFixed(1)}%` },
                { label: "Rejections", value: String(dashboardData?.deduplicationMetrics.totalRejections || 0) },
              ]}
              isAnomalous={dashboardData?.deduplicationMetrics.isAnomalous || false}
            />
            <MetricCard
              title="PHI Access"
              icon="eye"
              metrics={[
                { label: "Total Accesses", value: String(dashboardData?.phiAccessMetrics.totalAccesses || 0) },
                { label: "After Hours", value: String(dashboardData?.phiAccessMetrics.afterHoursAccesses || 0) },
              ]}
              isAnomalous={dashboardData?.phiAccessMetrics.isAnomalous || false}
            />
          </View>
        </Animated.View>

        {compliance2026 ? (
          <Animated.View
            entering={FadeInDown.delay(350).duration(400)}
            style={styles.metricsSection}
          >
            <Text style={styles.sectionTitle}>2026 Regulation Compliance</Text>
            <View style={[styles.regulation2026Card, { backgroundColor: compliance2026.hipaa2026?.compliant ? "#05966910" : "#DC262610", borderColor: compliance2026.hipaa2026?.compliant ? "#059669" : "#DC2626" }]}>
              <View style={styles.regulationRow}>
                <Feather name="shield" size={20} color={compliance2026.hipaa2026?.compliant ? "#059669" : "#DC2626"} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.regulationTitle, { color: theme.text }]}>HIPAA 2026 NPP Update</Text>
                  <Text style={[styles.regulationSubtitle, { color: theme.textSecondary }]}>
                    SUD & Reproductive Health Protections
                  </Text>
                </View>
                <View style={[styles.complianceBadge, { backgroundColor: compliance2026.hipaa2026?.compliant ? "#059669" : "#DC2626" }]}>
                  <Feather name={compliance2026.hipaa2026?.compliant ? "check" : "x"} size={12} color="#FFFFFF" />
                  <Text style={styles.complianceBadgeText}>
                    {compliance2026.hipaa2026?.compliant ? "Compliant" : "Action Needed"}
                  </Text>
                </View>
              </View>
              <View style={styles.regulationDetails}>
                <Text style={[styles.regulationDetail, { color: theme.textSecondary }]}>
                  Effective: {compliance2026.hipaa2026?.nppEffectiveDate || "Feb 16, 2026"}
                </Text>
                <Text style={[styles.regulationDetail, { color: theme.textSecondary }]}>
                  Patient Acknowledged: {compliance2026.hipaa2026?.patientAcknowledged ? "Yes" : "No"}
                </Text>
              </View>
            </View>
            <View style={[styles.regulation2026Card, { backgroundColor: compliance2026.informationBlocking?.compliant ? "#05966910" : "#DC262610", borderColor: compliance2026.informationBlocking?.compliant ? "#059669" : "#DC2626", marginTop: 10 }]}>
              <View style={styles.regulationRow}>
                <Feather name="unlock" size={20} color={compliance2026.informationBlocking?.compliant ? "#059669" : "#DC2626"} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.regulationTitle, { color: theme.text }]}>ONC HTI-1 Information Blocking</Text>
                  <Text style={[styles.regulationSubtitle, { color: theme.textSecondary }]}>
                    15-Day Data Access SLA
                  </Text>
                </View>
                <View style={[styles.complianceBadge, { backgroundColor: compliance2026.informationBlocking?.compliant ? "#059669" : "#DC2626" }]}>
                  <Feather name={compliance2026.informationBlocking?.compliant ? "check" : "x"} size={12} color="#FFFFFF" />
                  <Text style={styles.complianceBadgeText}>
                    {compliance2026.informationBlocking?.compliant ? "Compliant" : "Action Needed"}
                  </Text>
                </View>
              </View>
              <View style={styles.regulationDetails}>
                <Text style={[styles.regulationDetail, { color: theme.textSecondary }]}>
                  Overdue Requests: {compliance2026.informationBlocking?.overdueRequests || 0}
                </Text>
                <Text style={[styles.regulationDetail, { color: theme.textSecondary }]}>
                  Pending Requests: {compliance2026.informationBlocking?.pendingRequests || 0}
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View 
          entering={FadeInDown.delay(400).duration(400)}
          style={styles.alertsSection}
        >
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {["all", "open", "critical", "high", "medium", "acknowledged", "resolved"].map((filter) => (
              <Pressable
                key={filter}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipActive
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === filter && styles.filterChipTextActive
                ]}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={48} color={theme.success} />
              <Text style={styles.emptyStateTitle}>All Clear</Text>
              <Text style={styles.emptyStateText}>No alerts match your filter criteria</Text>
            </View>
          ) : (
            filteredAlerts.map((alert, index) => (
              <Animated.View
                key={alert.id}
                entering={SlideInRight.delay(index * 50).duration(300)}
              >
                <Pressable
                  style={styles.alertCard}
                  onPress={() => setSelectedAlert(alert)}
                >
                  <View style={[styles.alertSeverityBadge, { backgroundColor: severityColors[alert.severity] }]}>
                    <Feather name={getSeverityIcon(alert.severity)} size={14} color="#FFFFFF" />
                  </View>
                  <View style={styles.alertContent}>
                    <View style={styles.alertHeader}>
                      <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                      <View style={[styles.alertStatusBadge, { backgroundColor: statusColors[alert.status] + "20" }]}>
                        <Text style={[styles.alertStatusText, { color: statusColors[alert.status] }]}>
                          {alert.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.alertDescription} numberOfLines={2}>{alert.description}</Text>
                    <View style={styles.alertMeta}>
                      <View style={styles.alertMetaItem}>
                        <Feather name={categoryIcons[alert.category] || "tag"} size={12} color={theme.textSecondary} />
                        <Text style={styles.alertMetaText}>{alert.category.replace("_", " ")}</Text>
                      </View>
                      <Text style={styles.alertTime}>{formatDate(alert.createdAt)}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              </Animated.View>
            ))
          )}
        </Animated.View>

        <Animated.View 
          entering={FadeIn.delay(500).duration(400)}
          style={styles.severityLegend}
        >
          <Text style={styles.legendTitle}>Severity Levels</Text>
          <View style={styles.legendItems}>
            {Object.entries(severityColors).map(([severity, color]) => (
              <View key={severity} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={selectedAlert !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedAlert(null)}
      >
        {selectedAlert && (
          <AlertDetailModal
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
            onUpdateStatus={(status, resolution) => {
              updateAlertMutation.mutate({ 
                id: selectedAlert.id, 
                status,
                resolution 
              });
            }}
            isUpdating={updateAlertMutation.isPending}
          />
        )}
      </Modal>
    </View>
  );
}

function StatsCard({ 
  icon, 
  label, 
  value, 
  color, 
  delay 
}: { 
  icon: keyof typeof Feather.glyphMap; 
  label: string; 
  value: number; 
  color: string;
  delay: number;
}) {
  return (
    <Animated.View 
      entering={FadeInRight.delay(delay).duration(400)}
      style={styles.statsCard}
    >
      <View style={[styles.statsIconContainer, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statsValue, { color }]}>{value}</Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </Animated.View>
  );
}

function MetricCard({
  title,
  icon,
  metrics,
  isAnomalous,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  metrics: { label: string; value: string }[];
  isAnomalous: boolean;
}) {
  return (
    <View style={[styles.metricCard, isAnomalous && styles.metricCardAnomalous]}>
      <View style={styles.metricCardHeader}>
        <Feather name={icon} size={18} color={isAnomalous ? "#DC2626" : theme.primary} />
        <Text style={styles.metricCardTitle}>{title}</Text>
        {isAnomalous && (
          <View style={styles.anomalyBadge}>
            <Feather name="alert-triangle" size={12} color="#DC2626" />
          </View>
        )}
      </View>
      {metrics.map((metric, idx) => (
        <View key={idx} style={styles.metricRow}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <Text style={styles.metricValue}>{metric.value}</Text>
        </View>
      ))}
    </View>
  );
}

function AlertDetailModal({
  alert,
  onClose,
  onUpdateStatus,
  isUpdating,
}: {
  alert: ComplianceAlert;
  onClose: () => void;
  onUpdateStatus: (status: string, resolution?: string) => void;
  isUpdating: boolean;
}) {
  const [resolution, setResolution] = useState("");

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onClose} style={styles.modalCloseButton} accessibilityRole="button" accessibilityLabel="Close alert details">
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.modalTitle}>Alert Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.modalContent}>
        <View style={[styles.modalSeverityBanner, { backgroundColor: severityColors[alert.severity] + "15" }]}>
          <Feather 
            name={alert.severity === "critical" ? "alert-octagon" : "alert-triangle"} 
            size={24} 
            color={severityColors[alert.severity]} 
          />
          <View style={styles.modalSeverityInfo}>
            <Text style={[styles.modalSeverityText, { color: severityColors[alert.severity] }]}>
              {alert.severity.toUpperCase()} SEVERITY
            </Text>
            <Text style={styles.modalCategory}>{alert.category.replace("_", " ").toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.modalAlertTitle}>{alert.title}</Text>
        <Text style={styles.modalAlertDescription}>{alert.description}</Text>

        <View style={styles.modalInfoSection}>
          <View style={styles.modalInfoRow}>
            <Text style={styles.modalInfoLabel}>Status</Text>
            <View style={[styles.alertStatusBadge, { backgroundColor: statusColors[alert.status] + "20" }]}>
              <Text style={[styles.alertStatusText, { color: statusColors[alert.status] }]}>
                {alert.status}
              </Text>
            </View>
          </View>
          <View style={styles.modalInfoRow}>
            <Text style={styles.modalInfoLabel}>Created</Text>
            <Text style={styles.modalInfoValue}>
              {new Date(alert.createdAt).toLocaleString()}
            </Text>
          </View>
          {alert.thresholdValue !== undefined && (
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Threshold</Text>
              <Text style={styles.modalInfoValue}>{alert.thresholdValue}</Text>
            </View>
          )}
          {alert.actualValue !== undefined && (
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Actual Value</Text>
              <Text style={[styles.modalInfoValue, { color: "#DC2626", fontWeight: "600" }]}>
                {alert.actualValue.toFixed(1)}
              </Text>
            </View>
          )}
          {alert.timeWindow && (
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Time Window</Text>
              <Text style={styles.modalInfoValue}>{alert.timeWindow}</Text>
            </View>
          )}
        </View>

        {alert.status === "open" && (
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalActionButton, styles.acknowledgeButton]}
              onPress={() => onUpdateStatus("acknowledged")}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="eye" size={18} color="#FFFFFF" />
                  <Text style={styles.modalActionButtonText}>Acknowledge</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.modalActionButton, styles.dismissButton]}
              onPress={() => onUpdateStatus("dismissed")}
              disabled={isUpdating}
            >
              <Feather name="x-circle" size={18} color="#6B7280" />
              <Text style={[styles.modalActionButtonText, { color: "#6B7280" }]}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {alert.status === "acknowledged" && (
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalActionButton, styles.investigateButton]}
              onPress={() => onUpdateStatus("investigating")}
              disabled={isUpdating}
            >
              <Feather name="search" size={18} color="#FFFFFF" />
              <Text style={styles.modalActionButtonText}>Investigate</Text>
            </Pressable>
            <Pressable
              style={[styles.modalActionButton, styles.resolveButton]}
              onPress={() => onUpdateStatus("resolved", "Issue investigated and resolved")}
              disabled={isUpdating}
            >
              <Feather name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.modalActionButtonText}>Resolve</Text>
            </Pressable>
          </View>
        )}

        {alert.status === "investigating" && (
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalActionButton, styles.resolveButton, { flex: 1 }]}
              onPress={() => onUpdateStatus("resolved", "Investigation completed - issue resolved")}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.modalActionButtonText}>Mark Resolved</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.light.textSecondary,
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  runChecksButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  runChecksText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  statsGrid: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statsCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  statsIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  statsLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  metricsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: Spacing.md,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  metricCardAnomalous: {
    borderColor: "#DC262640",
    backgroundColor: "#FEF2F2",
  },
  metricCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  metricCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    flex: 1,
  },
  anomalyBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  alertsSection: {
    marginBottom: Spacing.lg,
  },
  filtersContainer: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginTop: Spacing.md,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    gap: Spacing.sm,
  },
  alertSeverityBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  alertContent: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    flex: 1,
  },
  alertStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertStatusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  alertDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  alertMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  alertMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  alertMetaText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textTransform: "capitalize",
  },
  alertTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  severityLegend: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.backgroundRoot,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  modalContent: {
    padding: Spacing.lg,
  },
  modalSeverityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.lg,
  },
  modalSeverityInfo: {
    flex: 1,
  },
  modalSeverityText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalCategory: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  modalAlertTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  modalAlertDescription: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  modalInfoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  modalInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  modalInfoLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  modalInfoValue: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  modalActionButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  acknowledgeButton: {
    backgroundColor: "#D97706",
  },
  dismissButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  investigateButton: {
    backgroundColor: "#2563EB",
  },
  resolveButton: {
    backgroundColor: "#059669",
  },
  regulation2026Card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
  },
  regulationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  regulationTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  regulationSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  complianceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  complianceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  regulationDetails: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    gap: 4,
  },
  regulationDetail: {
    fontSize: 13,
  },
});
