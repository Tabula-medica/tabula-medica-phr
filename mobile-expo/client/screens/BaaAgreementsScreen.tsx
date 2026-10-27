import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type BaaStatus = "draft" | "active" | "expired" | "terminated";

interface BaaAgreement {
  id: string;
  userId: string;
  partnerName: string;
  partnerEmail: string;
  partnerOrganization: string | null;
  status: BaaStatus;
  signedDate: string | null;
  expirationDate: string;
  documentPath: string | null;
  documentName: string | null;
  documentMimeType: string | null;
  documentSizeBytes: number | null;
  notes: string | null;
  reminderSent30Days: boolean;
  reminderSent14Days: boolean;
  reminderSent7Days: boolean;
  lastReminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BaaStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  draft: number;
}

const STATUS_CONFIG: Record<BaaStatus, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  draft: { label: "Draft", color: "#6B7280", icon: "edit-3" },
  active: { label: "Active", color: "#22C55E", icon: "check-circle" },
  expired: { label: "Expired", color: "#EF4444", icon: "alert-circle" },
  terminated: { label: "Terminated", color: "#F59E0B", icon: "x-circle" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not set";
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function daysUntilExpiration(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: keyof typeof Feather.glyphMap }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: color + "10", borderColor: color + "30" }]}>
      <Feather name={icon} size={18} color={color} />
      <ThemedText style={[styles.statValue, { color }]}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

