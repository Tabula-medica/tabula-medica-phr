import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import Svg, { Polyline, Circle, Line, Rect } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TrendDataPoint {
  date: string;
  value: number;
  id: string;
}

interface TrendResponse {
  recordId: string;
  recordTitle: string;
  recordType: string;
  trendData: TrendDataPoint[];
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data";
  stats: {
    min: number;
    max: number;
    avg: number;
    count: number;
    latest: number;
  } | null;
}

interface TrendSparklineProps {
  recordId: string;
  recordType: string;
  activeRecordId: string;
}

const SPARKLINE_WIDTH = 280;
const SPARKLINE_HEIGHT = 60;
const PADDING = 8;

export function TrendSparkline({ recordId, recordType, activeRecordId }: TrendSparklineProps) {
  const { theme } = useTheme();

  const showTrend = recordType === "lab" || recordType === "vital";

  const { data, isLoading, isError } = useQuery<TrendResponse>({
    queryKey: [`/api/health-records/${recordId}/trend`],
    enabled: showTrend,
  });

  if (!showTrend) return null;
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Loading trend data...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (isError || !data || !data.stats || data.trendData.length < 2) return null;

  const { trendData, stats, trend } = data;

  const trendColor =
    trend === "increasing" ? "#10B981" :
    trend === "decreasing" ? "#EF4444" :
    theme.primary;

  const trendIcon: keyof typeof Feather.glyphMap =
    trend === "increasing" ? "trending-up" :
    trend === "decreasing" ? "trending-down" :
    "minus";

  const trendLabel =
    trend === "increasing" ? "Trending up" :
    trend === "decreasing" ? "Trending down" :
    "Stable";

  const values = trendData.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const chartWidth = SPARKLINE_WIDTH - PADDING * 2;
  const chartHeight = SPARKLINE_HEIGHT - PADDING * 2;

  const points = trendData.map((d, i) => {
    const x = PADDING + (i / (trendData.length - 1)) * chartWidth;
    const y = PADDING + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { x, y, isActive: d.id === activeRecordId };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");
  const activePoint = points.find(p => p.isActive);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]} testID="trend-sparkline">
      <View style={styles.headerRow}>
        <View style={styles.trendLabel}>
          <Feather name={trendIcon} size={14} color={trendColor} />
          <ThemedText type="caption" style={{ color: trendColor, fontWeight: "600" }}>
            {trendLabel}
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {stats.count} readings
        </ThemedText>
      </View>

      <View style={styles.chartContainer}>
        <Svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT}>
          <Rect x={0} y={0} width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} fill="transparent" />

          <Line
            x1={PADDING}
            y1={PADDING + chartHeight - ((stats.avg - minVal) / range) * chartHeight}
            x2={PADDING + chartWidth}
            y2={PADDING + chartHeight - ((stats.avg - minVal) / range) * chartHeight}
            stroke={theme.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={trendColor}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {activePoint ? (
            <>
              <Circle cx={activePoint.x} cy={activePoint.y} r={5} fill={trendColor} opacity={0.2} />
              <Circle cx={activePoint.x} cy={activePoint.y} r={3} fill={trendColor} />
            </>
          ) : null}
        </Svg>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Min</ThemedText>
          <ThemedText type="caption" style={{ fontWeight: "600" }}>{stats.min}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Avg</ThemedText>
          <ThemedText type="caption" style={{ fontWeight: "600" }}>{stats.avg}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Max</ThemedText>
          <ThemedText type="caption" style={{ fontWeight: "600" }}>{stats.max}</ThemedText>
        </View>
        <View style={styles.statItem}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>Latest</ThemedText>
          <ThemedText type="caption" style={{ fontWeight: "600", color: trendColor }}>{stats.latest}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  trendLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chartContainer: {
    alignItems: "center",
    marginVertical: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
    gap: 2,
  },
});
