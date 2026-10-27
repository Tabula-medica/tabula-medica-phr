import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Paths, File as ExpoFile } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; colorKey: keyof typeof Colors.light; label: string }> = {
  login: { icon: "log-in", colorKey: "success", label: "Login" },
  logout: { icon: "log-out", colorKey: "textSecondary", label: "Logout" },
  view_record: { icon: "eye", colorKey: "primary", label: "View Record" },
  create_record: { icon: "plus-circle", colorKey: "success", label: "Create Record" },
  update_record: { icon: "edit", colorKey: "warning", label: "Update Record" },
  delete_record: { icon: "trash-2", colorKey: "error", label: "Delete Record" },
  share_record: { icon: "share-2", colorKey: "primary", label: "Share Record" },
  create_share_link: { icon: "link", colorKey: "primary", label: "Create Share Link" },
  view_share_link: { icon: "external-link", colorKey: "info", label: "View Share Link" },
  revoke_share_link: { icon: "x-circle", colorKey: "error", label: "Revoke Share Link" },
  export_data: { icon: "download", colorKey: "primary", label: "Export Data" },
  sync_source: { icon: "refresh-cw", colorKey: "success", label: "Sync Source" },
  view_phi: { icon: "file-text", colorKey: "warning", label: "View PHI" },
  update_phi: { icon: "edit-2", colorKey: "warning", label: "Update PHI" },
  revoke_session: { icon: "shield-off", colorKey: "error", label: "Revoke Session" },
  revoke_all_sessions: { icon: "shield-off", colorKey: "error", label: "Revoke All Sessions" },
  view_devices: { icon: "smartphone", colorKey: "textSecondary", label: "View Devices" },
};

const FILTER_OPTIONS = [
  { key: "all", label: "All Events" },
  { key: "security", label: "Security" },
  { key: "phi", label: "PHI Access" },
  { key: "sharing", label: "Sharing" },
];

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(dateString);
}

function AuditLogItem({
  entry,
  theme,
}: {
  entry: AuditLogEntry;
  theme: typeof Colors.light;
}) {
  const config = ACTION_CONFIG[entry.action] || { 
    icon: "activity", 
    colorKey: "textSecondary", 
    label: entry.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) 
  };
  const color = theme[config.colorKey] as string;

  return (
    <View style={[styles.logItem, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.logIcon, { backgroundColor: `${color}15` }]}>
        <Feather name={config.icon} size={16} color={color} />
      </View>
      <View style={styles.logContent}>
        <View style={styles.logHeader}>
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            {config.label}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {formatRelativeTime(entry.createdAt)}
          </ThemedText>
        </View>
        {entry.resourceType ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {entry.resourceType}{entry.resourceId ? ` #${entry.resourceId.slice(0, 8)}...` : ""}
          </ThemedText>
        ) : null}
        {entry.ipAddress ? (
          <View style={styles.metaRow}>
            <Feather name="globe" size={10} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {entry.ipAddress.replace(/\.\d+$/, ".***")}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function AuditLogScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [filter, setFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const { data: auditLogs = [], isLoading, refetch, isRefetching } = useQuery<AuditLogEntry[]>({
    queryKey: ["/api/audit-logs"],
  });

  const filteredLogs = auditLogs.filter((log) => {
    if (filter === "all") return true;
    if (filter === "security") return ["login", "logout", "revoke_session", "revoke_all_sessions", "view_devices"].includes(log.action);
    if (filter === "phi") return ["view_phi", "update_phi", "view_record", "create_record", "update_record", "delete_record"].includes(log.action);
    if (filter === "sharing") return ["share_record", "create_share_link", "view_share_link", "revoke_share_link"].includes(log.action);
    return true;
  });

  const handleExport = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(true);

    try {
      const exportUrl = `${axiosInstance.defaults.baseURL}/api/audit-logs/export`;

      if (Platform.OS === "web") {
        await WebBrowser.openBrowserAsync(exportUrl);
      } else {
        const filename = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
        const file = new ExpoFile(Paths.cache, filename);

        const response = await fetch(exportUrl);
        if (!response.ok) throw new Error("Failed to download audit log");

        const text = await response.text();
        await file.write(text);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: "text/csv",
            dialogTitle: "Export Audit Log",
          });
        }
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.titleRow}>
          <View>
            <ThemedText type="h2">Audit Log</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {auditLogs.length} events recorded
            </ThemedText>
          </View>
          <Pressable
            style={[styles.exportButton, { backgroundColor: theme.primary }]}
            onPress={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="download" size={16} color="#FFFFFF" />
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Export
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const isActive = filter === option.key;
            return (
              <Pressable
                key={option.key}
                style={[
                  styles.filterChip,
                  { backgroundColor: isActive ? theme.primary : theme.backgroundDefault },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilter(option.key);
                }}
              >
                <ThemedText
                  type="caption"
                  style={{ color: isActive ? "#FFFFFF" : theme.text, fontWeight: "600" }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AuditLogItem entry={item} theme={theme} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="clipboard" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                No audit events found
              </ThemedText>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}

      <View style={[styles.complianceNotice, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="shield" size={14} color={theme.success} />
        <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1 }}>
          HIPAA-compliant audit trail. All PHI access is logged with IP, timestamp, and user identity.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing.xl * 3,
  },
  logItem: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logContent: {
    flex: 1,
    gap: 2,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  complianceNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
});
