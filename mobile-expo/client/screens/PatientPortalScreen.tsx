import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Appointment {
  id: string;
  title: string;
  scheduledAt: string;
  providerName: string | null;
  appointmentType: string;
  status: string;
  duration: number;
}

interface UnreadCount {
  unreadCount: number;
}

interface ReadingStats {
  articlesRead: number;
  articlesSaved: number;
  totalReadTime: number;
}

interface HealthSummaryData {
  summary: {
    totalRecords: number;
    diagnosesCount: number;
    activeDiagnosesCount: number;
    medicationsCount: number;
    activeMedicationsCount: number;
    labResultsCount: number;
    immunizationsCount: number;
    allergiesCount: number;
    vitalsCount: number;
    pendingOrdersCount: number;
  };
  activeDiagnoses: Array<{
    id: string;
    title: string;
    date: string;
    summary: string;
    provider: string;
    icdCode?: string;
    severity?: string;
    status: string;
  }>;
  activeMedications: Array<{
    id: string;
    title: string;
    summary: string;
    provider: string;
    dosage?: string;
    frequency?: string;
    status: string;
  }>;
  recentLabs: Array<{
    id: string;
    title: string;
    date: string;
    summary: string;
    provider: string;
    hasAbnormal: boolean;
  }>;
  pendingOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    tests: any;
    labProvider: string;
    orderedAt: string;
    priority: string;
  }>;
}

