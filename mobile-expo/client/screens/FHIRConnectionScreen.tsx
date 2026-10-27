import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { BaseModal } from "@/components/BaseModal";
import { FormInput } from "@/components/FormInput";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

interface ConnectionConfig {
  authType: string;
  fhirVersion: string | null;
  supportedResources: any[] | null;
  connectionTestResult: any | null;
  syncConfig: any | null;
  lastCapabilityCheck: string | null;
}

interface FHIRConnection {
  id: string;
  name: string;
  type: string;
  fhirEndpoint: string | null;
  isConnected: boolean;
  lastSyncAt: string | null;
  recordCount: number;
  patientId: string | null;
  connectionConfig: ConnectionConfig | null;
  createdAt: string;
}

interface SyncJob {
  id: string;
  status: string;
  phase: string | null;
  direction: string;
  progressPercentage: number;
  processedResources: number;
  importedResources: number;
  failedResources: number;
  errors: any[] | null;
  startedAt: string | null;
  completedAt: string | null;
}

const AUTH_TYPES = [
  { value: "none", label: "No Authentication" },
  { value: "basic", label: "Basic Auth" },
  { value: "bearer", label: "Bearer Token" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "smart_on_fhir", label: "SMART on FHIR" },
];

const FHIR_VERSIONS = [
  { value: "R4", label: "R4 (Recommended)" },
  { value: "R5", label: "R5" },
  { value: "STU3", label: "STU3" },
  { value: "DSTU2", label: "DSTU2" },
];

function StatusBadge({ status, theme }: { status: string; theme: any }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    connected: { bg: theme.success + "20", text: theme.success },
    disconnected: { bg: theme.error + "20", text: theme.error },
    pending: { bg: theme.warning + "20", text: theme.warning },
    syncing: { bg: theme.primary + "20", text: theme.primary },
    completed: { bg: theme.success + "20", text: theme.success },
    failed: { bg: theme.error + "20", text: theme.error },
  };

  const colors = statusColors[status] || statusColors.disconnected;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <ThemedText type="small" style={{ color: colors.text, fontWeight: "600" }}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </ThemedText>
    </View>
  );
}

function ConnectionCard({
  connection,
  onPress,
  onTest,
  onSync,
  onDelete,
  onResourceConfig,
  isTesting,
  theme,
}: {
  connection: FHIRConnection;
  onPress?: () => void;
  onTest: () => void;
  onSync: () => void;
  onDelete: () => void;
  onResourceConfig: () => void;
  isTesting: boolean;
  theme: any;
}) {
  const testResult = connection.connectionConfig?.connectionTestResult;
  const cardStyle = [styles.connectionCard, { backgroundColor: theme.backgroundDefault }];
  const cardTestID = `connection-card-${connection.id}`;
  const inner = (
    <>
      <View style={styles.connectionHeader}>
          <View style={styles.connectionInfo}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="server" size={20} color={theme.primary} />
            </View>
            <View style={styles.connectionDetails}>
              <ThemedText type="h3" style={{ color: theme.text }}>
                {connection.name}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={1}>
                {connection.fhirEndpoint || "No endpoint configured"}
              </ThemedText>
            </View>
          </View>
          <StatusBadge
            status={connection.isConnected ? "connected" : "disconnected"}
            theme={theme}
          />
        </View>

        <View style={[styles.connectionStats, { borderTopColor: theme.border }]}>
          <View style={styles.statItem}>
            <Feather name="database" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {connection.recordCount} records
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {connection.lastSyncAt
                ? `Synced ${new Date(connection.lastSyncAt).toLocaleDateString()}`
                : "Never synced"}
            </ThemedText>
          </View>
          {testResult?.latencyMs ? (
            <View style={styles.statItem}>
              <Feather name="activity" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {testResult.latencyMs}ms
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.connectionActions}>
          <Button
            size="sm"
            variant="ghost"
            icon="check-circle"
            loading={isTesting}
            onPress={onTest}
            style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
            testID={`test-connection-${connection.id}`}
          >
            Test
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="refresh-cw"
            onPress={onSync}
            style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
            testID={`sync-connection-${connection.id}`}
          >
            Sync
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="sliders"
            onPress={onResourceConfig}
            style={[styles.actionButton, { backgroundColor: theme.backgroundRoot }]}
            testID={`configure-connection-${connection.id}`}
          >
            Configure
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon="trash-2"
            onPress={onDelete}
            style={[styles.actionButton, { backgroundColor: theme.error + "15" }]}
            testID={`delete-connection-${connection.id}`}
          >
            {""}
          </Button>
        </View>
    </>
  );

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      {onPress ? (
        <Pressable onPress={onPress} testID={cardTestID} style={cardStyle}>
          {inner}
        </Pressable>
      ) : (
        <View testID={cardTestID} style={cardStyle}>
          {inner}
        </View>
      )}
    </Animated.View>
  );
}

