import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTimeline } from "@/hooks/queries";
import { findEventById } from "@/api/records";
import { Card, EmptyView, ErrorView, LoadingView, NoCdsFooter, Pill, Screen } from "@/components/ui";
import { eventMeta, formatDate } from "@/lib/events";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Detail reads from the same timeline cache the list populated. If the user
  // deep-linked straight here, the query fetches it fresh.
  const { data, isLoading, isError, error, refetch } = useTimeline({ limit: 100 });
  const event = findEventById(data?.events, String(id));

  if (isLoading) {
    return (
      <Screen>
        <LoadingView label="Loading record…" />
      </Screen>
    );
  }
  if (isError) {
    return (
      <Screen>
        <ErrorView message={(error as Error)?.message} onRetry={refetch} />
      </Screen>
    );
  }
  if (!event) {
    return (
      <Screen>
        <EmptyView
          icon="help-circle-outline"
          title="Record not found"
          message="This record may have been removed or is not yet synced to your account."
        />
      </Screen>
    );
  }

  const meta = eventMeta(event.type);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: meta.label }} />

      <View style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: `${meta.color}1A` }]}>
          <Ionicons name={meta.icon} size={28} color={meta.color} />
        </View>
        <Pill label={meta.label} color={meta.color} />
        <Text style={[typography.h1, { marginTop: spacing.md }]}>{event.title}</Text>
        <Text style={typography.bodyMuted}>{formatDate(event.date)}</Text>
      </View>

      <Card>
        <Field label="Description" value={event.description} />
        {event.provider ? <Field label="Provider / source" value={event.provider} /> : null}
        <Field label="Date" value={formatDate(event.date)} />
        <Field label="Record ID" value={event.id} mono />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={typography.label}>What this means</Text>
        <Text style={[typography.body, { marginTop: spacing.xs }]}>
          This entry is part of your consolidated health timeline. Tabula Medica
          brings records together from every source you connect so nothing gets
          lost between providers.
        </Text>
      </Card>

      <NoCdsFooter />
    </Screen>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={typography.label}>{label}</Text>
      <Text style={[typography.body, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "flex-start", marginBottom: spacing.lg, gap: spacing.sm },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  field: {
    gap: 2,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  mono: { fontFamily: "Courier", color: colors.textMuted, fontSize: 13 },
});
