import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useHeaderHeight } from "@react-navigation/elements";
import { Colors, Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const theme = Colors.light;

interface FlagSummary {
  totalActive: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  lastScanAt: string | null;
  scanStatus: string;
}

interface DuplicateFlag {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  category: string;
  status: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
  critical: { color: "#DC2626", icon: "alert-octagon", label: "Critical" },
  high: { color: "#EA580C", icon: "alert-triangle", label: "High" },
  medium: { color: "#D97706", icon: "alert-circle", label: "Medium" },
  low: { color: "#2563EB", icon: "info", label: "Low" },
};

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; color: string }> = {
  clinical_data: { icon: "activity", label: "Clinical Data", color: "#059669" },
  subscription: { icon: "umbrella", label: "Coverage", color: "#7C3AED" },
  regulatory: { icon: "shield", label: "Regulatory", color: "#DC2626" },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  identical_vital_entries: "Identical Vitals",
  overlapping_medication_logs: "Overlapping Medications",
  duplicate_lab_results: "Duplicate Labs",
  redundant_ai_audit_findings: "Redundant AI Findings",
  double_entitlement: "Double Entitlement",
  multi_device_abuse: "Multi-Device Abuse",
  restoration_conflict: "Restore Conflict",
  mhmda_consent_gap: "MHMDA Consent Gap",
  ccpa_request_anomaly: "CCPA Request Anomaly",
  identity_document_expiry: "Document Expiry",
  identity_cross_reference_mismatch: "Identity Mismatch",
};

