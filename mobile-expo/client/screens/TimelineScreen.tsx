import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Shadows, GlassEffects, Gradients } from "@/constants/theme";
import { api, HealthRecord, HealthSummary } from "@/lib/api";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";

type RecordType = "visit" | "lab" | "medication" | "imaging" | "procedure" | "immunization" | "allergy" | "vital" | "condition" | "document";

type ZoomLevel = "day" | "month" | "year" | "all";
type EventLane = "all" | "visits" | "labs" | "imaging" | "meds" | "problems" | "procedures" | "immunizations";

interface Episode {
  id: string;
  name: string;
  type: "cancer" | "pregnancy" | "surgery" | "chronic" | "acute" | "wellness";
  startDate: string;
  endDate?: string;
  recordIds: string[];
  isExpanded: boolean;
}

const ZOOM_LEVELS: { key: ZoomLevel; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All" },
];

const EVENT_LANES: { key: EventLane; label: string; icon: keyof typeof Feather.glyphMap; types: string[] }[] = [
  { key: "all", label: "All", icon: "list", types: [] },
  { key: "visits", label: "Visits", icon: "user", types: ["visit", "appointment"] },
  { key: "labs", label: "Labs", icon: "activity", types: ["lab"] },
  { key: "imaging", label: "Imaging", icon: "image", types: ["imaging"] },
  { key: "meds", label: "Meds", icon: "package", types: ["medication"] },
  { key: "problems", label: "Problems", icon: "alert-circle", types: ["condition", "allergy"] },
  { key: "procedures", label: "Procedures", icon: "tool", types: ["procedure"] },
  { key: "immunizations", label: "Immun.", icon: "shield", types: ["immunization"] },
];

const EPISODE_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  cancer: { icon: "heart", color: "#e11d48" },
  pregnancy: { icon: "star", color: "#8b5cf6" },
  surgery: { icon: "tool", color: "#0ea5e9" },
  chronic: { icon: "clock", color: "#f59e0b" },
  acute: { icon: "zap", color: "#ef4444" },
  wellness: { icon: "sun", color: "#22c55e" },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RECORD_TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof Feather.glyphMap; colorKey: keyof typeof Colors.light }
