import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { apiRequest } from "@/lib/query-client";
import { useLanguage } from "@/context/LanguageContext";
import { Spacing } from "@/constants/theme";
import { CodeLookup, type CodeResult } from "@/components/ui";

type MedSchedule = {
  id: string;
  medicationName: string;
  dosage: string | null;
  frequency: string;
  timesPerDay: number;
  scheduledTimes: string[];
  instructions: string | null;
  prescribedBy: string | null;
  isActive: boolean;
  remindersEnabled: boolean;
  startDate: string;
  endDate: string | null;
  pillCount: number | null;
};

type AdherenceStats = {
  total: number;
  taken: number;
  skipped: number;
  missed: number;
  adherenceRate: number;
  currentStreak: number;
  longestStreak: number;
};

type Interaction = {
  drug1: string;
  drug2: string;
  severity: string;
  description: string;
};

type SideEffectProfile = {
  medication: string;
  common: string[];
  serious: string[];
  watchFor: string[];
};

type RefillAlert = {
  medication: string;
  refillDate: string | null;
  daysRemaining: number;
  urgency: string;
  pillsRemaining: number | null;
};

type AIInsights = {
  interactions: Interaction[];
  sideEffects: SideEffectProfile[];
  refillAlerts: RefillAlert[];
  aiSummary: string | null;
};

type SmsReminderStatus = {
  configured: boolean;
  phoneNumber: string | null;
  remindersEnabled: boolean;
  reminderTime: string | null;
};