export default function DuplicateFlagsScreen() {
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedFlag, setSelectedFlag] = useState<DuplicateFlag | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<FlagSummary>({
    queryKey: ["/api/duplicate-flags/summary"],
  });

  const flagsPath = selectedFilter === "all"
    ? "/api/duplicate-flags/flags"
    : `/api/duplicate-flags/flags?category=${selectedFilter}`;
  const { data: flags, isLoading: flagsLoading, refetch: refetchFlags } = useQuery<DuplicateFlag[]>({
    queryKey: [flagsPath],
  });

  const invalidateAll = useCallback(() => {
    refetchSummary();
    refetchFlags();
  }, [refetchSummary, refetchFlags]);

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/duplicate-flags/scan"),
    onSuccess: invalidateAll,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      apiRequest("POST", `/api/duplicate-flags/${id}/resolve`, { resolution }),
    onSuccess: () => {
      setShowResolveModal(false);
      setSelectedFlag(null);
      setResolutionText("");
      invalidateAll();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest("POST", `/api/duplicate-flags/${id}/dismiss`, { reason }),
    onSuccess: () => {
      setShowResolveModal(false);
      setSelectedFlag(null);
      setResolutionText("");
      invalidateAll();
    },
  });

  const onRefresh = useCallback(() => {
    refetchSummary();
    refetchFlags();
  }, [refetchSummary, refetchFlags]);

  const openResolveModal = (flag: DuplicateFlag) => {
    setSelectedFlag(flag);
    setResolutionText("");
    setShowResolveModal(true);
  };

  if (summaryLoading) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.screenTitle}>Duplicate Flags</Text>
              <Text style={styles.screenSubtitle}>
                {summary?.lastScanAt
                  ? `Last scan: ${new Date(summary.lastScanAt).toLocaleString()}`
                  : "No scans yet"}
              </Text>
            </View>
            <Pressable
              testID="button-scan"
              style={[styles.scanButton, scanMutation.isPending ? styles.scanButtonDisabled : null]}
              onPress={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
            >
              {scanMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="search" size={16} color="#fff" />
              )}
              <Text style={styles.scanButtonText}>
                {scanMutation.isPending ? "Scanning..." : "Run Scan"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderLeftColor: "#DC2626" }]}>
            <Text style={styles.summaryNumber}>{summary?.bySeverity?.critical || 0}</Text>
            <Text style={styles.summaryLabel}>Critical</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#EA580C" }]}>
            <Text style={styles.summaryNumber}>{summary?.bySeverity?.high || 0}</Text>
            <Text style={styles.summaryLabel}>High</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#D97706" }]}>
            <Text style={styles.summaryNumber}>{summary?.bySeverity?.medium || 0}</Text>
            <Text style={styles.summaryLabel}>Medium</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: "#2563EB" }]}>
            <Text style={styles.summaryNumber}>{summary?.bySeverity?.low || 0}</Text>
            <Text style={styles.summaryLabel}>Low</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.categoryRow}>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <View key={key} style={styles.categoryBadge}>
              <Feather name={config.icon} size={14} color={config.color} />
              <Text style={[styles.categoryBadgeText, { color: config.color }]}>
                {config.label}: {summary?.byCategory?.[key] || 0}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {[
              { key: "all", label: "All Flags" },
              { key: "clinical_data", label: "Clinical" },
              { key: "subscription", label: "Coverage" },
              { key: "regulatory", label: "Regulatory" },
            ].map((filter) => (
              <Pressable
                key={filter.key}
                testID={`filter-${filter.key}`}
                style={[
                  styles.filterChip,
                  selectedFilter === filter.key ? styles.filterChipActive : null,
                ]}
                onPress={() => setSelectedFilter(filter.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFilter === filter.key ? styles.filterChipTextActive : null,
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {flagsLoading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing.xl }} />
        ) : (
          <Animated.View entering={FadeInDown.delay(400).duration(400)}>
            {!flags || flags.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="check-circle" size={48} color={theme.textSecondary} />
                <Text style={styles.emptyTitle}>No Active Flags</Text>
                <Text style={styles.emptySubtitle}>
                  Run a scan to check for duplicate entries, coverage anomalies, and regulatory gaps.
                </Text>
              </View>
            ) : (
              flags.map((flag, index) => {
                const severityConfig = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.low;
                const typeLabel = FLAG_TYPE_LABELS[flag.alertType] || flag.alertType;
                return (
                  <Animated.View
                    key={flag.id}
                    entering={FadeInDown.delay(index * 50).duration(300)}
                  >
                    <Pressable
                      testID={`flag-card-${flag.id}`}
                      style={[styles.flagCard, { borderLeftColor: severityConfig.color }]}
                      onPress={() => openResolveModal(flag)}
                    >
                      <View style={styles.flagHeader}>
                        <View style={styles.flagHeaderLeft}>
                          <Feather name={severityConfig.icon} size={18} color={severityConfig.color} />
                          <View style={[styles.severityBadge, { backgroundColor: severityConfig.color + "20" }]}>
                            <Text style={[styles.severityBadgeText, { color: severityConfig.color }]}>
                              {severityConfig.label}
                            </Text>
                          </View>
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, flag.status === "open" ? styles.statusOpen : styles.statusAck]}>
                          <Text style={styles.statusText}>{flag.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.flagTitle}>{flag.title}</Text>
                      <Text style={styles.flagDescription} numberOfLines={3}>
                        {flag.description}
                      </Text>
                      <View style={styles.flagFooter}>
                        <Text style={styles.flagDate}>
                          {new Date(flag.createdAt).toLocaleDateString()}
                        </Text>
                        <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal
        visible={showResolveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowResolveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedFlag?.title || "Flag Details"}
              </Text>
              <Pressable testID="button-close-modal" onPress={() => setShowResolveModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedFlag ? (
              <>
                <Text style={styles.modalDescription}>{selectedFlag.description}</Text>

                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalMetaLabel}>Severity:</Text>
                  <Text style={[styles.modalMetaValue, { color: SEVERITY_CONFIG[selectedFlag.severity]?.color || theme.text }]}>
                    {SEVERITY_CONFIG[selectedFlag.severity]?.label || selectedFlag.severity}
                  </Text>
                </View>
                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalMetaLabel}>Category:</Text>
                  <Text style={styles.modalMetaValue}>
                    {CATEGORY_CONFIG[selectedFlag.category]?.label || selectedFlag.category}
                  </Text>
                </View>
                <View style={styles.modalMetaRow}>
                  <Text style={styles.modalMetaLabel}>Type:</Text>
                  <Text style={styles.modalMetaValue}>
                    {FLAG_TYPE_LABELS[selectedFlag.alertType] || selectedFlag.alertType}
                  </Text>
                </View>

                <TextInput
                  testID="input-resolution"
                  style={styles.resolutionInput}
                  placeholder="Enter resolution notes or dismissal reason..."
                  placeholderTextColor={theme.textSecondary}
                  value={resolutionText}
                  onChangeText={setResolutionText}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.modalActions}>
                  <Pressable
                    testID="button-dismiss-flag"
                    style={[styles.actionButton, styles.dismissButton]}
                    onPress={() => {
                      if (resolutionText.trim() && selectedFlag) {
                        dismissMutation.mutate({ id: selectedFlag.id, reason: resolutionText.trim() });
                      }
                    }}
                    disabled={!resolutionText.trim() || dismissMutation.isPending}
                  >
                    <Feather name="x-circle" size={16} color="#DC2626" />
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </Pressable>
                  <Pressable
                    testID="button-resolve-flag"
                    style={[styles.actionButton, styles.resolveButton]}
                    onPress={() => {
                      if (resolutionText.trim() && selectedFlag) {
                        resolveMutation.mutate({ id: selectedFlag.id, resolution: resolutionText.trim() });
                      }
                    }}
                    disabled={!resolutionText.trim() || resolveMutation.isPending}
                  >
                    <Feather name="check-circle" size={16} color="#fff" />
                    <Text style={styles.resolveButtonText}>Resolve</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundDefault,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.text,
  },
  screenSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.text,
  },
  summaryLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  flagCard: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  flagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  flagHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  typeBadge: {
    backgroundColor: theme.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: "#FEF3C7",
  },
  statusAck: {
    backgroundColor: "#DBEAFE",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },
  flagTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 4,
  },
  flagDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  flagFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flagDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.backgroundDefault,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    flex: 1,
    marginRight: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalMetaRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  modalMetaLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
    width: 80,
  },
  modalMetaValue: {
    fontSize: 13,
    color: theme.textSecondary,
    flex: 1,
  },
  resolutionInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: theme.text,
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  dismissButton: {
    backgroundColor: "#FEE2E2",
  },
  dismissButtonText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 14,
  },
  resolveButton: {
    backgroundColor: "#059669",
  },
  resolveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