function SyncProgressCard({ job, theme }: { job: SyncJob; theme: any }) {
  const isActive = ["pending", "connecting", "syncing"].includes(job.status);

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <View style={[styles.syncCard, { backgroundColor: theme.primary + "10" }]}>
        <View style={styles.syncHeader}>
          <View style={styles.syncInfo}>
            <Feather
              name={isActive ? "loader" : job.status === "completed" ? "check-circle" : "x-circle"}
              size={18}
              color={isActive ? theme.primary : job.status === "completed" ? theme.success : theme.error}
            />
            <ThemedText type="body" style={{ color: theme.text, marginLeft: 8, fontWeight: "600" }}>
              {job.direction === "import" ? "Importing" : job.direction === "export" ? "Exporting" : "Syncing"} data
            </ThemedText>
          </View>
          <StatusBadge status={job.status} theme={theme} />
        </View>

        {isActive ? (
          <>
            <View style={[styles.progressBar, { backgroundColor: theme.backgroundRoot }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.primary, width: `${job.progressPercentage}%` },
                ]}
              />
            </View>
            <View style={styles.syncStats}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {job.phase || "Starting..."}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {job.processedResources} processed • {job.importedResources} imported
              </ThemedText>
            </View>
          </>
        ) : null}

        {job.errors && job.errors.length > 0 ? (
          <View style={[styles.errorBox, { backgroundColor: theme.error + "10" }]}>
            <Feather name="alert-triangle" size={14} color={theme.error} />
            <ThemedText type="small" style={{ color: theme.error, marginLeft: 4, flex: 1 }}>
              {job.errors.length} error(s) occurred
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function FHIRConnectionScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp>();

  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    fhirEndpoint: "",
    authType: "none",
    fhirVersion: "R4",
    patientId: "",
    accessToken: "",
    clientId: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: connections = [], isLoading, refetch } = useQuery<FHIRConnection[]>({
    queryKey: ["/api/fhir-connections"],
  });

  const { data: activeSyncJobs = [] } = useQuery<SyncJob[]>({
    queryKey: ["/api/sync-jobs/active"],
    refetchInterval: 3000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/fhir-connections", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-connections"] });
      setShowAddModal(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/fhir-connections/${id}/test`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-connections"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => setTestingId(null),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/fhir-connections/${id}/sync`, { direction: "import" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync-jobs/active"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/fhir-connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-connections"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      fhirEndpoint: "",
      authType: "none",
      fhirVersion: "R4",
      patientId: "",
      accessToken: "",
      clientId: "",
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.fhirEndpoint.trim()) errors.fhirEndpoint = "FHIR endpoint URL is required";
    if (formData.fhirEndpoint && !formData.fhirEndpoint.startsWith("http")) {
      errors.fhirEndpoint = "Must be a valid URL (http:// or https://)";
    }
    if (formData.authType === "bearer" && !formData.accessToken) {
      errors.accessToken = "Access token is required for Bearer auth";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    if (!validateForm()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createMutation.mutate({
      name: formData.name,
      fhirEndpoint: formData.fhirEndpoint,
      authType: formData.authType,
      fhirVersion: formData.fhirVersion,
      patientId: formData.patientId || null,
      credentials: {
        accessToken: formData.accessToken || null,
        clientId: formData.clientId || null,
      },
    });
  };

  const handleTest = (id: string) => {
    setTestingId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    testMutation.mutate(id);
  };

  const handleSync = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    syncMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteMutation.mutate(id);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "15" }]}>
        <Feather name="link" size={48} color={theme.primary} />
      </View>
      <ThemedText type="h2" style={{ color: theme.text, textAlign: "center", marginTop: Spacing.lg }}>
        No FHIR Connections
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
        Connect to external FHIR servers to import and sync your health records securely.
      </ThemedText>
      <Button
        icon="plus"
        onPress={() => setShowAddModal(true)}
        style={{ marginTop: Spacing.xl }}
        testID="add-connection-empty"
      >
        Add Connection
      </Button>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.primary} />}
      >
        <Pressable
          style={[styles.mappingCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F0F9FF" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("FHIRMapping", {});
          }}
        >
          <View style={[styles.mappingIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="git-merge" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              Data Mapping Rules
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 2 }}>
              Customize how FHIR data transforms into your health records
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={24} color={theme.textSecondary} />
        </Pressable>

        {activeSyncJobs.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="h3" style={{ color: theme.text, marginBottom: Spacing.sm }}>
              Active Syncs
            </ThemedText>
            {activeSyncJobs.map((job) => (
              <SyncProgressCard key={job.id} job={job} theme={theme} />
            ))}
          </View>
        ) : null}

        {connections.length === 0 && !isLoading ? (
          renderEmptyState()
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3" style={{ color: theme.text }}>
                Connected Sources
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {connections.length} connection{connections.length !== 1 ? "s" : ""}
              </ThemedText>
            </View>
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onTest={() => handleTest(connection.id)}
                onSync={() => handleSync(connection.id)}
                onDelete={() => handleDelete(connection.id)}
                onResourceConfig={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("FHIRResourceConfig", { 
                    sourceId: connection.id, 
                    sourceName: connection.name 
                  });
                }}
                isTesting={testingId === connection.id}
                theme={theme}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowAddModal(true);
        }}
        testID="add-connection-fab"
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <BaseModal
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); resetForm(); }}
        title="Add FHIR Connection"
        testID="add-connection-modal"
      >
        <FormInput
          label="Connection Name *"
          value={formData.name}
          onChangeText={(text) => setFormData((f) => ({ ...f, name: text }))}
          placeholder="e.g., My Hospital Portal"
          error={formErrors.name}
          testID="input-name"
        />

        <FormInput
          label="FHIR Server URL *"
          value={formData.fhirEndpoint}
          onChangeText={(text) => setFormData((f) => ({ ...f, fhirEndpoint: text }))}
          placeholder="https://fhir.example.com/api/fhir"
          error={formErrors.fhirEndpoint}
          autoCapitalize="none"
          keyboardType="url"
          testID="input-endpoint"
        />

        <View style={styles.formGroup}>
          <ThemedText type="body" style={{ color: theme.text, fontWeight: "600", marginBottom: 8 }}>
            FHIR Version
          </ThemedText>
          <View style={styles.optionRow}>
            {FHIR_VERSIONS.map((v) => (
              <Pressable
                key={v.value}
                style={[
                  styles.optionButton,
                  { backgroundColor: formData.fhirVersion === v.value ? theme.primary : theme.backgroundDefault, borderColor: theme.border },
                ]}
                onPress={() => setFormData((f) => ({ ...f, fhirVersion: v.value }))}
              >
                <ThemedText
                  type="small"
                  style={{ color: formData.fhirVersion === v.value ? "#FFFFFF" : theme.text, fontWeight: "500" }}
                >
                  {v.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText type="body" style={{ color: theme.text, fontWeight: "600", marginBottom: 8 }}>
            Authentication Type
          </ThemedText>
          <View style={styles.authOptions}>
            {AUTH_TYPES.map((auth) => (
              <Pressable
                key={auth.value}
                style={[
                  styles.authOption,
                  {
                    backgroundColor: formData.authType === auth.value ? theme.primary + "15" : theme.backgroundDefault,
                    borderColor: formData.authType === auth.value ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setFormData((f) => ({ ...f, authType: auth.value }))}
              >
                <Feather
                  name={formData.authType === auth.value ? "check-circle" : "circle"}
                  size={16}
                  color={formData.authType === auth.value ? theme.primary : theme.textSecondary}
                />
                <ThemedText type="small" style={{ color: theme.text, marginLeft: 8 }}>
                  {auth.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {formData.authType === "bearer" ? (
          <FormInput
            label="Access Token *"
            value={formData.accessToken}
            onChangeText={(text) => setFormData((f) => ({ ...f, accessToken: text }))}
            placeholder="Enter your access token"
            error={formErrors.accessToken}
            secureTextEntry
            testID="input-token"
          />
        ) : null}

        <FormInput
          label="Patient ID (Optional)"
          value={formData.patientId}
          onChangeText={(text) => setFormData((f) => ({ ...f, patientId: text }))}
          placeholder="Leave empty to fetch all accessible records"
          helperText="If you have a specific patient ID, enter it to filter records."
          autoCapitalize="none"
          testID="input-patient-id"
        />

        <View style={[styles.infoBox, { backgroundColor: theme.primary + "10" }]}>
          <Feather name="shield" size={18} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
              Secure Connection
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              Your credentials are encrypted and stored securely. We use industry-standard TLS encryption for all FHIR communications.
            </ThemedText>
          </View>
        </View>

        <Button
          onPress={handleCreate}
          loading={createMutation.isPending}
          disabled={createMutation.isPending}
          fullWidth
          icon="save"
          style={{ marginTop: Spacing.lg }}
          testID="save-connection"
        >
          Save Connection
        </Button>
      </BaseModal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  mappingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  mappingIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  connectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  connectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  connectionInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  connectionDetails: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  connectionStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  connectionActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    borderRadius: BorderRadius.md,
    minWidth: 70,
    height: 36,
  },
  syncCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  syncHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  syncInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  syncStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  authOptions: {
    gap: Spacing.sm,
  },
  authOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
});