export default function MedicationAdherenceScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    interactions: true,
    refills: true,
    sideEffects: false,
  });
  const [newMed, setNewMed] = useState({
    medicationName: "",
    dosage: "",
    frequency: "daily",
    instructions: "",
    prescribedBy: "",
  });
  const [selectedRxCode, setSelectedRxCode] = useState<string>("");

  const { data: medications = [], isLoading, refetch } = useQuery<MedSchedule[]>({
    queryKey: ["/api/medications"],
  });

  const { data: stats } = useQuery<AdherenceStats>({
    queryKey: ["/api/medications/adherence-stats"],
  });

  const { data: insights } = useQuery<AIInsights>({
    queryKey: ["/api/medications/ai-insights"],
    enabled: medications.length > 0,
  });

  const { data: smsStatus } = useQuery<SmsReminderStatus>({
    queryKey: ["/api/sms/reminder-status"],
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (data: { medicationName: string; dosage: string | null; scheduledTime: string }) => {
      const res = await apiRequest("POST", "/api/sms/medication-reminder/send", data);
      return res.json();
    },
  });

  const [sentReminders, setSentReminders] = useState<Record<string, "success" | "error">>({});

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/medications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications/ai-insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
      setShowAddModal(false);
      setNewMed({ medicationName: "", dosage: "", frequency: "daily", instructions: "", prescribedBy: "" });
      setSelectedRxCode("");
    },
  });

  const logMutation = useMutation({
    mutationFn: async ({ medId, status }: { medId: string; status: string }) => {
      const res = await apiRequest("POST", `/api/medications/${medId}/log`, {
        status,
        scheduledTime: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications/adherence-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
    },
  });

  const activeMeds = useMemo(() => medications.filter(m => m.isActive), [medications]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleAddMed = useCallback(() => {
    if (!newMed.medicationName.trim()) return;
    addMutation.mutate({
      ...newMed,
      rxnormCode: selectedRxCode || undefined,
      startDate: new Date().toISOString(),
      scheduledTimes: ["08:00"],
    });
  }, [newMed, selectedRxCode]);

  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/medications/ai-insights"] });
    queryClient.invalidateQueries({ queryKey: ["/api/medications/adherence-stats"] });
  }, [refetch, queryClient]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const hasInteractions = insights?.interactions && insights.interactions.length > 0;
  const hasRefillAlerts = insights?.refillAlerts && insights.refillAlerts.length > 0;
  const hasSideEffects = insights?.sideEffects && insights.sideEffects.length > 0;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: 100, paddingHorizontal: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
      >
        {stats ? (
          <View style={[styles.statsCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText type="title" style={{ color: theme.primary, fontSize: 32 }}>
                  {stats.adherenceRate}%
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {t.common.done || "Adherence"}
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <View style={styles.streakRow}>
                  <Feather name="zap" size={20} color="#F59E0B" />
                  <ThemedText type="title" style={{ fontSize: 28, marginLeft: 4 }}>
                    {stats.currentStreak}
                  </ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Day Streak
                </ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <ThemedText type="title" style={{ fontSize: 28 }}>
                  {stats.taken}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Taken
                </ThemedText>
              </View>
            </View>
            {stats.longestStreak > 0 ? (
              <View style={[styles.bestStreak, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="award" size={14} color={theme.primary} />
                <ThemedText type="caption" style={{ marginLeft: 6, color: theme.textSecondary }}>
                  Best streak: {stats.longestStreak} days
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {smsStatus ? (
          <View testID="sms-reminder-status" style={[styles.smsStatusCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <View style={styles.smsStatusHeader}>
              <View style={[styles.alertIcon, { backgroundColor: smsStatus.configured ? "#10B981" + "15" : "#F59E0B" + "15" }]}>
                <Feather name="message-square" size={16} color={smsStatus.configured ? "#10B981" : "#F59E0B"} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 14 }}>
                  {"SMS Reminders"}
                </ThemedText>
                {smsStatus.configured ? (
                  <ThemedText type="caption" style={{ color: "#10B981", fontSize: 11 }}>
                    {"Active \u2022 "}{smsStatus.phoneNumber}
                  </ThemedText>
                ) : (
                  <ThemedText type="caption" style={{ color: "#F59E0B", fontSize: 11 }}>
                    {"Not configured"}
                  </ThemedText>
                )}
              </View>
              <View style={[styles.smsStatusBadge, { backgroundColor: smsStatus.configured ? "#10B981" + "20" : "#F59E0B" + "20" }]}>
                <ThemedText type="caption" style={{ color: smsStatus.configured ? "#10B981" : "#F59E0B", fontSize: 10, fontWeight: "700" }}>
                  {smsStatus.configured ? "ON" : "OFF"}
                </ThemedText>
              </View>
            </View>
            {!smsStatus.configured ? (
              <View style={[styles.smsConfigNotice, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="info" size={13} color="#D97706" />
                <ThemedText type="caption" style={{ color: "#92400E", marginLeft: 6, flex: 1, fontSize: 11 }}>
                  {"Update your patient profile with a phone number to enable SMS medication reminders."}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {hasInteractions ? (
          <Pressable
            testID="section-drug-interactions"
            onPress={() => toggleSection("interactions")}
            style={[styles.alertCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
          >
            <View style={styles.alertHeader}>
              <View style={[styles.alertIcon, { backgroundColor: "#FEE2E2" }]}>
                <Feather name="alert-triangle" size={16} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 14, color: "#991B1B" }}>
                  Drug Interactions ({insights!.interactions.length})
                </ThemedText>
                <ThemedText type="caption" style={{ color: "#B91C1C", fontSize: 11 }}>
                  Review potential medication conflicts
                </ThemedText>
              </View>
              <Feather
                name={expandedSections.interactions ? "chevron-up" : "chevron-down"}
                size={18}
                color="#DC2626"
              />
            </View>
            {expandedSections.interactions ? (
              <View style={{ marginTop: 10 }}>
                {insights!.interactions.map((interaction, idx) => (
                  <View
                    key={`interaction-${idx}`}
                    style={[styles.interactionItem, {
                      borderLeftColor: interaction.severity === "high" ? "#DC2626" : "#F59E0B",
                      backgroundColor: interaction.severity === "high" ? "#FEE2E2" : "#FEF3C7",
                    }]}
                  >
                    <View style={styles.interactionHeader}>
                      <ThemedText type="caption" style={[styles.severityBadge, {
                        backgroundColor: interaction.severity === "high" ? "#DC2626" : "#F59E0B",
                        color: "#FFFFFF",
                      }]}>
                        {interaction.severity.toUpperCase()}
                      </ThemedText>
                      <ThemedText type="caption" style={{ fontWeight: "700", color: "#1F2937", flex: 1 }}>
                        {interaction.drug1} + {interaction.drug2}
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" style={{ color: "#4B5563", fontSize: 12, marginTop: 4 }}>
                      {interaction.description}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {hasRefillAlerts ? (
          <Pressable
            testID="section-refill-alerts"
            onPress={() => toggleSection("refills")}
            style={[styles.alertCard, {
              backgroundColor: "#FFFBEB",
              borderColor: "#FDE68A",
            }]}
          >
            <View style={styles.alertHeader}>
              <View style={[styles.alertIcon, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="clock" size={16} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 14, color: "#92400E" }}>
                  Refill Reminders ({insights!.refillAlerts.length})
                </ThemedText>
                <ThemedText type="caption" style={{ color: "#B45309", fontSize: 11 }}>
                  Medications that need attention
                </ThemedText>
              </View>
              <Feather
                name={expandedSections.refills ? "chevron-up" : "chevron-down"}
                size={18}
                color="#D97706"
              />
            </View>
            {expandedSections.refills ? (
              <View style={{ marginTop: 10 }}>
                {insights!.refillAlerts.map((alert, idx) => {
                  const urgencyColors: Record<string, { bg: string; text: string; badge: string }> = {
                    overdue: { bg: "#FEE2E2", text: "#991B1B", badge: "#DC2626" },
                    urgent: { bg: "#FEF3C7", text: "#92400E", badge: "#F59E0B" },
                    upcoming: { bg: "#ECFDF5", text: "#065F46", badge: "#10B981" },
                  };
                  const colors = urgencyColors[alert.urgency] || urgencyColors.upcoming;
                  return (
                    <View key={`refill-${idx}`} style={[styles.refillItem, { backgroundColor: colors.bg }]}>
                      <View style={styles.refillHeader}>
                        <ThemedText type="caption" style={[styles.severityBadge, { backgroundColor: colors.badge, color: "#FFFFFF" }]}>
                          {alert.urgency === "overdue" ? "OVERDUE" : alert.urgency === "urgent" ? "URGENT" : "SOON"}
                        </ThemedText>
                        <ThemedText type="caption" style={{ fontWeight: "700", color: "#1F2937", flex: 1 }}>
                          {alert.medication}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <Feather name="calendar" size={12} color={colors.text} />
                        <ThemedText type="caption" style={{ color: colors.text, fontSize: 12, marginLeft: 4 }}>
                          {alert.urgency === "overdue"
                            ? `Overdue by ${Math.abs(alert.daysRemaining)} day(s)`
                            : `${alert.daysRemaining} day(s) remaining`}
                        </ThemedText>
                      </View>
                      {alert.pillsRemaining !== null && alert.pillsRemaining !== undefined ? (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                          <Feather name="package" size={12} color={colors.text} />
                          <ThemedText type="caption" style={{ color: colors.text, fontSize: 12, marginLeft: 4 }}>
                            {alert.pillsRemaining} pills remaining
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {hasSideEffects ? (
          <Pressable
            testID="section-side-effects"
            onPress={() => toggleSection("sideEffects")}
            style={[styles.alertCard, {
              backgroundColor: "#EFF6FF",
              borderColor: "#BFDBFE",
            }]}
          >
            <View style={styles.alertHeader}>
              <View style={[styles.alertIcon, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="info" size={16} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 14, color: "#1E40AF" }}>
                  Side Effect Profiles ({insights!.sideEffects.length})
                </ThemedText>
                <ThemedText type="caption" style={{ color: "#3B82F6", fontSize: 11 }}>
                  Know what to watch for with your medications
                </ThemedText>
              </View>
              <Feather
                name={expandedSections.sideEffects ? "chevron-up" : "chevron-down"}
                size={18}
                color="#2563EB"
              />
            </View>
            {expandedSections.sideEffects ? (
              <View style={{ marginTop: 10 }}>
                {insights!.sideEffects.map((se, idx) => (
                  <View key={`se-${idx}`} style={[styles.sideEffectItem, { backgroundColor: "#DBEAFE" }]}>
                    <ThemedText type="caption" style={{ fontWeight: "700", color: "#1E3A8A", marginBottom: 6, fontSize: 13 }}>
                      {se.medication}
                    </ThemedText>
                    {se.common.length > 0 ? (
                      <View style={{ marginBottom: 4 }}>
                        <ThemedText type="caption" style={{ fontWeight: "600", color: "#6B7280", fontSize: 11 }}>
                          Common:
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: "#4B5563", fontSize: 12 }}>
                          {se.common.join(", ")}
                        </ThemedText>
                      </View>
                    ) : null}
                    {se.serious.length > 0 ? (
                      <View style={{ marginBottom: 4 }}>
                        <ThemedText type="caption" style={{ fontWeight: "600", color: "#DC2626", fontSize: 11 }}>
                          Serious (seek help):
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: "#B91C1C", fontSize: 12 }}>
                          {se.serious.join(", ")}
                        </ThemedText>
                      </View>
                    ) : null}
                    {se.watchFor.length > 0 ? (
                      <View>
                        <ThemedText type="caption" style={{ fontWeight: "600", color: "#D97706", fontSize: 11 }}>
                          Watch for:
                        </ThemedText>
                        <ThemedText type="caption" style={{ color: "#92400E", fontSize: 12 }}>
                          {se.watchFor.join(", ")}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {insights?.aiSummary ? (
          <View style={[styles.aiSummaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <View style={styles.aiSummaryHeader}>
              <View style={[styles.alertIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="cpu" size={16} color={theme.primary} />
              </View>
              <ThemedText type="subtitle" style={{ fontSize: 14, flex: 1 }}>
                AI Medication Summary
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
              {insights.aiSummary}
            </ThemedText>
            <ThemedText style={{ fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
              AI-assisted medication information for reference only. Not medical advice.
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={{ flex: 1 }}>
            {t.phr.medications}
          </ThemedText>
          <Pressable
            testID="button-add-medication"
            onPress={() => setShowAddModal(true)}
            style={[styles.addButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <ThemedText type="caption" style={{ color: "#FFFFFF", marginLeft: 4 }}>
              {t.common.add}
            </ThemedText>
          </Pressable>
        </View>

        {activeMeds.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="heart" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 12, textAlign: "center" }}>
              No medications added yet. Tap "Add" to start tracking your medications.
            </ThemedText>
          </View>
        ) : null}

        {activeMeds.map((med) => {
          const medInteractions = insights?.interactions?.filter(
            i => i.drug1.toLowerCase() === med.medicationName.toLowerCase() || i.drug2.toLowerCase() === med.medicationName.toLowerCase()
          ) || [];
          const medRefill = insights?.refillAlerts?.find(
            a => a.medication.toLowerCase() === med.medicationName.toLowerCase()
          );
          const hasWarning = medInteractions.length > 0 || (medRefill && medRefill.urgency !== "upcoming");

          return (
            <View
              key={med.id}
              testID={`card-medication-${med.id}`}
              style={[styles.medCard, {
                backgroundColor: theme.backgroundDefault,
                borderColor: hasWarning ? "#DC2626" + "40" : theme.border,
                borderWidth: hasWarning ? 1.5 : 1,
              }]}
            >
              <View style={styles.medHeader}>
                <View style={[styles.medIcon, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name="heart" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ThemedText type="subtitle" style={{ fontSize: 15 }}>
                      {med.medicationName}
                    </ThemedText>
                    {medInteractions.length > 0 ? (
                      <View style={[styles.warningDot, { backgroundColor: "#DC2626" }]} />
                    ) : null}
                  </View>
                  {med.dosage ? (
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {med.dosage} - {med.frequency}
                    </ThemedText>
                  ) : (
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {med.frequency}
                    </ThemedText>
                  )}
                </View>
                <View style={styles.medHeaderIcons}>
                  {med.remindersEnabled ? (
                    <Feather name="bell" size={16} color={theme.primary} />
                  ) : null}
                  {smsStatus?.configured ? (
                    <View style={[styles.smsIndicator, { backgroundColor: theme.primary + "15" }]}>
                      <Feather name="message-square" size={12} color={theme.primary} />
                    </View>
                  ) : null}
                </View>
              </View>

              {med.instructions ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 8 }}>
                  {med.instructions}
                </ThemedText>
              ) : null}

              {med.prescribedBy ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  Prescribed by: {med.prescribedBy}
                </ThemedText>
              ) : null}

              {medRefill ? (
                <View style={[styles.inlineAlert, {
                  backgroundColor: medRefill.urgency === "overdue" ? "#FEE2E2" : medRefill.urgency === "urgent" ? "#FEF3C7" : "#ECFDF5",
                }]}>
                  <Feather
                    name={medRefill.urgency === "overdue" ? "alert-circle" : "clock"}
                    size={13}
                    color={medRefill.urgency === "overdue" ? "#DC2626" : medRefill.urgency === "urgent" ? "#D97706" : "#059669"}
                  />
                  <ThemedText type="caption" style={{
                    marginLeft: 6,
                    fontSize: 11,
                    fontWeight: "600",
                    color: medRefill.urgency === "overdue" ? "#991B1B" : medRefill.urgency === "urgent" ? "#92400E" : "#065F46",
                  }}>
                    {medRefill.urgency === "overdue"
                      ? `Refill overdue by ${Math.abs(medRefill.daysRemaining)} day(s)`
                      : `Refill in ${medRefill.daysRemaining} day(s)`}
                    {medRefill.pillsRemaining !== null && medRefill.pillsRemaining !== undefined
                      ? ` (${medRefill.pillsRemaining} pills left)`
                      : ""}
                  </ThemedText>
                </View>
              ) : null}

              {medInteractions.length > 0 ? (
                <View style={[styles.inlineAlert, { backgroundColor: "#FEE2E2" }]}>
                  <Feather name="alert-triangle" size={13} color="#DC2626" />
                  <ThemedText type="caption" style={{ marginLeft: 6, fontSize: 11, color: "#991B1B", fontWeight: "600", flex: 1 }}>
                    Interacts with: {medInteractions.map(i =>
                      i.drug1.toLowerCase() === med.medicationName.toLowerCase() ? i.drug2 : i.drug1
                    ).join(", ")}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.actionRow}>
                <Pressable
                  testID={`button-taken-${med.id}`}
                  onPress={() => logMutation.mutate({ medId: med.id, status: "taken" })}
                  style={[styles.actionBtn, { backgroundColor: "#10B981" + "15", borderColor: "#10B981" }]}
                >
                  <Feather name="check" size={14} color="#10B981" />
                  <ThemedText type="caption" style={{ color: "#10B981", marginLeft: 4, fontWeight: "600" }}>
                    {"Taken"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  testID={`button-skipped-${med.id}`}
                  onPress={() => logMutation.mutate({ medId: med.id, status: "skipped" })}
                  style={[styles.actionBtn, { backgroundColor: "#F59E0B" + "15", borderColor: "#F59E0B" }]}
                >
                  <Feather name="skip-forward" size={14} color="#F59E0B" />
                  <ThemedText type="caption" style={{ color: "#F59E0B", marginLeft: 4, fontWeight: "600" }}>
                    {"Skip"}
                  </ThemedText>
                </Pressable>
                <Pressable
                  testID={`button-missed-${med.id}`}
                  onPress={() => logMutation.mutate({ medId: med.id, status: "missed" })}
                  style={[styles.actionBtn, { backgroundColor: "#EF4444" + "15", borderColor: "#EF4444" }]}
                >
                  <Feather name="x" size={14} color="#EF4444" />
                  <ThemedText type="caption" style={{ color: "#EF4444", marginLeft: 4, fontWeight: "600" }}>
                    {"Missed"}
                  </ThemedText>
                </Pressable>
              </View>

              {smsStatus?.configured ? (
                <View style={styles.smsReminderRow}>
                  <Pressable
                    testID={`button-send-sms-${med.id}`}
                    disabled={sendReminderMutation.isPending}
                    onPress={() => {
                      sendReminderMutation.mutate(
                        {
                          medicationName: med.medicationName,
                          dosage: med.dosage,
                          scheduledTime: med.scheduledTimes.length > 0 ? med.scheduledTimes[0] : new Date().toISOString(),
                        },
                        {
                          onSuccess: () => {
                            setSentReminders(prev => ({ ...prev, [med.id]: "success" }));
                            setTimeout(() => setSentReminders(prev => { const next = { ...prev }; delete next[med.id]; return next; }), 3000);
                          },
                          onError: () => {
                            setSentReminders(prev => ({ ...prev, [med.id]: "error" }));
                            setTimeout(() => setSentReminders(prev => { const next = { ...prev }; delete next[med.id]; return next; }), 3000);
                          },
                        }
                      );
                    }}
                    style={[styles.smsBtn, { backgroundColor: theme.primary + "12", borderColor: theme.primary + "40" }]}
                  >
                    {sendReminderMutation.isPending ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <Feather name="send" size={13} color={theme.primary} />
                        <ThemedText type="caption" style={{ color: theme.primary, marginLeft: 5, fontWeight: "600", fontSize: 11 }}>
                          {"Send Reminder Now"}
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                  {sentReminders[med.id] === "success" ? (
                    <View style={styles.smsStatusMsg}>
                      <Feather name="check-circle" size={12} color="#10B981" />
                      <ThemedText type="caption" style={{ color: "#10B981", marginLeft: 4, fontSize: 11 }}>
                        {"Sent"}
                      </ThemedText>
                    </View>
                  ) : null}
                  {sentReminders[med.id] === "error" ? (
                    <View style={styles.smsStatusMsg}>
                      <Feather name="alert-circle" size={12} color="#EF4444" />
                      <ThemedText type="caption" style={{ color: "#EF4444", marginLeft: 4, fontSize: 11 }}>
                        {"Failed"}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Add Medication</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <CodeLookup
                type="rxnorm"
                label="Medication Name *"
                value={newMed.medicationName}
                onChangeText={(v) => setNewMed(p => ({ ...p, medicationName: v }))}
                onSelect={(item: CodeResult) => {
                  setNewMed(p => ({ ...p, medicationName: item.display }));
                  setSelectedRxCode(item.code);
                }}
                selectedCode={selectedRxCode}
                placeholder="Search medications (e.g., Metformin)"
                testID="input-medication-name"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={{ marginBottom: 4, fontWeight: "600" }}>
                Dosage
              </ThemedText>
              <TextInput
                testID="input-dosage"
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={newMed.dosage}
                onChangeText={(v) => setNewMed(p => ({ ...p, dosage: v }))}
                placeholder="e.g., 500mg"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={{ marginBottom: 4, fontWeight: "600" }}>
                Frequency
              </ThemedText>
              <View style={styles.freqRow}>
                {["daily", "twice daily", "weekly", "as needed"].map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setNewMed(p => ({ ...p, frequency: f }))}
                    style={[
                      styles.freqChip,
                      {
                        backgroundColor: newMed.frequency === f ? theme.primary : theme.backgroundSecondary,
                        borderColor: newMed.frequency === f ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText type="caption" style={{ color: newMed.frequency === f ? "#FFFFFF" : theme.text, fontSize: 12 }}>
                      {f}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="caption" style={{ marginBottom: 4, fontWeight: "600" }}>
                Instructions
              </ThemedText>
              <TextInput
                testID="input-instructions"
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={newMed.instructions}
                onChangeText={(v) => setNewMed(p => ({ ...p, instructions: v }))}
                placeholder="e.g., Take with food"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <Pressable
              testID="button-save-medication"
              onPress={handleAddMed}
              disabled={addMutation.isPending || !newMed.medicationName.trim()}
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary, opacity: !newMed.medicationName.trim() ? 0.5 : 1 },
              ]}
            >
              {addMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {t.common.save}
                </ThemedText>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", flex: 1 },
  statDivider: { width: 1, height: 40 },
  streakRow: { flexDirection: "row", alignItems: "center" },
  bestStreak: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  alertCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  alertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  interactionItem: {
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  interactionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  severityBadge: {
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  refillItem: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  refillHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sideEffectItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  aiSummaryCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  aiSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineAlert: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  warningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
  },
  medCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  medHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  medIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  formGroup: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  freqRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  freqChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  smsStatusCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  smsStatusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  smsStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  smsConfigNotice: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  medHeaderIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smsIndicator: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  smsReminderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  smsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  smsStatusMsg: {
    flexDirection: "row",
    alignItems: "center",
  },
});
