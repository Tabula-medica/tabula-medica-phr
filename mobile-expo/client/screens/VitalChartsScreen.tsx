import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2;
const CHART_HEIGHT = 220;
const GROWTH_CHART_HEIGHT = 280;

interface VitalReading {
  date: string;
  value: number;
  unit: string;
  label: string;
  systolic?: number;
  diastolic?: number;
}

interface VitalCategory {
  type: string;
  count: number;
  latest: VitalReading | null;
  normalRange: { min: number; max: number; label: string } | null;
  data: VitalReading[];
}

interface GrowthPoint {
  date: string;
  ageMonths: number;
  value: number;
  unit: string;
}

type TabMode = "adult" | "pediatric";

const VITAL_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  blood_pressure: "heart",
  heart_rate: "activity",
  temperature: "thermometer",
  respiratory_rate: "wind",
  oxygen_saturation: "droplet",
  weight: "trending-up",
  height: "maximize-2",
  bmi: "bar-chart-2",
};

const VITAL_LABELS: Record<string, string> = {
  blood_pressure: "Blood Pressure",
  heart_rate: "Heart Rate",
  temperature: "Temperature",
  respiratory_rate: "Respiratory Rate",
  oxygen_saturation: "O2 Saturation",
  weight: "Weight",
  height: "Height",
  bmi: "BMI",
};

const VITAL_COLORS: Record<string, string> = {
  blood_pressure: "#ef4444",
  heart_rate: "#f59e0b",
  temperature: "#8b5cf6",
  respiratory_rate: "#14b8a6",
  oxygen_saturation: "#3b82f6",
  weight: "#22c55e",
  height: "#ec4899",
  bmi: "#6366f1",
};

function VitalLineChart({
  data,
  normalRange,
  color,
  width,
  height,
  showDiastolic,
  isDark,
}: {
  data: VitalReading[];
  normalRange: { min: number; max: number } | null;
  color: string;
  width: number;
  height: number;
  showDiastolic?: boolean;
  isDark: boolean;
}) {
  if (data.length === 0) return null;

  const padding = { top: 24, right: 24, bottom: 36, left: 48 };
  const cw = width - padding.left - padding.right;
  const ch = height - padding.top - padding.bottom;

  const allValues = data.flatMap((d) => {
    const vals = [d.value];
    if (showDiastolic && d.diastolic) vals.push(d.diastolic);
    return vals;
  });

  let minVal = Math.min(...allValues);
  let maxVal = Math.max(...allValues);

  if (normalRange) {
    minVal = Math.min(minVal, normalRange.min);
    maxVal = Math.max(maxVal, normalRange.max);
  }

  const valRange = maxVal - minVal || 1;
  minVal -= valRange * 0.1;
  maxVal += valRange * 0.1;
  const range = maxVal - minVal;

  const toX = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * cw;
  const toY = (v: number) => padding.top + ch - ((v - minVal) / range) * ch;

  const mainPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.value) }));
  const mainPath = mainPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${mainPath} L ${mainPoints[mainPoints.length - 1].x} ${padding.top + ch} L ${mainPoints[0].x} ${padding.top + ch} Z`;

  let diastolicPath = "";
  let diastolicPoints: { x: number; y: number }[] = [];
  if (showDiastolic) {
    diastolicPoints = data.map((d, i) => ({ x: toX(i), y: toY(d.diastolic || 0) }));
    diastolicPath = diastolicPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }

  const gridLines = 4;
  const gridStep = range / gridLines;

  const textColor = isDark ? "#9ca3af" : "#6b7280";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>

      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padding.top + (i / gridLines) * ch;
        const val = maxVal - (i / gridLines) * range;
        return (
          <G key={`grid-${i}`}>
            <Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={gridColor} strokeWidth={0.5} strokeDasharray="4,4" />
            <SvgText x={padding.left - 6} y={y + 4} fontSize={10} fill={textColor} textAnchor="end">
              {Math.round(val)}
            </SvgText>
          </G>
        );
      })}

      {normalRange ? (
        <Rect
          x={padding.left}
          y={toY(normalRange.max)}
          width={cw}
          height={toY(normalRange.min) - toY(normalRange.max)}
          fill="#22c55e"
          opacity={0.08}
        />
      ) : null}

      <Path d={areaPath} fill={`url(#grad-${color})`} />
      <Path d={mainPath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

      {mainPoints.map((p, i) => (
        <Circle key={`main-${i}`} cx={p.x} cy={p.y} r={4} fill={color} stroke="white" strokeWidth={2} />
      ))}

      {showDiastolic && diastolicPath ? (
        <>
          <Path d={diastolicPath} stroke={`${color}99`} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray="6,3" />
          {diastolicPoints.map((p, i) => (
            <Circle key={`dia-${i}`} cx={p.x} cy={p.y} r={3} fill={`${color}99`} stroke="white" strokeWidth={1.5} />
          ))}
        </>
      ) : null}

      {data.length <= 12
        ? data.map((d, i) => (
            <SvgText
              key={`label-${i}`}
              x={toX(i)}
              y={padding.top + ch + 18}
              fontSize={9}
              fill={textColor}
              textAnchor="middle"
              rotation={data.length > 6 ? -30 : 0}
              origin={`${toX(i)}, ${padding.top + ch + 18}`}
            >
              {d.date.slice(5)}
            </SvgText>
          ))
        : [0, Math.floor(data.length / 2), data.length - 1].map((idx) => (
            <SvgText
              key={`label-${idx}`}
              x={toX(idx)}
              y={padding.top + ch + 18}
              fontSize={9}
              fill={textColor}
              textAnchor="middle"
            >
              {data[idx].date.slice(5)}
            </SvgText>
          ))}
    </Svg>
  );
}

