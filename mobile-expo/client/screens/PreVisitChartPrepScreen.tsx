import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import VoiceFAB from "@/components/VoiceFAB";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

interface AppointmentContext {
  appointmentId: string;
  patientId: string;
  patientAgeYears: number;
  patientSex: string;
  appointmentDate: string;
  appointmentType: string;
}

interface ChartSummaryInput {
  activeProblems: string[];
  currentMedications: { name: string; dose: string; startDate?: string }[];
  recentLabResults: { test: string; value: string; date: string; flag?: string }[];
  lastVisitDate?: string;
  dueScreenings?: string[];
  dueImmunizations?: string[];
  allergies?: string[];
}

interface PreVisitBrief {
  appointmentId: string;
  generatedAt: string;
  modelUsed: string;
  activeProblems: string[];
  medicationChanges: string[];
  overdueHealthMaintenance: string[];
  hccGapSuggestions: string[];
  mipsGapSuggestions: string[];
  priorityAlerts: string[];
  briefSummary: string;
  disclaimer: string;
}

const DEMO_CTX: AppointmentContext = {
  appointmentId: "demo-appt-001",
  patientId: "demo-patient-001",
  patientAgeYears: 58,
  patientSex: "Female",
  appointmentDate: new Date().toISOString().split("T")[0],
  appointmentType: "Annual Wellness Visit",
};

const DEMO_CHART: ChartSummaryInput = {
  activeProblems: ["Type 2 Diabetes (E11.9)", "Hypertension (I10)", "Hyperlipidemia (E78.5)"],
  currentMedications: [
    { name: "Metformin", dose: "1000mg BID", startDate: "2019-03" },
    { name: "Lisinopril", dose: "10mg daily", startDate: "2020-01" },
    { name: "Atorvastatin", dose: "40mg nightly", startDate: "2021-06" },
  ],
  recentLabResults: [
    { test: "HbA1c", value: "7.8%", date: "2026-03-10", flag: "high" },
    { test: "LDL", value: "98 mg/dL", date: "2026-03-10" },
    { test: "eGFR", value: "72 mL/min", date: "2026-03-10" },
    { test: "BP", value: "138/88 mmHg", date: "2026-04-15", flag: "high" },
  ],
  lastVisitDate: "2025-06-12",
  dueScreenings: ["Colorectal cancer screening (age 58)", "Breast cancer mammography"],
  dueImmunizations: ["Pneumococcal (PPSV23)", "Shingrix dose 2"],
  allergies: ["Penicillin (hives)"],
};

