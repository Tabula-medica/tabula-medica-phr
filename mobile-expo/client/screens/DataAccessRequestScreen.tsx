import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface DataAccessRequest {
  id: string;
  userId: string;
  requestType: string;
  description: string | null;
  dataCategories: string[] | null;
  status: string;
  dueDate: string;
  requestedAt: string;
  fulfilledAt: string | null;
  deniedReason: string | null;
  metadata: any;
}

interface DataAccessStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  averageFulfillmentDays: number;
}

interface ComplianceInfo {
  maxFulfillmentDays: number;
  regulation: string;
  effectiveDate: string;
  description: string;
}

interface DataAccessResponse {
  requests: DataAccessRequest[];
  stats: DataAccessStats;
  complianceInfo: ComplianceInfo;
}

const REQUEST_TYPES = [
  { id: "full_record", label: "Complete Health Record", icon: "file-text" as const, desc: "All medical records and health data" },
  { id: "lab_results", label: "Lab Results", icon: "activity" as const, desc: "Laboratory test results and reports" },
  { id: "medications", label: "Medication History", icon: "package" as const, desc: "Prescription and medication records" },
  { id: "imaging", label: "Imaging Reports", icon: "image" as const, desc: "X-rays, MRIs, CT scans, and imaging" },
  { id: "visit_notes", label: "Visit Notes", icon: "clipboard" as const, desc: "Doctor visit summaries and notes" },
  { id: "immunizations", label: "Immunization Records", icon: "shield" as const, desc: "Vaccination history and records" },
  { id: "billing", label: "Billing Records", icon: "credit-card" as const, desc: "Claims and billing statements" },
  { id: "fhir_export", label: "FHIR R4 Data Export", icon: "download" as const, desc: "Portable health data in FHIR format" },
];