function GrowthChart({
  patientData,
  percentiles,
  width,
  height,
  color,
  isDark,
  label,
  unit,
}: {
  patientData: GrowthPoint[];
  percentiles: { p3: number[]; p50: number[]; p97: number[] } | null;
  width: number;
  height: number;
  color: string;
  isDark: boolean;
  label: string;
  unit: string;
}) {
  const padding = { top: 28, right: 24, bottom: 44, left: 52 };
  const cw = width - padding.left - padding.right;
  const ch = height - padding.top - padding.bottom;

  const maxMonths = percentiles ? percentiles.p50.length - 1 : Math.max(...patientData.map((d) => d.ageMonths), 24);

  const allValues = [
    ...patientData.map((d) => d.value),
    ...(percentiles ? [...percentiles.p3, ...percentiles.p97] : []),
  ];
  let minVal = Math.min(...allValues) * 0.9;
  let maxVal = Math.max(...allValues) * 1.1;
  const range = maxVal - minVal || 1;

  const toX = (m: number) => padding.left + (m / maxMonths) * cw;
  const toY = (v: number) => padding.top + ch - ((v - minVal) / range) * ch;

  const textColor = isDark ? "#9ca3af" : "#6b7280";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  const makePercentilePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");

  const p3Path = percentiles ? makePercentilePath(percentiles.p3) : "";
  const p50Path = percentiles ? makePercentilePath(percentiles.p50) : "";
  const p97Path = percentiles ? makePercentilePath(percentiles.p97) : "";

  const bandPath = percentiles
    ? `${makePercentilePath(percentiles.p3)} ${percentiles.p97
        .map((v, i) => `L ${toX(percentiles.p97.length - 1 - i)} ${toY(percentiles.p97[percentiles.p97.length - 1 - i])}`)
        .reverse()
        .join(" ")} Z`
    : "";

  const bandPathCorrected = percentiles
    ? (() => {
        const forwardP3 = percentiles.p3.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
        const reverseP97 = [...percentiles.p97]
          .map((v, i) => `L ${toX(percentiles.p97.length - 1 - i)} ${toY(percentiles.p97[percentiles.p97.length - 1 - i])}`)
          .join(" ");
        return `${forwardP3} ${reverseP97} Z`;
      })()
    : "";

  const patientPoints = patientData.map((d) => ({ x: toX(d.ageMonths), y: toY(d.value) }));
  const patientPath = patientPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const gridLines = 5;

  return (
    <View>
      <Svg width={width} height={height}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padding.top + (i / gridLines) * ch;
          const val = maxVal - (i / gridLines) * range;
          return (
            <G key={`gy-${i}`}>
              <Line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke={gridColor} strokeWidth={0.5} strokeDasharray="4,4" />
              <SvgText x={padding.left - 6} y={y + 4} fontSize={9} fill={textColor} textAnchor="end">
                {Math.round(val * 10) / 10}
              </SvgText>
            </G>
          );
        })}

        {[0, 3, 6, 9, 12, 18, 24].filter((m) => m <= maxMonths).map((m) => (
          <G key={`gx-${m}`}>
            <Line x1={toX(m)} y1={padding.top} x2={toX(m)} y2={padding.top + ch} stroke={gridColor} strokeWidth={0.5} strokeDasharray="4,4" />
            <SvgText x={toX(m)} y={padding.top + ch + 16} fontSize={9} fill={textColor} textAnchor="middle">
              {m}mo
            </SvgText>
          </G>
        ))}

        {percentiles ? (
          <>
            <Path d={bandPathCorrected} fill="#22c55e" opacity={0.08} />
            <Path d={p3Path} stroke="#22c55e" strokeWidth={1} fill="none" strokeDasharray="4,4" opacity={0.5} />
            <Path d={p50Path} stroke="#22c55e" strokeWidth={1.5} fill="none" opacity={0.6} />
            <Path d={p97Path} stroke="#22c55e" strokeWidth={1} fill="none" strokeDasharray="4,4" opacity={0.5} />

            <SvgText x={width - padding.right + 2} y={toY(percentiles.p3[percentiles.p3.length - 1]) + 3} fontSize={8} fill="#22c55e" opacity={0.7}>
              3rd
            </SvgText>
            <SvgText x={width - padding.right + 2} y={toY(percentiles.p50[percentiles.p50.length - 1]) + 3} fontSize={8} fill="#22c55e" opacity={0.7}>
              50th
            </SvgText>
            <SvgText x={width - padding.right + 2} y={toY(percentiles.p97[percentiles.p97.length - 1]) + 3} fontSize={8} fill="#22c55e" opacity={0.7}>
              97th
            </SvgText>
          </>
        ) : null}

        {patientData.length > 0 ? (
          <>
            <Path d={patientPath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {patientPoints.map((p, i) => (
              <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={5} fill={color} stroke="white" strokeWidth={2} />
            ))}
          </>
        ) : null}

        <SvgText x={padding.left + cw / 2} y={height - 4} fontSize={10} fill={textColor} textAnchor="middle">
          Age (months)
        </SvgText>
        <SvgText
          x={12}
          y={padding.top + ch / 2}
          fontSize={10}
          fill={textColor}
          textAnchor="middle"
          rotation={-90}
          origin={`12, ${padding.top + ch / 2}`}
        >
          {label} ({unit})
        </SvgText>
      </Svg>

      {percentiles ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: "#22c55e" }]} />
            <ThemedText type="caption">WHO Percentiles (3rd-97th)</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <ThemedText type="caption">Patient Data</ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function VitalSummaryCard({
  category,
  onPress,
  isDark,
  index,
}: {
  category: VitalCategory;
  onPress: () => void;
  isDark: boolean;
  index: number;
}) {
  const color = VITAL_COLORS[category.type] || "#6b7280";
  const icon = VITAL_ICONS[category.type] || "activity";
  const label = VITAL_LABELS[category.type] || category.type;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <Pressable onPress={onPress} testID={`vital-card-${category.type}`}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={[styles.iconCircle, { backgroundColor: `${color}18` }]}>
              <Feather name={icon} size={18} color={color} />
            </View>
            <View style={styles.summaryInfo}>
              <ThemedText type="h4" style={{ fontSize: 14 }}>
                {label}
              </ThemedText>
              <ThemedText type="caption">
                {category.count} reading{category.count !== 1 ? "s" : ""}
              </ThemedText>
            </View>
            <View style={styles.latestValue}>
              {category.latest ? (
                <>
                  <ThemedText type="h4" style={{ fontSize: 18, color }}>
                    {category.latest.label}
                  </ThemedText>
                  <ThemedText type="caption" style={{ fontSize: 10, textAlign: "right" }}>
                    {category.latest.date}
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="caption">No data</ThemedText>
              )}
            </View>
          </View>

          {category.data.length > 1 ? (
            <View style={styles.miniChartContainer}>
              <VitalLineChart
                data={category.data.slice(-8)}
                normalRange={category.normalRange}
                color={color}
                width={CHART_WIDTH}
                height={120}
                showDiastolic={category.type === "blood_pressure"}
                isDark={isDark}
              />
            </View>
          ) : null}

          {category.normalRange ? (
            <View style={[styles.normalRangeTag, { backgroundColor: `${color}10` }]}>
              <Feather name="info" size={12} color={color} />
              <ThemedText type="caption" style={{ marginLeft: 4, color }}>
                {category.normalRange.label}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </Pressable>
    </Animated.View>
  );
}

export default function VitalChartsScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [activeTab, setActiveTab] = useState<TabMode>("adult");
  const [selectedVital, setSelectedVital] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(12);

  const {
    data: adultDataRaw,
    isLoading: adultLoading,
    refetch: refetchAdult,
  } = useQuery({
    queryKey: ["/api/vitals/chart-data", timeRange],
    enabled: activeTab === "adult",
  });
  const adultData = adultDataRaw as any;

  const {
    data: pediatricDataRaw,
    isLoading: pediatricLoading,
    refetch: refetchPediatric,
  } = useQuery({
    queryKey: ["/api/vitals/pediatric-growth"],
    enabled: activeTab === "pediatric",
  });
  const pediatricData = pediatricDataRaw as any;

  const handleRefresh = useCallback(() => {
    if (activeTab === "adult") {
      refetchAdult();
    } else {
      refetchPediatric();
    }
  }, [activeTab, refetchAdult, refetchPediatric]);

  const categories: VitalCategory[] = useMemo(() => {
    if (!adultData?.categories) return [];
    return adultData.categories;
  }, [adultData]);

  const expandedCategory = useMemo(() => {
    if (!selectedVital) return null;
    return categories.find((c: VitalCategory) => c.type === selectedVital) || null;
  }, [selectedVital, categories]);

  const timeRangeOptions = [
    { label: "3M", value: 3 },
    { label: "6M", value: 6 },
    { label: "1Y", value: 12 },
    { label: "2Y", value: 24 },
  ];

  const isLoading = activeTab === "adult" ? adultLoading : pediatricLoading;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === "adult" ? { backgroundColor: theme.primary } : { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }]}
            onPress={() => { setActiveTab("adult"); setSelectedVital(null); }}
            testID="tab-adult"
          >
            <Feather name="activity" size={16} color={activeTab === "adult" ? "#fff" : theme.textSecondary} />
            <ThemedText
              type="h4"
              style={[styles.tabText, activeTab === "adult" ? { color: "#fff" } : { color: theme.textSecondary }]}
            >
              Adult Vitals
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === "pediatric" ? { backgroundColor: theme.primary } : { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" }]}
            onPress={() => { setActiveTab("pediatric"); setSelectedVital(null); }}
            testID="tab-pediatric"
          >
            <Feather name="trending-up" size={16} color={activeTab === "pediatric" ? "#fff" : theme.textSecondary} />
            <ThemedText
              type="h4"
              style={[styles.tabText, activeTab === "pediatric" ? { color: "#fff" } : { color: theme.textSecondary }]}
            >
              Growth Charts
            </ThemedText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="caption" style={{ marginTop: Spacing.md }}>
              Loading vital signs...
            </ThemedText>
          </View>
        ) : activeTab === "adult" ? (
          <>
            <View style={styles.timeRangeRow}>
              {timeRangeOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.timeRangeBtn,
                    timeRange === opt.value
                      ? { backgroundColor: theme.primary }
                      : { backgroundColor: isDark ? "#1f2937" : "#f3f4f6" },
                  ]}
                  onPress={() => setTimeRange(opt.value)}
                  testID={`time-range-${opt.value}`}
                >
                  <ThemedText
                    type="caption"
                    style={[
                      styles.timeRangeBtnText,
                      timeRange === opt.value ? { color: "#fff" } : { color: theme.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {selectedVital && expandedCategory ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <Card style={styles.expandedCard}>
                  <View style={styles.expandedHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Feather
                        name={VITAL_ICONS[expandedCategory.type] || "activity"}
                        size={20}
                        color={VITAL_COLORS[expandedCategory.type] || theme.primary}
                      />
                      <ThemedText type="h4" style={{ marginLeft: 8, fontSize: 16 }}>
                        {VITAL_LABELS[expandedCategory.type]}
                      </ThemedText>
                    </View>
                    <Pressable onPress={() => setSelectedVital(null)} testID="close-expanded">
                      <Feather name="x" size={20} color={theme.textSecondary} />
                    </Pressable>
                  </View>

                  <VitalLineChart
                    data={expandedCategory.data}
                    normalRange={expandedCategory.normalRange}
                    color={VITAL_COLORS[expandedCategory.type] || theme.primary}
                    width={CHART_WIDTH}
                    height={CHART_HEIGHT}
                    showDiastolic={expandedCategory.type === "blood_pressure"}
                    isDark={isDark}
                  />

                  {expandedCategory.normalRange ? (
                    <View style={[styles.normalRangeBanner, { backgroundColor: "#22c55e12" }]}>
                      <Feather name="check-circle" size={14} color="#22c55e" />
                      <ThemedText type="caption" style={{ marginLeft: 6, color: "#22c55e" }}>
                        {expandedCategory.normalRange.label}
                      </ThemedText>
                    </View>
                  ) : null}

                  {expandedCategory.data.length > 0 ? (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <ThemedText type="caption">Min</ThemedText>
                        <ThemedText type="h4">
                          {Math.min(...expandedCategory.data.map((d: VitalReading) => d.value))}
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText type="caption">Max</ThemedText>
                        <ThemedText type="h4">
                          {Math.max(...expandedCategory.data.map((d: VitalReading) => d.value))}
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText type="caption">Avg</ThemedText>
                        <ThemedText type="h4">
                          {Math.round(
                            expandedCategory.data.reduce((s: number, d: VitalReading) => s + d.value, 0) / expandedCategory.data.length
                          )}
                        </ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText type="caption">Readings</ThemedText>
                        <ThemedText type="h4">{expandedCategory.data.length}</ThemedText>
                      </View>
                    </View>
                  ) : null}
                </Card>
              </Animated.View>
            ) : null}

            {categories.length > 0 ? (
              categories.map((cat: VitalCategory, index: number) => (
                <VitalSummaryCard
                  key={cat.type}
                  category={cat}
                  onPress={() => setSelectedVital(selectedVital === cat.type ? null : cat.type)}
                  isDark={isDark}
                  index={index}
                />
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Feather name="activity" size={48} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                  No Vital Signs Recorded
                </ThemedText>
                <ThemedText type="caption" style={{ marginTop: Spacing.sm, textAlign: "center", lineHeight: 20 }}>
                  Add vital sign records to see trend charts and analysis. Records can be added from the Records tab or imported from connected health systems.
                </ThemedText>
              </Card>
            )}
          </>
        ) : (
          <>
            {pediatricData ? (
              <>
                <Card style={styles.patientInfoCard}>
                  <View style={styles.patientInfoRow}>
                    <View style={styles.patientInfoItem}>
                      <ThemedText type="caption">Age</ThemedText>
                      <ThemedText type="h4">
                        {pediatricData.ageYears < 2
                          ? `${pediatricData.ageMonths} months`
                          : `${pediatricData.ageYears} years`}
                      </ThemedText>
                    </View>
                    <View style={styles.patientInfoItem}>
                      <ThemedText type="caption">Gender</ThemedText>
                      <ThemedText type="h4" style={{ textTransform: "capitalize" }}>
                        {pediatricData.gender || "Not set"}
                      </ThemedText>
                    </View>
                    <View style={styles.patientInfoItem}>
                      <ThemedText type="caption">Chart Type</ThemedText>
                      <ThemedText type="h4">
                        {pediatricData.isPediatric ? "WHO Growth" : "Adult Trend"}
                      </ThemedText>
                    </View>
                  </View>
                </Card>

                {pediatricData.isPediatric ? (
                  <>
                    {pediatricData.measurements.weight.count > 0 || pediatricData.percentileCurves ? (
                      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                        <Card style={styles.chartCard}>
                          <View style={styles.chartHeader}>
                            <Feather name="trending-up" size={18} color="#22c55e" />
                            <ThemedText type="h4" style={{ marginLeft: 8 }}>
                              Weight-for-Age
                            </ThemedText>
                          </View>
                          <GrowthChart
                            patientData={pediatricData.measurements.weight.data}
                            percentiles={pediatricData.percentileCurves?.weight || null}
                            width={CHART_WIDTH}
                            height={GROWTH_CHART_HEIGHT}
                            color="#3b82f6"
                            isDark={isDark}
                            label="Weight"
                            unit="kg"
                          />
                        </Card>
                      </Animated.View>
                    ) : null}

                    {pediatricData.measurements.height.count > 0 || pediatricData.percentileCurves ? (
                      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                        <Card style={styles.chartCard}>
                          <View style={styles.chartHeader}>
                            <Feather name="maximize-2" size={18} color="#8b5cf6" />
                            <ThemedText type="h4" style={{ marginLeft: 8 }}>
                              Height/Length-for-Age
                            </ThemedText>
                          </View>
                          <GrowthChart
                            patientData={pediatricData.measurements.height.data}
                            percentiles={pediatricData.percentileCurves?.height || null}
                            width={CHART_WIDTH}
                            height={GROWTH_CHART_HEIGHT}
                            color="#8b5cf6"
                            isDark={isDark}
                            label="Height"
                            unit="cm"
                          />
                        </Card>
                      </Animated.View>
                    ) : null}

                    {pediatricData.measurements.headCircumference.count > 0 ? (
                      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
                        <Card style={styles.chartCard}>
                          <View style={styles.chartHeader}>
                            <Feather name="circle" size={18} color="#f59e0b" />
                            <ThemedText type="h4" style={{ marginLeft: 8 }}>
                              Head Circumference-for-Age
                            </ThemedText>
                          </View>
                          <GrowthChart
                            patientData={pediatricData.measurements.headCircumference.data}
                            percentiles={null}
                            width={CHART_WIDTH}
                            height={GROWTH_CHART_HEIGHT}
                            color="#f59e0b"
                            isDark={isDark}
                            label="Head Circumference"
                            unit="cm"
                          />
                        </Card>
                      </Animated.View>
                    ) : null}

                    {pediatricData.measurements.bmi.count > 0 ? (
                      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                        <Card style={styles.chartCard}>
                          <View style={styles.chartHeader}>
                            <Feather name="bar-chart-2" size={18} color="#6366f1" />
                            <ThemedText type="h4" style={{ marginLeft: 8 }}>
                              BMI-for-Age
                            </ThemedText>
                          </View>
                          <GrowthChart
                            patientData={pediatricData.measurements.bmi.data}
                            percentiles={null}
                            width={CHART_WIDTH}
                            height={GROWTH_CHART_HEIGHT}
                            color="#6366f1"
                            isDark={isDark}
                            label="BMI"
                            unit="kg/m2"
                          />
                        </Card>
                      </Animated.View>
                    ) : null}

                    {pediatricData.measurements.weight.count === 0 &&
                    pediatricData.measurements.height.count === 0 &&
                    pediatricData.measurements.headCircumference.count === 0 ? (
                      <Card style={styles.emptyCard}>
                        <Feather name="trending-up" size={48} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                        <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                          No Growth Measurements
                        </ThemedText>
                        <ThemedText type="caption" style={{ marginTop: Spacing.sm, textAlign: "center", lineHeight: 20 }}>
                          WHO percentile curves are shown. Add weight, height, and head circumference measurements to track growth.
                        </ThemedText>
                      </Card>
                    ) : null}
                  </>
                ) : (
                  <Card style={styles.emptyCard}>
                    <Feather name="user" size={48} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                    <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                      Adult Patient
                    </ThemedText>
                    <ThemedText type="caption" style={{ marginTop: Spacing.sm, textAlign: "center", lineHeight: 20 }}>
                      Growth charts are designed for pediatric patients (under 18 years). Use the Adult Vitals tab for trend analysis.
                    </ThemedText>
                  </Card>
                )}
              </>
            ) : (
              <Card style={styles.emptyCard}>
                <Feather name="alert-circle" size={48} color={theme.textSecondary} style={{ opacity: 0.4 }} />
                <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                  Patient Profile Required
                </ThemedText>
                <ThemedText type="caption" style={{ marginTop: Spacing.sm, textAlign: "center", lineHeight: 20 }}>
                  Date of birth is needed for growth charts. Complete the patient profile first.
                </ThemedText>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  timeRangeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  timeRangeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  timeRangeBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  latestValue: {
    alignItems: "flex-end",
  },
  miniChartContainer: {
    marginTop: Spacing.sm,
    alignItems: "center",
  },
  normalRangeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  expandedCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  normalRangeBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb22",
  },
  statItem: {
    alignItems: "center",
    gap: 2,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  patientInfoCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  patientInfoRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  patientInfoItem: {
    alignItems: "center",
    gap: 4,
  },
  chartCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
