import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export interface ConnectionHealth {
  sourceType: string;
  syncStatus: string;
  needsReauth: boolean;
  lastSyncedAt?: string | null;
}

interface ConnectionHealthNoticesProps {
  health: ConnectionHealth[];
  onReconnect: (sourceType: string) => void;
  reconnectingSource?: string | null;
  canReconnect?: boolean;
}

function displaySourceName(sourceType: string): string {
  const normalized = sourceType.trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized === "ehr") return "EHR";
  if (normalized === "insurance" || normalized === "insurer") return "Insurer";

  return sourceType
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizedStatus(syncStatus: string): string {
  return syncStatus.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isErrorStatus(syncStatus: string): boolean {
  const status = normalizedStatus(syncStatus);
  return status === "error" || status === "failed" || status === "failure" || status.includes("error");
}

function formatLastSynced(value?: string | null): string | null {
  if (!value) return null;

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return null;

  return `Last synced ${timestamp.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

export function ConnectionHealthNotices({
  health,
  onReconnect,
  reconnectingSource = null,
  canReconnect = true,
}: ConnectionHealthNoticesProps) {
  const { theme } = useTheme();
  const unhealthyConnections = health.filter((connection) => {
    return connection.needsReauth || normalizedStatus(connection.syncStatus) !== "active";
  });

  if (unhealthyConnections.length === 0) return null;

  return (
    <View style={styles.list} accessibilityLabel="Connection health notices">
      {unhealthyConnections.map((connection) => {
        const sourceName = displaySourceName(connection.sourceType);
        const needsReauth =
          connection.needsReauth || normalizedStatus(connection.syncStatus) === "needs_reauth";
        const temporaryError = !needsReauth && isErrorStatus(connection.syncStatus);
        const isPending = reconnectingSource === connection.sourceType;
        const lastSynced = formatLastSynced(connection.lastSyncedAt);

        return (
          <View
            key={connection.sourceType}
            style={[
              styles.notice,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: temporaryError ? `${theme.info}55` : `${theme.warning}55`,
              },
            ]}
            accessibilityRole="summary"
          >
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: temporaryError
                    ? `${theme.info}18`
                    : `${theme.warning}18`,
                },
              ]}
            >
              <Feather
                name={temporaryError ? "clock" : "alert-circle"}
                size={19}
                color={temporaryError ? theme.info : theme.warning}
              />
            </View>

            <View style={styles.content}>
              <ThemedText
                type="small"
                style={[
                  styles.title,
                  { color: theme.text },
                ]}
              >
                {temporaryError ? "Sync temporarily unavailable" : "Reconnect needed"}
              </ThemedText>
              <ThemedText type="body" style={styles.sourceName}>
                {sourceName}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {temporaryError
                  ? "You do not need to reconnect. Please check again later."
                  : `Reconnect your ${sourceName} account to resume syncing your health information.`}
              </ThemedText>
              {lastSynced ? (
                <ThemedText
                  type="caption"
                  style={[styles.lastSynced, { color: theme.textSecondary }]}
                >
                  {lastSynced}
                </ThemedText>
              ) : null}

              {!temporaryError ? (
                canReconnect ? (
                  <Pressable
                    onPress={() => onReconnect(connection.sourceType)}
                    disabled={!!reconnectingSource}
                    accessibilityRole="button"
                    accessibilityLabel={`Reconnect ${sourceName}`}
                    accessibilityState={{ disabled: !!reconnectingSource, busy: isPending }}
                    testID={`reconnect-${connection.sourceType}`}
                    style={({ pressed }) => [
                      styles.reconnectButton,
                      {
                        backgroundColor: theme.primary,
                        opacity: isPending ? 0.72 : pressed ? 0.82 : 1,
                      },
                    ]}
                  >
                    {isPending ? (
                      <ActivityIndicator size="small" color={theme.buttonText} />
                    ) : (
                      <Feather name="refresh-cw" size={15} color={theme.buttonText} />
                    )}
                    <ThemedText
                      type="small"
                      style={[styles.buttonText, { color: theme.buttonText }]}
                    >
                      {isPending ? "Reconnecting…" : "Reconnect"}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText
                    type="small"
                    style={[styles.unavailable, { color: theme.textSecondary }]}
                    accessibilityRole="text"
                  >
                    Reconnecting is currently unavailable.
                  </ThemedText>
                )
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  content: {
    flex: 1,
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  title: {
    fontWeight: "600",
  },
  sourceName: {
    fontWeight: "600",
  },
  lastSynced: {
    marginTop: Spacing.xs,
  },
  reconnectButton: {
    minHeight: Spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  buttonText: {
    fontWeight: "600",
  },
  unavailable: {
    marginTop: Spacing.sm,
  },
});

export default ConnectionHealthNotices;
