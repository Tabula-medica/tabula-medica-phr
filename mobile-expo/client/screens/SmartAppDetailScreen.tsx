import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

interface SmartApp {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  launchUrl?: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AccessLog {
  id: string;
  action: string;
  resourceType?: string;
  resourceCount?: number;
  scopesUsed?: string[];
  ipAddress?: string;
  userAgent?: string;
  responseTime?: number;
  statusCode?: number;
  createdAt: string;
}

interface AppStats {
  totalLaunches: number;
  uniqueResourceTypes: number;
  avgResponseTime: number;
  last24hLaunches: number;
}

type RouteParams = {
  SmartAppDetail: {
    appId: string;
  };
};

export default function SmartAppDetailScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "SmartAppDetail">>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const appId = route.params.appId;

  const { data: app, isLoading: appLoading, refetch: refetchApp } = useQuery<SmartApp>({
    queryKey: ["/api/smart-apps", appId],
  });

  const { data: logsData, refetch: refetchLogs } = useQuery<{ logs: AccessLog[] }>({
    queryKey: [`/api/smart-apps/${appId}/access-logs`],
  });

  const { data: statsData } = useQuery<AppStats>({
    queryKey: [`/api/smart-apps/${appId}/stats`],
  });

  const toggleAppMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await apiRequest("PATCH", `/api/smart-apps/${appId}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
      refetchApp();
    },
  });

  const revokeTokensMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/smart-apps/${appId}/revoke-tokens`);
      return res.json();
    },
    onSuccess: () => {
      Alert.alert("Success", "All access tokens have been revoked");
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/smart-apps/${appId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
      navigation.goBack();
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchApp(), refetchLogs()]);
    setRefreshing(false);
  };

  const handleToggle = async () => {
    if (!app) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleAppMutation.mutate(!app.isActive);
  };

  const handleLaunch = async () => {
    if (!app) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("SmartAppLaunch", { appId: app.id });
  };

  const handleRevokeTokens = () => {
    Alert.alert(
      "Revoke Tokens",
      "This will invalidate all active access tokens for this app. The app will need to re-authorize.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => revokeTokensMutation.mutate(),
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!app) return;
    Alert.alert(
      "Remove App",
      `Are you sure you want to remove "${app.name}"? This will revoke all access and delete all logs.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteAppMutation.mutate(),
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const getActionIcon = (action: string): keyof typeof Feather.glyphMap => {
    switch (action) {
      case "launch":
        return "external-link";
      case "token_refresh":
        return "refresh-cw";
      case "data_access":
        return "database";
      case "authorize":
        return "check-circle";
      default:
        return "activity";
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "launch":
        return theme.primary;
      case "authorize":
        return theme.success;
      case "data_access":
        return theme.warning;
      default:
        return theme.textSecondary;
    }
  };

  const logs = logsData?.logs || [];
  const stats = statsData;

  if (appLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!app) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, padding: Spacing.lg }]}>
        <Text style={[Typography.body, { color: theme.textSecondary }]}>App not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
      }
    >
      <Card style={styles.headerCard}>
        <View style={styles.appHeader}>
          <View style={[styles.appIcon, { backgroundColor: app.isActive ? theme.primary + "20" : theme.backgroundSecondary }]}>
            <Feather name="grid" size={32} color={app.isActive ? theme.primary : theme.textSecondary} />
          </View>
          <View style={styles.appInfo}>
            <Text style={[Typography.h3, { color: theme.text }]}>{app.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: app.isActive ? theme.success + "20" : theme.textSecondary + "20" }]}>
                <View style={[styles.statusDot, { backgroundColor: app.isActive ? theme.success : theme.textSecondary }]} />
                <Text style={[Typography.caption, { color: app.isActive ? theme.success : theme.textSecondary }]}>
                  {app.isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
          <Switch
            value={app.isActive}
            onValueChange={handleToggle}
            trackColor={{ false: theme.border, true: theme.success + "60" }}
            thumbColor={app.isActive ? theme.success : theme.textSecondary}
          />
        </View>

        {app.description ? (
          <Text style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            {app.description}
          </Text>
        ) : null}

        {app.isActive ? (
          <Pressable
            style={({ pressed }) => [
              styles.launchButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleLaunch}
          >
            <Feather name="external-link" size={18} color="#FFFFFF" />
            <Text style={[Typography.body, { color: "#FFFFFF", fontWeight: "600" }]}>Launch App</Text>
          </Pressable>
        ) : null}
      </Card>

      <Card style={styles.statsCard}>
        <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.md }]}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.primary }]}>{app.accessCount}</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Total Launches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.success }]}>{stats?.last24hLaunches || 0}</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Last 24h</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.warning }]}>{stats?.avgResponseTime || 0}ms</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Avg Response</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.text }]}>{stats?.uniqueResourceTypes || 0}</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Resource Types</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.detailsCard}>
        <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.md }]}>Configuration</Text>

        <View style={styles.detailRow}>
          <Text style={[Typography.caption, { color: theme.textSecondary }]}>Client ID</Text>
          <Text style={[Typography.small, { color: theme.text }]} numberOfLines={1}>
            {app.clientId}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[Typography.caption, { color: theme.textSecondary }]}>Redirect URI</Text>
          <Text style={[Typography.small, { color: theme.text }]} numberOfLines={1}>
            {app.redirectUri}
          </Text>
        </View>

        {app.launchUrl ? (
          <View style={styles.detailRow}>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Launch URL</Text>
            <Text style={[Typography.small, { color: theme.primary }]} numberOfLines={1}>
              {app.launchUrl}
            </Text>
          </View>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={[Typography.caption, { color: theme.textSecondary }]}>Registered</Text>
          <Text style={[Typography.small, { color: theme.text }]}>
            {formatDate(app.createdAt)}
          </Text>
        </View>

        {app.lastAccessedAt ? (
          <View style={styles.detailRow}>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Last Accessed</Text>
            <Text style={[Typography.small, { color: theme.text }]}>
              {formatTimeAgo(app.lastAccessedAt)}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card style={styles.scopesCard}>
        <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.sm }]}>Permissions</Text>
        <Text style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
          {app.scopes?.length || 0} scopes granted
        </Text>
        <View style={styles.scopesList}>
          {(app.scopes || []).map((scope, idx) => (
            <View
              key={idx}
              style={[styles.scopeTag, { backgroundColor: theme.primary + "15" }]}
            >
              <Text style={[Typography.caption, { color: theme.primary }]}>{scope}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.logsCard}>
        <View style={styles.logsHeader}>
          <Text style={[Typography.h4, { color: theme.text }]}>Access Log</Text>
          <Text style={[Typography.caption, { color: theme.textSecondary }]}>Last 20 events</Text>
        </View>

        {logs.length > 0 ? (
          <View style={styles.logsList}>
            {logs.slice(0, 20).map((log, idx) => (
              <View
                key={log.id}
                style={[
                  styles.logItem,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                ]}
              >
                <View style={[styles.logIcon, { backgroundColor: getActionColor(log.action) + "20" }]}>
                  <Feather name={getActionIcon(log.action)} size={14} color={getActionColor(log.action)} />
                </View>
                <View style={styles.logContent}>
                  <Text style={[Typography.small, { color: theme.text }]}>
                    {log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                  {log.resourceType ? (
                    <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                      {log.resourceType} ({log.resourceCount || 0} records)
                    </Text>
                  ) : null}
                </View>
                <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                  {formatTimeAgo(log.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyLogs}>
            <Feather name="file-text" size={32} color={theme.textSecondary} />
            <Text style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
              No access logs yet
            </Text>
          </View>
        )}
      </Card>

      <Card style={styles.dangerCard}>
        <Text style={[Typography.h4, { color: theme.error, marginBottom: Spacing.md }]}>Danger Zone</Text>

        <Pressable
          style={({ pressed }) => [
            styles.dangerButton,
            { borderColor: theme.warning, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleRevokeTokens}
        >
          <Feather name="key" size={18} color={theme.warning} />
          <View style={styles.dangerButtonText}>
            <Text style={[Typography.body, { color: theme.text }]}>Revoke Access Tokens</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>
              Invalidate all active sessions
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.dangerButton,
            { borderColor: theme.error, marginTop: Spacing.sm, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleDelete}
        >
          <Feather name="trash-2" size={18} color={theme.error} />
          <View style={styles.dangerButtonText}>
            <Text style={[Typography.body, { color: theme.error }]}>Remove App</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>
              Delete app and all associated data
            </Text>
          </View>
        </Pressable>
      </Card>

      <View style={{ height: Spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  headerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  appInfo: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    marginTop: Spacing.xs,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  launchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  statsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statItem: {
    width: "50%",
    paddingVertical: Spacing.sm,
  },
  detailsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  detailRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  scopesCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  scopesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  scopeTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  logsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  logsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  logsList: {
    gap: 0,
  },
  logItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  logIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  logContent: {
    flex: 1,
  },
  emptyLogs: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  dangerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  dangerButtonText: {
    flex: 1,
  },
});
