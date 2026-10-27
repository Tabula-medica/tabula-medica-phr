import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type ThemeColors = typeof Colors.light;

interface SensorReading {
  id: string;
  userId: string;
  deviceId: string | null;
  dataType: string;
  value: any;
  unit: string;
  timestamp: string;
  quality: number | null;
  isManual: boolean;
  notes: string | null;
  metadata: any;
  createdAt: string;
}

interface SensorAlert {
  id: string;
  userId: string;
  deviceId: string | null;
  readingId: string | null;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  dataType: string;
  triggerValue: any;
  thresholdValue: any;
  status: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface DashboardData {
  connectedDevices: number;
  devices: any[];
  activeAlerts: number;
  alerts: SensorAlert[];
  latestReadings: Record<string, SensorReading>;
  thresholds: any[];
}

type RouteParams = {
  RealTimeSensor: {
    deviceId?: string;
    deviceName?: string;
  };
};

const DATA_TYPE_CONFIG: Record<string, { 
  name: string; 
  icon: keyof typeof Feather.glyphMap;
  color: string;
  formatValue: (value: any) => string;
}> = {
  blood_pressure: { 
    name: "Blood Pressure", 
    icon: "heart",
    color: "#EF4444",
    formatValue: (v) => v?.systolic ? `${v.systolic}/${v.diastolic}` : "-",
  },
  glucose: { 
    name: "Blood Glucose", 
    icon: "droplet",
    color: "#8B5CF6",
    formatValue: (v) => v?.value ? `${v.value}` : "-",
  },
  heart_rate: { 
    name: "Heart Rate", 
    icon: "activity",
    color: "#EC4899",
    formatValue: (v) => v?.bpm ? `${v.bpm}` : "-",
  },
  spo2: { 
    name: "Oxygen Saturation", 
    icon: "wind",
    color: "#06B6D4",
    formatValue: (v) => v?.percentage ? `${v.percentage}%` : "-",
  },
  weight: { 
    name: "Weight", 
    icon: "trending-up",
    color: "#10B981",
    formatValue: (v) => v?.kg ? `${v.kg.toFixed(1)} kg` : "-",
  },
  temperature: { 
    name: "Temperature", 
    icon: "thermometer",
    color: "#F59E0B",
    formatValue: (v) => v?.celsius ? `${v.celsius.toFixed(1)}°C` : "-",
  },
  steps: { 
    name: "Steps", 
    icon: "navigation",
    color: "#3B82F6",
    formatValue: (v) => v?.count ? v.count.toLocaleString() : "-",
  },
  sleep: { 
    name: "Sleep", 
    icon: "moon",
    color: "#6366F1",
    formatValue: (v) => v?.hours ? `${v.hours.toFixed(1)}h` : "-",
  },
  hrv: { 
    name: "Heart Rate Variability", 
    icon: "activity",
    color: "#14B8A6",
    formatValue: (v) => v?.ms ? `${v.ms} ms` : "-",
  },
};

const PERIOD_OPTIONS = [
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "90d", label: "90 Days" },
];

function getSeverityColor(severity: string, colors: ThemeColors): string {
  switch (severity) {
    case "critical": return colors.error;
    case "warning": return colors.warning;
    default: return colors.textSecondary;
  }
}

