import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

type TabId = "overview" | "appointments" | "procedures" | "treatment" | "xrays";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "appointments", label: "Visits", icon: "calendar" },
  { id: "procedures", label: "Procedures", icon: "clipboard" },
  { id: "treatment", label: "Plan", icon: "file-text" },
  { id: "xrays", label: "Images", icon: "image" },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function StatusBadge({ status, type }: { status: string; type: "appointment" | "procedure" }) {
  const { theme } = useTheme();
  const colorMap: Record<string, string> = {
    Scheduled: "#3B82F6",
    Complete: "#10B981",
    Completed: "#10B981",
    "Treatment Planned": "#F59E0B",
    Broken: "#EF4444",
    Cancelled: "#EF4444",
    ASAP: "#F97316",
    Planned: "#8B5CF6",
    "Existing/Current": "#6B7280",
  };
  const color = colorMap[status] || "#6B7280";
  return (
    <View style={[styles.badge, { backgroundColor: color + "20", borderColor: color + "40" }]}>
      <ThemedText type="small" style={{ color, fontWeight: "600", fontSize: 11 }}>{status}</ThemedText>
    </View>
  );
}

function ToothDiagram({ toothNum }: { toothNum: string }) {
  const { theme } = useTheme();
  if (!toothNum) return null;
  return (
    <View style={[styles.toothBadge, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }]}>
      <Feather name="hash" size={10} color={theme.primary} />
      <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700", fontSize: 11, marginLeft: 2 }}>{toothNum}</ThemedText>
    </View>
  );
}

