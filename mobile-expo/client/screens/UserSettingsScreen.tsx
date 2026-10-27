import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { api, getUserId } from "@/lib/api";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAIConsent } from "@/context/AIConsentContext";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  autoSyncEnabled: boolean;
  consentAiSummary: boolean;
  consentFastenHealth: boolean;
  consentGrantedAt?: string;
  isVerified: boolean;
  verificationProvider?: string;
  createdAt: string;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncedAt?: string;
}

type SettingsSection = "profile" | "notifications" | "data" | "account";

function SectionHeader({ icon, title, theme }: { icon: string; title: string; theme: any }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconWrap, { backgroundColor: `${theme.primary}12` }]}>
        <Feather name={icon as any} size={18} color={theme.primary} />
      </View>
      <ThemedText type="h3" style={styles.sectionTitle}>{title}</ThemedText>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  description,
  theme,
  right,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  description?: string;
  theme: any;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.settingIconCircle, { backgroundColor: `${theme.primary}08` }]}>
        <Feather name={icon as any} size={18} color={theme.textSecondary} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingLabel}>{label}</ThemedText>
        {description ? (
          <ThemedText style={[styles.settingDesc, { color: theme.textSecondary }]}>{description}</ThemedText>
        ) : null}
      </View>
      {right ? right : onPress ? <Feather name="chevron-right" size={18} color={theme.textSecondary} /> : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View testID={testID}>{content}</View>;
}

