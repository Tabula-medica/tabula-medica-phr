import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface AppointmentSuggestion {
  id: string;
  title: string;
  description: string;
  appointmentType: string;
  suggestionType: string;
  priority: string;
  suggestedTimeframe: string;
  suggestedSpecialty: string | null;
  rationale: string;
  relatedConditions: string[];
  relatedRisks: string[];
  confidence: number;
  status: string;
  createdAt: string;
}

interface RefillRequest {
  id: string;
  medicationName: string;
  medicationDetails: {
    dosage?: string;
    frequency?: string;
  };
  requestType: string;
  daysSupplyRemaining: number | null;
  predictedRunOutDate: string | null;
  priority: string;
  insuranceDetails: {
    priorAuthRequired?: boolean;
  } | null;
  aiRationale: string;
  status: string;
  createdAt: string;
}

interface ConsultationSummary {
  id: string;
  summaryType: string;
  title: string;
  executiveSummary: string;
  keyFindings: Array<{
    category: string;
    finding: string;
    significance: string;
    actionRequired?: boolean;
  }>;
  recommendations: Array<{
    priority: string;
    recommendation: string;
    rationale: string;
  }>;
  followUpActions: Array<{
    action: string;
    timeframe: string;
  }>;
  questionsToAsk: string[];
  userRating: number | null;
  createdAt: string;
}

interface DashboardData {
  stats: {
    pendingSuggestions: number;
    pendingRefills: number;
    recentSummaries: number;
  };
  pendingSuggestions: AppointmentSuggestion[];
  pendingRefills: RefillRequest[];
  recentSummaries: ConsultationSummary[];
}

