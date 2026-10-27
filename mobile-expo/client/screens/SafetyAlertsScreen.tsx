import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface SafetyAlert {
  id: string;
  alertType: "critical" | "warning" | "info";
  severity: "critical" | "high" | "medium" | "low";
  vitalType: string;
  value: number;
  unit: string;
  referenceRange: { min: number; max: number };
  title: string;
  message: string;
  recommendation: string;
  contactProvider: boolean;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

interface ReferenceRange {
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  warningLowMin?: number;
  warningHighMax?: number;
  criticalLowMin?: number;
  criticalHighMax?: number;
}

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onContactProvider,
  isLoading,
  theme,
}: {
  alert: SafetyAlert;
  onAcknowledge: () => void;
  onResolve: () => void;
  onContactProvider: () => void;
  isLoading: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const getSeverityColor = () => {
    switch (alert.severity) {
      case "critical":
        return "#dc2626";
      case "high":
        return "#ea580c";
      case "medium":
        return "#d97706";
      case "low":
        return "#ca8a04";
      default:
        return theme.textSecondary;
    }
  };

  const getSeverityIcon = (): keyof typeof Feather.glyphMap => {
    switch (alert.severity) {
      case "critical":
        return "alert-octagon";
      case "high":
        return "alert-triangle";
      case "medium":
        return "alert-circle";
      default:
        return "info";
    }
  };

  const severityColor = getSeverityColor();

  return (
    <Animated.View entering={FadeInDown}>
      <Card style={StyleSheet.flatten([styles.alertCard, { borderLeftColor: severityColor, borderLeftWidth: 4 }])}>
        <View style={styles.alertHeader}>
          <View style={[styles.severityIcon, { backgroundColor: severityColor + "20" }]}>
            <Feather name={getSeverityIcon()} size={24} color={severityColor} />
          </View>
          <View style={styles.alertInfo}>
            <View style={styles.alertTitleRow}>
              <ThemedText style={styles.alertTitle}>{alert.title}</ThemedText>
              <View style={[styles.severityBadge, { backgroundColor: severityColor + "20" }]}>
                <ThemedText style={[styles.severityText, { color: severityColor }]}>
                  {alert.severity.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.alertDate, { color: theme.textSecondary }]}>
              {new Date(alert.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </ThemedText>
          </View>
        </View>

        <View style={styles.valueSection}>
          <View style={styles.valueContainer}>
            <ThemedText style={[styles.valueLabel, { color: theme.textSecondary }]}>
              Your Value
            </ThemedText>
            <ThemedText style={[styles.valueText, { color: severityColor }]}>
              {alert.value} {alert.unit}
            </ThemedText>
          </View>
          <View style={styles.rangeContainer}>
            <ThemedText style={[styles.valueLabel, { color: theme.textSecondary }]}>
              Normal Range
            </ThemedText>
            <ThemedText style={styles.rangeText}>
              {alert.referenceRange.min} - {alert.referenceRange.max} {alert.unit}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.messageText}>{alert.message}</ThemedText>

        <View style={[styles.recommendationBox, { backgroundColor: severityColor + "10" }]}>
          <Feather name="info" size={16} color={severityColor} />
          <ThemedText style={[styles.recommendationText, { color: severityColor }]}>
            {alert.recommendation}
          </ThemedText>
        </View>

        <View style={styles.actionButtons}>
          {alert.contactProvider && (
            <Pressable
              style={[styles.actionButton, styles.contactButton, { backgroundColor: severityColor }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onContactProvider();
              }}
              disabled={isLoading}
            >
              <Feather name="phone" size={16} color="#fff" />
              <ThemedText style={styles.actionButtonText}>Contact Provider</ThemedText>
            </Pressable>
          )}

          {!alert.acknowledgedAt ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAcknowledge();
              }}
              disabled={isLoading}
            >
              <Feather name="check" size={16} color={theme.text} />
              <ThemedText style={[styles.actionButtonSecondaryText, { color: theme.text }]}>
                Acknowledge
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.success + "20" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onResolve();
              }}
              disabled={isLoading}
            >
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText style={[styles.actionButtonSecondaryText, { color: theme.success }]}>
                Mark Resolved
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Card>
    </Animated.View>
  );
}

