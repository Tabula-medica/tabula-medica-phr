import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

type TabId = "overview" | "appointments" | "procedures" | "treatment" | "perio" | "notes" | "images";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "appointments", label: "Visits", icon: "calendar" },
  { id: "procedures", label: "Procedures", icon: "clipboard" },
  { id: "treatment", label: "Plan", icon: "file-text" },
  { id: "perio", label: "Perio", icon: "activity" },
  { id: "notes", label: "Notes", icon: "edit-3" },
  { id: "images", label: "Images", icon: "image" },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    Scheduled: "#3B82F6",
    Complete: "#10B981",
    Completed: "#10B981",
    Planned: "#F59E0B",
    Active: "#8B5CF6",
    Cancelled: "#EF4444",
    Broken: "#EF4444",
    High: "#EF4444",
    Medium: "#F59E0B",
    Low: "#10B981",
  };
  const color = colorMap[status] || "#6B7280";
  return (
    <View style={[styles.badge, { backgroundColor: color + "20", borderColor: color + "40" }]}>
      <ThemedText type="small" style={{ color, fontWeight: "600", fontSize: 11 }}>{status}</ThemedText>
    </View>
  );
}

function ToothBadge({ toothNum }: { toothNum: string }) {
  const { theme } = useTheme();
  if (!toothNum) return null;
  return (
    <View style={[styles.toothBadge, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }]}>
      <Feather name="hash" size={10} color={theme.primary} />
      <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700", fontSize: 11, marginLeft: 2 }}>{toothNum}</ThemedText>
    </View>
  );
}

function CostBreakdown({ fee, insurancePortion, patientPortion }: { fee: number; insurancePortion: number; patientPortion: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.costBreakdown}>
      <View style={styles.costItem}>
        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Total</ThemedText>
        <ThemedText type="small" style={{ fontWeight: "700" }}>{formatCurrency(fee)}</ThemedText>
      </View>
      <View style={styles.costItem}>
        <ThemedText type="small" style={{ color: "#10B981", fontSize: 10 }}>Insurance</ThemedText>
        <ThemedText type="small" style={{ fontWeight: "600", color: "#10B981" }}>{formatCurrency(insurancePortion)}</ThemedText>
      </View>
      <View style={styles.costItem}>
        <ThemedText type="small" style={{ color: "#F59E0B", fontSize: 10 }}>You Pay</ThemedText>
        <ThemedText type="small" style={{ fontWeight: "600", color: "#F59E0B" }}>{formatCurrency(patientPortion)}</ThemedText>
      </View>
    </View>
  );
}

