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
import { useNavigation } from "@react-navigation/native";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import * as Haptics from "expo-haptics";

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
}

export default function SmartAppsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: apps, isLoading, refetch } = useQuery<SmartApp[]>({
    queryKey: ["/api/smart-apps"],
  });

  const toggleAppMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/smart-apps/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/smart-apps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleToggleApp = async (app: SmartApp) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleAppMutation.mutate({ id: app.id, isActive: !app.isActive });
  };

  const handleDeleteApp = (app: SmartApp) => {
    Alert.alert(
      "Remove App",
      `Are you sure you want to remove "${app.name}"? This will revoke all access tokens.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteAppMutation.mutate(app.id),
        },
      ]
    );
  };

  const handleLaunchApp = async (app: SmartApp) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("SmartAppLaunch", { appId: app.id });
  };

  const handleViewDetails = (app: SmartApp) => {
    navigation.navigate("SmartAppDetail", { appId: app.id });
  };

  const handleRegisterApp = () => {
    navigation.navigate("SmartAppRegister");
  };

  const getStatusColor = (app: SmartApp) => {
    if (!app.isActive) return theme.textSecondary;
    if (app.lastAccessedAt) {
      const lastAccess = new Date(app.lastAccessedAt);
      const now = new Date();
      const hoursSinceAccess = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);
      if (hoursSinceAccess < 24) return theme.success;
    }
    return theme.primary;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatLastAccess = (dateString?: string) => {
    if (!dateString) return "Never accessed";
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

  const activeApps = (apps || []).filter(app => app.isActive);
  const inactiveApps = (apps || []).filter(app => !app.isActive);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 100 }} />
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
      <View style={styles.headerSection}>
        <Text style={[Typography.h2, { color: theme.text }]}>SMART on FHIR Apps</Text>
        <Text style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
          Manage third-party apps that can access your health data
        </Text>
      </View>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.primary }]}>{apps?.length || 0}</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Total Apps</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.success }]}>{activeApps.length}</Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Active</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[Typography.h2, { color: theme.text }]}>
              {(apps || []).reduce((sum, app) => sum + app.accessCount, 0)}
            </Text>
            <Text style={[Typography.caption, { color: theme.textSecondary }]}>Total Launches</Text>
          </View>
        </View>
      </Card>

      <Pressable
        style={({ pressed }) => [
          styles.registerButton,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={handleRegisterApp}
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <Text style={[Typography.body, { color: "#FFFFFF", fontWeight: "600" }]}>Register New App</Text>
      </Pressable>

      {activeApps.length > 0 ? (
        <View style={styles.section}>
          <Text style={[Typography.caption, { color: theme.text, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }]}>
            Active Apps
          </Text>
          {activeApps.map(app => (
            <Card key={app.id} style={styles.appCard}>
              <Pressable
                style={styles.appContent}
                onPress={() => handleViewDetails(app)}
              >
                <View style={styles.appHeader}>
                  <View style={[styles.appIcon, { backgroundColor: theme.primary + "20" }]}>
                    <Feather name="grid" size={24} color={theme.primary} />
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={[Typography.h4, { color: theme.text }]}>{app.name}</Text>
                    <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                      {app.scopes?.length || 0} scopes • {app.accessCount} launches
                    </Text>
                  </View>
                  <Switch
                    value={app.isActive}
                    onValueChange={() => handleToggleApp(app)}
                    trackColor={{ false: theme.border, true: theme.success + "60" }}
                    thumbColor={app.isActive ? theme.success : theme.textSecondary}
                  />
                </View>

                {app.description ? (
                  <Text
                    style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm }]}
                    numberOfLines={2}
                  >
                    {app.description}
                  </Text>
                ) : null}

                <View style={styles.appFooter}>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(app) }]} />
                    <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                      {formatLastAccess(app.lastAccessedAt)}
                    </Text>
                  </View>
                  <View style={styles.appActions}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionButton,
                        { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                      ]}
                      onPress={() => handleLaunchApp(app)}
                    >
                      <Feather name="external-link" size={14} color="#FFFFFF" />
                      <Text style={[Typography.caption, { color: "#FFFFFF", fontWeight: "500" }]}>Launch</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        { opacity: pressed ? 0.5 : 1 },
                      ]}
                      onPress={() => handleDeleteApp(app)}
                    >
                      <Feather name="trash-2" size={18} color={theme.error} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}

      {inactiveApps.length > 0 ? (
        <View style={styles.section}>
          <Text style={[Typography.caption, { color: theme.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }]}>
            Inactive Apps
          </Text>
          {inactiveApps.map(app => (
            <Card key={app.id} style={styles.appCard}>
              <Pressable
                style={[styles.appContent, { opacity: 0.7 }]}
                onPress={() => handleViewDetails(app)}
              >
                <View style={styles.appHeader}>
                  <View style={[styles.appIcon, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="grid" size={24} color={theme.textSecondary} />
                  </View>
                  <View style={styles.appInfo}>
                    <Text style={[Typography.h4, { color: theme.textSecondary }]}>{app.name}</Text>
                    <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                      Disabled • {app.accessCount} total launches
                    </Text>
                  </View>
                  <Switch
                    value={app.isActive}
                    onValueChange={() => handleToggleApp(app)}
                    trackColor={{ false: theme.border, true: theme.success + "60" }}
                    thumbColor={app.isActive ? theme.success : theme.textSecondary}
                  />
                </View>
              </Pressable>
            </Card>
          ))}
        </View>
      ) : null}

      {(apps || []).length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="box" size={48} color={theme.textSecondary} />
          <Text style={[Typography.h3, { color: theme.text, marginTop: Spacing.md }]}>No Apps Connected</Text>
          <Text style={[Typography.small, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }]}>
            Register a SMART on FHIR app to securely share your health data with third-party services.
          </Text>
        </Card>
      ) : null}

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
  headerSection: {
    marginBottom: Spacing.lg,
  },
  statsCard: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  registerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  appCard: {
    marginTop: Spacing.sm,
  },
  appContent: {
    padding: Spacing.md,
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  appInfo: {
    flex: 1,
  },
  appFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  appActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  iconButton: {
    padding: Spacing.xs,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginTop: Spacing.lg,
  },
});