export default function SafetyAlertsScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: alerts = [], isLoading, refetch } = useQuery<SafetyAlert[]>({
    queryKey: ["/api/clinical-safety/alerts"],
  });

  const { data: criticalCount } = useQuery<{ count: number }>({
    queryKey: ["/api/clinical-safety/alerts/critical-count"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/clinical-safety/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-safety/alerts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/clinical-safety/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-safety/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-safety/alerts/critical-count"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clinical-safety/scan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-safety/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-safety/alerts/critical-count"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleContactProvider = () => {
    if (Platform.OS !== "web") {
      Linking.openURL("tel:911");
    }
  };

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const otherAlerts = alerts.filter((a) => a.severity !== "critical");

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {(criticalCount?.count ?? 0) > 0 && (
          <Animated.View entering={FadeInDown} style={styles.criticalBanner}>
            <View style={[styles.criticalBannerContent, { backgroundColor: "#dc262620" }]}>
              <Feather name="alert-octagon" size={24} color="#dc2626" />
              <View style={styles.criticalBannerText}>
                <ThemedText style={styles.criticalBannerTitle}>
                  {criticalCount?.count} Critical Alert{criticalCount?.count !== 1 ? "s" : ""}
                </ThemedText>
                <ThemedText style={[styles.criticalBannerMessage, { color: colors.textSecondary }]}>
                  Immediate attention required. Please contact your healthcare provider.
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.sectionTitle}>Health Alerts</ThemedText>
            <Pressable
              style={[styles.scanButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                scanMutation.mutate();
              }}
              disabled={scanMutation.isPending}
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
              <ThemedText style={styles.scanButtonText}>
                {scanMutation.isPending ? "Scanning..." : "Scan Records"}
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Automated monitoring of your vital signs and lab results for values outside clinical norms.
          </ThemedText>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.success + "20" }]}>
              <Feather name="check-circle" size={48} color={colors.success} />
            </View>
            <ThemedText style={styles.emptyTitle}>All Clear</ThemedText>
            <ThemedText style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              No health alerts at this time. Your recent values are within normal ranges.
            </ThemedText>
          </View>
        ) : (
          <>
            {criticalAlerts.length > 0 && (
              <View style={styles.alertSection}>
                <ThemedText style={[styles.alertSectionTitle, { color: "#dc2626" }]}>
                  Critical Alerts
                </ThemedText>
                {criticalAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                    onResolve={() => resolveMutation.mutate(alert.id)}
                    onContactProvider={handleContactProvider}
                    isLoading={acknowledgeMutation.isPending || resolveMutation.isPending}
                    theme={colors}
                  />
                ))}
              </View>
            )}

            {otherAlerts.length > 0 && (
              <View style={styles.alertSection}>
                <ThemedText style={styles.alertSectionTitle}>Other Alerts</ThemedText>
                {otherAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                    onResolve={() => resolveMutation.mutate(alert.id)}
                    onContactProvider={handleContactProvider}
                    isLoading={acknowledgeMutation.isPending || resolveMutation.isPending}
                    theme={colors}
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={[styles.disclaimerBox, { backgroundColor: colors.backgroundSecondary }]}>
          <Feather name="info" size={16} color={colors.textSecondary} />
          <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            This information is for educational purposes only and is not a substitute for professional medical advice.
            Always consult your healthcare provider for medical decisions.
          </ThemedText>
        </View>
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
    gap: Spacing.lg,
  },
  criticalBanner: {
    marginBottom: Spacing.sm,
  },
  criticalBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  criticalBannerText: {
    flex: 1,
  },
  criticalBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#dc2626",
  },
  criticalBannerMessage: {
    fontSize: 13,
    marginTop: 2,
  },
  headerSection: {
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  alertSection: {
    gap: Spacing.md,
  },
  alertSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  alertCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  severityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  alertInfo: {
    flex: 1,
  },
  alertTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  severityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  severityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  alertDate: {
    fontSize: 12,
    marginTop: 2,
  },
  valueSection: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  valueContainer: {
    flex: 1,
  },
  rangeContainer: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  valueText: {
    fontSize: 18,
    fontWeight: "700",
  },
  rangeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  recommendationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactButton: {
    flex: 1,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
});