function SectionCard({
  title,
  icon,
  items,
  color,
  empty,
}: {
  title: string;
  icon: string;
  items: string[];
  color: string;
  empty?: string;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <View style={[styles.sectionCard, { borderLeftColor: color }]}>
      <View style={styles.sectionHeader}>
        <Feather name={icon as any} size={16} color={color} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <View style={[styles.countBadge, { backgroundColor: color + "20" }]}>
          <Text style={[styles.countText, { color }]}>{items.length}</Text>
        </View>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{empty}</Text>
      ) : (
        items.map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: color }]} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function PreVisitChartPrepScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [brief, setBrief] = useState<PreVisitBrief | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/clinical/pre-visit-prep", {
        appointmentContext: DEMO_CTX,
        chartSummary: DEMO_CHART,
      });
      return res.json();
    },
    onSuccess: (data: PreVisitBrief) => setBrief(data),
    onError: (err: any) =>
      Alert.alert("Error", err.message || "Failed to generate pre-visit brief"),
  });

  return (
    <View style={styles.wrapper}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + 16, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <Feather name="clipboard" size={24} color="#6366f1" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Pre-Visit Chart Prep</Text>
          <Text style={styles.heroSub}>
            AI-generated provider brief for tomorrow's appointments. Extended-thinking, read-only.
          </Text>
        </View>
      </View>

      <View style={styles.appointmentCard}>
        <Text style={styles.apptLabel}>Demo Appointment</Text>
        <Text style={styles.apptTitle}>{DEMO_CTX.appointmentType}</Text>
        <Text style={styles.apptMeta}>
          {DEMO_CTX.patientAgeYears}-year-old {DEMO_CTX.patientSex} · {DEMO_CTX.appointmentDate}
        </Text>
      </View>

      {!brief ? (
        <TouchableOpacity
          style={[styles.generateBtn, generateMutation.isPending && styles.generateBtnDisabled]}
          onPress={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="zap" size={18} color="#fff" />
          )}
          <Text style={styles.generateBtnText}>
            {generateMutation.isPending ? "Generating brief…" : "Generate Pre-Visit Brief"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.briefContainer}>
          {brief.priorityAlerts.length > 0 && (
            <View style={styles.alertsBanner}>
              <Feather name="alert-triangle" size={16} color="#dc2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertsTitle}>Priority Alerts</Text>
                {brief.priorityAlerts.map((a, i) => (
                  <Text key={i} style={styles.alertItem}>• {a}</Text>
                ))}
              </View>
            </View>
          )}

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Provider Summary</Text>
            <Text style={styles.summaryText}>{brief.briefSummary}</Text>
          </View>

          <SectionCard
            title="Active Problems"
            icon="activity"
            items={brief.activeProblems}
            color="#6366f1"
            empty="No changes noted"
          />
          <SectionCard
            title="Medication Changes"
            icon="package"
            items={brief.medicationChanges}
            color="#0891b2"
            empty="No changes since last visit"
          />
          <SectionCard
            title="Overdue Health Maintenance"
            icon="calendar"
            items={brief.overdueHealthMaintenance}
            color="#d97706"
          />
          <SectionCard
            title="HCC Gap Suggestions"
            icon="file-text"
            items={brief.hccGapSuggestions}
            color="#7c3aed"
          />
          <SectionCard
            title="MIPS Gap Suggestions"
            icon="bar-chart-2"
            items={brief.mipsGapSuggestions}
            color="#0d9488"
          />

          <View style={styles.disclaimerCard}>
            <Feather name="shield" size={14} color="#6b7280" />
            <Text style={styles.disclaimerText}>{brief.disclaimer}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Model: {brief.modelUsed}</Text>
            <Text style={styles.metaText}>
              Generated: {new Date(brief.generatedAt).toLocaleTimeString()}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.regenerateBtn}
            onPress={() => {
              setBrief(null);
              generateMutation.mutate();
            }}
          >
            <Feather name="refresh-cw" size={14} color="#6366f1" />
            <Text style={styles.regenerateBtnText}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
      {/* Navigation-only voice overlay: this screen is read-only (displays a generated
          clinical brief); there are no fillable fields. VoiceFAB handles NAVIGATE
          commands only — no onFillField prop is wired because fill actions are a no-op
          on this screen. */}
      <VoiceFAB testID="voice-fab-pre-visit" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingHorizontal: 16, gap: 16 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  heroSub: { fontSize: 13, color: "#6b7280", marginTop: 2, lineHeight: 18 },
  appointmentCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  apptLabel: { fontSize: 11, fontWeight: "600", color: "#6366f1", textTransform: "uppercase", letterSpacing: 0.5 },
  apptTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginTop: 4 },
  apptMeta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  generateBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  briefContainer: { gap: 12 },
  alertsBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  alertsTitle: { fontWeight: "700", color: "#dc2626", fontSize: 13, marginBottom: 4 },
  alertItem: { fontSize: 13, color: "#991b1b", lineHeight: 18 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryLabel: { fontSize: 11, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  summaryText: { fontSize: 14, color: "#374151", lineHeight: 21 },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontWeight: "700", fontSize: 13, flex: 1 },
  countBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  countText: { fontWeight: "700", fontSize: 11 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: 4 },
  bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 19 },
  emptyText: { fontSize: 13, color: "#9ca3af", fontStyle: "italic", paddingLeft: 4 },
  disclaimerCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  disclaimerText: { flex: 1, fontSize: 11, color: "#6b7280", lineHeight: 17 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: 10, color: "#9ca3af" },
  regenerateBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: "#c7d2fe",
    backgroundColor: "#eef2ff",
  },
  regenerateBtnText: { color: "#6366f1", fontWeight: "600", fontSize: 13 },
});