export default function DataAccessRequestScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery<DataAccessResponse>({
    queryKey: ["/api/compliance/data-access-requests"],
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compliance/data-access-requests", {
        requestType: selectedType,
        description: description || undefined,
        dataCategories: selectedType ? [selectedType] : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/data-access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/2026-status"] });
      setShowNewRequestModal(false);
      setSelectedType(null);
      setDescription("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const getDaysRemaining = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string, dueDate: string) => {
    if (status === "completed") return theme.success;
    if (status === "denied") return theme.error;
    const daysLeft = getDaysRemaining(dueDate);
    if (daysLeft < 0) return theme.error;
    if (daysLeft <= 3) return theme.warning;
    return theme.info;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending Review",
      in_progress: "In Progress",
      completed: "Completed",
      denied: "Denied",
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string): keyof typeof Feather.glyphMap => {
    const icons: Record<string, keyof typeof Feather.glyphMap> = {
      pending: "clock",
      in_progress: "loader",
      completed: "check-circle",
      denied: "x-circle",
    };
    return icons[status] || "circle";
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading Data Access Requests...
        </ThemedText>
      </View>
    );
  }

  const stats = data?.stats;
  const requests = data?.requests || [];
  const complianceInfo = data?.complianceInfo;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: Spacing.xl * 3 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={[styles.regulationCard, { backgroundColor: `${theme.info}10`, borderColor: `${theme.info}30` }]}>
          <View style={styles.regulationHeader}>
            <View style={[styles.regulationIcon, { backgroundColor: `${theme.info}20` }]}>
              <Feather name="book-open" size={20} color={theme.info} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="body" style={{ color: theme.info, fontWeight: "600" }}>
                ONC HTI-1 Information Blocking
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {complianceInfo?.description || "15-day data access guarantee"}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.slaChip, { backgroundColor: `${theme.info}15` }]}>
            <Feather name="clock" size={12} color={theme.info} />
            <ThemedText type="small" style={{ color: theme.info, marginLeft: 4, fontWeight: "600" }}>
              Maximum {complianceInfo?.maxFulfillmentDays || 15} calendar days
            </ThemedText>
          </View>
        </Animated.View>

        {stats ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h3" style={{ color: theme.primary }}>{stats.total}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Total</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h3" style={{ color: theme.warning }}>{stats.pending + stats.inProgress}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Active</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h3" style={{ color: theme.success }}>{stats.completed}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Completed</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: stats.overdue > 0 ? theme.error : theme.border }]}>
              <ThemedText type="h3" style={{ color: stats.overdue > 0 ? theme.error : theme.success }}>{stats.overdue}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Overdue</ThemedText>
            </View>
          </Animated.View>
        ) : null}

        {stats && stats.averageFulfillmentDays > 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.avgCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Average Fulfillment Time</ThemedText>
            <View style={styles.avgValueRow}>
              <ThemedText type="h3" style={{ color: stats.averageFulfillmentDays <= 15 ? theme.success : theme.error }}>
                {stats.averageFulfillmentDays}
              </ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                days (SLA: 15 days)
              </ThemedText>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View style={[
                styles.progressFill,
                {
                  backgroundColor: stats.averageFulfillmentDays <= 15 ? theme.success : theme.error,
                  width: `${Math.min((stats.averageFulfillmentDays / 15) * 100, 100)}%`,
                }
              ]} />
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowNewRequestModal(true);
            }}
            style={[styles.newRequestButton, { backgroundColor: theme.primary }]}
            testID="button-new-data-request"
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
              New Data Access Request
            </ThemedText>
          </Pressable>
        </Animated.View>

        <ThemedText type="body" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm, fontWeight: "600" }}>
          Request History
        </ThemedText>

        {requests.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.emptyState, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="inbox" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              No data access requests yet
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
              Submit a request to access your health records within the 15-day compliance window
            </ThemedText>
          </Animated.View>
        ) : null}

        {requests.map((request, index) => {
          const daysLeft = getDaysRemaining(request.dueDate);
          const statusColor = getStatusColor(request.status, request.dueDate);
          const isExpanded = expandedRequestId === request.id;
          const typeInfo = REQUEST_TYPES.find(t => t.id === request.requestType);

          return (
            <Animated.View key={request.id} entering={FadeInDown.delay(350 + index * 60).duration(300)}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpandedRequestId(isExpanded ? null : request.id);
                }}
                style={[styles.requestCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                testID={`request-card-${request.id}`}
              >
                <View style={styles.requestHeader}>
                  <View style={[styles.requestTypeIcon, { backgroundColor: `${statusColor}15` }]}>
                    <Feather name={typeInfo?.icon || "file"} size={18} color={statusColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
                      {typeInfo?.label || request.requestType}
                    </ThemedText>
                    <View style={styles.requestMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
                        <Feather name={getStatusIcon(request.status)} size={10} color={statusColor} />
                        <ThemedText type="small" style={{ color: statusColor, marginLeft: 3, fontSize: 10, fontWeight: "600" }}>
                          {getStatusLabel(request.status)}
                        </ThemedText>
                      </View>
                      {request.status !== "completed" && request.status !== "denied" ? (
                        <View style={[styles.daysChip, { backgroundColor: daysLeft < 0 ? `${theme.error}15` : daysLeft <= 3 ? `${theme.warning}15` : `${theme.success}15` }]}>
                          <ThemedText type="small" style={{
                            color: daysLeft < 0 ? theme.error : daysLeft <= 3 ? theme.warning : theme.success,
                            fontSize: 10,
                            fontWeight: "600",
                          }}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
                </View>

                {isExpanded ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.requestDetails}>
                    <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
                    <View style={styles.detailRow}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Submitted</ThemedText>
                      <ThemedText type="small" style={{ color: theme.text }}>
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <View style={styles.detailRow}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Due Date</ThemedText>
                      <ThemedText type="small" style={{ color: daysLeft < 0 ? theme.error : theme.text, fontWeight: daysLeft < 0 ? "600" : "400" }}>
                        {new Date(request.dueDate).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    {request.fulfilledAt ? (
                      <View style={styles.detailRow}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>Fulfilled</ThemedText>
                        <ThemedText type="small" style={{ color: theme.success }}>
                          {new Date(request.fulfilledAt).toLocaleDateString()}
                        </ThemedText>
                      </View>
                    ) : null}
                    {request.description ? (
                      <View style={[styles.descriptionBox, { backgroundColor: `${theme.textSecondary}08` }]}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {request.description}
                        </ThemedText>
                      </View>
                    ) : null}
                    {request.deniedReason ? (
                      <View style={[styles.descriptionBox, { backgroundColor: `${theme.error}08` }]}>
                        <ThemedText type="small" style={{ color: theme.error }}>
                          Reason: {request.deniedReason}
                        </ThemedText>
                      </View>
                    ) : null}

                    {request.status !== "completed" && request.status !== "denied" ? (
                      <View style={styles.countdownSection}>
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>
                          Compliance Countdown
                        </ThemedText>
                        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
                          <View style={[
                            styles.progressFill,
                            {
                              backgroundColor: daysLeft < 0 ? theme.error : daysLeft <= 3 ? theme.warning : theme.success,
                              width: `${Math.max(0, Math.min(100, ((15 - Math.max(0, daysLeft)) / 15) * 100))}%`,
                            }
                          ]} />
                        </View>
                        <ThemedText type="small" style={{
                          color: daysLeft < 0 ? theme.error : theme.textSecondary,
                          marginTop: 4,
                          fontWeight: daysLeft < 0 ? "600" : "400",
                        }}>
                          {daysLeft < 0
                            ? `Overdue by ${Math.abs(daysLeft)} day(s) - Compliance violation`
                            : `${daysLeft} of 15 days remaining`}
                        </ThemedText>
                      </View>
                    ) : null}
                  </Animated.View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <Modal
        visible={showNewRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3" style={{ color: theme.text }}>
                Request Data Access
              </ThemedText>
              <Pressable onPress={() => setShowNewRequestModal(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Select the type of health data you would like to request. Per ONC HTI-1 regulations, your request will be fulfilled within 15 calendar days.
            </ThemedText>

            <ScrollView style={styles.typeList} showsVerticalScrollIndicator={false}>
              {REQUEST_TYPES.map(type => (
                <Pressable
                  key={type.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedType(type.id);
                  }}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: selectedType === type.id ? `${theme.primary}10` : theme.backgroundSecondary,
                      borderColor: selectedType === type.id ? theme.primary : "transparent",
                      borderWidth: selectedType === type.id ? 1.5 : 0,
                    }
                  ]}
                  testID={`request-type-${type.id}`}
                >
                  <View style={[styles.typeOptionIcon, { backgroundColor: selectedType === type.id ? `${theme.primary}20` : `${theme.textSecondary}10` }]}>
                    <Feather name={type.icon} size={18} color={selectedType === type.id ? theme.primary : theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ color: selectedType === type.id ? theme.primary : theme.text, fontWeight: selectedType === type.id ? "600" : "400" }}>
                      {type.label}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {type.desc}
                    </ThemedText>
                  </View>
                  {selectedType === type.id ? (
                    <Feather name="check-circle" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }}>
              Additional Details (optional)
            </ThemedText>
            <TextInput
              style={[styles.descInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Describe your request in more detail..."
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              testID="input-request-description"
            />

            <Pressable
              onPress={() => createRequestMutation.mutate()}
              disabled={!selectedType || createRequestMutation.isPending}
              style={[
                styles.submitButton,
                {
                  backgroundColor: selectedType ? theme.primary : `${theme.primary}40`,
                  opacity: createRequestMutation.isPending ? 0.7 : 1,
                }
              ]}
              testID="button-submit-request"
            >
              {createRequestMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
                    Submit Request
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  regulationCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  regulationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  regulationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  slaChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    alignItems: "center",
  },
  avgCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  avgValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: Spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.xs,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  newRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyState: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
  },
  requestCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  requestTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  requestMeta: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 4,
    flexWrap: "wrap",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  daysChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requestDetails: {
    marginTop: Spacing.sm,
  },
  detailDivider: {
    height: 1,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  descriptionBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  countdownSection: {
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeList: {
    maxHeight: 300,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  typeOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  descInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    minHeight: 80,
    fontSize: 14,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
});