export default function PatientPortalScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme: colors } = useTheme();

  const { data: upcomingAppointments = [], isLoading: loadingAppts } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments/upcoming"],
  });

  const { data: unreadData } = useQuery<UnreadCount>({
    queryKey: ["/api/messaging/unread-count"],
  });

  const { data: readingStats } = useQuery<ReadingStats>({
    queryKey: ["/api/education/stats"],
  });

  const {
    data: healthSummary,
    isLoading: loadingHealth,
    refetch: refetchHealth,
  } = useQuery<HealthSummaryData>({
    queryKey: ["/api/patient/health-summary"],
  });

  const unreadCount = unreadData?.unreadCount || 0;
  const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;
  const summary = healthSummary?.summary;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
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
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days > 1 && days <= 7) return `In ${days} days`;
    return `In ${Math.ceil(days / 7)} weeks`;
  };

  const getOrderStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Draft",
      submitted: "Submitted",
      collected: "Sample Collected",
      in_progress: "Processing",
      pending: "Pending",
    };
    return labels[status] || status;
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case "submitted":
        return colors.primary;
      case "collected":
      case "in_progress":
        return colors.warning;
      case "pending":
      case "draft":
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  const navigateTo = (screen: string) => {
    navigation.navigate(screen);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderSummaryStatCard = (
    icon: keyof typeof Feather.glyphMap,
    label: string,
    count: number,
    color: string,
    onPress: () => void,
    testID: string,
    subtitle?: string
  ) => (
    <Pressable
      style={[styles.statCard, { backgroundColor: `${color}10` }]}
      onPress={onPress}
      testID={testID}
    >
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <ThemedText style={[styles.statCount, { color: colors.text }]}>{count}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</ThemedText>
      {subtitle ? (
        <ThemedText style={[styles.statSublabel, { color }]}>{subtitle}</ThemedText>
      ) : null}
    </Pressable>
  );

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => refetchHealth()}
            tintColor={colors.primary}
          />
        }
      >
        <ThemedText style={[styles.welcomeTitle, { color: colors.text }]}>
          Your Health Hub
        </ThemedText>
        <ThemedText style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
          Health records, appointments, messages, and education in one place
        </ThemedText>

        {nextAppointment ? (
          <Animated.View entering={FadeInDown.delay(50)}>
            <Pressable
              onPress={() => navigateTo("AppointmentScheduling")}
              testID="next-appointment-banner"
            >
              <Card style={{ ...styles.nextAppointmentCard, borderColor: colors.primary }}>
                <View style={styles.nextAppointmentBadge}>
                  <Feather name="zap" size={14} color={colors.primary} />
                  <ThemedText style={[styles.nextAppointmentBadgeText, { color: colors.primary }]}>
                    Next Appointment - {getRelativeDate(nextAppointment.scheduledAt)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.nextAppointmentTitle, { color: colors.text }]}>
                  {nextAppointment.title}
                </ThemedText>
                <View style={styles.nextAppointmentDetails}>
                  <View style={styles.nextAppointmentDetail}>
                    <Feather name="calendar" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.nextAppointmentText, { color: colors.text }]}>
                      {formatDate(nextAppointment.scheduledAt)} at {formatTime(nextAppointment.scheduledAt)}
                    </ThemedText>
                  </View>
                  {nextAppointment.providerName ? (
                    <View style={styles.nextAppointmentDetail}>
                      <Feather name="user" size={14} color={colors.textSecondary} />
                      <ThemedText style={[styles.nextAppointmentText, { color: colors.text }]}>
                        {nextAppointment.providerName}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(80)}>
          <Card
            onPress={() => navigateTo("PatientIntake")}
            style={{ ...styles.intakeCard, borderColor: `${colors.success}40` }}
          >
            <View style={styles.intakeRow} testID="start-intake">
              <View style={[styles.intakeIcon, { backgroundColor: `${colors.success}15` }]}>
                <Feather name="clipboard" size={24} color={colors.success} />
              </View>
              <View style={styles.intakeInfo}>
                <ThemedText style={[styles.intakeTitle, { color: colors.text }]}>
                  Patient Intake Form
                </ThemedText>
                <ThemedText style={[styles.intakeDesc, { color: colors.textSecondary }]}>
                  Complete your health information to get personalized care insights
                </ThemedText>
              </View>
              <Feather name="arrow-right" size={20} color={colors.success} />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              My Health Summary
            </ThemedText>
            <Pressable onPress={() => navigateTo("ConsolidatedPHR")} testID="view-all-records">
              <ThemedText style={[styles.viewAll, { color: colors.primary }]}>View All Records</ThemedText>
            </Pressable>
          </View>

          {loadingHealth ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : (
            <View style={styles.statsGrid}>
              {renderSummaryStatCard(
                "heart",
                "Diagnoses",
                summary?.activeDiagnosesCount || 0,
                colors.error,
                () => navigateTo("ConsolidatedPHR"),
                "stat-diagnoses",
                summary?.activeDiagnosesCount ? `${summary.activeDiagnosesCount} active` : undefined
              )}
              {renderSummaryStatCard(
                "package",
                "Medications",
                summary?.activeMedicationsCount || 0,
                colors.primary,
                () => navigateTo("MedicationAdherence"),
                "stat-medications",
                summary?.activeMedicationsCount ? `${summary.activeMedicationsCount} active` : undefined
              )}
              {renderSummaryStatCard(
                "clipboard",
                "Lab Results",
                summary?.labResultsCount || 0,
                colors.recordLab || colors.warning,
                () => navigateTo("LabResults"),
                "stat-labs"
              )}
              {renderSummaryStatCard(
                "alert-circle",
                "Allergies",
                summary?.allergiesCount || 0,
                colors.warning,
                () => navigateTo("ConsolidatedPHR"),
                "stat-allergies"
              )}
            </View>
          )}
        </Animated.View>

        {(healthSummary?.activeDiagnoses?.length || 0) > 0 ? (
          <Animated.View entering={FadeInDown.delay(130)}>
            <ThemedText style={[styles.subSectionTitle, { color: colors.text }]}>
              Active Diagnoses
            </ThemedText>
            {healthSummary!.activeDiagnoses.slice(0, 3).map((dx) => (
              <Card key={dx.id} style={styles.miniCard}>
                <View style={styles.miniCardRow}>
                  <View style={[styles.miniCardDot, { backgroundColor: colors.error }]} />
                  <View style={styles.miniCardInfo}>
                    <ThemedText style={[styles.miniCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {dx.title}
                    </ThemedText>
                    {dx.icdCode ? (
                      <ThemedText style={[styles.miniCardMeta, { color: colors.textSecondary }]}>
                        {dx.icdCode}
                      </ThemedText>
                    ) : null}
                  </View>
                  {dx.severity ? (
                    <View style={[styles.severityBadge, { backgroundColor: `${dx.severity === "high" ? colors.error : colors.warning}15` }]}>
                      <ThemedText style={[styles.severityText, { color: dx.severity === "high" ? colors.error : colors.warning }]}>
                        {dx.severity}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </Animated.View>
        ) : null}

        {(healthSummary?.activeMedications?.length || 0) > 0 ? (
          <Animated.View entering={FadeInDown.delay(150)}>
            <ThemedText style={[styles.subSectionTitle, { color: colors.text }]}>
              Active Medications
            </ThemedText>
            {healthSummary!.activeMedications.slice(0, 3).map((med) => (
              <Card key={med.id} style={styles.miniCard}>
                <View style={styles.miniCardRow}>
                  <View style={[styles.miniCardDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.miniCardInfo}>
                    <ThemedText style={[styles.miniCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {med.title}
                    </ThemedText>
                    <ThemedText style={[styles.miniCardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[med.dosage, med.frequency].filter(Boolean).join(" - ") || med.summary}
                    </ThemedText>
                  </View>
                </View>
              </Card>
            ))}
          </Animated.View>
        ) : null}

        {(healthSummary?.recentLabs?.length || 0) > 0 ? (
          <Animated.View entering={FadeInDown.delay(170)}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={[styles.subSectionTitle, { color: colors.text }]}>
                Recent Lab Results
              </ThemedText>
              <Pressable onPress={() => navigateTo("LabResults")} testID="view-all-labs">
                <ThemedText style={[styles.viewAll, { color: colors.primary }]}>View All</ThemedText>
              </Pressable>
            </View>
            {healthSummary!.recentLabs.map((lab) => (
              <Card key={lab.id} style={styles.miniCard}>
                <View style={styles.miniCardRow}>
                  <View style={[styles.miniCardDot, { backgroundColor: lab.hasAbnormal ? colors.error : colors.success }]} />
                  <View style={styles.miniCardInfo}>
                    <ThemedText style={[styles.miniCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {lab.title}
                    </ThemedText>
                    <ThemedText style={[styles.miniCardMeta, { color: colors.textSecondary }]}>
                      {formatDate(lab.date)}{lab.provider ? ` - ${lab.provider}` : ""}
                    </ThemedText>
                  </View>
                  {lab.hasAbnormal ? (
                    <View style={[styles.abnormalBadge, { backgroundColor: `${colors.error}15` }]}>
                      <Feather name="alert-triangle" size={12} color={colors.error} />
                      <ThemedText style={[styles.abnormalText, { color: colors.error }]}>Abnormal</ThemedText>
                    </View>
                  ) : null}
                </View>
              </Card>
            ))}
          </Animated.View>
        ) : null}

        {(healthSummary?.pendingOrders?.length || 0) > 0 ? (
          <Animated.View entering={FadeInDown.delay(190)}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Pending Tests & Orders
              </ThemedText>
              <View style={[styles.pendingCountBadge, { backgroundColor: `${colors.warning}15` }]}>
                <ThemedText style={[styles.pendingCountText, { color: colors.warning }]}>
                  {healthSummary!.pendingOrders.length}
                </ThemedText>
              </View>
            </View>
            {healthSummary!.pendingOrders.map((order) => (
              <Card key={order.id} style={styles.orderCard}>
                <View style={styles.orderRow}>
                  <View style={[styles.orderIcon, { backgroundColor: `${getOrderStatusColor(order.status)}15` }]}>
                    <Feather name="clock" size={16} color={getOrderStatusColor(order.status)} />
                  </View>
                  <View style={styles.orderInfo}>
                    <ThemedText style={[styles.orderTitle, { color: colors.text }]} numberOfLines={1}>
                      {order.labProvider || "Lab"} - #{order.orderNumber}
                    </ThemedText>
                    <View style={styles.orderMeta}>
                      <View style={[styles.statusPill, { backgroundColor: `${getOrderStatusColor(order.status)}15` }]}>
                        <ThemedText style={[styles.statusPillText, { color: getOrderStatusColor(order.status) }]}>
                          {getOrderStatusLabel(order.status)}
                        </ThemedText>
                      </View>
                      {order.priority === "stat" || order.priority === "urgent" ? (
                        <View style={[styles.priorityPill, { backgroundColor: `${colors.error}15` }]}>
                          <ThemedText style={[styles.priorityPillText, { color: colors.error }]}>
                            {order.priority.toUpperCase()}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                    {order.tests && Array.isArray(order.tests) ? (
                      <ThemedText style={[styles.orderTests, { color: colors.textSecondary }]} numberOfLines={1}>
                        {(order.tests as any[]).map((t: any) => t.testName || t.name || t).join(", ")}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))}
          </Animated.View>
        ) : null}

        <View style={styles.quickActions}>
          <Animated.View entering={FadeInDown.delay(200)} style={styles.quickActionWrapper}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: `${colors.primary}10` }]}
              onPress={() => navigateTo("AppointmentScheduling")}
              testID="quick-action-appointments"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.primary }]}>
                <Feather name="calendar" size={22} color="#fff" />
              </View>
              <ThemedText style={[styles.quickActionTitle, { color: colors.text }]}>Appointments</ThemedText>
              <ThemedText style={[styles.quickActionSub, { color: colors.textSecondary }]}>
                {upcomingAppointments.length > 0 ? `${upcomingAppointments.length} upcoming` : "Schedule now"}
              </ThemedText>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250)} style={styles.quickActionWrapper}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: `${colors.success}10` }]}
              onPress={() => navigateTo("SecureMessaging")}
              testID="quick-action-messages"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.success }]}>
                <Feather name="message-circle" size={22} color="#fff" />
              </View>
              <ThemedText style={[styles.quickActionTitle, { color: colors.text }]}>Messages</ThemedText>
              <ThemedText style={[styles.quickActionSub, { color: colors.textSecondary }]}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </ThemedText>
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <ThemedText style={styles.badgeText}>{unreadCount}</ThemedText>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300)} style={styles.quickActionWrapper}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: `${colors.warning}10` }]}
              onPress={() => navigateTo("EducationHub")}
              testID="quick-action-education"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.warning }]}>
                <Feather name="book-open" size={22} color="#fff" />
              </View>
              <ThemedText style={[styles.quickActionTitle, { color: colors.text }]}>Education</ThemedText>
              <ThemedText style={[styles.quickActionSub, { color: colors.textSecondary }]}>
                {readingStats?.articlesRead ? `${readingStats.articlesRead} articles read` : "Start learning"}
              </ThemedText>
            </Pressable>
          </Animated.View>
        </View>

        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
          Services
        </ThemedText>

        <Animated.View entering={FadeInDown.delay(320)}>
          <Pressable onPress={() => navigateTo("ConsolidatedPHR")} testID="service-health-records">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.success}15` }]}>
                  <Feather name="folder" size={22} color={colors.success} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    My Health Records
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    Complete view of diagnoses, medications, labs, vitals, and more
                  </ThemedText>
                </View>
                {summary?.totalRecords ? (
                  <View style={styles.serviceRight}>
                    <View style={[styles.serviceBadge, { backgroundColor: colors.success }]}>
                      <ThemedText style={styles.serviceBadgeText}>{summary.totalRecords}</ThemedText>
                    </View>
                    <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                  </View>
                ) : (
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                )}
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(340)}>
          <Pressable onPress={() => navigateTo("AppointmentScheduling")} testID="service-schedule">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="plus-circle" size={22} color={colors.primary} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    Schedule an Appointment
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    Book, reschedule, or cancel appointments with your providers
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(360)}>
          <Pressable onPress={() => navigateTo("SecureMessaging")} testID="service-messaging">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.success}15` }]}>
                  <Feather name="mail" size={22} color={colors.success} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    Secure Messaging
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    Send non-urgent messages to your care team securely
                  </ThemedText>
                </View>
                <View style={styles.serviceRight}>
                  {unreadCount > 0 ? (
                    <View style={[styles.serviceBadge, { backgroundColor: colors.error }]}>
                      <ThemedText style={styles.serviceBadgeText}>{unreadCount}</ThemedText>
                    </View>
                  ) : null}
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                </View>
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380)}>
          <Pressable onPress={() => navigateTo("EducationHub")} testID="service-education">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.warning}15` }]}>
                  <Feather name="book-open" size={22} color={colors.warning} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    Health Education
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    Personalized articles and resources for your conditions
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)}>
          <Pressable onPress={() => navigateTo("CareTeam")} testID="service-careteam">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="users" size={22} color={colors.primary} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    My Care Team
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    View and manage your healthcare providers
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(420)}>
          <Pressable onPress={() => navigateTo("MedicationAdherence")} testID="service-medications">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.error}15` }]}>
                  <Feather name="package" size={22} color={colors.error} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    Medications
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    Track medications, refills, and adherence
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(440)}>
          <Pressable onPress={() => navigateTo("LabResults")} testID="service-lab-results">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.recordLab || colors.warning}15` }]}>
                  <Feather name="clipboard" size={22} color={colors.recordLab || colors.warning} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    Lab Results
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    View results with abnormal flagging and AI analysis
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(460)}>
          <Pressable onPress={() => navigateTo("Telehealth")} testID="service-telehealth">
            <Card style={styles.serviceCard}>
              <View style={styles.serviceRow}>
                <View style={[styles.serviceIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="video" size={22} color={colors.primary} />
                </View>
                <View style={styles.serviceInfo}>
                  <ThemedText style={[styles.serviceTitle, { color: colors.text }]}>
                    Telehealth
                  </ThemedText>
                  <ThemedText style={[styles.serviceDesc, { color: colors.textSecondary }]}>
                    Virtual consultations with your providers
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <View style={styles.upcomingSection}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              Upcoming Appointments
            </ThemedText>
            <Pressable onPress={() => navigateTo("AppointmentScheduling")} testID="view-all-appointments">
              <ThemedText style={[styles.viewAll, { color: colors.primary }]}>View All</ThemedText>
            </Pressable>
          </View>

          {loadingAppts ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: Spacing.md }} />
          ) : upcomingAppointments.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Feather name="calendar" size={32} color={colors.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No upcoming appointments
              </ThemedText>
              <Pressable
                style={[styles.emptyAction, { backgroundColor: colors.primary }]}
                onPress={() => navigateTo("AppointmentScheduling")}
                testID="schedule-first-appointment"
              >
                <ThemedText style={styles.emptyActionText}>Schedule Now</ThemedText>
              </Pressable>
            </Card>
          ) : (
            upcomingAppointments.slice(0, 3).map((appt, index) => (
              <Animated.View key={appt.id} entering={FadeInDown.delay(480 + index * 50)}>
                <Card style={styles.appointmentMiniCard}>
                  <View style={styles.appointmentMiniRow}>
                    <View style={[styles.appointmentMiniIcon, { backgroundColor: `${colors.primary}15` }]}>
                      <Feather name="calendar" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.appointmentMiniInfo}>
                      <ThemedText style={[styles.appointmentMiniTitle, { color: colors.text }]} numberOfLines={1}>
                        {appt.title}
                      </ThemedText>
                      <ThemedText style={[styles.appointmentMiniDate, { color: colors.textSecondary }]}>
                        {formatDate(appt.scheduledAt)} at {formatTime(appt.scheduledAt)}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.appointmentMiniRelative, { color: colors.primary }]}>
                      {getRelativeDate(appt.scheduledAt)}
                    </ThemedText>
                  </View>
                </Card>
              </Animated.View>
            ))
          )}
        </View>

        <Animated.View entering={FadeInDown.delay(550)}>
          <Pressable onPress={() => navigateTo("PrivacyPractices")} testID="consent-privacy-link">
            <Card style={[styles.consentCard, { borderColor: `${colors.primary}30` }]}>
              <View style={styles.consentRow}>
                <View style={[styles.consentIcon, { backgroundColor: `${colors.primary}10` }]}>
                  <Feather name="lock" size={20} color={colors.primary} />
                </View>
                <View style={styles.consentInfo}>
                  <ThemedText style={[styles.consentTitle, { color: colors.text }]}>
                    Privacy & Consent
                  </ThemedText>
                  <ThemedText style={[styles.consentDesc, { color: colors.textSecondary }]}>
                    View your data sharing preferences, consent history, and Notice of Privacy Practices
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </View>
            </Card>
          </Pressable>
        </Animated.View>

        <View style={[styles.hipaaNotice, { backgroundColor: `${colors.primary}08` }]}>
          <Feather name="shield" size={16} color={colors.primary} />
          <ThemedText style={[styles.hipaaText, { color: colors.textSecondary }]}>
            All communications are HIPAA-compliant and encrypted end-to-end. Your health data is protected under federal and state privacy laws including SUD and reproductive health protections.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  welcomeTitle: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.lg },
  nextAppointmentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  nextAppointmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  nextAppointmentBadgeText: { fontSize: 13, fontWeight: "600" },
  nextAppointmentTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  nextAppointmentDetails: { gap: 4 },
  nextAppointmentDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nextAppointmentText: { fontSize: 14 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  subSectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm, marginTop: Spacing.md },
  viewAll: { fontSize: 14, fontWeight: "600" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  statCount: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  statSublabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  miniCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  miniCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  miniCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniCardInfo: { flex: 1, marginLeft: Spacing.sm },
  miniCardTitle: { fontSize: 14, fontWeight: "600" },
  miniCardMeta: { fontSize: 12, marginTop: 1 },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  abnormalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  abnormalText: { fontSize: 11, fontWeight: "600" },
  pendingCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pendingCountText: { fontSize: 13, fontWeight: "700" },
  orderCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  orderInfo: { flex: 1, marginLeft: Spacing.sm },
  orderTitle: { fontSize: 14, fontWeight: "600" },
  orderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillText: { fontSize: 11, fontWeight: "600" },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityPillText: { fontSize: 10, fontWeight: "700" },
  orderTests: { fontSize: 12, marginTop: 2 },
  quickActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  quickActionWrapper: { flex: 1 },
  quickAction: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    position: "relative",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  quickActionTitle: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  quickActionSub: { fontSize: 11, textAlign: "center", marginTop: 2 },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  serviceCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceInfo: { flex: 1, marginLeft: Spacing.md },
  serviceTitle: { fontSize: 15, fontWeight: "600" },
  serviceDesc: { fontSize: 13, marginTop: 2 },
  serviceRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  serviceBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  serviceBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  upcomingSection: { marginTop: Spacing.lg },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  emptyText: { fontSize: 14, marginTop: Spacing.sm, marginBottom: Spacing.md },
  emptyAction: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyActionText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  appointmentMiniCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  appointmentMiniRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  appointmentMiniIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentMiniInfo: { flex: 1, marginLeft: Spacing.sm },
  appointmentMiniTitle: { fontSize: 14, fontWeight: "600" },
  appointmentMiniDate: { fontSize: 12, marginTop: 2 },
  appointmentMiniRelative: { fontSize: 12, fontWeight: "600" },
  consentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  consentIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  consentInfo: { flex: 1, marginLeft: Spacing.md },
  consentTitle: { fontSize: 15, fontWeight: "600" },
  consentDesc: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  hipaaNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  hipaaText: { flex: 1, fontSize: 12, lineHeight: 18 },
  intakeCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  intakeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  intakeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  intakeInfo: { flex: 1, marginLeft: Spacing.md },
  intakeTitle: { fontSize: 15, fontWeight: "600" },
  intakeDesc: { fontSize: 12, marginTop: 2, lineHeight: 18 },
});
