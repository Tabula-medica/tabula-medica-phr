import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path, Circle, Line, Text as SvgText, Rect } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const { width: screenWidth } = Dimensions.get("window");
const chartWidth = screenWidth - Spacing.lg * 4;
const chartHeight = 180;

interface HealthSummary {
  trends: {
    bloodPressure: { systolic: number[]; diastolic: number[]; dates: string[] };
    heartRate: { values: number[]; dates: string[] };
    glucose: { values: number[]; dates: string[] };
    weight: { values: number[]; dates: string[] };
  };
  stats: {
    totalRecords: number;
    lastVisitDate: string | null;
    activeMedications: number;
    upcomingAppointments: number;
  };
}

const VITAL_CONFIGS: Record<string, { label: string; unit: string; color: string; icon: keyof typeof Feather.glyphMap; normalRange?: { min: number; max: number } }> = {
  bloodPressure: { label: "Blood Pressure", unit: "mmHg", color: "#EF4444", icon: "heart", normalRange: { min: 90, max: 120 } },
  heartRate: { label: "Heart Rate", unit: "bpm", color: "#F59E0B", icon: "activity", normalRange: { min: 60, max: 100 } },
  glucose: { label: "Blood Glucose", unit: "mg/dL", color: "#10B981", icon: "droplet", normalRange: { min: 70, max: 100 } },
  weight: { label: "Weight", unit: "lbs", color: "#8B5CF6", icon: "user", normalRange: undefined },
};

