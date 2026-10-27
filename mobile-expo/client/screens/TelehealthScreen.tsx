import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface TelehealthVisit {
  id: string;
  patientId: string;
  title: string;
  reason: string | null;
  visitType: string;
  status: string;
  scheduledAt: string;
  duration: number;
  chiefComplaint: string | null;
  providerName: string | null;
  providerSpecialty: string | null;
  rating: number | null;
  feedback: string | null;
  aiSummary: string | null;
  soapNotes: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  } | null;
  followUpInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

type FilterTab = "upcoming" | "past";

const VISIT_TYPES = [
  { value: "initial_consultation", label: "Initial Consultation" },
  { value: "follow_up", label: "Follow Up" },
  { value: "urgent_care", label: "Urgent Care" },
  { value: "mental_health", label: "Mental Health" },
  { value: "specialist_referral", label: "Specialist Referral" },
  { value: "medication_review", label: "Medication Review" },
  { value: "lab_review", label: "Lab Review" },
  { value: "chronic_care", label: "Chronic Care" },
  { value: "preventive", label: "Preventive" },
  { value: "second_opinion", label: "Second Opinion" },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#3B82F6",
  confirmed: "#10B981",
  waiting_room: "#F59E0B",
  in_progress: "#8B5CF6",
  completed: "#6B7280",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  waiting_room: "Waiting Room",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatVisitType(type: string): string {
  const found = VISIT_TYPES.find((v) => v.value === type);
  return found ? found.label : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TelehealthScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterTab>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<TelehealthVisit | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelVisitId, setCancelVisitId] = useState<string | null>(null);
  const [ratingVisitId, setRatingVisitId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [showRatingModal, setShowRatingModal] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    providerName: "",
    providerSpecialty: "",
    visitType: "follow_up",
    scheduledDate: "",
    scheduledTime: "",
    reason: "",
    chiefComplaint: "",
    duration: 30,
  });
  const [showVisitTypePicker, setShowVisitTypePicker] = useState(false);

  const { data: visits = [], isLoading, refetch } = useQuery<TelehealthVisit[]>({
    queryKey: [`/api/telehealth/visits?filter=${filter}`],
  });

  const scheduleVisitMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(
        `${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime || "09:00"}`
      ).toISOString();
      const url = new URL("/api/telehealth/visits", getApiUrl());
      return apiRequest("POST", url.toString(), {
        title: `${formatVisitType(scheduleForm.visitType)} with ${scheduleForm.providerName || "Provider"}`,
        reason: scheduleForm.reason,
        visitType: scheduleForm.visitType,
        scheduledAt,
        duration: scheduleForm.duration,
        chiefComplaint: scheduleForm.chiefComplaint,
        providerName: scheduleForm.providerName,
        providerSpecialty: scheduleForm.providerSpecialty,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits?filter=upcoming`] });
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits?filter=past`] });
      setShowScheduleModal(false);
      setScheduleForm({
        providerName: "",
        providerSpecialty: "",
        visitType: "follow_up",
        scheduledDate: "",
        scheduledTime: "",
        reason: "",
        chiefComplaint: "",
        duration: 30,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const cancelVisitMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const url = new URL(`/api/telehealth/visits/${id}/cancel`, getApiUrl());
      return apiRequest("POST", url.toString(), { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits?filter=upcoming`] });
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits?filter=past`] });
      setShowCancelModal(false);
      setCancelReason("");
      setCancelVisitId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const rateVisitMutation = useMutation({
    mutationFn: async ({ id, rating, feedback }: { id: string; rating: number; feedback: string }) => {
      const url = new URL(`/api/telehealth/visits/${id}/rate`, getApiUrl());
      return apiRequest("POST", url.toString(), { rating, feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits?filter=past`] });
      setShowRatingModal(false);
      setRatingValue(0);
      setRatingFeedback("");
      setRatingVisitId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const aiSummaryMutation = useMutation({
    mutationFn: async (id: string) => {
      const url = new URL(`/api/telehealth/visits/${id}/ai-summary`, getApiUrl());
      const res = await apiRequest("POST", url.toString(), {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits?filter=past`] });
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleJoinVisit = useCallback((visit: TelehealthVisit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("VideoConsultation", { visitId: visit.id });
  }, [navigation]);

  const handleOpenDetail = useCallback((visit: TelehealthVisit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedVisit(visit);
    setShowDetailModal(true);
  }, []);

  const handleCancelVisit = useCallback((visitId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCancelVisitId(visitId);
    setShowCancelModal(true);
  }, []);

  const handleOpenRating = useCallback((visitId: string, currentRating?: number | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRatingVisitId(visitId);
    setRatingValue(currentRating || 0);
    setShowRatingModal(true);
  }, []);

  const isJoinable = (status: string) =>
    status === "scheduled" || status === "confirmed" || status === "waiting_room" || status === "in_progress";

  const renderStars = (rating: number, interactive: boolean = false, onRate?: (r: number) => void) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            testID={`star-${star}`}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
            accessibilityState={{ selected: star <= rating }}
            onPress={() => {
              if (interactive && onRate) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onRate(star);
              }
            }}
            disabled={!interactive}
          >
            <Feather
              name="star"
              size={interactive ? 28 : 16}
              color={star <= rating ? "#F59E0B" : theme.border}
              style={{ marginRight: 2 }}
            />
          </Pressable>
        ))}
      </View>
    );
  };

  const renderVisitCard = (visit: TelehealthVisit, index: number) => {
    const statusColor = STATUS_COLORS[visit.status] || theme.textSecondary;
    const isPast = filter === "past";

    return (
      <Animated.View
        key={visit.id}
        entering={FadeInDown.delay(index * 60).duration(400)}
      >
        <Pressable
          testID={`visit-card-${visit.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${visit.providerName || "Provider"} visit, ${formatVisitType(visit.visitType)}, ${STATUS_LABELS[visit.status] || visit.status}, ${formatDateTime(visit.scheduledAt)}`}
          style={[styles.visitCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={() => {
            if (isPast) {
              handleOpenDetail(visit);
            }
          }}
        >
          <View style={styles.visitCardHeader}>
            <View style={styles.visitCardHeaderLeft}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="user" size={20} color={theme.primary} />
              </View>
              <View style={styles.providerInfo}>
                <ThemedText type="h4" numberOfLines={1}>
                  {visit.providerName || "Provider"}
                </ThemedText>
                {visit.providerSpecialty ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {visit.providerSpecialty}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
              <ThemedText type="caption" style={{ color: statusColor, fontWeight: "600" }}>
                {STATUS_LABELS[visit.status] || visit.status}
              </ThemedText>
            </View>
          </View>

          <View style={styles.visitCardBody}>
            <View style={styles.visitInfoRow}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {formatDateTime(visit.scheduledAt)}
              </ThemedText>
            </View>
            <View style={styles.visitInfoRow}>
              <Feather name="video" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                {formatVisitType(visit.visitType)}
              </ThemedText>
            </View>
            {visit.chiefComplaint ? (
              <View style={styles.visitInfoRow}>
                <Feather name="file-text" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }} numberOfLines={1}>
                  {visit.chiefComplaint}
                </ThemedText>
              </View>
            ) : null}
            {!isPast ? (
              <Pressable
                style={styles.reminderIndicator}
                accessibilityRole="button"
                accessibilityLabel="Reminders active, go to reminder settings"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("ReminderSettings");
                }}
              >
                <Feather name="bell" size={12} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, marginLeft: 4 }}>
                  Reminders Active
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {isPast ? (
            <View style={styles.visitCardFooter}>
              <View style={styles.footerLeft}>
                {visit.rating ? (
                  renderStars(visit.rating)
                ) : (
                  <Pressable
                    testID={`rate-visit-${visit.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Rate this visit"
                    onPress={() => handleOpenRating(visit.id)}
                    style={[styles.smallButton, { borderColor: theme.primary }]}
                  >
                    <Feather name="star" size={14} color={theme.primary} />
                    <ThemedText type="caption" style={{ color: theme.primary, marginLeft: 4 }}>
                      Rate Visit
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              {visit.aiSummary ? (
                <View style={[styles.aiPreview, { backgroundColor: theme.info + "10" }]}>
                  <Feather name="cpu" size={12} color={theme.info} />
                  <ThemedText type="caption" style={{ color: theme.info, marginLeft: 4 }} numberOfLines={1}>
                    AI Summary Available
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.visitCardFooter}>
              {isJoinable(visit.status) ? (
                <Pressable
                  testID={`join-visit-${visit.id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Join video visit"
                  style={[styles.joinButton, { backgroundColor: theme.primary }]}
                  onPress={() => handleJoinVisit(visit)}
                >
                  <Feather name="video" size={16} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.xs }}>
                    Join
                  </ThemedText>
                </Pressable>
              ) : null}
              {visit.status !== "cancelled" ? (
                <Pressable
                  testID={`cancel-visit-${visit.id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel visit"
                  onPress={() => handleCancelVisit(visit.id)}
                  style={[styles.smallButton, { borderColor: theme.error }]}
                >
                  <Feather name="x" size={14} color={theme.error} />
                  <ThemedText type="caption" style={{ color: theme.error, marginLeft: 4 }}>
                    Cancel
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather
        name={filter === "upcoming" ? "calendar" : "clock"}
        size={48}
        color={theme.textSecondary}
      />
      <ThemedText type="h4" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: "center" }}>
        {filter === "upcoming" ? "No Upcoming Visits" : "No Past Visits"}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
        {filter === "upcoming"
          ? "Schedule a telehealth visit to get started."
          : "Your completed visits will appear here."}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl + 80,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.topActionRow}>
          <View style={[styles.tabBar, { backgroundColor: theme.backgroundSecondary, flex: 1 }]}>
            <Pressable
              testID="tab-upcoming"
              accessibilityRole="tab"
              accessibilityLabel="Upcoming visits"
              accessibilityState={{ selected: filter === "upcoming" }}
              style={[
                styles.tab,
                filter === "upcoming" ? { backgroundColor: theme.primary } : null,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter("upcoming");
              }}
            >
              <ThemedText
                type="small"
                style={{
                  color: filter === "upcoming" ? "#FFFFFF" : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                Upcoming
              </ThemedText>
            </Pressable>
            <Pressable
              testID="tab-past"
              accessibilityRole="tab"
              accessibilityLabel="Past visits"
              accessibilityState={{ selected: filter === "past" }}
              style={[
                styles.tab,
                filter === "past" ? { backgroundColor: theme.primary } : null,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFilter("past");
              }}
            >
              <ThemedText
                type="small"
                style={{
                  color: filter === "past" ? "#FFFFFF" : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                Past
              </ThemedText>
            </Pressable>
          </View>
          <Pressable
            testID="button-reminder-settings"
            accessibilityRole="button"
            accessibilityLabel="Reminder settings"
            style={[styles.reminderButton, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("ReminderSettings");
            }}
          >
            <Feather name="bell" size={18} color={theme.primary} />
          </Pressable>
        </View>

        {visits.length > 0
          ? visits.map((visit, index) => renderVisitCard(visit, index))
          : renderEmptyState()}
      </ScrollView>

      <Pressable
        testID="button-schedule-visit"
        accessibilityRole="button"
        accessibilityLabel="Schedule new visit"
        style={[styles.fab, { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.xl }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowScheduleModal(true);
        }}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={showScheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable
              testID="button-close-schedule"
              accessibilityRole="button"
              accessibilityLabel="Close schedule modal"
              onPress={() => setShowScheduleModal(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Schedule Visit</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Provider Name
            </ThemedText>
            <TextInput
              testID="input-provider-name"
              accessibilityLabel="Provider name"
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Dr. Smith"
              placeholderTextColor={theme.textSecondary}
              value={scheduleForm.providerName}
              onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, providerName: text }))}
            />

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Provider Specialty
            </ThemedText>
            <TextInput
              testID="input-provider-specialty"
              accessibilityLabel="Provider specialty"
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Family Medicine"
              placeholderTextColor={theme.textSecondary}
              value={scheduleForm.providerSpecialty}
              onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, providerSpecialty: text }))}
            />

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Visit Type
            </ThemedText>
            <Pressable
              testID="button-visit-type-picker"
              accessibilityRole="button"
              accessibilityLabel={`Visit type: ${formatVisitType(scheduleForm.visitType)}`}
              accessibilityState={{ expanded: showVisitTypePicker }}
              style={[styles.input, styles.pickerButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
              onPress={() => setShowVisitTypePicker(!showVisitTypePicker)}
            >
              <ThemedText type="small">{formatVisitType(scheduleForm.visitType)}</ThemedText>
              <Feather name="chevron-down" size={16} color={theme.textSecondary} />
            </Pressable>
            {showVisitTypePicker ? (
              <View style={[styles.pickerDropdown, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                {VISIT_TYPES.map((vt) => (
                  <Pressable
                    key={vt.value}
                    testID={`visit-type-option-${vt.value}`}
                    accessibilityRole="radio"
                    accessibilityLabel={vt.label}
                    accessibilityState={{ selected: scheduleForm.visitType === vt.value }}
                    style={[
                      styles.pickerOption,
                      scheduleForm.visitType === vt.value ? { backgroundColor: theme.primary + "15" } : null,
                    ]}
                    onPress={() => {
                      setScheduleForm((prev) => ({ ...prev, visitType: vt.value }));
                      setShowVisitTypePicker(false);
                    }}
                  >
                    <ThemedText
                      type="small"
                      style={scheduleForm.visitType === vt.value ? { color: theme.primary, fontWeight: "600" } : undefined}
                    >
                      {vt.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Date (YYYY-MM-DD)
            </ThemedText>
            <TextInput
              testID="input-schedule-date"
              accessibilityLabel="Schedule date"
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="2026-02-15"
              placeholderTextColor={theme.textSecondary}
              value={scheduleForm.scheduledDate}
              onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, scheduledDate: text }))}
            />

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Time (HH:MM)
            </ThemedText>
            <TextInput
              testID="input-schedule-time"
              accessibilityLabel="Schedule time"
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="14:00"
              placeholderTextColor={theme.textSecondary}
              value={scheduleForm.scheduledTime}
              onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, scheduledTime: text }))}
            />

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Reason for Visit
            </ThemedText>
            <TextInput
              testID="input-visit-reason"
              accessibilityLabel="Reason for visit"
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Describe the reason for your visit"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              value={scheduleForm.reason}
              onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, reason: text }))}
            />

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
              Chief Complaint
            </ThemedText>
            <TextInput
              testID="input-chief-complaint"
              accessibilityLabel="Chief complaint"
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Describe your primary symptoms or concerns"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              value={scheduleForm.chiefComplaint}
              onChangeText={(text) => setScheduleForm((prev) => ({ ...prev, chiefComplaint: text }))}
            />

            <Pressable
              testID="button-submit-schedule"
              accessibilityRole="button"
              accessibilityLabel="Schedule visit"
              accessibilityState={{ disabled: scheduleVisitMutation.isPending || !scheduleForm.scheduledDate }}
              style={[
                styles.submitButton,
                { backgroundColor: theme.primary },
                scheduleVisitMutation.isPending ? { opacity: 0.6 } : null,
              ]}
              onPress={() => scheduleVisitMutation.mutate()}
              disabled={scheduleVisitMutation.isPending || !scheduleForm.scheduledDate}
            >
              {scheduleVisitMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="calendar" size={18} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>
                    Schedule Visit
                  </ThemedText>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable
              testID="button-close-detail"
              accessibilityRole="button"
              accessibilityLabel="Close visit details"
              onPress={() => setShowDetailModal(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Visit Details</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          {selectedVisit ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={[styles.detailSection, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={styles.detailRow}>
                  <Feather name="user" size={16} color={theme.primary} />
                  <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
                    <ThemedText type="h4">{selectedVisit.providerName || "Provider"}</ThemedText>
                    {selectedVisit.providerSpecialty ? (
                      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                        {selectedVisit.providerSpecialty}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                  <Feather name="calendar" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                    {formatDateTime(selectedVisit.scheduledAt)}
                  </ThemedText>
                </View>
                <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                  <Feather name="video" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                    {formatVisitType(selectedVisit.visitType)}
                  </ThemedText>
                </View>
                <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selectedVisit.status] || theme.textSecondary) + "20" }]}>
                    <ThemedText type="caption" style={{ color: STATUS_COLORS[selectedVisit.status] || theme.textSecondary, fontWeight: "600" }}>
                      {STATUS_LABELS[selectedVisit.status] || selectedVisit.status}
                    </ThemedText>
                  </View>
                </View>
              </View>

              {selectedVisit.rating ? (
                <View style={[styles.detailSection, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Rating</ThemedText>
                  {renderStars(selectedVisit.rating)}
                  {selectedVisit.feedback ? (
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                      {selectedVisit.feedback}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}

              {selectedVisit.soapNotes ? (
                <View style={[styles.detailSection, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>SOAP Notes</ThemedText>
                  {selectedVisit.soapNotes.subjective ? (
                    <View style={styles.soapEntry}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: theme.primary }}>Subjective</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                        {selectedVisit.soapNotes.subjective}
                      </ThemedText>
                    </View>
                  ) : null}
                  {selectedVisit.soapNotes.objective ? (
                    <View style={styles.soapEntry}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: theme.primary }}>Objective</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                        {selectedVisit.soapNotes.objective}
                      </ThemedText>
                    </View>
                  ) : null}
                  {selectedVisit.soapNotes.assessment ? (
                    <View style={styles.soapEntry}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: theme.primary }}>Assessment</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                        {selectedVisit.soapNotes.assessment}
                      </ThemedText>
                    </View>
                  ) : null}
                  {selectedVisit.soapNotes.plan ? (
                    <View style={styles.soapEntry}>
                      <ThemedText type="small" style={{ fontWeight: "600", color: theme.primary }}>Plan</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                        {selectedVisit.soapNotes.plan}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {selectedVisit.aiSummary ? (
                <View style={[styles.detailSection, { backgroundColor: theme.info + "08", borderColor: theme.info + "30" }]}>
                  <View style={styles.detailRow}>
                    <Feather name="cpu" size={16} color={theme.info} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm, color: theme.info }}>AI Summary</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginTop: Spacing.sm, lineHeight: 22 }}>
                    {selectedVisit.aiSummary}
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  testID="button-generate-ai-summary"
                  accessibilityRole="button"
                  accessibilityLabel="Generate AI summary"
                  style={[styles.outlineButton, { borderColor: theme.info }]}
                  onPress={() => {
                    if (selectedVisit) {
                      aiSummaryMutation.mutate(selectedVisit.id);
                    }
                  }}
                  disabled={aiSummaryMutation.isPending}
                >
                  {aiSummaryMutation.isPending ? (
                    <ActivityIndicator size="small" color={theme.info} />
                  ) : (
                    <>
                      <Feather name="cpu" size={16} color={theme.info} />
                      <ThemedText type="small" style={{ color: theme.info, fontWeight: "600", marginLeft: Spacing.sm }}>
                        Generate AI Summary
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              )}

              {selectedVisit.followUpInstructions ? (
                <View style={[styles.detailSection, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  <View style={styles.detailRow}>
                    <Feather name="clipboard" size={16} color={theme.warning} />
                    <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Follow-Up Instructions</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.text, marginTop: Spacing.sm, lineHeight: 22 }}>
                    {selectedVisit.followUpInstructions}
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={showCancelModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Cancel Visit</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Are you sure you want to cancel this visit? Please provide a reason.
            </ThemedText>
            <TextInput
              testID="input-cancel-reason"
              accessibilityLabel="Reason for cancellation"
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Reason for cancellation"
              placeholderTextColor={theme.textSecondary}
              value={cancelReason}
              onChangeText={setCancelReason}
            />
            <View style={styles.dialogActions}>
              <Pressable
                testID="button-cancel-dismiss"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={[styles.dialogButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setCancelVisitId(null);
                }}
              >
                <ThemedText type="small" style={{ fontWeight: "600" }}>Go Back</ThemedText>
              </Pressable>
              <Pressable
                testID="button-cancel-confirm"
                accessibilityRole="button"
                accessibilityLabel="Confirm cancellation"
                style={[styles.dialogButton, { backgroundColor: theme.error }]}
                onPress={() => {
                  if (cancelVisitId) {
                    cancelVisitMutation.mutate({ id: cancelVisitId, reason: cancelReason });
                  }
                }}
                disabled={cancelVisitMutation.isPending}
              >
                {cancelVisitMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>Confirm Cancel</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRatingModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogBox, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Rate Your Visit</ThemedText>
            <View style={{ alignItems: "center", marginBottom: Spacing.lg }}>
              {renderStars(ratingValue, true, (r) => setRatingValue(r))}
            </View>
            <TextInput
              testID="input-rating-feedback"
              accessibilityLabel="Rating feedback"
              style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Share your feedback (optional)"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              value={ratingFeedback}
              onChangeText={setRatingFeedback}
            />
            <View style={styles.dialogActions}>
              <Pressable
                testID="button-rating-dismiss"
                accessibilityRole="button"
                accessibilityLabel="Cancel rating"
                style={[styles.dialogButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => {
                  setShowRatingModal(false);
                  setRatingValue(0);
                  setRatingFeedback("");
                  setRatingVisitId(null);
                }}
              >
                <ThemedText type="small" style={{ fontWeight: "600" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                testID="button-rating-submit"
                accessibilityRole="button"
                accessibilityLabel="Submit rating"
                accessibilityState={{ disabled: rateVisitMutation.isPending || ratingValue === 0 }}
                style={[styles.dialogButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  if (ratingVisitId && ratingValue > 0) {
                    rateVisitMutation.mutate({ id: ratingVisitId, rating: ratingValue, feedback: ratingFeedback });
                  }
                }}
                disabled={rateVisitMutation.isPending || ratingValue === 0}
              >
                {rateVisitMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>Submit</ThemedText>
                )}
              </Pressable>
            </View>
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
  topActionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  reminderButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.xs,
  },
  visitCard: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  visitCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  visitCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  providerInfo: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  visitCardBody: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  visitInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  visitCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  aiPreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["5xl"],
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  pickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerDropdown: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
    maxHeight: 250,
  },
  pickerOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.md,
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  detailSection: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  soapEntry: {
    marginBottom: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  dialogBox: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  dialogButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
});
