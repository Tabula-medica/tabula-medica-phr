import React from "react";
import { Alert, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useCancelAccountDeletion,
  useDataRightsRequests,
  usePrivacyPreferences,
  useRequestAccountDeletion,
  useRequestDataExport,
  useUpdateProcessingPrefs,
} from "@/hooks/queries";
import type { ProcessingPrefKey } from "@/api/gdpr";
import {
  Button,
  Card,
  ErrorView,
  LoadingView,
  Pill,
  Screen,
} from "@/components/ui";
import { formatDate } from "@/lib/events";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const TOGGLES: { key: ProcessingPrefKey; label: string; subtitle: string }[] = [
  {
    key: "aiProcessingOptOut",
    label: "Opt out of AI processing",
    subtitle: "Don't use my data to power AI summaries or insights",
  },
  {
    key: "doNotSell",
    label: "Do not sell my information",
    subtitle: "CCPA — Tabula Medica never sells PHI regardless",
  },
  {
    key: "marketingEmailsOptOut",
    label: "Opt out of marketing emails",
    subtitle: "Only receive essential account & security messages",
  },
  {
    key: "analyticsOptOut",
    label: "Opt out of product analytics",
    subtitle: "Don't include my usage in aggregate analytics",
  },
  {
    key: "limitSensitivePi",
    label: "Limit use of sensitive info",
    subtitle: "Restrict processing of sensitive personal information",
  },
  {
    key: "optOutAutomatedDecisions",
    label: "Opt out of automated decisions",
    subtitle: "No solely-automated decisions about my care",
  },
];

export default function PrivacyScreen() {
  const prefs = usePrivacyPreferences();
  const requests = useDataRightsRequests();
  const updatePrefs = useUpdateProcessingPrefs();
  const exportData = useRequestDataExport();
  const requestDeletion = useRequestAccountDeletion();
  const cancelDeletion = useCancelAccountDeletion();

  const pendingErasure = (requests.data ?? []).find(
    (r) => r.type === "erasure" && r.status === "pending"
  );

  const refetchAll = () => {
    prefs.refetch();
    requests.refetch();
  };

  const onExport = async () => {
    try {
      const res = await exportData.mutateAsync();
      Alert.alert("Data export requested", res.message);
    } catch (err) {
      Alert.alert("Couldn't request export", (err as Error)?.message ?? "Please try again.");
    }
  };

  const onDelete = () =>
    Alert.alert(
      "Delete account?",
      "Your account and health records will be permanently deleted after a 30-day grace period. You can cancel any time before then.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Schedule deletion",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await requestDeletion.mutateAsync();
              Alert.alert("Deletion scheduled", res.message);
            } catch (err) {
              Alert.alert("Couldn't schedule deletion", (err as Error)?.message ?? "Please try again.");
            }
          },
        },
      ]
    );

  const onCancelDeletion = async () => {
    if (!pendingErasure) return;
    try {
      await cancelDeletion.mutateAsync(pendingErasure.id);
      Alert.alert("Deletion cancelled", "Your account will not be deleted.");
    } catch (err) {
      Alert.alert("Couldn't cancel", (err as Error)?.message ?? "Please try again.");
    }
  };

  if (prefs.isLoading) {
    return (
      <Screen>
        <LoadingView label="Loading privacy settings…" />
      </Screen>
    );
  }
  if (prefs.isError) {
    return (
      <Screen>
        <ErrorView message={(prefs.error as Error)?.message} onRetry={refetchAll} />
      </Screen>
    );
  }

  const p = prefs.data;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={prefs.isRefetching || requests.isRefetching}
          onRefresh={refetchAll}
        />
      }
    >
      <Text style={typography.bodyMuted}>
        These rights are guaranteed to every patient under GDPR and CCPA and are
        never gated behind a paid plan.
      </Text>

      <Text style={styles.sectionTitle}>YOUR DATA</Text>
      <Card style={{ gap: spacing.md }}>
        <Text style={typography.body}>
          Get a complete copy of everything Tabula Medica holds about you. We email
          a secure download link within 30 days (usually much sooner).
        </Text>
        <Button
          title="Request a copy of my data"
          icon="download-outline"
          variant="secondary"
          onPress={onExport}
          loading={exportData.isPending}
        />
      </Card>

      <Text style={styles.sectionTitle}>PROCESSING PREFERENCES</Text>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {TOGGLES.map((t, i) => (
          <View
            key={t.key}
            style={[styles.toggleRow, i < TOGGLES.length - 1 && styles.divider]}
          >
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{t.label}</Text>
              <Text style={typography.caption}>{t.subtitle}</Text>
            </View>
            <Switch
              value={Boolean(p?.[t.key])}
              disabled={updatePrefs.isPending}
              onValueChange={(v) => updatePrefs.mutate({ [t.key]: v })}
              trackColor={{ true: colors.accent }}
            />
          </View>
        ))}
      </Card>

      <Text style={styles.sectionTitle}>REQUEST HISTORY</Text>
      <Card style={{ gap: spacing.sm }}>
        {requests.isLoading ? (
          <LoadingView label="Loading history…" />
        ) : (requests.data ?? []).length === 0 ? (
          <Text style={typography.bodyMuted}>No data-rights requests in the last 12 months.</Text>
        ) : (
          (requests.data ?? []).map((r) => (
            <View key={r.id} style={styles.requestRow}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{labelForType(r.type)}</Text>
                <Text style={typography.caption}>{formatDate(r.requestedAt)}</Text>
              </View>
              <Pill label={r.status.replace("_", " ")} color={statusColor(r.status)} />
            </View>
          ))
        )}
      </Card>

      <Text style={styles.sectionTitle}>DANGER ZONE</Text>
      <Card style={styles.danger}>
        {pendingErasure ? (
          <>
            <View style={styles.dangerHead}>
              <Ionicons name="time-outline" size={20} color={colors.danger} />
              <Text style={[typography.h3, { color: colors.dangerDark }]}>
                Deletion scheduled
              </Text>
            </View>
            <Text style={[typography.body, { marginTop: spacing.xs }]}>
              {pendingErasure.scheduledFor
                ? `Your account is scheduled for permanent deletion on ${formatDate(
                    pendingErasure.scheduledFor
                  )}.`
                : "Your account is scheduled for deletion."}{" "}
              Cancel below to keep it.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="Cancel deletion"
                icon="arrow-undo-outline"
                onPress={onCancelDeletion}
                loading={cancelDeletion.isPending}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.dangerHead}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[typography.h3, { color: colors.dangerDark }]}>Delete account</Text>
            </View>
            <Text style={[typography.body, { marginTop: spacing.xs }]}>
              Permanently delete your account and all health records after a 30-day
              grace period.
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <Button
                title="Delete my account"
                variant="danger"
                icon="trash-outline"
                onPress={onDelete}
                loading={requestDeletion.isPending}
              />
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

function labelForType(type: string): string {
  const map: Record<string, string> = {
    access: "Data access request",
    portability: "Data portability (FHIR export)",
    erasure: "Account deletion",
    rectification: "Correction request",
    do_not_sell: "Do not sell my info",
    limit_sensitive: "Limit sensitive info",
    opt_out_automated_decisions: "Opt out of automated decisions",
  };
  return map[type] ?? type;
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return colors.success;
    case "in_progress":
    case "pending":
      return colors.warning;
    case "cancelled":
      return colors.textMuted;
    default:
      return colors.textMuted;
  }
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    letterSpacing: 1,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  danger: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  dangerHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