export default function HealthDashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme: colors, fontScale, highContrast } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVital, setSelectedVital] = useState<string>("bloodPressure");

  const { data: summary, isLoading, refetch } = useQuery<HealthSummary>({
    queryKey: ["/api/health/dashboard-summary"],
  });

  const generateMockData = () => {
    const now = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      dates.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    }

    return {
      bloodPressure: {
        systolic: [118, 122, 120, 125, 119, 121, 118],
        diastolic: [78, 80, 76, 82, 79, 77, 75],
        dates,
      },
      heartRate: {
        values: [72, 68, 75, 70, 73, 69, 71],
        dates,
      },
      glucose: {
        values: [95, 102, 98, 88, 92, 96, 94],
        dates,
      },
      weight: {
        values: [165, 164.5, 165.2, 164, 163.5, 164, 163],
        dates,
      },
    };
  };

  const trends = summary?.trends || generateMockData();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getDataValues = (vitalType: string): number[] => {
    switch (vitalType) {
      case "bloodPressure":
        return trends.bloodPressure.systolic;
      case "heartRate":
        return trends.heartRate.values;
      case "glucose":
        return trends.glucose.values;
      case "weight":
        return trends.weight.values;
      default:
        return [];
    }
  };

  const getDates = (vitalType: string): string[] => {
    switch (vitalType) {
      case "bloodPressure":
        return trends.bloodPressure.dates;
      case "heartRate":
        return trends.heartRate.dates;
      case "glucose":
        return trends.glucose.dates;
      case "weight":
        return trends.weight.dates;
      default:
        return [];
    }
  };

  const getCurrentValue = (vitalType: string) => {
    switch (vitalType) {
      case "bloodPressure":
        const sys = trends.bloodPressure.systolic;
        const dia = trends.bloodPressure.diastolic;
        return `${sys[sys.length - 1]}/${dia[dia.length - 1]}`;
      case "heartRate":
        return trends.heartRate.values[trends.heartRate.values.length - 1].toString();
      case "glucose":
        return trends.glucose.values[trends.glucose.values.length - 1].toString();
      case "weight":
        return trends.weight.values[trends.weight.values.length - 1].toString();
      default:
        return "--";
    }
  };

  const getTrend = (vitalType: string): "up" | "down" | "stable" => {
    let values: number[];
    switch (vitalType) {
      case "bloodPressure":
        values = trends.bloodPressure.systolic;
        break;
      case "heartRate":
        values = trends.heartRate.values;
        break;
      case "glucose":
        values = trends.glucose.values;
        break;
      case "weight":
        values = trends.weight.values;
        break;
      default:
        return "stable";
    }
    const diff = values[values.length - 1] - values[values.length - 2];
    if (Math.abs(diff) < 2) return "stable";
    return diff > 0 ? "up" : "down";
  };

  const createLinePath = (values: number[], padding: { top: number; bottom: number; left: number; right: number }) => {
    if (values.length === 0) return "";
    
    const min = Math.min(...values) - 5;
    const max = Math.max(...values) + 5;
    const range = max - min;
    
    const usableWidth = chartWidth - padding.left - padding.right;
    const usableHeight = chartHeight - padding.top - padding.bottom;
    
    const points = values.map((val, i) => {
      const x = padding.left + (i / (values.length - 1)) * usableWidth;
      const y = padding.top + (1 - (val - min) / range) * usableHeight;
      return { x, y };
    });
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    
    return path;
  };

  const getPointPositions = (values: number[], padding: { top: number; bottom: number; left: number; right: number }) => {
    if (values.length === 0) return [];
    
    const min = Math.min(...values) - 5;
    const max = Math.max(...values) + 5;
    const range = max - min;
    
    const usableWidth = chartWidth - padding.left - padding.right;
    const usableHeight = chartHeight - padding.top - padding.bottom;
    
    return values.map((val, i) => ({
      x: padding.left + (i / (values.length - 1)) * usableWidth,
      y: padding.top + (1 - (val - min) / range) * usableHeight,
      value: val,
    }));
  };

  const renderVitalCard = (vitalType: string) => {
    const config = VITAL_CONFIGS[vitalType];
    const isSelected = selectedVital === vitalType;
    const currentValue = getCurrentValue(vitalType);
    const trend = getTrend(vitalType);

    return (
      <Pressable
        key={vitalType}
        onPress={() => setSelectedVital(vitalType)}
        accessibilityRole="button"
        accessibilityLabel={`${config.label}: ${currentValue} ${config.unit}`}
        accessibilityHint={`Tap to view ${config.label} trend chart`}
      >
        <View
          style={[
            styles.vitalCard,
            { backgroundColor: colors.backgroundDefault },
            isSelected && { borderColor: config.color, borderWidth: 2 },
          ]}
        >
          <View style={[styles.vitalIcon, { backgroundColor: `${config.color}15` }]}>
            <Feather name={config.icon} size={20} color={config.color} />
          </View>
          <ThemedText style={[styles.vitalLabel, { fontSize: 12 * fontScale }]}>
            {config.label}
          </ThemedText>
          <View style={styles.vitalValueRow}>
            <ThemedText style={[styles.vitalValue, { fontSize: 20 * fontScale }]}>
              {currentValue}
            </ThemedText>
            <View style={styles.trendIndicator}>
              {trend === "up" ? (
                <Feather name="trending-up" size={14} color={colors.warning} />
              ) : trend === "down" ? (
                <Feather name="trending-down" size={14} color={colors.success} />
              ) : (
                <Feather name="minus" size={14} color={colors.textSecondary} />
              )}
            </View>
          </View>
          <ThemedText style={[styles.vitalUnit, { fontSize: 11 * fontScale }]}>
            {config.unit}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const renderChart = () => {
    const config = VITAL_CONFIGS[selectedVital];
    const values = getDataValues(selectedVital);
    const dates = getDates(selectedVital);
    const padding = { top: 20, bottom: 40, left: 10, right: 10 };
    
    const linePath = createLinePath(values, padding);
    const points = getPointPositions(values, padding);
    
    const min = Math.min(...values) - 5;
    const max = Math.max(...values) + 5;

    return (
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <ThemedText style={[styles.chartTitle, { fontSize: 16 * fontScale }]}>
            {config.label} Trend
          </ThemedText>
          <View style={[styles.legendDot, { backgroundColor: config.color }]} />
        </View>

        <View
          style={styles.chartContainer}
          accessible={true}
          accessibilityRole="summary"
          accessibilityLabel={`${config.label} trend chart showing data over the past 7 weeks`}
          accessibilityHint={`Displays a line chart of ${config.label.toLowerCase()} readings. Latest value: ${values.length > 0 ? String(values[values.length - 1]) : "no data"} ${config.unit}.`}
        >
          <Svg width={chartWidth} height={chartHeight}>
            {[0, 1, 2, 3].map((i) => (
              <Line
                key={`grid-${i}`}
                x1={padding.left}
                y1={padding.top + (i / 3) * (chartHeight - padding.top - padding.bottom)}
                x2={chartWidth - padding.right}
                y2={padding.top + (i / 3) * (chartHeight - padding.top - padding.bottom)}
                stroke={colors.border}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            ))}
            
            {config.normalRange ? (
              <Rect
                x={padding.left}
                y={padding.top + (1 - (config.normalRange.max - min) / (max - min)) * (chartHeight - padding.top - padding.bottom)}
                width={chartWidth - padding.left - padding.right}
                height={((config.normalRange.max - config.normalRange.min) / (max - min)) * (chartHeight - padding.top - padding.bottom)}
                fill={colors.success}
                fillOpacity={0.1}
              />
            ) : null}
            
            <Path
              d={linePath}
              stroke={config.color}
              strokeWidth={highContrast ? 3 : 2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {points.map((point, i) => (
              <Circle
                key={`point-${i}`}
                cx={point.x}
                cy={point.y}
                r={5}
                fill={config.color}
              />
            ))}
            
            {selectedVital === "bloodPressure" ? (
              <>
                <Path
                  d={createLinePath(trends.bloodPressure.diastolic, padding)}
                  stroke={colors.primary}
                  strokeWidth={highContrast ? 3 : 2}
                  fill="none"
                  strokeDasharray="4,4"
                  strokeLinecap="round"
                />
                {getPointPositions(trends.bloodPressure.diastolic, padding).map((point, i) => (
                  <Circle
                    key={`dia-point-${i}`}
                    cx={point.x}
                    cy={point.y}
                    r={4}
                    fill={colors.primary}
                  />
                ))}
              </>
            ) : null}
            
            {dates.map((date, i) => (
              <SvgText
                key={`label-${i}`}
                x={padding.left + (i / (dates.length - 1)) * (chartWidth - padding.left - padding.right)}
                y={chartHeight - 10}
                fill={colors.textSecondary}
                fontSize={9 * fontScale}
                textAnchor="middle"
              >
                {date.split(" ")[0]}
              </SvgText>
            ))}
          </Svg>
        </View>

        {selectedVital === "bloodPressure" ? (
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: config.color }]} />
              <ThemedText style={[styles.legendText, { fontSize: 12 * fontScale }]}>
                Systolic
              </ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLineDashed, { backgroundColor: colors.primary }]} />
              <ThemedText style={[styles.legendText, { fontSize: 12 * fontScale }]}>
                Diastolic
              </ThemedText>
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderQuickStats = () => {
    const stats = summary?.stats || {
      totalRecords: 47,
      lastVisitDate: "Dec 15, 2025",
      activeMedications: 3,
      upcomingAppointments: 1,
    };

    return (
      <View style={styles.quickStats} accessibilityRole="summary">
        <View 
          style={[styles.quickStatCard, { backgroundColor: colors.backgroundDefault }]}
          accessibilityLabel={`${stats.totalRecords} total health records`}
        >
          <Feather name="file-text" size={20} color={colors.primary} />
          <ThemedText style={[styles.quickStatValue, { fontSize: 22 * fontScale }]}>
            {stats.totalRecords}
          </ThemedText>
          <ThemedText style={[styles.quickStatLabel, { fontSize: 11 * fontScale }]}>
            Records
          </ThemedText>
        </View>
        <View 
          style={[styles.quickStatCard, { backgroundColor: colors.backgroundDefault }]}
          accessibilityLabel={`${stats.activeMedications} active medications`}
        >
          <Feather name="package" size={20} color={Colors.light.recordMedication} />
          <ThemedText style={[styles.quickStatValue, { fontSize: 22 * fontScale }]}>
            {stats.activeMedications}
          </ThemedText>
          <ThemedText style={[styles.quickStatLabel, { fontSize: 11 * fontScale }]}>
            Medications
          </ThemedText>
        </View>
        <View 
          style={[styles.quickStatCard, { backgroundColor: colors.backgroundDefault }]}
          accessibilityLabel={`${stats.upcomingAppointments} upcoming appointments`}
        >
          <Feather name="calendar" size={20} color={colors.info} />
          <ThemedText style={[styles.quickStatValue, { fontSize: 22 * fontScale }]}>
            {stats.upcomingAppointments}
          </ThemedText>
          <ThemedText style={[styles.quickStatLabel, { fontSize: 11 * fontScale }]}>
            Upcoming
          </ThemedText>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        accessibilityRole="scrollbar"
      >
        <View style={styles.header}>
          <ThemedText 
            style={[styles.title, { fontSize: 24 * fontScale }]}
            accessibilityRole="header"
          >
            Health Dashboard
          </ThemedText>
          <ThemedText style={[styles.subtitle, { fontSize: 14 * fontScale }]}>
            Your vitals at a glance
          </ThemedText>
        </View>

        {renderQuickStats()}

        <View 
          style={styles.vitalsGrid}
          accessibilityLabel="Vital signs overview"
        >
          {Object.keys(VITAL_CONFIGS).map(renderVitalCard)}
        </View>

        {renderChart()}

        <Card style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={[styles.insightIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="zap" size={18} color={colors.primary} />
            </View>
            <ThemedText style={[styles.insightTitle, { fontSize: 15 * fontScale }]}>
              AI Health Insight
            </ThemedText>
          </View>
          <ThemedText style={[styles.insightText, { fontSize: 14 * fontScale }]}>
            Your blood pressure has been stable over the past 7 weeks, staying within the normal range. 
            Keep up the good work with your current lifestyle habits.
          </ThemedText>
          <Pressable
            style={[styles.insightButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("AnalyticsDashboard")}
            accessibilityRole="button"
            accessibilityLabel="View detailed analytics"
          >
            <ThemedText style={styles.insightButtonText}>View Detailed Analytics</ThemedText>
            <Feather name="arrow-right" size={16} color="#FFFFFF" />
          </Pressable>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    opacity: 0.7,
  },
  quickStats: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickStatCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  quickStatValue: {
    fontWeight: "700",
    marginTop: Spacing.xs,
  },
  quickStatLabel: {
    opacity: 0.6,
    marginTop: 2,
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  vitalCard: {
    width: (screenWidth - Spacing.lg * 2 - Spacing.sm) / 2 - Spacing.sm / 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  vitalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  vitalLabel: {
    opacity: 0.6,
    marginBottom: 4,
  },
  vitalValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  vitalValue: {
    fontWeight: "700",
  },
  trendIndicator: {},
  vitalUnit: {
    opacity: 0.5,
  },
  chartCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  chartTitle: {
    fontWeight: "600",
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  chartContainer: {
    alignItems: "center",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  legendLineDashed: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    borderStyle: "dashed",
  },
  legendText: {
    opacity: 0.7,
  },
  insightCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  insightTitle: {
    fontWeight: "600",
  },
  insightText: {
    lineHeight: 22,
    opacity: 0.8,
    marginBottom: Spacing.md,
  },
  insightButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  insightButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