function AgreementCard({
  agreement,
  onPress,
  onUpload,
  colors,
  isDark,
}: {
  agreement: BaaAgreement;
  onPress: () => void;
  onUpload: () => void;
  colors: any;
  isDark: boolean;
}) {
  const statusConfig = STATUS_CONFIG[agreement.status] || STATUS_CONFIG.draft;
  const daysLeft = daysUntilExpiration(agreement.expirationDate);
  const isExpiringSoon = agreement.status === "active" && daysLeft <= 30 && daysLeft > 0;
  const isExpired = daysLeft <= 0 && agreement.status === "active";

  return (
    <Pressable
      testID={`baa-card-${agreement.id}`}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundDefault,
          borderColor: isExpiringSoon ? "#F59E0B40" : isExpired ? "#EF444440" : colors.border,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`BAA agreement with ${agreement.partnerName}, status ${statusConfig.label}`}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.partnerName, { color: colors.text }]}>{agreement.partnerName}</ThemedText>
          {agreement.partnerOrganization ? (
            <ThemedText style={[styles.partnerOrg, { color: colors.textSecondary }]}>
              {agreement.partnerOrganization}
            </ThemedText>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + "18" }]}>
          <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
          <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</ThemedText>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <View style={styles.metaRow}>
          <Feather name="mail" size={13} color={colors.textSecondary} />
          <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>{agreement.partnerEmail}</ThemedText>
        </View>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={13} color={colors.textSecondary} />
          <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>
            Expires: {formatDate(agreement.expirationDate)}
          </ThemedText>
        </View>
        {isExpiringSoon ? (
          <View style={[styles.warningBanner, { backgroundColor: "#F59E0B10" }]}>
            <Feather name="alert-triangle" size={13} color="#F59E0B" />
            <ThemedText style={[styles.warningText, { color: "#F59E0B" }]}>
              Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
            </ThemedText>
          </View>
        ) : null}
        {isExpired ? (
          <View style={[styles.warningBanner, { backgroundColor: "#EF444410" }]}>
            <Feather name="alert-circle" size={13} color="#EF4444" />
            <ThemedText style={[styles.warningText, { color: "#EF4444" }]}>Agreement has expired</ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        {agreement.documentName ? (
          <View style={styles.docBadge}>
            <Feather name="file-text" size={12} color={colors.primary} />
            <ThemedText style={[styles.docName, { color: colors.primary }]} numberOfLines={1}>
              {agreement.documentName}
            </ThemedText>
            <ThemedText style={[styles.docSize, { color: colors.textSecondary }]}>
              {formatFileSize(agreement.documentSizeBytes)}
            </ThemedText>
          </View>
        ) : (
          <Pressable
            testID={`baa-upload-${agreement.id}`}
            style={[styles.uploadBtn, { borderColor: colors.primary + "40" }]}
            onPress={onUpload}
            accessibilityRole="button"
            accessibilityLabel="Upload BAA document"
          >
            <Feather name="upload" size={13} color={colors.primary} />
            <ThemedText style={[styles.uploadText, { color: colors.primary }]}>Upload Document</ThemedText>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function BaaAgreementsScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<BaaAgreement | null>(null);
  const [filterStatus, setFilterStatus] = useState<BaaStatus | "all">("all");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formOrg, setFormOrg] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<BaaStatus>("draft");
  const [formExpirationMonths, setFormExpirationMonths] = useState("12");

  const { data: agreements = [], isLoading, isError, refetch } = useQuery<BaaAgreement[]>({
    queryKey: ["/api/baa-agreements"],
  });

  const { data: stats } = useQuery<BaaStats>({
    queryKey: ["/api/baa-agreements/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/baa-agreements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements/stats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PUT", `/api/baa-agreements/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements/stats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/baa-agreements/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements/stats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDetailModal(false);
      setSelectedAgreement(null);
    },
  });

  const resetForm = useCallback(() => {
    setFormName("");
    setFormEmail("");
    setFormOrg("");
    setFormNotes("");
    setFormStatus("draft");
    setFormExpirationMonths("12");
  }, []);

  const handleCreate = useCallback(() => {
    if (!formName.trim() || !formEmail.trim()) return;
    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + parseInt(formExpirationMonths) || 12);
    createMutation.mutate({
      partnerName: formName.trim(),
      partnerEmail: formEmail.trim(),
      partnerOrganization: formOrg.trim() || undefined,
      notes: formNotes.trim() || undefined,
      status: formStatus,
      signedDate: formStatus === "active" ? new Date().toISOString() : null,
      expirationDate: expDate.toISOString(),
    });
  }, [formName, formEmail, formOrg, formNotes, formStatus, formExpirationMonths, createMutation]);

  const handleUploadDocument = useCallback(
    async (agreementId: string) => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/jpeg", "image/png"],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        const formData = new FormData();
        if (Platform.OS === "web") {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          formData.append("document", blob, asset.name);
        } else {
          const file = new File(asset.uri);
          formData.append("document", file as any);
        }
        const url = new URL(`/api/baa-agreements/${agreementId}/upload`, getApiUrl());
        await fetch(url.toString(), { method: "POST", body: formData, credentials: "include" });
        queryClient.invalidateQueries({ queryKey: ["/api/baa-agreements"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    },
    [queryClient]
  );

  const filteredAgreements = useMemo(() => {
    if (filterStatus === "all") return agreements;
    return agreements.filter((a) => a.status === filterStatus);
  }, [agreements, filterStatus]);

  const openDetail = useCallback((agreement: BaaAgreement) => {
    setSelectedAgreement(agreement);
    setShowDetailModal(true);
  }, []);

  const renderAgreement = useCallback(
    ({ item }: { item: BaaAgreement }) => (
      <AgreementCard
        agreement={item}
        onPress={() => openDetail(item)}
        onUpload={() => handleUploadDocument(item.id)}
        colors={colors}
        isDark={isDark}
      />
    ),
    [colors, isDark, openDetail, handleUploadDocument]
  );

  const statusFilters: { key: BaaStatus | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "draft", label: "Draft" },
    { key: "expired", label: "Expired" },
    { key: "terminated", label: "Ended" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDefault }]}>
      <FlatList
        data={filteredAgreements}
        keyExtractor={(item) => item.id}
        renderItem={renderAgreement}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl + 80 },
        ]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {stats ? (
              <View style={styles.statsRow}>
                <StatCard label="Total" value={stats.total} color={colors.primary} icon="file-text" />
                <StatCard label="Active" value={stats.active} color="#22C55E" icon="check-circle" />
                <StatCard label="Expiring" value={stats.expiringSoon} color="#F59E0B" icon="alert-triangle" />
                <StatCard label="Expired" value={stats.expired} color="#EF4444" icon="alert-circle" />
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterContent}
            >
              {statusFilters.map((f) => (
                <Pressable
                  key={f.key}
                  testID={`baa-filter-${f.key}`}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filterStatus === f.key ? colors.primary : isDark ? "rgba(255,255,255,0.06)" : colors.backgroundSecondary,
                      borderColor: filterStatus === f.key ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setFilterStatus(f.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${f.label}`}
                >
                  <ThemedText
                    style={[styles.filterText, { color: filterStatus === f.key ? "#FFF" : colors.text }]}
                  >
                    {f.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading agreements...
                </ThemedText>
              </View>
            ) : null}

            {isError ? (
              <View style={styles.centered}>
                <Feather name="alert-circle" size={40} color={colors.error} />
                <ThemedText style={[styles.errorTitle, { color: colors.text }]}>Failed to load</ThemedText>
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => refetch()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading"
                >
                  <Feather name="refresh-cw" size={14} color="#FFF" />
                  <ThemedText style={styles.retryText}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !isLoading && !isError ? (
            <View style={styles.centered}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "10" }]}>
                <Feather name="file-text" size={32} color={colors.primary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No BAA Agreements</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Track your Business Associate Agreements to maintain HIPAA compliance
              </ThemedText>
            </View>
          ) : null
        }
      />

      <Pressable
        testID="baa-add-btn"
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + Spacing.lg }]}
        onPress={() => {
          resetForm();
          setShowCreateModal(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="Add new BAA agreement"
      >
        <Feather name="plus" size={24} color="#FFF" />
      </Pressable>

      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>New BAA Agreement</ThemedText>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <KeyboardAwareScrollViewCompat style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Partner Name *</ThemedText>
              <TextInput
                testID="baa-form-name"
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary }]}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g., Acme Health Systems"
                placeholderTextColor={colors.textSecondary + "80"}
                accessibilityLabel="Partner name"
              />

              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Partner Email *</ThemedText>
              <TextInput
                testID="baa-form-email"
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary }]}
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="compliance@partner.com"
                placeholderTextColor={colors.textSecondary + "80"}
                keyboardType="email-address"
                autoCapitalize="none"
                accessibilityLabel="Partner email"
              />

              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Organization</ThemedText>
              <TextInput
                testID="baa-form-org"
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary }]}
                value={formOrg}
                onChangeText={setFormOrg}
                placeholder="Organization name (optional)"
                placeholderTextColor={colors.textSecondary + "80"}
                accessibilityLabel="Organization name"
              />

              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Agreement Duration</ThemedText>
              <View style={styles.durationRow}>
                {["6", "12", "24", "36"].map((m) => (
                  <Pressable
                    key={m}
                    style={[
                      styles.durationChip,
                      {
                        backgroundColor: formExpirationMonths === m ? colors.primary : isDark ? "rgba(255,255,255,0.06)" : colors.backgroundSecondary,
                        borderColor: formExpirationMonths === m ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setFormExpirationMonths(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`${m} months duration`}
                  >
                    <ThemedText
                      style={[styles.durationText, { color: formExpirationMonths === m ? "#FFF" : colors.text }]}
                    >
                      {m}mo
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</ThemedText>
              <View style={styles.durationRow}>
                {(["draft", "active"] as BaaStatus[]).map((s) => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <Pressable
                      key={s}
                      style={[
                        styles.durationChip,
                        {
                          backgroundColor: formStatus === s ? cfg.color + "20" : isDark ? "rgba(255,255,255,0.06)" : colors.backgroundSecondary,
                          borderColor: formStatus === s ? cfg.color : colors.border,
                        },
                      ]}
                      onPress={() => setFormStatus(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`Set status to ${cfg.label}`}
                    >
                      <Feather name={cfg.icon} size={12} color={formStatus === s ? cfg.color : colors.textSecondary} />
                      <ThemedText
                        style={[styles.durationText, { color: formStatus === s ? cfg.color : colors.text }]}
                      >
                        {cfg.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</ThemedText>
              <TextInput
                testID="baa-form-notes"
                style={[styles.input, styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.backgroundSecondary }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Optional notes about this agreement..."
                placeholderTextColor={colors.textSecondary + "80"}
                multiline
                numberOfLines={3}
                accessibilityLabel="Agreement notes"
              />

              <Pressable
                testID="baa-form-submit"
                style={[
                  styles.submitBtn,
                  { backgroundColor: formName.trim() && formEmail.trim() ? colors.primary : colors.primary + "40" },
                ]}
                onPress={handleCreate}
                disabled={!formName.trim() || !formEmail.trim() || createMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Create BAA agreement"
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="plus" size={16} color="#FFF" />
                    <ThemedText style={styles.submitText}>Create Agreement</ThemedText>
                  </>
                )}
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>

      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundDefault }]}>
            {selectedAgreement ? (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                    {selectedAgreement.partnerName}
                  </ThemedText>
                  <Pressable
                    onPress={() => setShowDetailModal(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Feather name="x" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
                  <View style={[styles.detailSection, { borderColor: colors.border }]}>
                    <DetailRow icon="user" label="Partner" value={selectedAgreement.partnerName} colors={colors} />
                    <DetailRow icon="mail" label="Email" value={selectedAgreement.partnerEmail} colors={colors} />
                    {selectedAgreement.partnerOrganization ? (
                      <DetailRow icon="briefcase" label="Organization" value={selectedAgreement.partnerOrganization} colors={colors} />
                    ) : null}
                    <DetailRow
                      icon="check-circle"
                      label="Status"
                      value={STATUS_CONFIG[selectedAgreement.status]?.label || selectedAgreement.status}
                      colors={colors}
                      valueColor={STATUS_CONFIG[selectedAgreement.status]?.color}
                    />
                    <DetailRow icon="calendar" label="Signed" value={formatDate(selectedAgreement.signedDate)} colors={colors} />
                    <DetailRow icon="clock" label="Expires" value={formatDate(selectedAgreement.expirationDate)} colors={colors} />
                    {selectedAgreement.documentName ? (
                      <DetailRow icon="file-text" label="Document" value={selectedAgreement.documentName} colors={colors} />
                    ) : null}
                    {selectedAgreement.notes ? (
                      <DetailRow icon="edit-3" label="Notes" value={selectedAgreement.notes} colors={colors} />
                    ) : null}
                  </View>

                  <View style={[styles.detailSection, { borderColor: colors.border }]}>
                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Reminder Status</ThemedText>
                    <ReminderRow label="30-day reminder" sent={selectedAgreement.reminderSent30Days} colors={colors} />
                    <ReminderRow label="14-day reminder" sent={selectedAgreement.reminderSent14Days} colors={colors} />
                    <ReminderRow label="7-day reminder" sent={selectedAgreement.reminderSent7Days} colors={colors} />
                    {selectedAgreement.lastReminderSentAt ? (
                      <ThemedText style={[styles.lastReminder, { color: colors.textSecondary }]}>
                        Last reminder: {formatDate(selectedAgreement.lastReminderSentAt)}
                      </ThemedText>
                    ) : null}
                  </View>

                  <View style={styles.detailActions}>
                    {selectedAgreement.status === "draft" ? (
                      <Pressable
                        testID="baa-activate-btn"
                        style={[styles.actionBtn, { backgroundColor: "#22C55E" }]}
                        onPress={() => {
                          updateMutation.mutate({
                            id: selectedAgreement.id,
                            updates: { status: "active", signedDate: new Date().toISOString() },
                          });
                          setShowDetailModal(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Activate agreement"
                      >
                        <Feather name="check-circle" size={16} color="#FFF" />
                        <ThemedText style={styles.actionBtnText}>Activate</ThemedText>
                      </Pressable>
                    ) : null}
                    {selectedAgreement.status === "active" ? (
                      <Pressable
                        testID="baa-terminate-btn"
                        style={[styles.actionBtn, { backgroundColor: "#F59E0B" }]}
                        onPress={() => {
                          updateMutation.mutate({
                            id: selectedAgreement.id,
                            updates: { status: "terminated" },
                          });
                          setShowDetailModal(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Terminate agreement"
                      >
                        <Feather name="x-circle" size={16} color="#FFF" />
                        <ThemedText style={styles.actionBtnText}>Terminate</ThemedText>
                      </Pressable>
                    ) : null}
                    {!selectedAgreement.documentName ? (
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          setShowDetailModal(false);
                          handleUploadDocument(selectedAgreement.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Upload document"
                      >
                        <Feather name="upload" size={16} color="#FFF" />
                        <ThemedText style={styles.actionBtnText}>Upload</ThemedText>
                      </Pressable>
                    ) : null}
                    <Pressable
                      testID="baa-delete-btn"
                      style={[styles.actionBtn, { backgroundColor: "#EF4444" }]}
                      onPress={() => deleteMutation.mutate(selectedAgreement.id)}
                      disabled={deleteMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Delete agreement"
                    >
                      <Feather name="trash-2" size={16} color="#FFF" />
                      <ThemedText style={styles.actionBtnText}>Delete</ThemedText>
                    </Pressable>
                  </View>
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
  valueColor,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  colors: any;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
        <ThemedText style={[styles.detailValue, { color: valueColor || colors.text }]}>{value}</ThemedText>
      </View>
    </View>
  );
}

function ReminderRow({ label, sent, colors }: { label: string; sent: boolean; colors: any }) {
  return (
    <View style={styles.reminderRow}>
      <Feather name={sent ? "check-circle" : "circle"} size={14} color={sent ? "#22C55E" : colors.textSecondary} />
      <ThemedText style={[styles.reminderLabel, { color: sent ? colors.text : colors.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.reminderStatus, { color: sent ? "#22C55E" : colors.textSecondary }]}>
        {sent ? "Sent" : "Pending"}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterContent: {
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  centered: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  retryText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: "700",
  },
  partnerOrg: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardMeta: {
    gap: 4,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  warningText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
    paddingTop: Spacing.sm,
  },
  docBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  docName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  docSize: {
    fontSize: 11,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.sm,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "85%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  modalBody: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  durationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  durationText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  submitText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  detailSection: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 6,
  },
  reminderLabel: {
    fontSize: 13,
    flex: 1,
  },
  reminderStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  lastReminder: {
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
  },
  detailActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    flex: 1,
    minWidth: 100,
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