> = {
  visit: { icon: "user", colorKey: "recordVisit" },
  lab: { icon: "activity", colorKey: "recordLab" },
  medication: { icon: "package", colorKey: "recordMedication" },
  imaging: { icon: "image", colorKey: "recordImaging" },
  procedure: { icon: "tool", colorKey: "recordVisit" },
  immunization: { icon: "shield", colorKey: "recordLab" },
  allergy: { icon: "alert-triangle", colorKey: "warning" },
  vital: { icon: "heart", colorKey: "recordMedication" },
  condition: { icon: "file-text", colorKey: "recordVisit" },
  document: { icon: "file", colorKey: "textSecondary" },
  appointment: { icon: "calendar", colorKey: "primary" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function getMonthYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

interface GroupedRecords {
  monthYear: string;
  records: HealthRecord[];
}

function groupRecordsByMonth(records: HealthRecord[]): GroupedRecords[] {
  const sorted = [...records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const grouped: Map<string, HealthRecord[]> = new Map();

  sorted.forEach((record) => {
    const monthYear = getMonthYear(record.date);
    if (!grouped.has(monthYear)) {
      grouped.set(monthYear, []);
    }
    grouped.get(monthYear)!.push(record);
  });

  return Array.from(grouped.entries()).map(([monthYear, records]) => ({
    monthYear,
    records,
  }));
}

const getGradientForType = (type: string): readonly [string, string] => {
  switch (type) {
    case "visit":
    case "procedure":
    case "condition":
      return Gradients.visit as [string, string];
    case "lab":
    case "immunization":
      return Gradients.lab as [string, string];
    case "medication":
    case "vital":
      return Gradients.medication as [string, string];
    case "imaging":
      return Gradients.imaging as [string, string];
    case "appointment":
      return ["#0ea5e9", "#3b82f6"] as [string, string];
    default:
      return Gradients.primary as [string, string];
  }
};

const STATUS_CONFIG: Record<string, { color: string; icon: "check-circle" | "thumbs-up" | "alert-circle" | "alert-triangle" | "trending-up" | "trending-down" | "minus"; label: string }> = {
  excellent: { color: "#22c55e", icon: "check-circle", label: "Excellent" },
  good: { color: "#0ea5e9", icon: "thumbs-up", label: "Good" },
  stable: { color: "#0ea5e9", icon: "minus", label: "Stable" },
  improving: { color: "#22c55e", icon: "trending-up", label: "Improving" },
  declining: { color: "#f59e0b", icon: "trending-down", label: "Declining" },
  needs_attention: { color: "#f59e0b", icon: "alert-circle", label: "Needs Attention" },
  attention_needed: { color: "#f59e0b", icon: "alert-circle", label: "Needs Attention" },
  critical: { color: "#ef4444", icon: "alert-triangle", label: "Critical" },
  action_required: { color: "#ef4444", icon: "alert-triangle", label: "Action Required" },
};

const TREND_CONFIG = {
  up: { icon: "trending-up" as const, color: "#22c55e" },
  down: { icon: "trending-down" as const, color: "#0ea5e9" },
  stable: { icon: "minus" as const, color: "#64748b" },
};

const MEDICAL_CODE_MAP: Record<string, string> = {
  "I10": "High Blood Pressure",
  "E11": "Type 2 Diabetes",
  "E11.9": "Type 2 Diabetes",
  "J06.9": "Upper Respiratory Infection",
  "M54.5": "Low Back Pain",
  "J45": "Asthma",
  "J45.909": "Asthma",
  "E78.5": "High Cholesterol",
  "E78.0": "High Cholesterol",
  "F41.1": "Generalized Anxiety",
  "F32.9": "Major Depression",
  "K21.0": "Acid Reflux (GERD)",
  "N39.0": "Urinary Tract Infection",
  "G43.909": "Migraine",
  "R10.9": "Abdominal Pain",
  "R05": "Cough",
  "Z00.00": "General Exam",
  "Z23": "Immunization Encounter",
  "99213": "Office Visit (Est. Patient)",
  "99214": "Office Visit (Detailed)",
  "99215": "Office Visit (Complex)",
  "99203": "Office Visit (New Patient)",
  "99204": "Office Visit (New, Detailed)",
  "36415": "Blood Draw",
  "80053": "Comprehensive Metabolic Panel",
  "85025": "Complete Blood Count (CBC)",
  "80061": "Lipid Panel",
  "83036": "Hemoglobin A1c",
  "81001": "Urinalysis",
  "71046": "Chest X-Ray",
  "70553": "Brain MRI",
  "74177": "CT Abdomen/Pelvis",
};

function humanizeMedicalCode(title: string): { displayName: string; codeLabel: string | null } {
  const icdMatch = title.match(/\b([A-Z]\d{2}(?:\.\d{1,3})?)\b/);
  const cptMatch = title.match(/\b(\d{5})\b/);

  if (icdMatch) {
    const code = icdMatch[1];
    const humanName = MEDICAL_CODE_MAP[code];
    if (humanName) {
      return { displayName: humanName, codeLabel: `ICD-10: ${code}` };
    }
  }

  if (cptMatch) {
    const code = cptMatch[1];
    const humanName = MEDICAL_CODE_MAP[code];
    if (humanName) {
      return { displayName: humanName, codeLabel: `CPT: ${code}` };
    }
  }

  for (const [code, name] of Object.entries(MEDICAL_CODE_MAP)) {
    if (title.toLowerCase().includes(code.toLowerCase())) {
      const isIcd = /^[A-Z]/.test(code);
      return { displayName: name, codeLabel: isIcd ? `ICD-10: ${code}` : `CPT: ${code}` };
    }
  }

  return { displayName: title, codeLabel: null };
}

type TrendDirection = "improving" | "concerning" | "stable" | null;

function getRecordTrend(record: HealthRecord): TrendDirection {
  if (record.type !== "lab") return null;

  const details = record.details;
  if (!details) return null;

  if (details.trend) {
    const t = String(details.trend).toLowerCase();
    if (t === "improving" || t === "decreasing" || t === "better") return "improving";
    if (t === "concerning" || t === "increasing" || t === "worse" || t === "elevated") return "concerning";
    if (t === "stable" || t === "normal" || t === "unchanged") return "stable";
  }

  if (details.flag) {
    const f = String(details.flag).toLowerCase();
    if (f === "high" || f === "critical" || f === "abnormal") return "concerning";
    if (f === "low") return "concerning";
    if (f === "normal") return "stable";
  }

  if (details.interpretation) {
    const interp = String(details.interpretation).toLowerCase();
    if (interp.includes("improv") || interp.includes("better") || interp.includes("decreas")) return "improving";
    if (interp.includes("elevat") || interp.includes("abnormal") || interp.includes("high") || interp.includes("concern")) return "concerning";
    if (interp.includes("normal") || interp.includes("stable")) return "stable";
  }

  return null;
}

function getColorForRecordType(type: string, theme: typeof Colors.light): string {
  switch (type) {
    case "visit":
    case "condition":
    case "appointment":
      return theme.recordVisit;
    case "lab":
    case "immunization":
      return theme.recordLab;
    case "medication":
    case "imaging":
    case "vital":
    case "allergy":
      return theme.recordMedication;
    case "procedure":
      return theme.recordImaging;
    default:
      return theme.primary;
  }
}

function HealthSummaryCard({
  summary,
  theme,
  isDark,
}: {
  summary: HealthSummary;
  theme: typeof Colors.light;
  isDark: boolean;
}) {
  const statusConfig = STATUS_CONFIG[summary.overallStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.good;
  const glassEffect = isDark ? GlassEffects.dark : GlassEffects.light;

  return (
    <Animated.View entering={FadeInDown.delay(100).springify()}>
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: glassEffect.background,
            borderColor: glassEffect.border,
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={glassEffect.blur} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ) : null}
        
        <View style={styles.summaryHeader}>
          <View style={styles.summaryGreeting}>
            <ThemedText type="h2">{summary.greeting}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
              {summary.statusDescription}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Feather name={statusConfig.icon} size={16} color={statusConfig.color} />
            <ThemedText type="caption" style={{ color: statusConfig.color, fontWeight: '600' }}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.aiSummaryContainer}>
          <View style={styles.aiSummaryIcon}>
            <LinearGradient
              colors={["#8b5cf6", "#6366f1"]}
              style={styles.aiIconGradient}
            >
              <Feather name="cpu" size={14} color="#fff" />
            </LinearGradient>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 8 }}>
              AI Health Summary
            </ThemedText>
          </View>
          <ThemedText type="body" style={[styles.aiSummaryText, { color: theme.text }]}>
            {summary.aiSummary}
          </ThemedText>
        </View>

        <View style={styles.insightsGrid}>
          {(summary.keyInsights || []).slice(0, 4).map((insight, index) => {
            const trendConfig = insight.trend ? TREND_CONFIG[insight.trend] : null;
            return (
              <View
                key={index}
                style={[
                  styles.insightCard,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
                ]}
              >
                <View style={styles.insightHeader}>
                  <Feather
                    name={insight.icon as keyof typeof Feather.glyphMap}
                    size={16}
                    color={theme.primary}
                  />
                  {trendConfig ? (
                    <Feather name={trendConfig.icon} size={12} color={trendConfig.color} />
                  ) : null}
                </View>
                <ThemedText type="h4" numberOfLines={1}>{insight.value}</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
                  {insight.title}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

function VisualTimeline({
  recentActivity,
  upcomingItems,
  theme,
  isDark,
  onItemPress,
}: {
  recentActivity: HealthSummary['recentActivity'];
  upcomingItems: HealthSummary['upcomingItems'];
  theme: typeof Colors.light;
  isDark: boolean;
  onItemPress?: (item: any) => void;
}) {
  const glassEffect = isDark ? GlassEffects.dark : GlassEffects.light;
  const allItems = [
    ...(upcomingItems || []).map(item => ({ ...item, isUpcoming: true })),
    ...(recentActivity || []).map(item => ({ ...item, isUpcoming: false })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);

  return (
    <Animated.View entering={FadeInDown.delay(200).springify()}>
      <View style={styles.timelineSection}>
        <ThemedText type="h3" style={styles.sectionTitle}>Health Timeline</ThemedText>
        
        <View style={styles.visualTimeline}>
          {allItems.map((item, index) => {
            const config = RECORD_TYPE_CONFIG[item.type] || RECORD_TYPE_CONFIG.visit;
            const gradientColors = getGradientForType(item.type);
            const isUpcoming = 'isUpcoming' in item && item.isUpcoming;
            
            return (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(100 + index * 50).springify()}
              >
                <Pressable
                  style={[
                    styles.timelineItem,
                    {
                      backgroundColor: glassEffect.background,
                      borderColor: isUpcoming ? theme.primary + '40' : glassEffect.border,
                      borderWidth: isUpcoming ? 2 : 1,
                    },
                  ]}
                  onPress={() => onItemPress?.(item)}
                >
                  {Platform.OS === "ios" ? (
                    <BlurView intensity={glassEffect.blur * 0.5} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                  ) : null}
                  
                  <View style={styles.timelineItemContent}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot]}>
                        <LinearGradient
                          colors={gradientColors}
                          style={styles.timelineDotGradient}
                        >
                          <Feather name={config.icon} size={12} color="#fff" />
                        </LinearGradient>
                      </View>
                      {index < allItems.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                      ) : null}
                    </View>
                    
                    <View style={styles.timelineRight}>
                      <View style={styles.timelineItemHeader}>
                        <ThemedText type="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                          {item.title}
                        </ThemedText>
                        {isUpcoming ? (
                          <View style={[styles.upcomingBadge, { backgroundColor: theme.primary + '20' }]}>
                            <ThemedText type="caption" style={{ color: theme.primary, fontWeight: '600' }}>
                              Upcoming
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {formatRelativeDate(item.date)}
                        {'description' in item ? ` • ${item.description}` : ''}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

function TimelineCard({
  record,
  index,
  onPress,
  theme,
  isDark,
}: {
  record: HealthRecord;
  index: number;
  onPress: () => void;
  theme: typeof Colors.light;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);
  const config = RECORD_TYPE_CONFIG[record.type] || RECORD_TYPE_CONFIG.visit;
  const recordColor = theme[config.colorKey] as string;
  const glassEffect = isDark ? GlassEffects.dark : GlassEffects.light;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.98, 1], [0.85, 1]),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const trend = getRecordTrend(record);
  const { displayName, codeLabel } = humanizeMedicalCode(record.title);
  const typeAccentColor = getColorForRecordType(record.type, theme);

  const trendBadge = trend ? (
    <View style={[
      styles.trendBadge,
      {
        backgroundColor: trend === "improving"
          ? "#22c55e20"
          : trend === "concerning"
            ? "#ef444420"
            : "#64748b20",
      },
    ]}>
      <Feather
        name={trend === "improving" ? "trending-down" : trend === "concerning" ? "trending-up" : "minus"}
        size={10}
        color={trend === "improving" ? "#22c55e" : trend === "concerning" ? "#ef4444" : "#64748b"}
      />
      <ThemedText type="caption" style={{
        color: trend === "improving" ? "#22c55e" : trend === "concerning" ? "#ef4444" : "#64748b",
        fontWeight: "600",
        fontSize: 10,
      }}>
        {trend === "improving" ? "Improved" : trend === "concerning" ? "Elevated" : "Stable"}
      </ThemedText>
    </View>
  ) : null;

  const cardContent = (
    <View style={styles.cardInner}>
      <View style={[styles.cardIcon, { backgroundColor: recordColor + "15" }]}>
        <Feather name={config.icon} size={22} color={recordColor} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
            <ThemedText type="h4" numberOfLines={1} style={styles.cardTitle}>
              {displayName}
            </ThemedText>
            {trendBadge}
          </View>
          <View style={styles.dateChip}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatRelativeDate(record.date)}
            </ThemedText>
          </View>
        </View>
        {codeLabel ? (
          <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 10 }}>
            ({codeLabel})
          </ThemedText>
        ) : null}
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary }}
          numberOfLines={1}
        >
          {record.provider}
        </ThemedText>
        <ThemedText
          type="small"
          numberOfLines={2}
          style={[styles.cardSummary, { color: theme.textSecondary }]}
        >
          {record.summary}
        </ThemedText>
      </View>
      <Feather
        name="chevron-right"
        size={20}
        color={theme.textSecondary}
        style={styles.cardChevron}
      />
    </View>
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
    >
      <Animated.View
        entering={FadeInDown.delay(index * 30).springify()}
        style={[
          styles.card,
          {
            backgroundColor: glassEffect.background,
            borderColor: glassEffect.border,
          },
        ]}
      >
        <View style={[styles.accentGradient, { backgroundColor: typeAccentColor }]} />
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={glassEffect.blur}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {cardContent}
      </Animated.View>
    </AnimatedPressable>
  );
}

const DEMO_EPISODES: Episode[] = [
  {
    id: "ep-1",
    name: "Type 2 Diabetes Management",
    type: "chronic",
    startDate: "2023-06-15",
    recordIds: ["rec-1", "rec-2", "rec-3"],
    isExpanded: false,
  },
  {
    id: "ep-2",
    name: "Knee Surgery Recovery",
    type: "surgery",
    startDate: "2024-11-01",
    endDate: "2025-01-15",
    recordIds: ["rec-4", "rec-5"],
    isExpanded: false,
  },
];

function TimelineFilters({
  zoomLevel,
  setZoomLevel,
  eventLane,
  setEventLane,
  theme,
}: {
  zoomLevel: ZoomLevel;
  setZoomLevel: (z: ZoomLevel) => void;
  eventLane: EventLane;
  setEventLane: (e: EventLane) => void;
  theme: typeof Colors.light;
}) {
  return (
    <View style={filterStyles.container}>
      <View style={filterStyles.section}>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
          ZOOM
        </ThemedText>
        <View style={[filterStyles.zoomRow, { backgroundColor: theme.backgroundSecondary }]}>
          {ZOOM_LEVELS.map((level) => (
            <Pressable
              key={level.key}
              style={[
                filterStyles.zoomBtn,
                zoomLevel === level.key && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setZoomLevel(level.key);
              }}
            >
              <ThemedText style={[
                filterStyles.zoomText,
                { color: zoomLevel === level.key ? "#fff" : theme.text },
              ]}>
                {level.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={filterStyles.section}>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
          CATEGORY
        </ThemedText>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={filterStyles.laneRow}
        >
          {EVENT_LANES.map((lane) => (
            <Pressable
              key={lane.key}
              style={[
                filterStyles.laneBtn,
                { backgroundColor: eventLane === lane.key ? `${theme.primary}20` : theme.backgroundSecondary },
                eventLane === lane.key && { borderColor: theme.primary, borderWidth: 1 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEventLane(lane.key);
              }}
            >
              <Feather 
                name={lane.icon} 
                size={14} 
                color={eventLane === lane.key ? theme.primary : theme.textSecondary} 
              />
              <ThemedText style={[
                filterStyles.laneText,
                { color: eventLane === lane.key ? theme.primary : theme.text },
              ]}>
                {lane.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function EpisodeCard({
  episode,
  onToggle,
  recordCount,
  theme,
}: {
  episode: Episode;
  onToggle: () => void;
  recordCount: number;
  theme: typeof Colors.light;
}) {
  const config = EPISODE_CONFIG[episode.type] || EPISODE_CONFIG.wellness;

  return (
    <Pressable 
      style={[episodeStyles.card, { backgroundColor: theme.backgroundDefault }]}
      onPress={onToggle}
    >
      <View style={[episodeStyles.iconContainer, { backgroundColor: `${config.color}15` }]}>
        <Feather name={config.icon} size={18} color={config.color} />
      </View>
      <View style={episodeStyles.content}>
        <ThemedText style={{ fontWeight: "600" }}>{episode.name}</ThemedText>
        <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
          {new Date(episode.startDate).toLocaleDateString()} 
          {episode.endDate ? ` - ${new Date(episode.endDate).toLocaleDateString()}` : " - Ongoing"}
          {" | "}{recordCount} records
        </ThemedText>
      </View>
      <Feather 
        name={episode.isExpanded ? "chevron-up" : "chevron-down"} 
        size={20} 
        color={theme.textSecondary} 
      />
    </Pressable>
  );
}

const filterStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  zoomRow: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 2,
  },
  zoomBtn: {
    flex: 1,
    paddingVertical: Spacing.xs,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  zoomText: {
    fontSize: 12,
    fontWeight: "600",
  },
  laneRow: {
    gap: Spacing.xs,
  },
  laneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  laneText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

const episodeStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
});

export default function TimelineScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month");
  const [eventLane, setEventLane] = useState<EventLane>("all");
  const [episodes, setEpisodes] = useState<Episode[]>(DEMO_EPISODES);
  const [showFilters, setShowFilters] = useState(false);

  const filteredRecords = useMemo(() => {
    let filtered = Array.isArray(records) ? records : [];
    
    if (eventLane !== "all") {
      const laneConfig = EVENT_LANES.find(l => l.key === eventLane);
      if (laneConfig && laneConfig.types.length > 0) {
        filtered = filtered.filter(r => laneConfig.types.includes(r.type));
      }
    }

    if (zoomLevel !== "all") {
      const now = new Date();
      let cutoffDate: Date;
      switch (zoomLevel) {
        case "day":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "month":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "year":
          cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      filtered = filtered.filter(r => new Date(r.date) >= cutoffDate);
    }

    return filtered;
  }, [records, eventLane, zoomLevel]);

  const toggleEpisode = (episodeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEpisodes(prev => prev.map(ep => 
      ep.id === episodeId ? { ...ep, isExpanded: !ep.isExpanded } : ep
    ));
  };

  const loadRecords = useCallback(async () => {
    try {
      const data = await api.records.list();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading records:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHealthSummary = useCallback(async () => {
    try {
      const data = await api.healthSummary.get();
      setHealthSummary(data);
    } catch (error) {
      console.error("Error loading health summary:", error);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadHealthSummary();
  }, [loadRecords, loadHealthSummary]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([loadRecords(), loadHealthSummary()]);
    setIsRefreshing(false);
  }, [loadRecords, loadHealthSummary]);

  const handleRecordPress = useCallback(
    (record: HealthRecord) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("RecordDetail", { record });
    },
    [navigation]
  );

  const groupedRecords = groupRecordsByMonth(filteredRecords);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-timeline.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Health Records Yet
      </ThemedText>
      <ThemedText
        type="body"
        style={[styles.emptyText, { color: theme.textSecondary }]}
      >
        Connect a data source to start{"\n"}building your health timeline
      </ThemedText>
      <Pressable
        onPress={() => navigation.navigate("ProfileTab", { screen: "ConnectHealthRecords" })}
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="plus" size={20} color="#fff" />
        <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
          Connect Source
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderItem = ({ item, index }: { item: HealthRecord; index: number }) => (
    <TimelineCard
      record={item}
      index={index}
      onPress={() => handleRecordPress(item)}
      theme={theme}
      isDark={isDark}
    />
  );

  const data = groupedRecords.flatMap((group, groupIndex) => [
    { type: "header" as const, monthYear: group.monthYear, key: `header-${groupIndex}` },
    ...group.records.map((record, recordIndex) => ({
      type: "record" as const,
      record,
      key: record.id,
      index: recordIndex,
    })),
  ]);

  const handleQuickPacket = useCallback((type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ProfileTab", {
      screen: "PacketExport",
      params: { presetType: type },
    });
  }, [navigation]);

  const handleQuickShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ProfileTab" as never, { screen: "Share" } as never);
  }, [navigation]);

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <View style={[styles.disclaimerBanner, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.1)', borderColor: theme.warning }]}>
        <Feather name="info" size={16} color={theme.warning} />
        <ThemedText style={[styles.disclaimerText, { color: theme.warning }]}>
          Informational only. Not medical advice.
        </ThemedText>
      </View>
      
      {isSummaryLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Loading your health summary...
          </ThemedText>
        </View>
      ) : healthSummary ? (
        <>
          <HealthSummaryCard summary={healthSummary} theme={theme} isDark={isDark} />
          
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <View style={[styles.packetBuilderCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.packetBuilderHeader}>
                <View style={[styles.packetIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather name="file-text" size={20} color={theme.primary} />
                </View>
                <View style={styles.packetBuilderInfo}>
                  <ThemedText type="h4">Visit Packet</ThemedText>
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                    Generate shareable health summary
                  </ThemedText>
                </View>
              </View>
              
              <View style={styles.packetOptions}>
                <Pressable
                  style={[styles.packetOption, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => handleQuickPacket("3months")}
                >
                  <ThemedText style={{ fontWeight: "600", fontSize: 13 }}>Last 3 months</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.packetOption, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => handleQuickPacket("12months")}
                >
                  <ThemedText style={{ fontWeight: "600", fontSize: 13 }}>Last 12 months</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.packetOption, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => handleQuickPacket("custom")}
                >
                  <ThemedText style={{ fontWeight: "600", fontSize: 13 }}>Custom</ThemedText>
                </Pressable>
              </View>

              <View style={styles.quickShareRow}>
                <Pressable
                  style={[styles.quickShareButton, { backgroundColor: theme.primary }]}
                  onPress={handleQuickShare}
                >
                  <Feather name="share-2" size={16} color="#fff" />
                  <ThemedText style={{ color: "#fff", fontWeight: "600", marginLeft: Spacing.xs }}>
                    Share via QR/Link
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Animated.View>
          
          <VisualTimeline
            recentActivity={healthSummary.recentActivity || []}
            upcomingItems={healthSummary.upcomingItems || []}
            theme={theme}
            isDark={isDark}
          />

          {episodes.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <View style={styles.episodesSection}>
                <View style={styles.sectionHeaderRow}>
                  <ThemedText type="h3">Health Episodes</ThemedText>
                  <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>
                    Grouped care journeys
                  </ThemedText>
                </View>
                {episodes.map(episode => (
                  <EpisodeCard
                    key={episode.id}
                    episode={episode}
                    onToggle={() => toggleEpisode(episode.id)}
                    recordCount={episode.recordIds.length}
                    theme={theme}
                  />
                ))}
              </View>
            </Animated.View>
          ) : null}

          {Array.isArray(records) && records.length > 0 ? (
            <>
              <View style={styles.recordsHeaderRow}>
                <ThemedText type="h3">All Records</ThemedText>
                <Pressable
                  style={[styles.filterToggle, { backgroundColor: showFilters ? `${theme.primary}20` : theme.backgroundSecondary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowFilters(!showFilters);
                  }}
                >
                  <Feather name="filter" size={14} color={showFilters ? theme.primary : theme.textSecondary} />
                  <ThemedText style={{ fontSize: 12, color: showFilters ? theme.primary : theme.textSecondary }}>
                    Filter
                  </ThemedText>
                </Pressable>
              </View>
              {showFilters ? (
                <TimelineFilters
                  zoomLevel={zoomLevel}
                  setZoomLevel={setZoomLevel}
                  eventLane={eventLane}
                  setEventLane={setEventLane}
                  theme={theme}
                />
              ) : null}
              {filteredRecords.length !== (Array.isArray(records) ? records.length : 0) ? (
                <View style={[styles.filterResultBanner, { backgroundColor: `${theme.primary}10` }]}>
                  <Feather name="filter" size={14} color={theme.primary} />
                  <ThemedText style={{ fontSize: 12, color: theme.primary }}>
                    Showing {filteredRecords.length} of {records.length} records
                  </ThemedText>
                  <Pressable onPress={() => {
                    setZoomLevel("all");
                    setEventLane("all");
                  }}>
                    <ThemedText style={{ fontSize: 12, color: theme.primary, fontWeight: "600" }}>Clear</ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const handleOpenAssistant = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AIAssistant" as never);
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={Array.isArray(records) && records.length > 0 ? data : []}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => {
          if (item.type === "header") {
            return (
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: theme.backgroundRoot },
                ]}
              >
                <View style={styles.monthHeaderRow}>
                  <View style={[styles.monthHeaderLine, { backgroundColor: theme.border }]} />
                  <ThemedText type="caption" style={[styles.monthHeaderText, { color: theme.textSecondary, backgroundColor: theme.backgroundRoot }]}>
                    {item.monthYear.toUpperCase()}
                  </ThemedText>
                  <View style={[styles.monthHeaderLine, { backgroundColor: theme.border }]} />
                </View>
              </View>
            );
          }
          return renderItem({ item: item.record, index: item.index });
        }}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          (!Array.isArray(records) || records.length === 0) && !healthSummary && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={!isLoading && !healthSummary ? renderEmpty : null}
        showsVerticalScrollIndicator={false}
      />
      
      <AnimatedPressable
        entering={FadeIn.delay(500).springify()}
        style={[
          styles.fab,
          {
            bottom: tabBarHeight + Spacing.xl,
            backgroundColor: theme.primary,
          },
        ]}
        onPress={handleOpenAssistant}
        accessibilityLabel="Open AI Health Assistant"
        accessibilityRole="button"
        testID="fab-ai-assistant"
      >
        <LinearGradient
          colors={Gradients.primary as [string, string]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Feather name="message-circle" size={24} color="#FFFFFF" />
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  listHeader: {
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  summaryCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  summaryGreeting: {
    flex: 1,
    marginRight: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  aiSummaryContainer: {
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: BorderRadius.md,
  },
  aiSummaryIcon: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  aiIconGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiSummaryText: {
    lineHeight: 22,
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  insightCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  timelineSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  visualTimeline: {
    gap: Spacing.sm,
  },
  timelineItem: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  timelineItemContent: {
    flexDirection: "row",
    padding: Spacing.md,
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: Spacing.md,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
  },
  timelineDotGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    minHeight: 20,
  },
  timelineRight: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  timelineItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  upcomingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recordsTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  monthHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  monthHeaderLine: {
    flex: 1,
    height: 1,
  },
  monthHeaderText: {
    fontWeight: "600",
    letterSpacing: 1,
    paddingHorizontal: Spacing.sm,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  card: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentGradient: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    gap: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
  },
  dateChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  cardSummary: {
    marginTop: 4,
    lineHeight: 20,
  },
  cardChevron: {
    marginLeft: Spacing.xs,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyImage: {
    width: 180,
    height: 180,
    marginBottom: Spacing.xl,
    opacity: 0.9,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xl,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  disclaimerBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  disclaimerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  packetBuilderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  packetBuilderHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  packetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  packetBuilderInfo: {
    flex: 1,
  },
  packetOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  packetOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  quickShareRow: {
    marginTop: Spacing.xs,
  },
  quickShareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  episodesSection: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  recordsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterResultBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
});
