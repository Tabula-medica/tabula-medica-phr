import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Appointment {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  appointmentType: string;
  providerName: string | null;
  facilityName: string | null;
  facilityAddress: string | null;
  scheduledAt: string;
  duration: number;
  status: string;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabType = "upcoming" | "past" | "all";

const APPOINTMENT_TYPES = [
  { value: "checkup", label: "Checkup", icon: "heart" as const },
  { value: "specialist", label: "Specialist", icon: "user" as const },
  { value: "lab", label: "Lab Work", icon: "droplet" as const },
  { value: "imaging", label: "Imaging", icon: "image" as const },
  { value: "therapy", label: "Therapy", icon: "smile" as const },
  { value: "vaccination", label: "Vaccination", icon: "shield" as const },
  { value: "other", label: "Other", icon: "calendar" as const },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function AppointmentSchedulingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { theme: colors } = useTheme();

  const [selectedTab, setSelectedTab] = useState<TabType>("upcoming");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState("checkup");
  const [formProvider, setFormProvider] = useState("");
  const [formFacility, setFormFacility] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formDuration, setFormDuration] = useState(30);
  const [formNotes, setFormNotes] = useState("");
  const [formReminder, setFormReminder] = useState(true);

  const { data: allAppointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: upcomingAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/upcoming"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${formDate}T${formTime || "09:00"}`);
      return apiRequest("POST", "/api/appointments", {
        title: formTitle,
        description: formDescription || undefined,
        appointmentType: formType,
        providerName: formProvider || undefined,
        facilityName: formFacility || undefined,
        facilityAddress: formAddress || undefined,
        scheduledAt: scheduledAt.toISOString(),
        duration: formDuration,
        notes: formNotes || undefined,
        reminderEnabled: formReminder,
        reminderMinutesBefore: 60,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      resetForm();
      setShowCreateModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Appointment> & { id: string }) => {
      const { id, ...rest } = updates;
      return apiRequest("PATCH", `/api/appointments/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowRescheduleModal(false);
      setShowDetailModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/appointments/${id}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setShowDetailModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormType("checkup");
    setFormProvider("");
    setFormFacility("");
    setFormAddress("");
    setFormDate("");
    setFormTime("");
    setFormDuration(30);
    setFormNotes("");
    setFormReminder(true);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    setRefreshing(false);
  }, [queryClient]);

  const now = new Date();
  const pastAppointments = allAppointments.filter(
    (a) => new Date(a.scheduledAt) < now || a.status === "completed" || a.status === "cancelled"
  );

  const displayedAppointments =
    selectedTab === "upcoming"
      ? upcomingAppointments
      : selectedTab === "past"
      ? pastAppointments
      : allAppointments;

  const getTypeInfo = (type: string) => {
    return APPOINTMENT_TYPES.find((t) => t.value === type) || APPOINTMENT_TYPES[6];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return colors.primary;
      case "confirmed":
        return colors.success;
      case "cancelled":
        return colors.error;
      case "completed":
        return colors.textSecondary;
      case "no_show":
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1 && days <= 7) return `In ${days} days`;
    if (days > 7 && days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
    return "";
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowDetailModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReschedule = () => {
    if (!selectedAppointment) return;
    const dt = new Date(selectedAppointment.scheduledAt);
    setFormDate(dt.toISOString().split("T")[0]);
    setFormTime(dt.toTimeString().slice(0, 5));
    setFormDuration(selectedAppointment.duration);
    setShowDetailModal(false);
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = () => {
    if (!selectedAppointment || !formDate) return;
    const scheduledAt = new Date(`${formDate}T${formTime || "09:00"}`);
    updateMutation.mutate({
      id: selectedAppointment.id,
      scheduledAt: scheduledAt.toISOString() as any,
      duration: formDuration,
      status: "scheduled",
    });
  };

  const renderAppointmentCard = ({ item, index }: { item: Appointment; index: number }) => {
    const typeInfo = getTypeInfo(item.appointmentType);
    const statusColor = getStatusColor(item.status);
    const relativeDate = getRelativeDate(item.scheduledAt);
    const isPast = new Date(item.scheduledAt) < now;

    return (
      <Animated.View entering={FadeInDown.delay(index * 40)}>
        <Pressable
          onPress={() => handleAppointmentPress(item)}
          testID={`appointment-card-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${typeInfo.label}, ${formatDate(item.scheduledAt)} at ${formatTime(item.scheduledAt)}, ${item.duration} minutes, ${item.status.replace(/_/g, " ")}`}
        >
          <Card
            style={{
              ...styles.appointmentCard,
              ...(isPast ? { opacity: 0.7 } : {}),
              borderLeftColor: statusColor,
              borderLeftWidth: 3,
            }}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.typeIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name={typeInfo.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.cardInfo}>
                <ThemedText style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText style={[styles.cardType, { color: colors.textSecondary }]}>
                  {typeInfo.label}
                  {item.providerName ? ` - ${item.providerName}` : ""}
                </ThemedText>
              </View>
              <StatusBadge label={item.status.replace(/_/g, " ")} color={statusColor} size="sm" />
            </View>

            <View style={styles.cardDetails}>
              <View style={styles.detailRow}>
                <Feather name="calendar" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.detailText, { color: colors.text }]}>
                  {formatDate(item.scheduledAt)}
                </ThemedText>
                {relativeDate ? (
                  <View style={[styles.relativeBadge, { backgroundColor: `${colors.primary}10` }]}>
                    <ThemedText style={[styles.relativeText, { color: colors.primary }]}>
                      {relativeDate}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={styles.detailRow}>
                <Feather name="clock" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.detailText, { color: colors.text }]}>
                  {formatTime(item.scheduledAt)} ({item.duration} min)
                </ThemedText>
              </View>
              {item.facilityName ? (
                <View style={styles.detailRow}>
                  <Feather name="map-pin" size={14} color={colors.textSecondary} />
                  <ThemedText
                    style={[styles.detailText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.facilityName}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {item.reminderEnabled ? (
              <View style={styles.reminderRow}>
                <Feather name="bell" size={12} color={colors.primary} />
                <ThemedText style={[styles.reminderText, { color: colors.primary }]}>
                  Reminder {item.reminderMinutesBefore} min before
                </ThemedText>
              </View>
            ) : null}
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRootDefault }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => { resetForm(); setShowCreateModal(false); }}>
            <ThemedText style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={[styles.modalTitle, { color: colors.text }]}>New Appointment</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save appointment"
            accessibilityState={{ disabled: !formTitle.trim() || !formDate || createMutation.isPending }}
            onPress={() => createMutation.mutate()}
            disabled={!formTitle.trim() || !formDate || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={[styles.modalSave, { color: formTitle.trim() && formDate ? colors.primary : colors.textSecondary }]}>
                Save
              </ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Title *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="e.g., Annual Physical"
            placeholderTextColor={colors.textSecondary}
            value={formTitle}
            onChangeText={setFormTitle}
            testID="input-title"
            accessibilityLabel="Appointment title"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Type *</ThemedText>
          <View style={styles.typeGrid}>
            {APPOINTMENT_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.typeOption,
                  { backgroundColor: colors.backgroundRoot, borderColor: colors.border },
                  formType === type.value && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => { setFormType(type.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                testID={`type-${type.value}`}
                accessibilityRole="radio"
                accessibilityLabel={`Type: ${type.label}`}
                accessibilityState={{ selected: formType === type.value }}
              >
                <Feather name={type.icon} size={16} color={formType === type.value ? colors.primary : colors.textSecondary} />
                <ThemedText style={[styles.typeLabel, { color: formType === type.value ? colors.primary : colors.text }]}>
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Date *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={formDate}
            onChangeText={setFormDate}
            testID="input-date"
            accessibilityLabel="Appointment date"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Time</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="HH:MM (24h format)"
            placeholderTextColor={colors.textSecondary}
            value={formTime}
            onChangeText={setFormTime}
            testID="input-time"
            accessibilityLabel="Appointment time"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Duration</ThemedText>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.durationOption,
                  { backgroundColor: colors.backgroundRoot, borderColor: colors.border },
                  formDuration === d && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setFormDuration(d)}
                accessibilityRole="radio"
                accessibilityLabel={`Duration: ${d} minutes`}
                accessibilityState={{ selected: formDuration === d }}
              >
                <ThemedText style={[styles.durationText, { color: formDuration === d ? colors.primary : colors.text }]}>
                  {d}m
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Provider Name</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="Dr. Smith"
            placeholderTextColor={colors.textSecondary}
            value={formProvider}
            onChangeText={setFormProvider}
            testID="input-provider"
            accessibilityLabel="Provider name"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Facility</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="City Medical Center"
            placeholderTextColor={colors.textSecondary}
            value={formFacility}
            onChangeText={setFormFacility}
            testID="input-facility"
            accessibilityLabel="Facility name"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Address</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="123 Health St, Suite 100"
            placeholderTextColor={colors.textSecondary}
            value={formAddress}
            onChangeText={setFormAddress}
            testID="input-address"
            accessibilityLabel="Facility address"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Description</ThemedText>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="Reason for visit..."
            placeholderTextColor={colors.textSecondary}
            value={formDescription}
            onChangeText={setFormDescription}
            multiline
            numberOfLines={3}
            testID="input-description"
            accessibilityLabel="Description"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Notes</ThemedText>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="Any special instructions..."
            placeholderTextColor={colors.textSecondary}
            value={formNotes}
            onChangeText={setFormNotes}
            multiline
            numberOfLines={3}
            testID="input-notes"
            accessibilityLabel="Notes"
          />

          <Pressable
            style={styles.reminderToggle}
            onPress={() => setFormReminder(!formReminder)}
            testID="toggle-reminder"
            accessibilityRole="switch"
            accessibilityLabel="Appointment reminder"
            accessibilityState={{ checked: formReminder }}
          >
            <Feather name={formReminder ? "bell" : "bell-off"} size={20} color={formReminder ? colors.primary : colors.textSecondary} />
            <ThemedText style={[styles.reminderLabel, { color: colors.text }]}>
              Appointment Reminder
            </ThemedText>
            <View style={[styles.toggleTrack, { backgroundColor: formReminder ? colors.primary : colors.backgroundRoot }]}>
              <View style={[styles.toggleThumb, formReminder && styles.toggleThumbActive]} />
            </View>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderDetailModal = () => {
    if (!selectedAppointment) return null;
    const typeInfo = getTypeInfo(selectedAppointment.appointmentType);
    const statusColor = getStatusColor(selectedAppointment.status);
    const canModify = selectedAppointment.status === "scheduled" || selectedAppointment.status === "confirmed";

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRootDefault }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close appointment details" onPress={() => setShowDetailModal(false)}>
              <ThemedText style={[styles.modalCancel, { color: colors.textSecondary }]}>Close</ThemedText>
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Appointment Details</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            <View style={[styles.detailHeader, { backgroundColor: `${colors.primary}08` }]}>
              <View style={[styles.detailIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name={typeInfo.icon} size={28} color={colors.primary} />
              </View>
              <ThemedText style={[styles.detailTitle, { color: colors.text }]}>
                {selectedAppointment.title}
              </ThemedText>
              <StatusBadge label={selectedAppointment.status.replace(/_/g, " ")} color={statusColor} variant="dot" size="lg" />
            </View>

            <Card style={styles.detailSection}>
              <View style={styles.detailSectionRow}>
                <Feather name="calendar" size={18} color={colors.primary} />
                <View style={styles.detailSectionInfo}>
                  <ThemedText style={[styles.detailSectionLabel, { color: colors.textSecondary }]}>Date</ThemedText>
                  <ThemedText style={[styles.detailSectionValue, { color: colors.text }]}>
                    {formatDate(selectedAppointment.scheduledAt)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.detailSectionRow}>
                <Feather name="clock" size={18} color={colors.primary} />
                <View style={styles.detailSectionInfo}>
                  <ThemedText style={[styles.detailSectionLabel, { color: colors.textSecondary }]}>Time</ThemedText>
                  <ThemedText style={[styles.detailSectionValue, { color: colors.text }]}>
                    {formatTime(selectedAppointment.scheduledAt)} ({selectedAppointment.duration} minutes)
                  </ThemedText>
                </View>
              </View>
              {selectedAppointment.providerName ? (
                <View style={styles.detailSectionRow}>
                  <Feather name="user" size={18} color={colors.primary} />
                  <View style={styles.detailSectionInfo}>
                    <ThemedText style={[styles.detailSectionLabel, { color: colors.textSecondary }]}>Provider</ThemedText>
                    <ThemedText style={[styles.detailSectionValue, { color: colors.text }]}>
                      {selectedAppointment.providerName}
                    </ThemedText>
                  </View>
                </View>
              ) : null}
              {selectedAppointment.facilityName ? (
                <View style={styles.detailSectionRow}>
                  <Feather name="map-pin" size={18} color={colors.primary} />
                  <View style={styles.detailSectionInfo}>
                    <ThemedText style={[styles.detailSectionLabel, { color: colors.textSecondary }]}>Location</ThemedText>
                    <ThemedText style={[styles.detailSectionValue, { color: colors.text }]}>
                      {selectedAppointment.facilityName}
                    </ThemedText>
                    {selectedAppointment.facilityAddress ? (
                      <ThemedText style={[styles.detailSectionSubvalue, { color: colors.textSecondary }]}>
                        {selectedAppointment.facilityAddress}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </Card>

            {selectedAppointment.description ? (
              <Card style={styles.detailSection}>
                <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>Description</ThemedText>
                <ThemedText style={[styles.sectionValue, { color: colors.text }]}>
                  {selectedAppointment.description}
                </ThemedText>
              </Card>
            ) : null}

            {selectedAppointment.notes ? (
              <Card style={styles.detailSection}>
                <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>Notes</ThemedText>
                <ThemedText style={[styles.sectionValue, { color: colors.text }]}>
                  {selectedAppointment.notes}
                </ThemedText>
              </Card>
            ) : null}

            {canModify ? (
              <View style={styles.actionButtons}>
                <Pressable
                  style={[styles.rescheduleButton, { backgroundColor: colors.primary }]}
                  onPress={handleReschedule}
                  testID="button-reschedule"
                  accessibilityRole="button"
                  accessibilityLabel="Reschedule appointment"
                >
                  <Feather name="refresh-cw" size={18} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>Reschedule</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.cancelButton, { backgroundColor: `${colors.error}15`, borderColor: colors.error }]}
                  onPress={() => cancelMutation.mutate(selectedAppointment.id)}
                  disabled={cancelMutation.isPending}
                  testID="button-cancel-appointment"
                  accessibilityRole="button"
                  accessibilityLabel="Cancel appointment"
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <>
                      <Feather name="x-circle" size={18} color={colors.error} />
                      <ThemedText style={[styles.cancelButtonText, { color: colors.error }]}>
                        Cancel Appointment
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderRescheduleModal = () => (
    <Modal
      visible={showRescheduleModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowRescheduleModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRootDefault }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel reschedule" onPress={() => setShowRescheduleModal(false)}>
            <ThemedText style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</ThemedText>
          </Pressable>
          <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Reschedule</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm reschedule"
            accessibilityState={{ disabled: !formDate || updateMutation.isPending }}
            onPress={handleRescheduleSubmit}
            disabled={!formDate || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={[styles.modalSave, { color: formDate ? colors.primary : colors.textSecondary }]}>
                Confirm
              </ThemedText>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          {selectedAppointment ? (
            <Card style={{ ...styles.rescheduleInfo, borderLeftColor: colors.primary }}>
              <ThemedText style={[styles.rescheduleTitle, { color: colors.text }]}>
                {selectedAppointment.title}
              </ThemedText>
              <ThemedText style={[styles.rescheduleOld, { color: colors.textSecondary }]}>
                Currently: {formatDate(selectedAppointment.scheduledAt)} at {formatTime(selectedAppointment.scheduledAt)}
              </ThemedText>
            </Card>
          ) : null}

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>New Date *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            value={formDate}
            onChangeText={setFormDate}
            testID="reschedule-date"
            accessibilityLabel="New appointment date"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>New Time</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="HH:MM (24h format)"
            placeholderTextColor={colors.textSecondary}
            value={formTime}
            onChangeText={setFormTime}
            testID="reschedule-time"
            accessibilityLabel="New appointment time"
          />

          <ThemedText style={[styles.fieldLabel, { color: colors.text }]}>Duration</ThemedText>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.durationOption,
                  { backgroundColor: colors.backgroundRoot, borderColor: colors.border },
                  formDuration === d && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => setFormDuration(d)}
                accessibilityRole="radio"
                accessibilityLabel={`Duration: ${d} minutes`}
                accessibilityState={{ selected: formDuration === d }}
              >
                <ThemedText style={[styles.durationText, { color: formDuration === d ? colors.primary : colors.text }]}>
                  {d}m
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {nextAppointment ? (
          <Pressable onPress={() => handleAppointmentPress(nextAppointment)} testID="next-appointment-card" accessibilityRole="button" accessibilityLabel={`Next appointment: ${nextAppointment.title}, ${formatDate(nextAppointment.scheduledAt)}`}>
            <Card style={{ ...styles.nextCard, borderColor: colors.primary }}>
              <View style={styles.nextBadge}>
                <Feather name="zap" size={14} color={colors.primary} />
                <ThemedText style={[styles.nextBadgeText, { color: colors.primary }]}>Next Appointment</ThemedText>
              </View>
              <ThemedText style={[styles.nextTitle, { color: colors.text }]}>{nextAppointment.title}</ThemedText>
              <View style={styles.nextDetails}>
                <Feather name="calendar" size={14} color={colors.textSecondary} />
                <ThemedText style={[styles.nextDetailText, { color: colors.text }]}>
                  {formatDate(nextAppointment.scheduledAt)} at {formatTime(nextAppointment.scheduledAt)}
                </ThemedText>
              </View>
              {nextAppointment.providerName ? (
                <View style={styles.nextDetails}>
                  <Feather name="user" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.nextDetailText, { color: colors.text }]}>
                    {nextAppointment.providerName}
                  </ThemedText>
                </View>
              ) : null}
            </Card>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => { resetForm(); setShowCreateModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          testID="button-create-appointment"
          accessibilityRole="button"
          accessibilityLabel="Schedule appointment"
        >
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.createButtonText}>Schedule Appointment</ThemedText>
        </Pressable>

        <View style={styles.tabRow}>
          {(["upcoming", "past", "all"] as TabType[]).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tab,
                selectedTab === tab && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSelectedTab(tab)}
              testID={`tab-${tab}`}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.charAt(0).toUpperCase() + tab.slice(1)} appointments`}
              accessibilityState={{ selected: selectedTab === tab }}
            >
              <ThemedText style={[styles.tabText, selectedTab === tab && { color: "#fff" }]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : displayedAppointments.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundRoot }]}>
            <Feather name="calendar" size={48} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No {selectedTab} appointments
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Schedule your next appointment to stay on top of your health
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={displayedAppointments}
            renderItem={renderAppointmentCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}
      </ScrollView>

      {renderCreateModal()}
      {renderDetailModal()}
      {renderRescheduleModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  loader: { marginTop: Spacing["2xl"] },
  nextCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  nextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  nextBadgeText: { fontSize: 13, fontWeight: "600" },
  nextTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  nextDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  nextDetailText: { fontSize: 14 },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  createButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  tabRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.md,
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  appointmentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1, marginLeft: Spacing.md },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardType: { fontSize: 13, marginTop: 2 },
  cardDetails: { gap: 6, marginLeft: 52 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: { fontSize: 13 },
  relativeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  relativeText: { fontSize: 11, fontWeight: "600" },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    marginLeft: 52,
  },
  reminderText: { fontSize: 12, fontWeight: "500" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: Spacing.md },
  emptySubtitle: { fontSize: 14, textAlign: "center", marginTop: Spacing.xs },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalCancel: { fontSize: 16 },
  modalSave: { fontSize: 16, fontWeight: "600" },
  modalBody: { flex: 1, padding: Spacing.lg },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 15,
  },
  textArea: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  typeLabel: { fontSize: 13, fontWeight: "500" },
  durationRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  durationOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  durationText: { fontSize: 13, fontWeight: "600" },
  reminderToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  reminderLabel: { flex: 1, fontSize: 15 },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  toggleThumbActive: { alignSelf: "flex-end" },
  detailHeader: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  detailIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  detailTitle: { fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: Spacing.sm },
  detailSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  detailSectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailSectionInfo: { flex: 1 },
  detailSectionLabel: { fontSize: 12, fontWeight: "500" },
  detailSectionValue: { fontSize: 15, fontWeight: "500", marginTop: 2 },
  detailSectionSubvalue: { fontSize: 13, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  sectionValue: { fontSize: 14, lineHeight: 20 },
  actionButtons: { gap: Spacing.sm, marginTop: Spacing.lg },
  rescheduleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  cancelButtonText: { fontWeight: "600", fontSize: 16 },
  rescheduleInfo: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 3,
    marginBottom: Spacing.md,
  },
  rescheduleTitle: { fontSize: 16, fontWeight: "600" },
  rescheduleOld: { fontSize: 13, marginTop: 4 },
});
