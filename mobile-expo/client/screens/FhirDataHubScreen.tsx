import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Modal,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

const SCOPE_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  "patient/Patient.read": { label: "Patient Demographics", icon: "user", description: "Name, contact info, identifiers" },
  "patient/Condition.read": { label: "Conditions", icon: "heart", description: "Active and historical diagnoses" },
  "patient/Observation.read": { label: "Observations", icon: "activity", description: "Vitals, lab values, measurements" },
  "patient/MedicationRequest.read": { label: "Medications", icon: "package", description: "Prescribed and active medications" },
  "patient/AllergyIntolerance.read": { label: "Allergies", icon: "alert-triangle", description: "Known allergies and intolerances" },
  "patient/Immunization.read": { label: "Immunizations", icon: "shield", description: "Vaccination records" },
  "patient/Procedure.read": { label: "Procedures", icon: "scissors", description: "Surgical and clinical procedures" },
  "patient/DiagnosticReport.read": { label: "Diagnostic Reports", icon: "file-text", description: "Lab reports and imaging results" },
  "patient/Encounter.read": { label: "Encounters", icon: "calendar", description: "Clinical visits and encounters" },
  "patient/CarePlan.read": { label: "Care Plans", icon: "clipboard", description: "Treatment and care plans" },
  "patient/CareTeam.read": { label: "Care Team", icon: "users", description: "Healthcare providers involved in care" },
  "patient/DocumentReference.read": { label: "Documents", icon: "folder", description: "Clinical documents and notes" },
  "patient/Goal.read": { label: "Goals", icon: "target", description: "Patient health goals" },
  "patient/Device.read": { label: "Devices", icon: "cpu", description: "Implants and medical devices" },
};

type TabKey = "apps" | "log";