export default function WorkflowAutomationScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"appointments" | "refills" | "summaries">("appointments");
  const [selectedSuggestion, setSelectedSuggestion] = useState<AppointmentSuggestion | null>(null);
  const [selectedRefill, setSelectedRefill] = useState<RefillRequest | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<ConsultationSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/workflow-automation/dashboard"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/api/workflow-automation/refresh");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const dismissSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await axiosInstance.post(`/api/workflow-automation/appointment-suggestions/${id}/dismiss`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation"] });
      setSelectedSuggestion(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const approveRefillMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await axiosInstance.post(`/api/workflow-automation/refill-requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation"] });
      setSelectedRefill(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.post("/api/workflow-automation/consultation-summaries/generate", {
        summaryType: "comprehensive",
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "Unable to generate summary. Please ensure you have health records.");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
      case "urgent":
        return colors.error;
      case "medium":
        return colors.warning;
      default:
        return colors.success;
    }
  };

  const getTypeIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "checkup":
        return "clipboard";
      case "specialist":
        return "user";
      case "lab":
        return "activity";
      case "imaging":
        return "camera";
      case "therapy":
        return "heart";
      case "vaccination":
        return "shield";
      case "follow_up":
        return "calendar";
      default:
        return "plus-circle";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderStats = () => {
    const stats = dashboard?.stats;
    return (
      <Animated.View entering={FadeInDown.delay(100)} style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="calendar" size={20} color={colors.primary} />
          </View>
          <ThemedText style={styles.statNumber}>{stats?.pendingSuggestions || 0}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
            Appointments
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.success + "20" }]}>
            <Feather name="package" size={20} color={colors.success} />
          </View>
          <ThemedText style={styles.statNumber}>{stats?.pendingRefills || 0}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
            Refills
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.warning + "20" }]}>
            <Feather name="file-text" size={20} color={colors.warning} />
          </View>
          <ThemedText style={styles.statNumber}>{stats?.recentSummaries || 0}</ThemedText>
          <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
            Summaries
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={[styles.tabContainer, { backgroundColor: colors.backgroundSecondary }]}>
      {[
        { key: "appointments", label: "Appointments", icon: "calendar" },
        { key: "refills", label: "Refills", icon: "package" },
        { key: "summaries", label: "Summaries", icon: "file-text" },
      ].map((tab) => (
        <Pressable
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && { backgroundColor: colors.primary },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab(tab.key as typeof activeTab);
          }}
        >
          <Feather
            name={tab.icon as keyof typeof Feather.glyphMap}
            size={16}
            color={activeTab === tab.key ? "#FFFFFF" : colors.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === tab.key ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            {tab.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderAppointmentCard = (suggestion: AppointmentSuggestion) => (
    <Pressable
      key={suggestion.id}
      style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
      onPress={() => {
        Haptics.selectionAsync();
        setSelectedSuggestion(suggestion);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: colors.primary + "20" }]}>
          <Feather name={getTypeIcon(suggestion.appointmentType)} size={18} color={colors.primary} />
        </View>
        <View style={styles.cardHeaderText}>
          <ThemedText style={styles.cardTitle}>{suggestion.title}</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            {suggestion.suggestedSpecialty || suggestion.appointmentType}
          </ThemedText>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(suggestion.priority) + "20" }]}>
          <ThemedText style={[styles.priorityText, { color: getPriorityColor(suggestion.priority) }]}>
            {suggestion.priority.toUpperCase()}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
        {suggestion.description}
      </ThemedText>
      <View style={styles.cardFooter}>
        <View style={styles.timeframeBadge}>
          <Feather name="clock" size={12} color={colors.textSecondary} />
          <ThemedText style={[styles.timeframeText, { color: colors.textSecondary }]}>
            {suggestion.suggestedTimeframe}
          </ThemedText>
        </View>
        <ThemedText style={[styles.confidenceText, { color: colors.textSecondary }]}>
          {suggestion.confidence}% confidence
        </ThemedText>
      </View>
    </Pressable>
  );

  const renderRefillCard = (request: RefillRequest) => (
    <Pressable
      key={request.id}
      style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
      onPress={() => {
        Haptics.selectionAsync();
        setSelectedRefill(request);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: colors.success + "20" }]}>
          <Feather name="package" size={18} color={colors.success} />
        </View>
        <View style={styles.cardHeaderText}>
          <ThemedText style={styles.cardTitle}>{request.medicationName}</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            {request.medicationDetails?.dosage} - {request.medicationDetails?.frequency}
          </ThemedText>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(request.priority) + "20" }]}>
          <ThemedText style={[styles.priorityText, { color: getPriorityColor(request.priority) }]}>
            {request.priority.toUpperCase()}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
        {request.aiRationale}
      </ThemedText>
      <View style={styles.cardFooter}>
        {request.daysSupplyRemaining != null ? (
          <View style={styles.timeframeBadge}>
            <Feather name="alert-circle" size={12} color={colors.warning} />
            <ThemedText style={[styles.timeframeText, { color: colors.warning }]}>
              {request.daysSupplyRemaining} days remaining
            </ThemedText>
          </View>
        ) : null}
        {request.insuranceDetails?.priorAuthRequired ? (
          <View style={[styles.authBadge, { backgroundColor: colors.warning + "20" }]}>
            <ThemedText style={[styles.authText, { color: colors.warning }]}>Prior Auth</ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  const renderSummaryCard = (summary: ConsultationSummary) => (
    <Pressable
      key={summary.id}
      style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}
      onPress={() => {
        Haptics.selectionAsync();
        setSelectedSummary(summary);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: colors.warning + "20" }]}>
          <Feather name="file-text" size={18} color={colors.warning} />
        </View>
        <View style={styles.cardHeaderText}>
          <ThemedText style={styles.cardTitle}>{summary.title}</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            {formatDate(summary.createdAt)}
          </ThemedText>
        </View>
        {summary.userRating != null ? (
          <View style={styles.ratingContainer}>
            <Feather name="star" size={14} color={colors.warning} />
            <ThemedText style={[styles.ratingText, { color: colors.warning }]}>{summary.userRating}</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={3}>
        {summary.executiveSummary}
      </ThemedText>
      <View style={styles.cardFooter}>
        <View style={styles.countBadge}>
          <ThemedText style={[styles.countText, { color: colors.textSecondary }]}>
            {summary.keyFindings?.length || 0} findings
          </ThemedText>
        </View>
        <View style={styles.countBadge}>
          <ThemedText style={[styles.countText, { color: colors.textSecondary }]}>
            {summary.recommendations?.length || 0} recommendations
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading workflows...
          </ThemedText>
        </View>
      );
    }

    switch (activeTab) {
      case "appointments":
        return (
          <View style={styles.listContainer}>
            {dashboard?.pendingSuggestions && dashboard.pendingSuggestions.length > 0 ? (
              dashboard.pendingSuggestions.map(renderAppointmentCard)
            ) : (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={48} color={colors.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No appointment suggestions
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Tap refresh to generate AI-powered suggestions
                </ThemedText>
              </View>
            )}
          </View>
        );
      case "refills":
        return (
          <View style={styles.listContainer}>
            {dashboard?.pendingRefills && dashboard.pendingRefills.length > 0 ? (
              dashboard.pendingRefills.map(renderRefillCard)
            ) : (
              <View style={styles.emptyState}>
                <Feather name="package" size={48} color={colors.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending refill requests
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Tap refresh to check medication refill needs
                </ThemedText>
              </View>
            )}
          </View>
        );
      case "summaries":
        return (
          <View style={styles.listContainer}>
            <Pressable
              style={[styles.generateButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                generateSummaryMutation.mutate();
              }}
              disabled={generateSummaryMutation.isPending}
            >
              {generateSummaryMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="plus" size={20} color="#FFFFFF" />
              )}
              <ThemedText style={styles.generateButtonText}>
                {generateSummaryMutation.isPending ? "Generating..." : "Generate New Summary"}
              </ThemedText>
            </Pressable>
            {dashboard?.recentSummaries && dashboard.recentSummaries.length > 0 ? (
              dashboard.recentSummaries.map(renderSummaryCard)
            ) : (
              <View style={styles.emptyState}>
                <Feather name="file-text" size={48} color={colors.textSecondary} />
                <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No consultation summaries
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Generate a summary from your health records
                </ThemedText>
              </View>
            )}
          </View>
        );
    }
  };

  const renderSuggestionModal = () => (
    <Modal visible={!!selectedSuggestion} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: colors.backgroundDefault }]}>
        <View style={styles.modalHeader}>
          <ThemedText style={styles.modalTitle}>Appointment Suggestion</ThemedText>
          <Pressable onPress={() => setSelectedSuggestion(null)}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {selectedSuggestion ? (
            <>
              <View style={[styles.modalCard, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.modalIcon, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name={getTypeIcon(selectedSuggestion.appointmentType)} size={32} color={colors.primary} />
                </View>
                <ThemedText style={styles.modalCardTitle}>{selectedSuggestion.title}</ThemedText>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedSuggestion.priority) + "20" }]}>
                  <ThemedText style={[styles.priorityText, { color: getPriorityColor(selectedSuggestion.priority) }]}>
                    {selectedSuggestion.priority.toUpperCase()} PRIORITY
                  </ThemedText>
                </View>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={styles.sectionTitle}>Description</ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {selectedSuggestion.description}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={styles.sectionTitle}>Why This Is Recommended</ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {selectedSuggestion.rationale}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={styles.sectionTitle}>Suggested Timeframe</ThemedText>
                <View style={[styles.infoRow, { backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name="clock" size={18} color={colors.primary} />
                  <ThemedText style={styles.infoText}>{selectedSuggestion.suggestedTimeframe}</ThemedText>
                </View>
              </View>

              {selectedSuggestion.relatedConditions && selectedSuggestion.relatedConditions.length > 0 ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.sectionTitle}>Related Conditions</ThemedText>
                  <View style={styles.tagContainer}>
                    {selectedSuggestion.relatedConditions.map((condition, idx) => (
                      <View key={idx} style={[styles.tag, { backgroundColor: colors.primary + "20" }]}>
                        <ThemedText style={[styles.tagText, { color: colors.primary }]}>{condition}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    dismissSuggestionMutation.mutate(selectedSuggestion.id);
                  }}
                  disabled={dismissSuggestionMutation.isPending}
                >
                  <Feather name="x" size={18} color={colors.error} />
                  <ThemedText style={[styles.actionButtonText, { color: colors.error }]}>Dismiss</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Alert.alert("Schedule Appointment", "This would open your calendar or appointment booking system.");
                  }}
                >
                  <Feather name="calendar" size={18} color="#FFFFFF" />
                  <ThemedText style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Schedule</ThemedText>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderRefillModal = () => (
    <Modal visible={!!selectedRefill} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: colors.backgroundDefault }]}>
        <View style={styles.modalHeader}>
          <ThemedText style={styles.modalTitle}>Refill Request</ThemedText>
          <Pressable onPress={() => setSelectedRefill(null)}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {selectedRefill ? (
            <>
              <View style={[styles.modalCard, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.modalIcon, { backgroundColor: colors.success + "20" }]}>
                  <Feather name="package" size={32} color={colors.success} />
                </View>
                <ThemedText style={styles.modalCardTitle}>{selectedRefill.medicationName}</ThemedText>
                <ThemedText style={[styles.modalCardSubtitle, { color: colors.textSecondary }]}>
                  {selectedRefill.medicationDetails?.dosage} - {selectedRefill.medicationDetails?.frequency}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={styles.sectionTitle}>Refill Recommendation</ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {selectedRefill.aiRationale}
                </ThemedText>
              </View>

              {selectedRefill.daysSupplyRemaining != null ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.sectionTitle}>Supply Status</ThemedText>
                  <View style={[styles.infoRow, { backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="alert-circle" size={18} color={colors.warning} />
                    <ThemedText style={styles.infoText}>
                      Approximately {selectedRefill.daysSupplyRemaining} days remaining
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {selectedRefill.insuranceDetails?.priorAuthRequired ? (
                <View style={styles.modalSection}>
                  <View style={[styles.warningBox, { backgroundColor: colors.warning + "20" }]}>
                    <Feather name="alert-triangle" size={18} color={colors.warning} />
                    <ThemedText style={[styles.warningText, { color: colors.warning }]}>
                      Prior authorization may be required
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
                  onPress={() => setSelectedRefill(null)}
                >
                  <Feather name="x" size={18} color={colors.textSecondary} />
                  <ThemedText style={[styles.actionButtonText, { color: colors.textSecondary }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.success }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    approveRefillMutation.mutate(selectedRefill.id);
                  }}
                  disabled={approveRefillMutation.isPending}
                >
                  {approveRefillMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={18} color="#FFFFFF" />
                  )}
                  <ThemedText style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Approve Request</ThemedText>
                </Pressable>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderSummaryModal = () => (
    <Modal visible={!!selectedSummary} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: colors.backgroundDefault }]}>
        <View style={styles.modalHeader}>
          <ThemedText style={styles.modalTitle}>Consultation Summary</ThemedText>
          <Pressable onPress={() => setSelectedSummary(null)}>
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {selectedSummary ? (
            <>
              <View style={[styles.modalCard, { backgroundColor: colors.backgroundSecondary }]}>
                <View style={[styles.modalIcon, { backgroundColor: colors.warning + "20" }]}>
                  <Feather name="file-text" size={32} color={colors.warning} />
                </View>
                <ThemedText style={styles.modalCardTitle}>{selectedSummary.title}</ThemedText>
                <ThemedText style={[styles.modalCardSubtitle, { color: colors.textSecondary }]}>
                  {formatDate(selectedSummary.createdAt)}
                </ThemedText>
              </View>

              <View style={styles.modalSection}>
                <ThemedText style={styles.sectionTitle}>Summary</ThemedText>
                <ThemedText style={[styles.sectionText, { color: colors.textSecondary }]}>
                  {selectedSummary.executiveSummary}
                </ThemedText>
              </View>

              {selectedSummary.keyFindings && selectedSummary.keyFindings.length > 0 ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.sectionTitle}>Key Findings</ThemedText>
                  {selectedSummary.keyFindings.map((finding, idx) => (
                    <View key={idx} style={[styles.findingCard, { backgroundColor: colors.backgroundSecondary }]}>
                      <View style={styles.findingHeader}>
                        <ThemedText style={styles.findingCategory}>{finding.category}</ThemedText>
                        {finding.actionRequired ? (
                          <View style={[styles.actionBadge, { backgroundColor: colors.error + "20" }]}>
                            <ThemedText style={[styles.actionBadgeText, { color: colors.error }]}>Action Needed</ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText style={styles.findingText}>{finding.finding}</ThemedText>
                      <ThemedText style={[styles.findingSignificance, { color: colors.textSecondary }]}>
                        {finding.significance}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {selectedSummary.recommendations && selectedSummary.recommendations.length > 0 ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.sectionTitle}>Recommendations</ThemedText>
                  {selectedSummary.recommendations.map((rec, idx) => (
                    <View key={idx} style={[styles.recommendationCard, { backgroundColor: colors.backgroundSecondary }]}>
                      <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(rec.priority) }]} />
                      <View style={styles.recommendationContent}>
                        <ThemedText style={styles.recommendationText}>{rec.recommendation}</ThemedText>
                        <ThemedText style={[styles.recommendationRationale, { color: colors.textSecondary }]}>
                          {rec.rationale}
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {selectedSummary.questionsToAsk && selectedSummary.questionsToAsk.length > 0 ? (
                <View style={styles.modalSection}>
                  <ThemedText style={styles.sectionTitle}>Questions to Ask Your Provider</ThemedText>
                  {selectedSummary.questionsToAsk.map((question, idx) => (
                    <View key={idx} style={[styles.questionItem, { backgroundColor: colors.backgroundSecondary }]}>
                      <Feather name="help-circle" size={16} color={colors.primary} />
                      <ThemedText style={styles.questionText}>{question}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View entering={FadeIn}>
          <View style={styles.headerSection}>
            <ThemedText style={styles.headerTitle}>Workflow Automation</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              AI-powered healthcare task management
            </ThemedText>
          </View>

          <Pressable
            style={[styles.refreshButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              refreshMutation.mutate();
            }}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="refresh-cw" size={18} color="#FFFFFF" />
            )}
            <ThemedText style={styles.refreshButtonText}>
              {refreshMutation.isPending ? "Analyzing..." : "Refresh Suggestions"}
            </ThemedText>
          </Pressable>

          {renderStats()}
          {renderTabs()}
          {renderContent()}
        </Animated.View>
      </ScrollView>

      {renderSuggestionModal()}
      {renderRefillModal()}
      {renderSummaryModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 15,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContainer: {
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
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
  cardHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  timeframeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeframeText: {
    fontSize: 12,
  },
  confidenceText: {
    fontSize: 12,
  },
  authBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  authText: {
    fontSize: 11,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  modalCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  modalCardSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  modalSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  infoText: {
    fontSize: 15,
    fontWeight: "500",
  },
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  primaryButton: {},
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  warningText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  findingCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  findingCategory: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.7,
  },
  actionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  findingText: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  findingSignificance: {
    fontSize: 13,
  },
  recommendationCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: Spacing.md,
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationText: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  recommendationRationale: {
    fontSize: 13,
  },
  questionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