export default function DentrixScreen() {
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
    queryKey: ["/api/dentrix/records"],
  });

  const configQuery = useQuery<any>({
    queryKey: ["/api/dentrix/config"],
  });

  const isDemo = !configQuery.data?.configured;
  const records = data;

  const completedProcedures = useMemo(() =>
    records?.procedures?.filter((p: any) => p.status === "Complete") || [],
  [records]);

  const plannedProcedures = useMemo(() =>
    records?.procedures?.filter((p: any) => p.status === "Planned") || [],
  [records]);

  const upcomingAppointments = useMemo(() =>
    records?.appointments?.filter((a: any) => a.status === "Scheduled") || [],
  [records]);

  const pastAppointments = useMemo(() =>
    records?.appointments?.filter((a: any) => a.status === "Complete") || [],
  [records]);

  const totalFees = useMemo(() =>
    completedProcedures.reduce((sum: number, p: any) => sum + (p.fee || 0), 0),
  [completedProcedures]);

  const totalInsurance = useMemo(() =>
    completedProcedures.reduce((sum: number, p: any) => sum + (p.insurancePortion || 0), 0),
  [completedProcedures]);

  const totalPatient = useMemo(() =>
    completedProcedures.reduce((sum: number, p: any) => sum + (p.patientPortion || 0), 0),
  [completedProcedures]);

  const plannedCost = useMemo(() =>
    plannedProcedures.reduce((sum: number, p: any) => sum + (p.fee || 0), 0),
  [plannedProcedures]);

  const renderOverview = () => (
    <View>
      {isDemo ? (
        <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: "#8B5CF6" }]}>
          <View style={styles.cardRow}>
            <Feather name="info" size={16} color="#8B5CF6" />
            <ThemedText type="small" style={{ flex: 1, marginLeft: 8, color: "#8B5CF6" }}>
              Running in demo mode. Connect your Dentrix practice to see real patient data.
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
          <View style={[styles.statIcon, { backgroundColor: "#F59E0B20" }]}>
            <Feather name="file-text" size={18} color="#F59E0B" />
          </View>
          <ThemedText style={styles.statValue}>{plannedProcedures.length}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Planned</ThemedText>
        </Card>
      </View>

      {records?.insurance?.length > 0 ? (
        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Dental Insurance</ThemedText>
          {records.insurance.map((ins: any, i: number) => (
            <View key={i}>
              <View style={styles.insuranceRow}>
                <View style={[styles.insuranceIcon, { backgroundColor: "#8B5CF615" }]}>
                  <Feather name="shield" size={16} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: "600" }}>{ins.carrierName}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {ins.planName} | {ins.coverageType}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Group: {ins.groupNumber} | ID: {ins.subscriberId}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.benefitBar, { marginTop: 8 }]}>
                <View style={styles.benefitRow}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Annual Maximum</ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "600" }}>{formatCurrency(ins.annualMaximum)}</ThemedText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}>
                  <View style={[
                    styles.progressFill,
                    {
                      backgroundColor: ins.remainingBenefit > ins.annualMaximum * 0.3 ? "#10B981" : ins.remainingBenefit > ins.annualMaximum * 0.1 ? "#F59E0B" : "#EF4444",
                      width: `${((ins.annualMaximum - ins.remainingBenefit) / ins.annualMaximum) * 100}%`,
                    },
                  ]} />
                </View>
                <View style={styles.benefitRow}>
                  <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600" }}>
                    Remaining: {formatCurrency(ins.remainingBenefit)}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Used: {formatCurrency(ins.annualMaximum - ins.remainingBenefit)}
                  </ThemedText>
                </View>
                <View style={[styles.benefitRow, { marginTop: 4 }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Deductible: {formatCurrency(ins.deductible)}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: ins.deductibleMet >= ins.deductible ? "#10B981" : "#F59E0B", fontWeight: "600" }}>
                    {ins.deductibleMet >= ins.deductible ? "Met" : `${formatCurrency(ins.deductibleMet)} of ${formatCurrency(ins.deductible)}`}
                  </ThemedText>
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {upcomingAppointments.length > 0 ? (
        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Next Appointment</ThemedText>
          {upcomingAppointments.slice(0, 1).map((apt: any) => (
            <View key={apt.appointmentId}>
              <View style={styles.aptHeader}>
                <View style={[styles.aptDateBadge, { backgroundColor: "#3B82F615" }]}>
                  <Feather name="calendar" size={14} color="#3B82F6" />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "600", color: "#3B82F6" }}>
                    {formatDate(apt.startTime)}
                  </ThemedText>
                </View>
                {apt.confirmed ? (
                  <View style={[styles.badge, { backgroundColor: "#10B98120", borderColor: "#10B98140" }]}>
                    <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600", fontSize: 11 }}>Confirmed</ThemedText>
                  </View>
                ) : (
                  <StatusBadge status="Scheduled" />
                )}
              </View>
              <ThemedText style={{ marginTop: 8, fontWeight: "500" }}>{apt.reason}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{apt.providerName}</ThemedText>
              {apt.notes ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{apt.notes}</ThemedText> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <ThemedText style={styles.sectionTitle}>Cost Summary</ThemedText>
        <View style={styles.costRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>Total procedures billed</ThemedText>
          <ThemedText style={{ fontWeight: "600" }}>{formatCurrency(totalFees)}</ThemedText>
        </View>
        <View style={styles.costRow}>
          <ThemedText type="small" style={{ color: "#10B981" }}>Insurance covered</ThemedText>
          <ThemedText style={{ fontWeight: "600", color: "#10B981" }}>{formatCurrency(totalInsurance)}</ThemedText>
        </View>
        <View style={[styles.costRow, { borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 8 }]}>
          <ThemedText type="small" style={{ fontWeight: "600" }}>Your out-of-pocket</ThemedText>
          <ThemedText style={{ fontWeight: "700", color: "#F59E0B" }}>{formatCurrency(totalPatient)}</ThemedText>
        </View>
        {plannedCost > 0 ? (
          <View style={[styles.tpSummary, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED", marginTop: 8 }]}>
            <ThemedText type="small" style={{ color: "#F59E0B", fontWeight: "600" }}>Planned treatment estimate</ThemedText>
            <ThemedText type="small" style={{ color: "#F59E0B", fontWeight: "700" }}>{formatCurrency(plannedCost)}</ThemedText>
          </View>
        ) : null}
      </Card>
    </View>
  );

  const renderAppointments = () => (
    <View>
      {upcomingAppointments.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>Upcoming</ThemedText>
          {upcomingAppointments.map((apt: any) => (
            <Card key={apt.appointmentId} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={[styles.aptDateBadge, { backgroundColor: "#3B82F615" }]}>
                  <Feather name="calendar" size={14} color="#3B82F6" />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "600", color: "#3B82F6" }}>{formatDate(apt.startTime)}</ThemedText>
                </View>
                <StatusBadge status="Scheduled" />
              </View>
              <ThemedText style={{ marginTop: 8, fontWeight: "500" }}>{apt.reason}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{apt.providerName}</ThemedText>
              {apt.procedures?.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {apt.procedures.map((code: string, i: number) => (
                    <View key={i} style={[styles.codeChip, { backgroundColor: "#3B82F615" }]}>
                      <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 11 }}>{code}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
              {apt.notes ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{apt.notes}</ThemedText> : null}
            </Card>
          ))}
        </>
      ) : null}

      {pastAppointments.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>Past Visits</ThemedText>
          {pastAppointments.map((apt: any) => (
            <Card key={apt.appointmentId} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={[styles.aptDateBadge, { backgroundColor: "#10B98115" }]}>
                  <Feather name="check-circle" size={14} color="#10B981" />
                  <ThemedText style={{ marginLeft: 6, fontWeight: "600", color: "#10B981" }}>{formatDate(apt.startTime)}</ThemedText>
                </View>
                <StatusBadge status="Complete" />
              </View>
              <ThemedText style={{ marginTop: 8, fontWeight: "500" }}>{apt.reason}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{apt.providerName}</ThemedText>
              {apt.notes ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{apt.notes}</ThemedText> : null}
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
            <Card key={proc.procedureId} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.codeChip, { backgroundColor: "#3B82F615" }]}>
                      <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 11 }}>{proc.cdtCode}</ThemedText>
                    </View>
                    <ToothBadge toothNum={proc.toothNumber} />
                    {proc.quadrant ? (
                      <View style={[styles.codeChip, { backgroundColor: "#6B728015" }]}>
                        <ThemedText type="small" style={{ color: "#6B7280", fontWeight: "600", fontSize: 10 }}>{proc.quadrant}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={{ fontWeight: "600", marginTop: 6 }}>{proc.description}</ThemedText>
                </View>
              </View>
              <CostBreakdown fee={proc.fee} insurancePortion={proc.insurancePortion} patientPortion={proc.patientPortion} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(proc.datePerformed)} | {proc.providerName}</ThemedText>
              </View>
              {proc.notes ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{proc.notes}</ThemedText> : null}
            </Card>
          ))}
        </>
      ) : null}

      {plannedProcedures.length > 0 ? (
        <>
          <ThemedText style={[styles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.sm }]}>Treatment Planned</ThemedText>
          {plannedProcedures.map((proc: any) => (
            <Card key={proc.procedureId} style={styles.card}>
              <View style={styles.aptHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.codeChip, { backgroundColor: "#F59E0B15" }]}>
                      <ThemedText type="small" style={{ color: "#F59E0B", fontWeight: "700", fontSize: 11 }}>{proc.cdtCode}</ThemedText>
                    </View>
                    <ToothBadge toothNum={proc.toothNumber} />
                  </View>
                  <ThemedText style={{ fontWeight: "600", marginTop: 6 }}>{proc.description}</ThemedText>
                </View>
              </View>
              <CostBreakdown fee={proc.fee} insurancePortion={proc.insurancePortion} patientPortion={proc.patientPortion} />
              {proc.notes ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontStyle: "italic" }}>{proc.notes}</ThemedText> : null}
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
          <Card key={tp.planId} style={styles.card}>
            <View style={styles.aptHeader}>
              <ThemedText style={{ fontWeight: "700", fontSize: 16, flex: 1 }}>{tp.planName}</ThemedText>
              <StatusBadge status={tp.status} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(tp.createdDate)}</ThemedText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Priority:</ThemedText>
                <StatusBadge status={tp.priority} />
              </View>
            </View>
            {tp.notes ? <ThemedText style={{ marginTop: 8, color: theme.textSecondary, lineHeight: 20 }}>{tp.notes}</ThemedText> : null}
            <View style={[styles.tpCostGrid, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", marginTop: 12 }]}>
              <View style={styles.tpCostItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Total</ThemedText>
                <ThemedText style={{ fontWeight: "700" }}>{formatCurrency(tp.totalFee)}</ThemedText>
              </View>
              <View style={styles.tpCostItem}>
                <ThemedText type="small" style={{ color: "#10B981", fontSize: 10 }}>Insurance Est.</ThemedText>
                <ThemedText style={{ fontWeight: "700", color: "#10B981" }}>{formatCurrency(tp.insuranceEstimate)}</ThemedText>
              </View>
              <View style={styles.tpCostItem}>
                <ThemedText type="small" style={{ color: "#F59E0B", fontSize: 10 }}>Your Est.</ThemedText>
                <ThemedText style={{ fontWeight: "700", color: "#F59E0B" }}>{formatCurrency(tp.patientEstimate)}</ThemedText>
              </View>
            </View>
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

  const renderPerio = () => (
    <View>
      {records?.perioCharts?.length > 0 ? (
        records.perioCharts.map((chart: any) => (
          <Card key={chart.chartId} style={styles.card}>
            <View style={styles.aptHeader}>
              <ThemedText style={{ fontWeight: "700", fontSize: 16 }}>Periodontal Chart</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(chart.examDate)}</ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{chart.providerName}</ThemedText>

            {chart.readings?.length > 0 ? (
              <>
                <View style={styles.perioGrid}>
                  {(() => {
                    const toothGroups = new Map<number, any[]>();
                    chart.readings.forEach((r: any) => {
                      if (!toothGroups.has(r.toothNumber)) toothGroups.set(r.toothNumber, []);
                      toothGroups.get(r.toothNumber)!.push(r);
                    });
                    return Array.from(toothGroups.entries()).map(([tooth, readings]) => {
                      const maxDepth = Math.max(...readings.map((r: any) => r.probingDepth));
                      const hasBleed = readings.some((r: any) => r.bleeding);
                      const hasRecession = readings.some((r: any) => r.recession > 0);
                      const color = maxDepth <= 3 ? "#10B981" : maxDepth <= 5 ? "#F59E0B" : "#EF4444";
                      return (
                        <View key={tooth} style={[styles.perioCell, { borderColor: color + "40" }]}>
                          <ThemedText type="small" style={{ fontWeight: "700", fontSize: 11 }}>#{tooth}</ThemedText>
                          <ThemedText type="small" style={{ color, fontWeight: "600", fontSize: 13 }}>{maxDepth}mm</ThemedText>
                          <View style={{ flexDirection: "row", gap: 3, marginTop: 2 }}>
                            {hasBleed ? (
                              <View style={[styles.miniIndicator, { backgroundColor: "#EF444430" }]}>
                                <ThemedText type="small" style={{ color: "#EF4444", fontSize: 8, fontWeight: "700" }}>BOP</ThemedText>
                              </View>
                            ) : null}
                            {hasRecession ? (
                              <View style={[styles.miniIndicator, { backgroundColor: "#F59E0B30" }]}>
                                <ThemedText type="small" style={{ color: "#F59E0B", fontSize: 8, fontWeight: "700" }}>REC</ThemedText>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    });
                  })()}
                </View>
                <View style={[styles.perioLegend, { marginTop: 10 }]}>
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
                  <View style={styles.legendItem}>
                    <ThemedText type="small" style={{ color: "#EF4444", fontSize: 9, fontWeight: "700" }}>BOP</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Bleeding</ThemedText>
                  </View>
                  <View style={styles.legendItem}>
                    <ThemedText type="small" style={{ color: "#F59E0B", fontSize: 9, fontWeight: "700" }}>REC</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Recession</ThemedText>
                  </View>
                </View>
              </>
            ) : null}
          </Card>
        ))
      ) : (
        <Card style={styles.card}>
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <Feather name="activity" size={40} color={theme.textTertiary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No periodontal charts</ThemedText>
          </View>
        </Card>
      )}
    </View>
  );

  const renderNotes = () => (
    <View>
      {records?.clinicalNotes?.length > 0 ? (
        records.clinicalNotes.map((note: any) => (
          <Card key={note.noteId} style={styles.card}>
            <View style={styles.aptHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={[styles.codeChip, { backgroundColor: "#8B5CF615" }]}>
                    <ThemedText type="small" style={{ color: "#8B5CF6", fontWeight: "700", fontSize: 11 }}>{note.noteType}</ThemedText>
                  </View>
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                  {formatDate(note.date)} | {note.providerName}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={{ marginTop: 8, lineHeight: 20, color: theme.text }}>{note.content}</ThemedText>
            {note.signedBy ? (
              <View style={[styles.signatureRow, { borderTopColor: theme.border }]}>
                <Feather name="check-circle" size={12} color="#10B981" />
                <ThemedText type="small" style={{ color: "#10B981", marginLeft: 4, fontWeight: "600" }}>
                  Signed by {note.signedBy} on {formatDate(note.signedDate)}
                </ThemedText>
              </View>
            ) : null}
          </Card>
        ))
      ) : (
        <Card style={styles.card}>
          <View style={{ alignItems: "center", padding: Spacing.xl }}>
            <Feather name="edit-3" size={40} color={theme.textTertiary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No clinical notes</ThemedText>
          </View>
        </Card>
      )}
    </View>
  );

  const renderImages = () => (
    <View>
      {records?.images?.length > 0 ? (
        records.images.map((img: any) => (
          <Card key={img.imageId} style={styles.card}>
            <View style={styles.aptHeader}>
              <View style={[styles.imgIcon, { backgroundColor: isDark ? "#1E293B" : "#F3F4F6" }]}>
                <Feather name={img.imageType === "Radiograph" ? "aperture" : "camera"} size={20} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={{ fontWeight: "600" }}>{img.description}</ThemedText>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>{formatDate(img.captureDate)}</ThemedText>
                  <View style={[styles.codeChip, { backgroundColor: "#6B728015" }]}>
                    <ThemedText type="small" style={{ color: "#6B7280", fontWeight: "600", fontSize: 10 }}>{img.category}</ThemedText>
                  </View>
                </View>
              </View>
            </View>
            {img.toothNumbers?.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {img.toothNumbers.map((t: string, i: number) => (
                  <ToothBadge key={i} toothNum={t} />
                ))}
              </View>
            ) : null}
            {img.notes ? <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 6, fontStyle: "italic" }}>{img.notes}</ThemedText> : null}
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
        <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>Loading Dentrix records...</ThemedText>
        <UpgradePrompt {...promptProps} />
      </ThemedView>
    );
  }

  if (isError || !records) {
    return (
      <ThemedView style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl }]}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText style={{ marginTop: Spacing.md, fontWeight: "600" }}>Unable to load Dentrix records</ThemedText>
        <Pressable testID="button-retry-dentrix" onPress={() => refetch()} style={[styles.retryButton, { backgroundColor: theme.primary }]} accessibilityRole="button" accessibilityLabel="Try again to load Dentrix records">
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              testID={`tab-dentrix-${tab.id}`}
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
      </ScrollView>

      {activeTab === "overview" ? renderOverview() : null}
      {activeTab === "appointments" ? renderAppointments() : null}
      {activeTab === "procedures" ? renderProcedures() : null}
      {activeTab === "treatment" ? renderTreatmentPlans() : null}
      {activeTab === "perio" ? renderPerio() : null}
      {activeTab === "notes" ? renderNotes() : null}
      {activeTab === "images" ? renderImages() : null}
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
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  costBreakdown: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#E2E8F020",
  },
  costItem: {
    alignItems: "center",
  },
  tpSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tpCostGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  tpCostItem: {
    alignItems: "center",
  },
  benefitBar: {
    gap: 4,
  },
  benefitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  perioGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  perioCell: {
    alignItems: "center",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
  },
  miniIndicator: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  perioLegend: {
    flexDirection: "row",
    gap: 10,
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
  imgIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  signatureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  retryButton: {
    marginTop: Spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.pill,
  },
});