export default function OpenDentalScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const { checkFeature, promptProps, isSubscribed } = useFeatureGate();

  useEffect(() => {
    if (!isSubscribed) {
      checkFeature("dental_integrations");
    }
  }, [isSubscribed, checkFeature]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<any>({
    queryKey: ["/api/dental/records"],
  });

  const configQuery = useQuery<any>({
    queryKey: ["/api/dental/config"],
  });

  const isDemo = !configQuery.data?.configured;
  const records = data;

  const completedProcedures = useMemo(() =>
    records?.procedures?.filter((p: any) => p.ProcStatus === 2) || [],
  [records]);

  const plannedProcedures = useMemo(() =>
    records?.procedures?.filter((p: any) => p.ProcStatus === 1) || [],
  [records]);

  const upcomingAppointments = useMemo(() =>
    records?.appointments?.filter((a: any) => a.AptStatus === 1) || [],
  [records]);

  const pastAppointments = useMemo(() =>
    records?.appointments?.filter((a: any) => a.AptStatus === 2) || [],
  [records]);

  const totalSpent = useMemo(() =>
    completedProcedures.reduce((sum: number, p: any) => sum + (p.ProcFee || 0), 0),
  [completedProcedures]);

  const treatmentPlanCost = useMemo(() =>
    plannedProcedures.reduce((sum: number, p: any) => sum + (p.ProcFee || 0), 0),
  [plannedProcedures]);

  const renderOverview = () => (
    <View>
      {isDemo ? (
        <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: "#F59E0B" }]}>
          <View style={styles.cardRow}>
            <Feather name="info" size={16} color="#F59E0B" />
            <ThemedText type="small" style={{ flex: 1, marginLeft: 8, color: "#F59E0B" }}>
              Running in demo mode. Connect your Open Dental practice to see real data.
            </ThemedText>
          </View>
        </Card>
      ) : null}

      <View style={styles.statsGrid}>
        <Card style={[styles.statCard, { flex: 1 }]}>
          <View style={[styles.statIcon, { backgroundColor: "#3B82F620" }]}>
            <Feather name="calendar" size={18} color="#3B82F6" />
          </View>
          <ThemedText style={styles.statValue}>{upcomingAppointments.length}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Upcoming</ThemedText>
        </Card>
        <Card style={[styles.statCard, { flex: 1 }]}>
          <View style={[styles.statIcon, { backgroundColor: "#10B98120" }]}>
            <Feather name="check-circle" size={18} color="#10B981" />
          </View>
          <ThemedText style={styles.statValue}>{completedProcedures.length}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Completed</ThemedText>
        </Card>
        <Card style={[styles.statCard, { flex: 1 }]}>
          <View style={[styles.statIcon, { backgroundColor: "#8B5CF620" }]}>
            <Feather name="file-text" size={18} color="#8B5CF6" />
          </View>
          <ThemedText style={styles.statValue}>{plannedProcedures.length}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Planned</ThemedText>
        </Card>
      </View>

      {records?.insurance?.length > 0 ? (
        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Dental Insurance</ThemedText>
          {records.insurance.map((ins: any, i: number) => (
            <View key={i} style={styles.insuranceRow}>
              <View style={[styles.insuranceIcon, { backgroundColor: "#3B82F615" }]}>
                <Feather name="shield" size={16} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "600" }}>{ins.carrierName}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {ins.planType} | Group: {ins.groupNum} | ID: {ins.subscriberId}
                </ThemedText>
              </View>
            </View>
          ))}
          {records.patient?.InsEst > 0 ? (
            <View style={[styles.estimateRow, { backgroundColor: isDark ? "#1E293B" : "#F0FDF4" }]}>
              <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600" }}>
                Estimated remaining benefits: {formatCurrency(records.patient.InsEst)}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      ) : null}

      {upcomingAppointments.length > 0 ? (
        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Next Appointment</ThemedText>
          {upcomingAppointments.slice(0, 1).map((apt: any) => (
            <View key={apt.AptNum}>
              <View style={styles.aptHeader}>
                <View style={[styles.aptDateBadge, { backgroundColor: "#3B82F615" }]}>
                  <Feather name="calendar" size={14} color="#3B82F6" />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "600", color: "#3B82F6" }}>
                    {formatDate(apt.AptDateTime)}
                  </ThemedText>
                </View>
                <StatusBadge status="Scheduled" type="appointment" />
              </View>
              <ThemedText style={{ marginTop: 8, fontWeight: "500" }}>{apt.ProcDescript}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {apt.ProvBarText}
              </ThemedText>
              {apt.Note ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>
                  {apt.Note}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <ThemedText style={styles.sectionTitle}>Cost Summary</ThemedText>
        <View style={styles.costRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Completed procedures</ThemedText>
          <ThemedText style={{ fontWeight: "600" }}>{formatCurrency(totalSpent)}</ThemedText>
        </View>
        <View style={[styles.costRow, { borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 8 }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Treatment plan estimate</ThemedText>
          <ThemedText style={{ fontWeight: "600", color: "#F59E0B" }}>{formatCurrency(treatmentPlanCost)}</ThemedText>
        </View>
      </Card>

      {records?.perioExams?.length > 0 ? (
        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Periodontal Health</ThemedText>
          {records.perioExams.map((exam: any) => (
            <View key={exam.PerioExamNum}>
              <View style={styles.aptHeader}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Exam date: {formatDate(exam.ExamDate)}
                </ThemedText>
                <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600" }}>
                  {exam.measurements?.length || 0} sites measured
                </ThemedText>
              </View>
              {exam.measurements?.length > 0 ? (
                <View style={styles.perioGrid}>
                  {exam.measurements.slice(0, 8).map((m: any, i: number) => {
                    const maxDepth = Math.max(m.MBvalue, m.Bvalue, m.DBvalue, m.MLvalue, m.Lvalue, m.DLvalue);
                    const color = maxDepth <= 3 ? "#10B981" : maxDepth <= 5 ? "#F59E0B" : "#EF4444";
                    return (
                      <View key={i} style={[styles.perioCell, { borderColor: color + "40" }]}>
                        <ThemedText type="small" style={{ fontWeight: "700", fontSize: 11 }}>#{m.IntTooth}</ThemedText>
                        <ThemedText type="small" style={{ color, fontWeight: "600", fontSize: 13 }}>{maxDepth}mm</ThemedText>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              <View style={[styles.perioLegend, { marginTop: 8 }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>1-3mm Healthy</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>4-5mm Monitor</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>6mm+ Concern</ThemedText>
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );

  const renderAppointments = () => (
    <View>
      {upcomingAppointments.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>Upcoming</ThemedText>
          {upcomingAppointments.map((apt: any) => (
            <Card key={apt.AptNum} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={[styles.aptDateBadge, { backgroundColor: "#3B82F615" }]}>
                  <Feather name="calendar" size={14} color="#3B82F6" />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "600", color: "#3B82F6" }}>{formatDate(apt.AptDateTime)}</ThemedText>
                </View>
                <StatusBadge status="Scheduled" type="appointment" />
              </View>
              <ThemedText style={{ marginTop: 8, fontWeight: "500" }}>{apt.ProcDescript}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{apt.ProvBarText}</ThemedText>
              {apt.Note ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{apt.Note}</ThemedText> : null}
              {apt.IsHygiene ? (
                <View style={[styles.badge, { backgroundColor: "#06B6D420", borderColor: "#06B6D440", marginTop: 8, alignSelf: "flex-start" }]}>
                  <ThemedText type="small" style={{ color: "#06B6D4", fontWeight: "600", fontSize: 11 }}>Hygiene Visit</ThemedText>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      {pastAppointments.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>Past Visits</ThemedText>
          {pastAppointments.map((apt: any) => (
            <Card key={apt.AptNum} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={[styles.aptDateBadge, { backgroundColor: "#10B98115" }]}>
                  <Feather name="check-circle" size={14} color="#10B981" />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "600", color: "#10B981" }}>{formatDate(apt.AptDateTime)}</ThemedText>
                </View>
                <StatusBadge status="Complete" type="appointment" />
              </View>
              <ThemedText style={{ marginTop: 8, fontWeight: "500" }}>{apt.ProcDescript}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{apt.ProvBarText}</ThemedText>
              {apt.Note ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{apt.Note}</ThemedText> : null}
            </Card>
          ))}
        </>
      ) : null}

      {upcomingAppointments.length === 0 && pastAppointments.length === 0 ? (
        <Card style={styles.card}>
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <Feather name="calendar" size={40} color={theme.textTertiary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No appointments found</ThemedText>
          </View>
        </Card>
      ) : null}
    </View>
  );

  const renderProcedures = () => (
    <View>
      {completedProcedures.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>Completed</ThemedText>
          {completedProcedures.map((proc: any) => (
            <Card key={proc.ProcNum} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.codeChip, { backgroundColor: "#3B82F615" }]}>
                      <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 11 }}>{proc.ProcCode}</ThemedText>
                    </View>
                    <ToothDiagram toothNum={proc.ToothNum} />
                  </View>
                  <ThemedText style={{ fontWeight: "600", marginTop: 6 }}>{proc.Descript}</ThemedText>
                </View>
                <ThemedText style={{ fontWeight: "700", color: theme.text }}>{formatCurrency(proc.ProcFee)}</ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(proc.ProcDate)}</ThemedText>
                <StatusBadge status="Completed" type="procedure" />
              </View>
              {proc.Surf ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>Surface: {proc.Surf}</ThemedText> : null}
              {proc.Note ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{proc.Note}</ThemedText> : null}
            </Card>
          ))}
        </>
      ) : null}

      {plannedProcedures.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>Treatment Planned</ThemedText>
          {plannedProcedures.map((proc: any) => (
            <Card key={proc.ProcNum} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.codeChip, { backgroundColor: "#F59E0B15" }]}>
                      <ThemedText type="small" style={{ color: "#F59E0B", fontWeight: "700", fontSize: 11 }}>{proc.ProcCode}</ThemedText>
                    </View>
                    <ToothDiagram toothNum={proc.ToothNum} />
                  </View>
                  <ThemedText style={{ fontWeight: "600", marginTop: 6 }}>{proc.Descript}</ThemedText>
                </View>
                <ThemedText style={{ fontWeight: "700", color: "#F59E0B" }}>{formatCurrency(proc.ProcFee)}</ThemedText>
              </View>
              <StatusBadge status="Treatment Planned" type="procedure" />
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );

  const renderTreatmentPlans = () => (
    <View>
      {records?.treatmentPlans?.length > 0 ? (
        records.treatmentPlans.map((tp: any) => (
          <Card key={tp.TreatPlanNum} style={styles.card}>
            <View style={styles.aptHeader}>
              <ThemedText style={{ fontWeight: "700", fontSize: 16, flex: 1 }}>{tp.Heading}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(tp.DateTP)}</ThemedText>
            </View>
            {tp.Note ? <ThemedText style={{ marginTop: 8, color: theme.textSecondary, lineHeight: 20 }}>{tp.Note}</ThemedText> : null}
            {plannedProcedures.length > 0 ? (
              <View style={[styles.tpSummary, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED", marginTop: 12 }]}>
                <ThemedText type="small" style={{ fontWeight: "600", color: "#F59E0B" }}>
                  {plannedProcedures.length} procedure{plannedProcedures.length !== 1 ? "s" : ""} planned
                </ThemedText>
                <ThemedText type="small" style={{ fontWeight: "700", color: "#F59E0B" }}>
                  Est. {formatCurrency(treatmentPlanCost)}
                </ThemedText>
              </View>
            ) : null}
          </Card>
        ))
      ) : (
        <Card style={styles.card}>
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <Feather name="file-text" size={40} color={theme.textTertiary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No treatment plans</ThemedText>
          </View>
        </Card>
      )}
    </View>
  );

  const renderImages = () => (
    <View>
      {records?.images?.length > 0 ? (
        records.images.map((img: any) => (
          <Card key={img.DocNum} style={styles.card}>
            <View style={styles.aptHeader}>
              <View style={[styles.imgIcon, { backgroundColor: isDark ? "#1E293B" : "#F3F4F6" }]}>
                <Feather name="image" size={20} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={{ fontWeight: "600" }}>{img.Description}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>{formatDate(img.DateCreated)}</ThemedText>
              </View>
            </View>
            {img.Note ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 8, fontStyle: "italic" }}>{img.Note}</ThemedText> : null}
          </Card>
        ))
      ) : (
        <Card style={styles.card}>
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <Feather name="image" size={40} color={theme.textTertiary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No dental images</ThemedText>
          </View>
        </Card>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Loading dental records...</ThemedText>
        <UpgradePrompt {...promptProps} />
      </ThemedView>
    );
  }

  if (isError || !records) {
    return (
      <ThemedView style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText style={{ marginTop: Spacing.md, fontWeight: "600" }}>Unable to load dental records</ThemedText>
        <Pressable testID="button-retry-dental" onPress={() => refetch()} style={[styles.retryButton, { backgroundColor: theme.primary }]} accessibilityRole="button" accessibilityLabel="Try again to load dental records">
          <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Try Again</ThemedText>
        </Pressable>
        <UpgradePrompt {...promptProps} />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.md }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
    >
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            testID={`tab-dental-${tab.id}`}
            onPress={() => setActiveTab(tab.id)}
            style={[
              styles.tabButton,
              activeTab === tab.id
                ? { backgroundColor: theme.primary + "15", borderColor: theme.primary + "40" }
                : { backgroundColor: isDark ? "#1E293B" : "#F3F4F6", borderColor: "transparent" },
            ]}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <Feather
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.id ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                marginLeft: 4,
                fontWeight: activeTab === tab.id ? "700" : "500",
                color: activeTab === tab.id ? theme.primary : theme.textSecondary,
                fontSize: 12,
              }}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {activeTab === "overview" ? renderOverview() : null}
      {activeTab === "appointments" ? renderAppointments() : null}
      {activeTab === "procedures" ? renderProcedures() : null}
      {activeTab === "treatment" ? renderTreatmentPlans() : null}
      {activeTab === "xrays" ? renderImages() : null}
      <UpgradePrompt {...promptProps} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  tabRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  card: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    padding: Spacing.md,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  toothBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
  },
  codeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  aptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aptDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
  },
  insuranceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  insuranceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  estimateRow: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  tpSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  imgIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  perioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  perioCell: {
    alignItems: "center",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 52,
  },
  perioLegend: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.pill,
  },
});
