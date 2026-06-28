import React from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { useDashboard, useRecordsSummary, useTimeline } from "@/hooks/queries";
import {
  Card,
  EmptyView,
  ErrorView,
  LoadingView,
  NoCdsFooter,
  Pill,
  Screen,
} from "@/components/ui";
import { eventMeta, relativeDate } from "@/lib/events";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const dashboard = useDashboard();
  const summary = useRecordsSummary();
  const timeline = useTimeline({ limit: 5 });

  const refreshing =
    dashboard.isRefetching || summary.isRefetching || timeline.isRefetching;
  const refetchAll = () => {
    dashboard.refetch();
    summary.refetch();
    timeline.refetch();
  };

  if (dashboard.isLoading && summary.isLoading) {
    return (
      <Screen>
        <LoadingView label="Loading your health summary…" />
      </Screen>
    );
  }

  if (dashboard.isError && summary.isError) {
    return (
      <Screen>
        <ErrorView message={(dashboard.error as Error)?.message} onRetry={refetchAll} />
      </Screen>
    );
  }

  const s = summary.data;
  const d = dashboard.data;
  const events = timeline.data?.events ?? [];

  return (
    <Screen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} />}
    >
      <Text style={styles.greeting}>
        {greeting()}
        {user?.name ? `, ${user.name.split(" ")[0]}` : ""}
      </Text>
      <Text style={typography.bodyMuted}>Here's your health at a glance.</Text>

      <View style={styles.statRow}>
        <Stat
          icon="medical-outline"
          label="Active meds"
          value={s?.medications.active ?? d?.activeMedications}
          color={colors.eventMedication}
        />
        <Stat
          icon="pulse-outline"
          label="Conditions"
          value={s?.conditions.active ?? d?.recentConditions}
          color={colors.eventCondition}
        />
      </View>
      <View style={styles.statRow}>
        <Stat
          icon="flask-outline"
          label="Recent labs"
          value={s?.labResults.recent ?? d?.recentLabs}
          color={colors.eventObservation}
        />
        <Stat
          icon="calendar-outline"
          label="Upcoming visits"
          value={s?.appointments.upcoming ?? d?.upcomingAppointments}
          color={colors.eventEncounter}
        />
      </View>

      {s?.labResults.abnormal ? (
        <Card style={styles.alert}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
          <Text style={styles.alertText}>
            {s.labResults.abnormal} recent lab result
            {s.labResults.abnormal === 1 ? "" : "s"} flagged outside the typical range.
            Review them with your care team.
          </Text>
        </Card>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={typography.h3}>Recent activity</Text>
        <Text style={styles.seeAll} onPress={() => router.push("/(app)/records")}>
          See all
        </Text>
      </View>

      {timeline.isLoading ? (
        <Card>
          <LoadingView label="Loading timeline…" />
        </Card>
      ) : timeline.isError ? (
        <Card>
          <ErrorView message={(timeline.error as Error)?.message} onRetry={timeline.refetch} />
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <EmptyView
            icon="time-outline"
            title="No recent activity"
            message="Connect a provider or upload records to start building your timeline."
          />
        </Card>
      ) : (
        events.map((event) => {
          const meta = eventMeta(event.type);
          return (
            <Card
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/(app)/records/${event.id}`)}
            >
              <View style={[styles.eventIcon, { backgroundColor: `${meta.color}1A` }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={styles.eventBody}>
                <Text style={typography.h3} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={typography.caption}>
                  {relativeDate(event.date)}
                  {event.provider ? ` · ${event.provider}` : ""}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </Card>
          );
        })
      )}

      <NoCdsFooter />
    </Screen>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  label: string;
  value: number | undefined;
  color: string;
}) {
  return (
    <Card style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value ?? "—"}</Text>
      <Text style={typography.caption}>{label}</Text>
    </Card>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  greeting: { ...typography.h1, marginTop: spacing.sm },
  statRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, alignItems: "flex-start", gap: spacing.xs, paddingVertical: spacing.md },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statValue: { fontSize: 26, fontWeight: "700", color: colors.text },
  alert: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    alignItems: "flex-start",
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  alertText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  seeAll: { color: colors.accent, fontWeight: "600" },
  eventCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  eventBody: { flex: 1, gap: 2 },
});