export default function FhirDataHubScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("apps");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: scopesData, isLoading: scopesLoading, refetch: refetchScopes } = useQuery<{ apps: any[] }>({
    queryKey: ["/api/fhir-hub/scopes"],
  });

  const { data: logData, isLoading: logLoading, refetch: refetchLog } = useQuery<{ logs: any[] }>({
    queryKey: ["/api/fhir-hub/access-log?days=30"],
    enabled: activeTab === "log",
  });

  const updateScopesMutation = useMutation({
    mutationFn: async ({ appId, scopes }: { appId: string; scopes: string[] }) => {
      const res = await apiRequest("PUT", `/api/fhir-hub/scopes/${appId}`, { scopes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-hub/scopes"] });
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage("Failed to update scopes. Please try again.");
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-hub/scopes"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (appId: string) => {
      const res = await apiRequest("DELETE", `/api/fhir-hub/scopes/${appId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-hub/scopes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-hub/access-log?days=30"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRevokeTarget(null);
      setErrorMessage(null);
    },
    onError: () => {
      setErrorMessage("Failed to revoke access. Please try again.");
      setRevokeTarget(null);
    },
  });

  const handleToggleScope = useCallback(
    (appId: string, scope: string, currentScopes: string[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newScopes = currentScopes.includes(scope)
        ? currentScopes.filter((s) => s !== scope)
        : [...currentScopes, scope];
      updateScopesMutation.mutate({ appId, scopes: newScopes });
    },
    [updateScopesMutation]
  );

  const handleRevokeAccess = useCallback(
    (appId: string, appName: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setRevokeTarget({ id: appId, name: appName });
    },
    []
  );

  const apps = scopesData?.apps || [];
  const logs = logData?.logs || [];

  const renderHeader = () => (
    <View style={{ paddingTop: headerHeight + Spacing.md, paddingHorizontal: Spacing.md }}>
      <View style={styles.headerRow}>
        <View style={[styles.headerIconContainer, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }]}>
          <Feather name="globe" size={24} color={theme.primary} />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>API Data Hub</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Manage partner app access to your FHIR health data
          </Text>
        </View>
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        {(["apps", "log"] as TabKey[]).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { backgroundColor: theme.primary },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab);
            }}
            accessibilityRole="button"
            accessibilityLabel={tab === "apps" ? "Partner Apps tab" : "Access Log tab"}
            testID={`tab-${tab}`}
          >
            <Feather
              name={tab === "apps" ? "layers" : "clock"}
              size={14}
              color={activeTab === tab ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? "#fff" : theme.textSecondary },
              ]}
            >
              {tab === "apps" ? "Partner Apps" : "Access Log"}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === "apps" && apps.length === 0 && !scopesLoading ? (
        <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <Feather name="inbox" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Partner Apps</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            When third-party apps request access to your health data, they will appear here for your approval.
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderAppCard = useCallback(
    ({ item: app }: { item: any }) => {
      const isExpanded = expandedApp === app.id;
      const grantedScopes: string[] = app.grantedScopes || [];
      const availableScopes: string[] = app.availableScopes || Object.keys(SCOPE_LABELS);
      const isActive = app.consentStatus === "active";

      return (
        <View style={[styles.appCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <Pressable
            style={styles.appHeader}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setExpandedApp(isExpanded ? null : app.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${app.name}, ${isActive ? "active" : "inactive"}, ${grantedScopes.length} scopes granted`}
            testID={`app-card-${app.id}`}
          >
            <View style={[styles.appLogo, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)" }]}>
              <Feather name="box" size={20} color={theme.primary} />
            </View>
            <View style={styles.appInfo}>
              <Text style={[styles.appName, { color: theme.text }]}>{app.name}</Text>
              <Text style={[styles.appMeta, { color: theme.textSecondary }]}>
                {grantedScopes.length} scope{grantedScopes.length !== 1 ? "s" : ""} granted
              </Text>
            </View>
            <View style={styles.appStatus}>
              <View style={[styles.statusBadge, { backgroundColor: isActive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? "#22c55e" : "#ef4444" }]} />
                <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#ef4444" }]}>
                  {isActive ? "Active" : "Inactive"}
                </Text>
              </View>
              <Feather
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.textSecondary}
              />
            </View>
          </Pressable>

          {isExpanded ? (
            <View style={[styles.scopeList, { borderTopColor: theme.border }]}>
              <Text style={[styles.scopeSectionTitle, { color: theme.textSecondary }]}>
                DATA ACCESS PERMISSIONS
              </Text>
              {availableScopes.map((scope) => {
                const meta = SCOPE_LABELS[scope];
                if (!meta) return null;
                const isGranted = grantedScopes.includes(scope);

                return (
                  <View key={scope} style={[styles.scopeRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.scopeIcon, { backgroundColor: isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.06)" }]}>
                      <Feather name={meta.icon as any} size={16} color={theme.primary} />
                    </View>
                    <View style={styles.scopeInfo}>
                      <Text style={[styles.scopeLabel, { color: theme.text }]}>{meta.label}</Text>
                      <Text style={[styles.scopeDescription, { color: theme.textSecondary }]}>{meta.description}</Text>
                    </View>
                    <Switch
                      value={isGranted}
                      onValueChange={() => handleToggleScope(app.id, scope, grantedScopes)}
                      trackColor={{ false: isDark ? "#374151" : "#d1d5db", true: "rgba(99,102,241,0.5)" }}
                      thumbColor={isGranted ? theme.primary : isDark ? "#6b7280" : "#9ca3af"}
                      accessibilityLabel={`${meta.label} access ${isGranted ? "enabled" : "disabled"}`}
                      testID={`scope-toggle-${scope}`}
                    />
                  </View>
                );
              })}

              {app.lastAccessedAt ? (
                <View style={styles.lastAccess}>
                  <Feather name="clock" size={12} color={theme.textSecondary} />
                  <Text style={[styles.lastAccessText, { color: theme.textSecondary }]}>
                    Last accessed {formatDate(app.lastAccessedAt)}
                  </Text>
                  <Text style={[styles.accessCount, { color: theme.textSecondary }]}>
                    {app.accessCount || 0} total requests
                  </Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.revokeButton, { borderColor: "#ef4444" }]}
                onPress={() => handleRevokeAccess(app.id, app.name)}
                accessibilityRole="button"
                accessibilityLabel={`Revoke all access for ${app.name}`}
                testID={`revoke-${app.id}`}
              >
                <Feather name="slash" size={16} color="#ef4444" />
                <Text style={styles.revokeText}>Revoke All Access</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    },
    [expandedApp, theme, isDark, handleToggleScope, handleRevokeAccess]
  );

  const renderLogItem = useCallback(
    ({ item: log }: { item: any }) => {
      const isSuccess = log.statusCode >= 200 && log.statusCode < 300;
      return (
        <View style={[styles.logItem, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
          <View style={[styles.logIcon, { backgroundColor: isSuccess ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }]}>
            <Feather
              name={isSuccess ? "check-circle" : "x-circle"}
              size={16}
              color={isSuccess ? "#22c55e" : "#ef4444"}
            />
          </View>
          <View style={styles.logInfo}>
            <Text style={[styles.logAction, { color: theme.text }]}>
              {log.appName || "Unknown App"}
            </Text>
            <Text style={[styles.logDetail, { color: theme.textSecondary }]}>
              {log.action} {log.resourceType}
              {log.resourceCount > 0 ? ` (${log.resourceCount} records)` : ""}
            </Text>
            <Text style={[styles.logTime, { color: theme.textSecondary }]}>
              {formatDate(log.createdAt)}
            </Text>
          </View>
          <View style={[styles.logStatusBadge, { backgroundColor: isSuccess ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)" }]}>
            <Text style={{ color: isSuccess ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: "600" }}>
              {log.statusCode}
            </Text>
          </View>
        </View>
      );
    },
    [theme]
  );

  const isLoading = activeTab === "apps" ? scopesLoading : logLoading;
  const listData = activeTab === "apps" ? apps : logs;

  if (isLoading && listData.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {errorMessage ? (
        <Pressable
          style={[styles.errorBanner, { top: headerHeight + Spacing.sm }]}
          onPress={() => setErrorMessage(null)}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityLabel={errorMessage}
          testID="error-banner"
        >
          <Feather name="alert-circle" size={16} color="#fff" />
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
          <Feather name="x" size={14} color="#fff" />
        </Pressable>
      ) : null}
      <FlatList
        data={listData}
        renderItem={activeTab === "apps" ? renderAppCard : renderLogItem}
        keyExtractor={(item) => item.id?.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: activeTab === "log" ? Spacing.md : 0 }}
        ListEmptyComponent={
          activeTab === "log" ? (
            <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, marginHorizontal: Spacing.md }]}>
              <Feather name="clock" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Access Logs</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Partner API access events from the last 30 days will appear here.
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              if (activeTab === "apps") refetchScopes();
              else refetchLog();
            }}
            tintColor={theme.primary}
          />
        }
        testID="data-hub-list"
      />

      <Modal
        visible={revokeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRevokeTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: "rgba(239,68,68,0.1)" }]}>
              <Feather name="alert-triangle" size={28} color="#ef4444" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Revoke Access</Text>
            <Text style={[styles.modalBody, { color: theme.textSecondary }]}>
              Remove all data access for {revokeTarget?.name}? This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: theme.backgroundRoot, borderColor: theme.border, borderWidth: 1 }]}
                onPress={() => setRevokeTarget(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel revoke"
                testID="modal-cancel"
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: "#ef4444" }]}
                onPress={() => {
                  if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm revoke access"
                testID="modal-confirm-revoke"
              >
                {revokeMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "#fff" }]}>Revoke</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  appCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  appLogo: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 15,
    fontWeight: "600",
  },
  appMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  appStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scopeList: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  scopeSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  scopeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scopeIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  scopeInfo: {
    flex: 1,
  },
  scopeLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  scopeDescription: {
    fontSize: 11,
    marginTop: 1,
  },
  lastAccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  lastAccessText: {
    fontSize: 12,
  },
  accessCount: {
    fontSize: 12,
    marginLeft: "auto",
  },
  revokeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  revokeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },
  logItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  logIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  logInfo: {
    flex: 1,
  },
  logAction: {
    fontSize: 14,
    fontWeight: "600",
  },
  logDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  logTime: {
    fontSize: 11,
    marginTop: 2,
  },
  logStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  errorBanner: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ef4444",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorBannerText: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  modalBody: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
