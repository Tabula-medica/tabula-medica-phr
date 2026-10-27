import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import * as Haptics from "expo-haptics";

interface Consent {
  id: string;
  patientUserId: string;
  appId?: string;
  grantedToUserId?: string;
  consentType: string;
  status: string;
  scope: string[];
  resourceTypes?: string[];
  purpose?: string;
  dataAccessStartDate?: string;
  dataAccessEndDate?: string;
  expiresAt?: string;
  grantedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

interface ConsentWithApp extends Consent {
  app?: {
    id: string;
    name: string;
    description?: string;
    logoUrl?: string;
  };
}

interface ConsentStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  byType: Record<string, number>;
}

const CONSENT_TYPE_LABELS: Record<string, string> = {
  app_access: "App Access",
  data_sharing: "Data Sharing",
  research: "Research",
  emergency: "Emergency Access",
  caregiver: "Caregiver Access",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22C55E",
  pending: "#F59E0B",
  revoked: "#EF4444",
  expired: "#6B7280",
  suspended: "#8B5CF6",
};

export default function ConsentManagementScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConsent, setSelectedConsent] = useState<ConsentWithApp | null>(null);
  const [revokeModalVisible, setRevokeModalVisible] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");

  const { data: consentsData, isLoading, refetch } = useQuery<{
    consents: ConsentWithApp[];
    stats: ConsentStats;
  }>({
    queryKey: ["/api/consents"],
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/consents/${id}/revoke`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consents"] });
      setRevokeModalVisible(false);
      setSelectedConsent(null);
      setRevokeReason("");
      Alert.alert("Success", "Consent has been revoked successfully.");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to revoke consent.");
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleRevokeConsent = (consent: ConsentWithApp) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedConsent(consent);
    setRevokeModalVisible(true);
  };

  const confirmRevoke = () => {
    if (selectedConsent) {
      revokeMutation.mutate({
        id: selectedConsent.id,
        reason: revokeReason || undefined,
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatScopes = (scopes: string[]) => {
    return scopes.map((scope) => {
      const parts = scope.split("/");
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return scope;
    }).join(", ");
  };

  const renderStatsCard = () => {
    const stats = consentsData?.stats;
    if (!stats) return null;

    return (
      <Card style={styles.statsCard}>
        <ThemedText type="h4" style={styles.statsTitle}>
          Consent Overview
        </ThemedText>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {stats.total}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Total
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: STATUS_COLORS.active }}>
              {stats.active}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Active
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: STATUS_COLORS.revoked }}>
              {stats.revoked}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Revoked
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: STATUS_COLORS.expired }}>
              {stats.expired}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Expired
            </ThemedText>
          </View>
        </View>
      </Card>
    );
  };

  const renderConsentCard = (consent: ConsentWithApp) => {
    const isActive = consent.status === "active";
    const statusColor = STATUS_COLORS[consent.status] || theme.textSecondary;
    const appName = consent.app?.name || "Unknown App";
    const consentTypeLabel = CONSENT_TYPE_LABELS[consent.consentType] || consent.consentType;

    return (
      <Card key={consent.id} style={styles.consentCard}>
        <View style={styles.consentHeader}>
          <View style={styles.consentIconContainer}>
            <View
              style={[
                styles.consentIcon,
                { backgroundColor: `${theme.primary}15` },
              ]}
            >
              <Feather
                name={consent.consentType === "emergency" ? "alert-circle" : "shield"}
                size={20}
                color={theme.primary}
              />
            </View>
          </View>
          <View style={styles.consentInfo}>
            <ThemedText type="h4">{appName}</ThemedText>
            <View style={styles.consentMeta}>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                <ThemedText type="small" style={{ color: statusColor }}>
                  {consent.status.toUpperCase()}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {consentTypeLabel}
              </ThemedText>
            </View>
          </View>
          {isActive ? (
            <Pressable
              onPress={() => handleRevokeConsent(consent)}
              style={({ pressed }) => [
                styles.revokeButton,
                { backgroundColor: `${theme.error}15`, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x-circle" size={16} color={theme.error} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.consentDetails}>
          <View style={styles.detailRow}>
            <Feather name="key" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
              Scopes: {formatScopes(consent.scope)}
            </ThemedText>
          </View>

          {consent.resourceTypes && consent.resourceTypes.length > 0 ? (
            <View style={styles.detailRow}>
              <Feather name="database" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                Resources: {consent.resourceTypes.join(", ")}
              </ThemedText>
            </View>
          ) : null}

          {consent.purpose ? (
            <View style={styles.detailRow}>
              <Feather name="info" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
                Purpose: {consent.purpose}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Granted: {formatDate(consent.grantedAt)}
            </ThemedText>
          </View>

          {consent.expiresAt ? (
            <View style={styles.detailRow}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Expires: {formatDate(consent.expiresAt)}
              </ThemedText>
            </View>
          ) : null}

          {consent.status === "revoked" && consent.revokedAt ? (
            <View style={styles.detailRow}>
              <Feather name="x" size={14} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error }}>
                Revoked: {formatDate(consent.revokedAt)}
                {consent.revocationReason ? ` - ${consent.revocationReason}` : ""}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  const renderRevokeModal = () => (
    <Modal
      visible={revokeModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setRevokeModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.modalTitle}>
            Revoke Consent
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            Are you sure you want to revoke access for "{selectedConsent?.app?.name || 'this app'}"?
            This will immediately prevent the app from accessing your health data.
          </ThemedText>

          <View style={styles.modalButtons}>
            <Pressable
              onPress={() => {
                setRevokeModalVisible(false);
                setSelectedConsent(null);
              }}
              style={[styles.modalButton, { backgroundColor: theme.border }]}
            >
              <ThemedText type="body">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={confirmRevoke}
              style={[styles.modalButton, { backgroundColor: theme.error }]}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText type="body" style={{ color: "#fff" }}>
                  Revoke Access
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading consents...
        </ThemedText>
      </View>
    );
  }

  const consents = consentsData?.consents || [];
  const activeConsents = consents.filter((c) => c.status === "active");
  const inactiveConsents = consents.filter((c) => c.status !== "active");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.headerSection}>
        <ThemedText type="h2">Data Access Permissions</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Manage which apps and services can access your health data
        </ThemedText>
      </View>

      {renderStatsCard()}

      {activeConsents.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Active Consents ({activeConsents.length})
          </ThemedText>
          {activeConsents.map(renderConsentCard)}
        </View>
      ) : null}

      {inactiveConsents.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Previous Consents ({inactiveConsents.length})
          </ThemedText>
          {inactiveConsents.map(renderConsentCard)}
        </View>
      ) : null}

      {consents.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="shield" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
            No Consents Yet
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
            When you grant access to third-party apps or share your data, your consents will appear here.
          </ThemedText>
        </Card>
      ) : null}

      <View style={styles.infoSection}>
        <View style={[styles.infoCard, { backgroundColor: `${theme.primary}10` }]}>
          <Feather name="info" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Your Rights Under HIPAA
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              You have the right to revoke any consent at any time. Revoking consent will immediately 
              prevent future access but may not affect data already shared.
            </ThemedText>
          </View>
        </View>
      </View>

      {renderRevokeModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    marginBottom: Spacing.xl,
  },
  statsCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  statsTitle: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  consentCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  consentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  consentIconContainer: {},
  consentIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  consentInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  consentMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  revokeButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  consentDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  infoSection: {
    marginTop: Spacing.lg,
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  modalTitle: {
    marginBottom: Spacing.md,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
