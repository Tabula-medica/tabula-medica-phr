import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTimeline } from "@/hooks/queries";
import { Card, EmptyView, ErrorView, LoadingView, NoCdsFooter } from "@/components/ui";
import { eventMeta, formatDate } from "@/lib/events";
import type { TimelineEventType } from "@/api/types";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const FILTERS: { key: TimelineEventType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "encounter", label: "Visits" },
  { key: "medication", label: "Medications" },
  { key: "condition", label: "Conditions" },
  { key: "observation", label: "Labs" },
  { key: "procedure", label: "Procedures" },
  { key: "immunization", label: "Immunizations" },
];

export default function RecordsListScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useTimeline({
    limit: 100,
  });
  const [filter, setFilter] = useState<TimelineEventType | "all">("all");

  const events = useMemo(() => {
    const all = data?.events ?? [];
    const filtered = filter === "all" ? all : all.filter((e) => e.type === filter);
    return [...filtered].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [data, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <LoadingView label="Loading records…" />
      ) : isError ? (
        <ErrorView message={(error as Error)?.message} onRetry={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {events.length === 0 ? (
            <EmptyView
              icon="folder-open-outline"
              title={filter === "all" ? "No records yet" : "Nothing in this category"}
              message={
                filter === "all"
                  ? "Connect a provider or upload documents to populate your record."
                  : "Try a different filter to see more of your history."
              }
            />
          ) : (
            events.map((event) => {
              const meta = eventMeta(event.type);
              return (
                <Card
                  key={event.id}
                  style={styles.row}
                  onPress={() => router.push(`/(app)/records/${event.id}`)}
                >
                  <View style={[styles.icon, { backgroundColor: `${meta.color}1A` }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={styles.body}>
                    <Text style={typography.h3} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={typography.bodyMuted} numberOfLines={1}>
                      {event.description}
                    </Text>
                    <Text style={typography.caption}>
                      {formatDate(event.date)}
                      {event.provider ? ` · ${event.provider}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
                </Card>
              );
            })
          )}
          <NoCdsFooter />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.textInverse },
  list: { padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.md, paddingBottom: spacing.xxl },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
});