export default function RealTimeSensorScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RouteParams, "RealTimeSensor">>();
  const queryClient = useQueryClient();

  const { deviceId, deviceName } = route.params || {};
  const [selectedDataType, setSelectedDataType] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");
  const [refreshing, setRefreshing] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/sensors/dashboard"],
  });

  const { data: readings = [], isLoading: readingsLoading, refetch: refetchReadings } = useQuery<SensorReading[]>({
    queryKey: ["/api/sensors/readings", selectedDataType, deviceId],
    enabled: !!selectedDataType,
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/sensors/alerts/${alertId}/acknowledge`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/sensors/alerts/${alertId}/resolve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDashboard(), selectedDataType ? refetchReadings() : Promise.resolve()]);
    setRefreshing(false);
  }, [refetchDashboard, refetchReadings, selectedDataType]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const renderMetricCard = (dataType: string, reading: SensorReading | undefined, index: number) => {
    const config = DATA_TYPE_CONFIG[dataType];
    if (!config) return null;

    const isSelected = selectedDataType === dataType;
    
    return (
      <Pressable
        key={dataType}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedDataType(isSelected ? null : dataType);
        }}
        style={({ pressed }) => [
          styles.metricCard,
          { 
            backgroundColor: isSelected ? `${config.color}15` : theme.backgroundDefault,
            borderColor: isSelected ? config.color : theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={[styles.metricIcon, { backgroundColor: `${config.color}20` }]}>
          <Feather name={config.icon} size={20} color={config.color} />
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          {config.name}
        </ThemedText>
        <ThemedText type="h3" style={{ color: theme.text, marginTop: 2 }}>
          {reading ? config.formatValue(reading.value) : "-"}
        </ThemedText>
        {reading ? (
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
            {formatTimestamp(reading.timestamp)}
          </ThemedText>
        ) : null}
      </Pressable>
    );
  };

  const renderAlertCard = (alert: SensorAlert, index: number) => (
    <Animated.View
      key={alert.id}
      entering={FadeInDown.delay(index * 30).springify()}
      style={[
        styles.alertCard,
        { 
          backgroundColor: `${getSeverityColor(alert.severity, theme)}10`,
          borderColor: getSeverityColor(alert.severity, theme),
        },
      ]}
    >
      <View style={styles.alertHeader}>
        <View style={[styles.alertSeverityBadge, { backgroundColor: getSeverityColor(alert.severity, theme) }]}>
          <Feather 
            name={alert.severity === "critical" ? "alert-triangle" : "alert-circle"} 
            size={12} 
            color="#FFFFFF" 
          />
          <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: 4, fontWeight: "600" }}>
            {alert.severity.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatTimestamp(alert.createdAt)}
        </ThemedText>
      </View>
      <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.sm }}>
        {alert.title}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
        {alert.message}
      </ThemedText>
      <View style={styles.alertActions}>
        {alert.status === "active" ? (
          <>
            <Pressable
              onPress={() => acknowledgeAlertMutation.mutate(alert.id)}
              style={({ pressed }) => [
                styles.alertActionButton,
                { backgroundColor: `${theme.primary}15`, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="check" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>Acknowledge</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => resolveAlertMutation.mutate(alert.id)}
              style={({ pressed }) => [
                styles.alertActionButton,
                { backgroundColor: `${theme.success}15`, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="check-circle" size={14} color={theme.success} />
              <ThemedText type="small" style={{ color: theme.success, marginLeft: 4 }}>Resolve</ThemedText>
            </Pressable>
          </>
        ) : (
          <View style={[styles.alertStatusBadge, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {alert.status === "acknowledged" ? "Acknowledged" : "Resolved"}
            </ThemedText>
          </View>
        )}
      </View>
    </Animated.View>
  );

  const renderReadingRow = (reading: SensorReading, index: number) => {
    const config = DATA_TYPE_CONFIG[reading.dataType];
    if (!config) return null;

    return (
      <Animated.View
        key={reading.id}
        entering={FadeInDown.delay(index * 20).springify()}
        style={[styles.readingRow, { borderBottomColor: theme.border }]}
      >
        <View style={styles.readingTime}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {new Date(reading.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {new Date(reading.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </ThemedText>
        </View>
        <View style={styles.readingValue}>
          <ThemedText type="h4" style={{ color: theme.text }}>
            {config.formatValue(reading.value)}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {reading.unit}
          </ThemedText>
        </View>
        {reading.quality ? (
          <View style={[styles.qualityBadge, { backgroundColor: `${theme.success}15` }]}>
            <ThemedText type="small" style={{ color: theme.success }}>{reading.quality}%</ThemedText>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  const latestReadings = dashboard?.latestReadings || {};

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <ThemedText type="h2" style={{ color: theme.text }}>
            {deviceName || "Sensor Data"}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
            Real-time health monitoring
          </ThemedText>
        </Animated.View>

        {(dashboard?.activeAlerts ?? 0) > 0 ? (
          <Animated.View entering={FadeInUp.springify()} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-triangle" size={18} color={theme.error} />
              <ThemedText type="h3" style={{ color: theme.text, marginLeft: Spacing.sm }}>
                Active Alerts ({dashboard?.activeAlerts})
              </ThemedText>
            </View>
            {dashboard?.alerts.map((alert, index) => renderAlertCard(alert, index))}
          </Animated.View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="h3" style={{ color: theme.text, marginBottom: Spacing.md }}>
            Latest Readings
          </ThemedText>
          
          {dashboardLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : Object.keys(latestReadings).length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="activity" size={32} color={theme.primary} />
              </View>
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
                No sensor data yet. Sync a device to see your readings.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.metricsGrid}>
              {Object.keys(DATA_TYPE_CONFIG).map((dataType, index) => 
                renderMetricCard(dataType, latestReadings[dataType], index)
              )}
            </View>
          )}
        </View>

        {selectedDataType ? (
          <Animated.View entering={FadeInUp.springify()} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3" style={{ color: theme.text }}>
                {DATA_TYPE_CONFIG[selectedDataType]?.name} History
              </ThemedText>
            </View>

            <View style={styles.periodSelector}>
              {PERIOD_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPeriod(option.id);
                  }}
                  style={({ pressed }) => [
                    styles.periodButton,
                    { 
                      backgroundColor: selectedPeriod === option.id ? theme.primary : theme.backgroundSecondary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <ThemedText 
                    type="small" 
                    style={{ color: selectedPeriod === option.id ? "#FFFFFF" : theme.textSecondary }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {readingsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : readings.length === 0 ? (
              <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", paddingVertical: Spacing.xl }}>
                No readings found for this period
              </ThemedText>
            ) : (
              <View style={[styles.readingsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                {readings.slice(0, 20).map((reading, index) => renderReadingRow(reading, index))}
              </View>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const { width } = Dimensions.get("window");
const metricCardWidth = (width - Spacing.lg * 2 - Spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  metricCard: {
    width: metricCardWidth,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  alertCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alertSeverityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  alertActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  alertActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  alertStatusBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  periodButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  readingsContainer: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  readingTime: {
    width: 70,
  },
  readingValue: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  qualityBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});