export default function UserSettingsScreen({ navigation }: { navigation: any }) {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthContext();
  const queryClient = useQueryClient();
  const { hasConsented, grantConsent, revokeConsent, consentTimestamp } = useAIConsent();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getUserId().then(setUserId);
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery<DataSource[]>({
    queryKey: ["/api/sources"],
    enabled: !!userId,
  });

  const { data: serverVersion, isLoading: versionLoading, isError: versionError } = useQuery<{
    sha: string;
    buildTimestamp: string;
    nodeEnv: string;
  }>({
    queryKey: ["/api/version"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const clientAppVersion = Constants.expoConfig?.version ?? "unknown";

  const formatBuildTimestamp = (value: string | undefined): string => {
    if (!value || value === "unknown") return "unknown";
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const serverShaDisplay = versionLoading
    ? "Loading…"
    : versionError || !serverVersion?.sha
    ? "unknown"
    : serverVersion.sha;
  const serverBuildDisplay = versionLoading
    ? "Loading…"
    : versionError
    ? "unknown"
    : formatBuildTimestamp(serverVersion?.buildTimestamp);

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<UserProfile>) => {
      if (!userId) throw new Error("No user");
      return api.users.update(userId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No user");
      return api.users.delete(userId);
    },
    onSuccess: () => {
      signOut();
    },
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return api.sources.sync(sourceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return api.sources.delete(sourceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
    },
  });

  useEffect(() => {
    if (profile) {
      setNameInput(profile.name || "");
      setEmailInput(profile.email || "");
    }
  }, [profile]);

  const handleToggle = useCallback(async (key: string, value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "consentAiSummary") {
      if (value) {
        grantConsent();
      } else {
        revokeConsent();
      }
    }
    updateMutation.mutate({ [key]: value } as any);
  }, [updateMutation, grantConsent, revokeConsent]);

  const handleSaveName = useCallback(() => {
    if (nameInput.trim() && nameInput !== profile?.name) {
      updateMutation.mutate({ name: nameInput.trim() } as any);
    }
    setEditingName(false);
  }, [nameInput, profile, updateMutation]);

  const handleSaveEmail = useCallback(() => {
    if (emailInput.trim() && emailInput !== profile?.email) {
      updateMutation.mutate({ email: emailInput.trim() } as any);
    }
    setEditingEmail(false);
  }, [emailInput, profile, updateMutation]);

  const handleDeleteAccount = useCallback(() => {
    setShowDeleteModal(false);
    deleteMutation.mutate();
  }, [deleteMutation]);

  const handleSourceAction = useCallback(async (sourceId: string, action: "sync" | "delete") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action === "sync") {
      syncSourceMutation.mutate(sourceId);
    } else {
      Alert.alert("Remove Data Source", "This will disconnect this data source. Your existing records will not be deleted.", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteSourceMutation.mutate(sourceId) },
      ]);
    }
  }, [syncSourceMutation, deleteSourceMutation]);

  if (profileLoading || !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={styles.card}>
            <SectionHeader icon="user" title="Profile Information" theme={theme} />

            <SettingRow
              icon="user"
              label="Name"
              theme={theme}
              testID="setting-name"
              right={
                editingName ? (
                  <View style={styles.inlineEditRow}>
                    <TextInput
                      testID="input-name"
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.primary, backgroundColor: theme.backgroundDefault }]}
                      value={nameInput}
                      onChangeText={setNameInput}
                      autoFocus
                      onSubmitEditing={handleSaveName}
                      returnKeyType="done"
                    />
                    <Pressable testID="button-save-name" onPress={handleSaveName} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={16} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => { setEditingName(false); setNameInput(profile.name); }} style={[styles.saveBtn, { backgroundColor: theme.border }]}>
                      <Feather name="x" size={16} color={theme.text} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable testID="button-edit-name" onPress={() => setEditingName(true)} style={styles.editableValue}>
                    <ThemedText style={[styles.valueText, { color: theme.textSecondary }]}>{profile.name}</ThemedText>
                    <Feather name="edit-2" size={14} color={theme.textSecondary} />
                  </Pressable>
                )
              }
            />

            <SettingRow
              icon="mail"
              label="Email"
              theme={theme}
              testID="setting-email"
              right={
                editingEmail ? (
                  <View style={styles.inlineEditRow}>
                    <TextInput
                      testID="input-email"
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.primary, backgroundColor: theme.backgroundDefault }]}
                      value={emailInput}
                      onChangeText={setEmailInput}
                      autoFocus
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onSubmitEditing={handleSaveEmail}
                      returnKeyType="done"
                    />
                    <Pressable testID="button-save-email" onPress={handleSaveEmail} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={16} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => { setEditingEmail(false); setEmailInput(profile.email); }} style={[styles.saveBtn, { backgroundColor: theme.border }]}>
                      <Feather name="x" size={16} color={theme.text} />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable testID="button-edit-email" onPress={() => setEditingEmail(true)} style={styles.editableValue}>
                    <ThemedText style={[styles.valueText, { color: theme.textSecondary }]}>{profile.email}</ThemedText>
                    <Feather name="edit-2" size={14} color={theme.textSecondary} />
                  </Pressable>
                )
              }
            />

            <SettingRow
              icon="shield"
              label="Identity Verified"
              description={profile.isVerified ? `Via ${profile.verificationProvider || "Provider"}` : "Not yet verified"}
              theme={theme}
              testID="setting-verified"
              right={
                <View style={[styles.statusBadge, { backgroundColor: profile.isVerified ? `${theme.success}15` : `${theme.warning}15` }]}>
                  <Feather name={profile.isVerified ? "check-circle" : "alert-circle"} size={14} color={profile.isVerified ? theme.success : theme.warning} />
                  <ThemedText style={[styles.statusText, { color: profile.isVerified ? theme.success : theme.warning }]}>
                    {profile.isVerified ? "Verified" : "Pending"}
                  </ThemedText>
                </View>
              }
            />

            <SettingRow
              icon="calendar"
              label="Member Since"
              theme={theme}
              testID="setting-member-since"
              right={<ThemedText style={[styles.valueText, { color: theme.textSecondary }]}>{formatDate(profile.createdAt)}</ThemedText>}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={styles.card}>
            <SectionHeader icon="bell" title="Notifications & Preferences" theme={theme} />

            <SettingRow
              icon="bell"
              label="Push Notifications"
              description="Receive health alerts and reminders"
              theme={theme}
              testID="setting-notifications"
              right={
                <Switch
                  testID="switch-notifications"
                  value={profile.notificationsEnabled}
                  onValueChange={(val) => handleToggle("notificationsEnabled", val)}
                  trackColor={{ false: theme.border, true: `${theme.primary}60` }}
                  thumbColor={profile.notificationsEnabled ? theme.primary : theme.textSecondary}
                />
              }
            />

            <SettingRow
              icon="refresh-cw"
              label="Auto Sync"
              description="Keep records up to date automatically"
              theme={theme}
              testID="setting-auto-sync"
              right={
                <Switch
                  testID="switch-auto-sync"
                  value={profile.autoSyncEnabled}
                  onValueChange={(val) => handleToggle("autoSyncEnabled", val)}
                  trackColor={{ false: theme.border, true: `${theme.primary}60` }}
                  thumbColor={profile.autoSyncEnabled ? theme.primary : theme.textSecondary}
                />
              }
            />

            <SettingRow
              icon="lock"
              label="Biometric Login"
              description="Use Face ID or fingerprint to sign in"
              theme={theme}
              testID="setting-biometric"
              right={
                <Switch
                  testID="switch-biometric"
                  value={profile.biometricEnabled}
                  onValueChange={(val) => handleToggle("biometricEnabled", val)}
                  trackColor={{ false: theme.border, true: `${theme.primary}60` }}
                  thumbColor={profile.biometricEnabled ? theme.primary : theme.textSecondary}
                />
              }
            />

            <SettingRow
              icon="clock"
              label="Reminders"
              description="Medication and appointment alerts"
              theme={theme}
              testID="setting-reminders"
              onPress={() => navigation.navigate("ReminderSettings")}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Card style={styles.card}>
            <SectionHeader icon="shield" title="Privacy & Consent" theme={theme} />

            <SettingRow
              icon="cpu"
              label="AI Record Summaries"
              description="Allow AI to summarize your health records"
              theme={theme}
              testID="setting-consent-ai"
              right={
                <Switch
                  testID="switch-consent-ai"
                  value={profile.consentAiSummary}
                  onValueChange={(val) => handleToggle("consentAiSummary", val)}
                  trackColor={{ false: theme.border, true: `${theme.primary}60` }}
                  thumbColor={profile.consentAiSummary ? theme.primary : theme.textSecondary}
                />
              }
            />

            <SettingRow
              icon="link"
              label="Fasten Health Retrieval"
              description="Allow record retrieval from hospitals"
              theme={theme}
              testID="setting-consent-fasten"
              right={
                <Switch
                  testID="switch-consent-fasten"
                  value={profile.consentFastenHealth}
                  onValueChange={(val) => handleToggle("consentFastenHealth", val)}
                  trackColor={{ false: theme.border, true: `${theme.primary}60` }}
                  thumbColor={profile.consentFastenHealth ? theme.primary : theme.textSecondary}
                />
              }
            />

            {profile.consentGrantedAt ? (
              <View style={[styles.consentNote, { backgroundColor: `${theme.success}08`, borderColor: `${theme.success}20` }]}>
                <Feather name="check-circle" size={14} color={theme.success} />
                <ThemedText style={[styles.consentNoteText, { color: theme.textSecondary }]}>
                  Consent last updated {formatDate(profile.consentGrantedAt)}
                </ThemedText>
              </View>
            ) : null}

            <SettingRow
              icon="user-check"
              label="Consent Management"
              description="Manage all data sharing permissions"
              theme={theme}
              testID="setting-consent-manage"
              onPress={() => navigation.navigate("ConsentManagement")}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Card style={styles.card}>
            <SectionHeader icon="database" title="Data Sources & Integrations" theme={theme} />

            <SettingRow
              icon="link"
              label="Connect Health Records"
              description="Import from 50,000+ health systems"
              theme={theme}
              testID="setting-connect-records"
              onPress={() => navigation.navigate("ConnectHealthRecords")}
            />

            {sourcesLoading ? (
              <View style={styles.sourcesLoading}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : sources && sources.length > 0 ? (
              sources.map((source) => (
                <View key={source.id} style={[styles.sourceRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.sourceIcon, { backgroundColor: source.status === "connected" ? `${theme.success}12` : `${theme.warning}12` }]}>
                    <Feather
                      name={source.type === "ehr" ? "activity" : source.type === "lab" ? "clipboard" : "server"}
                      size={18}
                      color={source.status === "connected" ? theme.success : theme.warning}
                    />
                  </View>
                  <View style={styles.sourceContent}>
                    <ThemedText style={styles.sourceName}>{source.name}</ThemedText>
                    <ThemedText style={[styles.sourceStatus, { color: theme.textSecondary }]}>
                      {source.status === "connected" ? "Connected" : source.status} {source.lastSyncedAt ? `\u00b7 Synced ${formatDate(source.lastSyncedAt)}` : ""}
                    </ThemedText>
                  </View>
                  <View style={styles.sourceActions}>
                    <Pressable
                      testID={`button-sync-${source.id}`}
                      onPress={() => handleSourceAction(source.id, "sync")}
                      style={[styles.sourceActionBtn, { backgroundColor: `${theme.primary}10` }]}
                    >
                      <Feather name="refresh-cw" size={14} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      testID={`button-remove-${source.id}`}
                      onPress={() => handleSourceAction(source.id, "delete")}
                      style={[styles.sourceActionBtn, { backgroundColor: `${theme.error}10` }]}
                    >
                      <Feather name="trash-2" size={14} color={theme.error} />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="inbox" size={24} color={theme.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No data sources connected yet
                </ThemedText>
              </View>
            )}

            <SettingRow
              icon="plus-circle"
              label="Add Data Source"
              description="Connect EHR, lab, or device"
              theme={theme}
              testID="setting-add-source"
              onPress={() => navigation.navigate("ConnectHealthRecords")}
            />

            <SettingRow
              icon="globe"
              label="TEFCA Hub"
              description="Nationwide data exchange network"
              theme={theme}
              testID="setting-tefca"
              onPress={() => navigation.navigate("TEFCAHub")}
            />

            <SettingRow
              icon="server"
              label="FHIR API"
              description="Browse, import, and export health data"
              theme={theme}
              testID="setting-fhir"
              onPress={() => navigation.navigate("FhirApi")}
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).springify()}>
          <Card style={styles.card}>
            <SectionHeader icon="info" title="About" theme={theme} />

            <SettingRow
              icon="smartphone"
              label="App Version"
              description={clientAppVersion}
              theme={theme}
              testID="setting-app-version"
            />

            <SettingRow
              icon="git-commit"
              label="Server Build"
              description={serverShaDisplay}
              theme={theme}
              testID="setting-server-sha"
            />

            <SettingRow
              icon="clock"
              label="Build Date"
              description={serverBuildDisplay}
              theme={theme}
              testID="setting-server-build-timestamp"
            />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Card style={styles.card}>
            <SectionHeader icon="alert-triangle" title="Account" theme={theme} />

            <SettingRow
              icon="log-out"
              label="Sign Out"
              theme={theme}
              testID="setting-sign-out"
              onPress={() => {
                Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign Out", style: "destructive", onPress: signOut },
                ]);
              }}
            />

            <SettingRow
              icon="trash-2"
              label="Delete Account"
              description="Permanently remove your account and data"
              theme={theme}
              testID="setting-delete-account"
              onPress={() => setShowDeleteModal(true)}
            />
          </Card>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={[styles.modalCard, { backgroundColor: theme.backgroundDefault }]}
          >
            <View style={[styles.modalIconWrap, { backgroundColor: `${theme.error}15` }]}>
              <Feather name="alert-triangle" size={32} color={theme.error} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>Delete Account?</ThemedText>
            <ThemedText style={[styles.modalBody, { color: theme.textSecondary }]}>
              This action is permanent and cannot be undone. All your health records, settings, and connected data sources will be permanently removed.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                testID="button-cancel-delete"
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <ThemedText style={[styles.modalBtnText, { color: theme.text }]}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                testID="button-confirm-delete"
                style={[styles.modalButton, { backgroundColor: theme.error }]}
                onPress={handleDeleteAccount}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={[styles.modalBtnText, { color: "#fff" }]}>Delete Account</ThemedText>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  card: { padding: Spacing.lg, marginBottom: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 17 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  settingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  settingContent: { flex: 1, gap: 2 },
  settingLabel: { fontSize: 15, fontWeight: "500" },
  settingDesc: { fontSize: 12, lineHeight: 16 },
  valueText: { fontSize: 14 },
  editableValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  inlineInput: {
    fontSize: 14,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderRadius: BorderRadius.sm,
    minWidth: 140,
  },
  saveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  consentNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginVertical: Spacing.xs,
  },
  consentNoteText: { fontSize: 12 },
  sourcesLoading: { padding: Spacing.lg, alignItems: "center" },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  sourceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sourceContent: { flex: 1, gap: 2 },
  sourceName: { fontSize: 14, fontWeight: "600" },
  sourceStatus: { fontSize: 12 },
  sourceActions: {
    flexDirection: "row",
    gap: 6,
  },
  sourceActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.xs,
  },
  emptyText: { fontSize: 13, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: { textAlign: "center", marginBottom: Spacing.sm },
  modalBody: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
});
