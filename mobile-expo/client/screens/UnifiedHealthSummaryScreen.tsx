import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Share,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TimelineEvent {
  id: string;
  date: string;
  category: string;
  title: string;
  detail: string;
  source: string;
  priority?: string;
  metadata?: Record<string, any>;
}

interface TimePeriod {
  period: string;
  label: string;
  events: TimelineEvent[];
}

interface SummaryData {
  snapshot: {
    totalEvents: number;
    categories: Record<string, number>;
    dateRange: { earliest: string; latest: string } | null;
    profileName?: string;
    dateOfBirth?: string;
    bloodType?: string;
  };
  periods: TimePeriod[];
  totalEvents: number;
  generatedAt: string;
}

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  condition: { icon: "heart", color: "#ef4444", label: "Condition" },
  medication: { icon: "thermometer", color: "#8b5cf6", label: "Medication" },
  lab: { icon: "activity", color: "#10b981", label: "Lab Result" },
  labs: { icon: "activity", color: "#10b981", label: "Lab Result" },
  vital: { icon: "trending-up", color: "#0ea5e9", label: "Vital Sign" },
  procedure: { icon: "scissors", color: "#f97316", label: "Procedure" },
  allergy: { icon: "alert-triangle", color: "#ef4444", label: "Allergy" },
  immunization: { icon: "shield", color: "#6366f1", label: "Immunization" },
  appointment: { icon: "calendar", color: "#0066cc", label: "Appointment" },
  visit: { icon: "user", color: "#0066cc", label: "Visit" },
  imaging: { icon: "image", color: "#f97316", label: "Imaging" },
  family_history: { icon: "users", color: "#a855f7", label: "Family History" },
  other: { icon: "file-text", color: "#6b7280", label: "Record" },
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
}

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "condition", label: "Conditions" },
  { key: "medication", label: "Medications" },
  { key: "lab", label: "Labs" },
  { key: "vital", label: "Vitals" },
  { key: "procedure", label: "Procedures" },
  { key: "allergy", label: "Allergies" },
  { key: "appointment", label: "Appointments" },
  { key: "family_history", label: "Family History" },
];

export default function UnifiedHealthSummaryScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<SummaryData>({
    queryKey: ["/api/unified-chronological-summary"],
    staleTime: 60000,
  });

  const filteredPeriods = useMemo(() => {
    if (!data?.periods) return [];
    const query = searchQuery.toLowerCase().trim();

    return data.periods
      .map((period) => {
        let filtered = period.events;
        if (activeFilter !== "all") {
          filtered = filtered.filter((e) =>
            activeFilter === "lab" ? (e.category === "lab" || e.category === "labs") : e.category === activeFilter
          );
        }
        if (query) {
          filtered = filtered.filter(
            (e) => e.title.toLowerCase().includes(query) || e.detail.toLowerCase().includes(query)
          );
        }
        return { ...period, events: filtered };
      })
      .filter((p) => p.events.length > 0);
  }, [data, activeFilter, searchQuery]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, []);

  const handleShare = useCallback(async () => {
    if (!data) return;
    let text = "COMPLETE HEALTH TIMELINE\n";
    if (data.snapshot.profileName) text += `Patient: ${data.snapshot.profileName}\n`;
    text += `Generated: ${new Date(data.generatedAt).toLocaleDateString()}\n`;
    text += `Total Events: ${data.totalEvents}\n\n`;

    for (const period of data.periods) {
      text += `--- ${period.label} ---\n`;
      for (const ev of period.events) {
        const cfg = getCategoryConfig(ev.category);
        text += `  [${cfg.label}] ${ev.title}`;
        if (ev.detail) text += ` — ${ev.detail}`;
        text += ` (${new Date(ev.date).toLocaleDateString()})\n`;
      }
      text += "\n";
    }

    text += "For personal reference only. This is NOT medical advice.";
    try {
      await Share.share({ message: text, title: "Health Timeline" });
    } catch {}
  }, [data]);

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const renderSectionHeader = ({ section }: { section: { label: string; data: TimelineEvent[] } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: isDark ? "#111827" : "#f8f9fa" }]}>
      <ThemedText style={[styles.sectionLabel, { color: theme.text }]}>{section.label}</ThemedText>
      <View style={[styles.sectionBadge, { backgroundColor: `${theme.primary}12` }]}>
        <ThemedText style={[styles.sectionCount, { color: theme.primary }]}>{section.data.length}</ThemedText>
      </View>
    </View>
  );

  const renderEvent = ({ item, index }: { item: TimelineEvent; index: number }) => {
    const cfg = getCategoryConfig(item.category);
    const isExpanded = expandedEvents.has(item.id);
    const eventDate = new Date(item.date);
    const dayStr = eventDate.toLocaleDateString("en-US", { day: "numeric", month: "short" });

    return (
      <Pressable
        testID={`timeline-event-${item.id}`}
        onPress={() => toggleExpand(item.id)}
        style={[styles.eventRow, { borderColor: cardBorder }]}
      >
        <View style={styles.dateColumn}>
          <ThemedText style={[styles.dateDay, { color: theme.textSecondary }]}>{dayStr}</ThemedText>
        </View>
        <View style={styles.lineColumn}>
          <View style={[styles.lineTop, { backgroundColor: index === 0 ? "transparent" : cardBorder }]} />
          <View style={[styles.dot, { backgroundColor: cfg.color, borderColor: isDark ? "#1f2937" : "#fff" }]} />
          <View style={[styles.lineBottom, { backgroundColor: cardBorder }]} />
        </View>
        <View style={[styles.eventCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.eventHeader}>
            <View style={[styles.categoryIcon, { backgroundColor: `${cfg.color}12` }]}>
              <Feather name={cfg.icon} size={14} color={cfg.color} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={[styles.eventTitle, { color: theme.text }]} numberOfLines={isExpanded ? undefined : 1}>
                {item.title}
              </ThemedText>
              <ThemedText style={[styles.categoryLabel, { color: cfg.color }]}>{cfg.label}</ThemedText>
            </View>
            {item.priority === "high" || item.priority === "critical" ? (
              <View style={[styles.priorityBadge, { backgroundColor: "#ef444415" }]}>
                <Feather name="alert-circle" size={10} color="#ef4444" />
              </View>
            ) : null}
            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textSecondary} />
          </View>
          {item.detail && !isExpanded ? (
            <ThemedText style={[styles.eventDetail, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.detail}
            </ThemedText>
          ) : null}
          {isExpanded ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.expandedContent}>
              {item.detail ? (
                <ThemedText style={[styles.eventDetailFull, { color: theme.text }]}>{item.detail}</ThemedText>
              ) : null}
              <View style={styles.metaGrid}>
                {item.source ? (
                  <View style={styles.metaItem}>
                    <Feather name="database" size={11} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                      {item.source === "intake" ? "From intake" : item.source === "appointment" ? "Appointment" : item.source}
                    </ThemedText>
                  </View>
                ) : null}
                {item.metadata?.provider ? (
                  <View style={styles.metaItem}>
                    <Feather name="user" size={11} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{item.metadata.provider}</ThemedText>
                  </View>
                ) : null}
                {item.metadata?.facility ? (
                  <View style={styles.metaItem}>
                    <Feather name="home" size={11} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{item.metadata.facility}</ThemedText>
                  </View>
                ) : null}
                {item.metadata?.status ? (
                  <View style={styles.metaItem}>
                    <Feather name="info" size={11} color={theme.textSecondary} />
                    <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{item.metadata.status}</ThemedText>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const sections = filteredPeriods.map((p) => ({
    label: p.label,
    period: p.period,
    data: p.events,
  }));

  const ListHeaderComponent = () => (
    <View style={{ paddingTop: Spacing.md }}>
      {data?.snapshot ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={[styles.snapshotCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.snapshotRow}>
              <View style={[styles.snapshotIcon, { backgroundColor: `${theme.primary}12` }]}>
                <Feather name="layers" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {data.snapshot.profileName ? (
                  <ThemedText style={[styles.snapshotName, { color: theme.text }]}>{data.snapshot.profileName}</ThemedText>
                ) : null}
                <ThemedText style={[styles.snapshotStats, { color: theme.textSecondary }]}>
                  {data.totalEvents} events
                  {data.snapshot.dateRange
                    ? ` from ${new Date(data.snapshot.dateRange.earliest).toLocaleDateString()} to ${new Date(data.snapshot.dateRange.latest).toLocaleDateString()}`
                    : ""}
                </ThemedText>
              </View>
              <Pressable testID="button-share-timeline" onPress={handleShare} hitSlop={12} accessibilityRole="button" accessibilityLabel="Share health timeline">
                <Feather name="share" size={18} color={theme.primary} />
              </Pressable>
            </View>

            <View style={styles.categoryChips}>
              {Object.entries(data.snapshot.categories)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([cat, count]) => {
                  const cfg = getCategoryConfig(cat);
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setActiveFilter(activeFilter === cat ? "all" : cat)}
                      style={[styles.categoryChip, {
                        backgroundColor: activeFilter === cat ? `${cfg.color}20` : cardBg,
                        borderColor: activeFilter === cat ? cfg.color : cardBorder,
                      }]}
                    >
                      <Feather name={cfg.icon} size={11} color={cfg.color} />
                      <ThemedText style={[styles.chipText, { color: activeFilter === cat ? cfg.color : theme.textSecondary }]}>
                        {cfg.label} ({count})
                      </ThemedText>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        </Animated.View>
      ) : null}

      <View style={[styles.searchBar, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <Feather name="search" size={16} color={theme.textSecondary} />
        <TextInput
          testID="input-timeline-search"
          style={[styles.searchInput, { color: theme.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search your timeline..."
          placeholderTextColor={`${theme.textSecondary}80`}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            testID={`filter-${opt.key}`}
            onPress={() => {
              setActiveFilter(opt.key);
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            }}
            style={[styles.filterChip, {
              backgroundColor: activeFilter === opt.key ? theme.primary : cardBg,
              borderColor: activeFilter === opt.key ? theme.primary : cardBorder,
            }]}
          >
            <ThemedText style={[styles.filterChipText, {
              color: activeFilter === opt.key ? "#fff" : theme.textSecondary,
            }]}>
              {opt.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.xl, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading your health timeline...</ThemedText>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.xl, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={40} color={theme.error} />
        <ThemedText style={[styles.errorTitle, { color: theme.text }]}>Unable to Load Timeline</ThemedText>
        <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={() => refetch()}>
          <ThemedText style={styles.retryText}>Try Again</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={40} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {searchQuery || activeFilter !== "all" ? "No matching events found" : "No health events recorded yet"}
            </ThemedText>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.md },
  loadingText: { fontSize: 15, marginTop: Spacing.md },
  errorTitle: { fontSize: 18, fontWeight: "600", marginTop: Spacing.md, marginBottom: Spacing.sm },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  retryText: { color: "#fff", fontWeight: "600" },
  snapshotCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  snapshotRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  snapshotIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  snapshotName: { fontSize: 17, fontWeight: "700" },
  snapshotStats: { fontSize: 13, marginTop: 1 },
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: "500" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm, paddingVertical: Spacing.xs },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.sm, paddingHorizontal: 4 },
  sectionLabel: { fontSize: 16, fontWeight: "700" },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  sectionCount: { fontSize: 12, fontWeight: "600" },
  eventRow: { flexDirection: "row", minHeight: 60 },
  dateColumn: { width: 48, paddingTop: Spacing.sm, alignItems: "center" },
  dateDay: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  lineColumn: { width: 20, alignItems: "center" },
  lineTop: { width: 2, flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  lineBottom: { width: 2, flex: 1 },
  eventCard: { flex: 1, borderRadius: BorderRadius.sm, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.xs, marginLeft: Spacing.xs },
  eventHeader: { flexDirection: "row", alignItems: "center" },
  categoryIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  eventTitle: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  categoryLabel: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  priorityBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", marginRight: 4 },
  eventDetail: { fontSize: 13, marginTop: 2, marginLeft: 40 },
  expandedContent: { marginTop: Spacing.xs, marginLeft: 40 },
  eventDetailFull: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.xs },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11 },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyText: { fontSize: 15, marginTop: Spacing.sm },
});
