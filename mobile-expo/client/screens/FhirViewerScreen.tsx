import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

type TabKey = "conditions" | "medications" | "observations";

interface FhirCondition {
  id: string;
  code: string;
  displayName: string;
  clinicalStatus: string;
  verificationStatus: string;
  category: string;
  onsetDate: string | null;
  abatementDate: string | null;
  provider: string;
  facility: string;
  severity: string;
}

interface FhirMedication {
  id: string;
  code: string;
  displayName: string;
  status: string;
  dosage: string;
  route: string;
  frequency: string;
  prescriber: string;
  facility: string;
  dateWritten: string | null;
  refills: number;
}

interface FhirObservation {
  id: string;
  code: string;
  displayName: string;
  category: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: string;
  effectiveDate: string | null;
  performer: string;
  interpretation: string;
}

interface PatientFhirData {
  patientName: string;
  dateOfBirth: string;
  gender: string;
  mrn: string;
  sourceNetwork: string;
  retrievedAt: string;
  conditions: FhirCondition[];
  medications: FhirMedication[];
  observations: FhirObservation[];
}

const TABS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "conditions", label: "Conditions", icon: "heart" },
  { key: "medications", label: "Medications", icon: "package" },
  { key: "observations", label: "Observations", icon: "bar-chart-2" },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FhirViewerScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("conditions");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<PatientFhirData>({
    queryKey: ["/api/fhir-viewer/patient"],
  });

  const handleDownloadPDF = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/fhir-viewer/download-pdf", baseUrl).toString();

      if (Platform.OS === "web") {
        const response = await apiRequest("GET", url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `FHIR_Patient_Record_${new Date().toISOString().split("T")[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } else {
        const fileUri = `${(FileSystem as any).cacheDirectory}FHIR_Patient_Record.pdf`;
        const downloadResult = await FileSystem.downloadAsync(url, fileUri);
        if (downloadResult.status !== 200) {
          throw new Error(`Download failed with status ${downloadResult.status}`);
        }
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/pdf",
            dialogTitle: "Save Patient Record PDF",
          });
        }
      }
    } catch (err: any) {
      setDownloadError(err.message || "Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, []);

  const statusColor = useCallback(
    (status: string) => {
      switch (status.toLowerCase()) {
        case "active":
          return theme.success;
        case "resolved":
        case "stopped":
          return theme.textSecondary;
        default:
          return theme.warning;
      }
    },
    [theme]
  );

  const interpretationColor = useCallback(
    (interp: string) => {
      const lower = interp.toLowerCase();
      if (lower === "normal" || lower === "optimal" || lower === "desirable") return theme.success;
      if (lower === "high" || lower === "low" || lower === "elevated" || lower.includes("anemia") || lower.includes("severely")) return theme.error;
      return theme.warning;
    },
    [theme]
  );

  const renderPatientHeader = () => {
    if (!data) return null;
    return (
      <View style={[styles.patientCard, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.patientIconRow}>
          <View style={[styles.patientAvatar, { backgroundColor: theme.primary }]}>
            <Feather name="user" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.patientInfo}>
            <Text style={[styles.patientName, { color: theme.text }]} testID="text-patient-name">
              {data.patientName}
            </Text>
            <Text style={[styles.patientMeta, { color: theme.textSecondary }]} testID="text-patient-meta">
              {data.gender} | DOB: {data.dateOfBirth} | {data.mrn}
            </Text>
          </View>
        </View>
        <View style={[styles.sourceRow, { borderTopColor: theme.border }]}>
          <Feather name="globe" size={12} color={theme.textSecondary} />
          <Text style={[styles.sourceText, { color: theme.textSecondary }]}>
            {data.sourceNetwork}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <SummaryBadge label="Conditions" count={data.conditions.length} color="#3B82F6" />
          <SummaryBadge label="Medications" count={data.medications.length} color="#10B981" />
          <SummaryBadge label="Observations" count={data.observations.length} color="#6366F1" />
        </View>
      </View>
    );
  };

  const renderTabs = () => (
    <View style={[styles.tabBar, { backgroundColor: theme.backgroundSecondary }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              isActive ? [styles.tabActive, { backgroundColor: theme.primary }] : undefined,
            ]}
            onPress={() => setActiveTab(tab.key)}
            testID={`tab-${tab.key}`}
          >
            <Feather
              name={tab.icon}
              size={14}
              color={isActive ? "#FFFFFF" : theme.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? "#FFFFFF" : theme.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderConditions = () =>
    data?.conditions.map((c) => (
      <View key={c.id} style={[styles.card, { backgroundColor: theme.backgroundSecondary }]} testID={`card-condition-${c.id}`}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.dot, { backgroundColor: statusColor(c.clinicalStatus) }]} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>{c.displayName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(c.clinicalStatus) + "20" }]}>
            <Text style={[styles.statusText, { color: statusColor(c.clinicalStatus) }]}>
              {c.clinicalStatus.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <DetailRow icon="tag" label="Category" value={c.category} theme={theme} />
          <DetailRow icon="alert-circle" label="Severity" value={c.severity} theme={theme} />
          <DetailRow icon="calendar" label="Onset" value={formatDate(c.onsetDate)} theme={theme} />
          {c.abatementDate ? (
            <DetailRow icon="check-circle" label="Resolved" value={formatDate(c.abatementDate)} theme={theme} />
          ) : null}
          <DetailRow icon="user" label="Provider" value={c.provider} theme={theme} />
          <DetailRow icon="map-pin" label="Facility" value={c.facility} theme={theme} />
        </View>
      </View>
    ));

  const renderMedications = () =>
    data?.medications.map((m) => (
      <View key={m.id} style={[styles.card, { backgroundColor: theme.backgroundSecondary }]} testID={`card-medication-${m.id}`}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.dot, { backgroundColor: statusColor(m.status) }]} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>{m.displayName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(m.status) + "20" }]}>
            <Text style={[styles.statusText, { color: statusColor(m.status) }]}>
              {m.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <DetailRow icon="droplet" label="Dosage" value={m.dosage} theme={theme} />
          <DetailRow icon="navigation" label="Route" value={m.route} theme={theme} />
          <DetailRow icon="clock" label="Frequency" value={m.frequency} theme={theme} />
          <DetailRow icon="calendar" label="Prescribed" value={formatDate(m.dateWritten)} theme={theme} />
          <DetailRow icon="repeat" label="Refills" value={String(m.refills)} theme={theme} />
          <DetailRow icon="user" label="Prescriber" value={m.prescriber} theme={theme} />
          <DetailRow icon="map-pin" label="Facility" value={m.facility} theme={theme} />
        </View>
      </View>
    ));

  const renderObservations = () =>
    data?.observations.map((o) => (
      <View key={o.id} style={[styles.card, { backgroundColor: theme.backgroundSecondary }]} testID={`card-observation-${o.id}`}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Feather
              name={o.category === "vital-signs" ? "activity" : "clipboard"}
              size={14}
              color={o.category === "vital-signs" ? "#6366F1" : "#10B981"}
            />
            <Text style={[styles.cardTitle, { color: theme.text }]}>{o.displayName}</Text>
          </View>
          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, { color: interpretationColor(o.interpretation) }]}>
              {o.value} {o.unit}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <DetailRow
            icon="layers"
            label="Category"
            value={o.category === "vital-signs" ? "Vital Signs" : "Laboratory"}
            theme={theme}
          />
          <DetailRow icon="sliders" label="Ref Range" value={o.referenceRange} theme={theme} />
          <View style={styles.detailRow}>
            <Feather name="trending-up" size={12} color={theme.textSecondary} />
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Interpretation</Text>
            <Text style={[styles.detailValue, { color: interpretationColor(o.interpretation) }]}>
              {o.interpretation}
            </Text>
          </View>
          <DetailRow icon="calendar" label="Date" value={formatDate(o.effectiveDate)} theme={theme} />
          <DetailRow icon="user" label="Performer" value={o.performer} theme={theme} />
        </View>
      </View>
    ));

  const renderContent = () => {
    if (activeTab === "conditions") return renderConditions();
    if (activeTab === "medications") return renderMedications();
    return renderObservations();
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Fetching FHIR R4 data via TEFCA...
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-triangle" size={48} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.text }]}>Failed to load patient data</Text>
        <Text style={[styles.errorDetail, { color: theme.textSecondary }]}>
          {(error as any)?.message || "Unknown error"}
        </Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={() => refetch()}
          testID="button-retry"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
        testID="fhir-viewer-scroll"
      >
        {renderPatientHeader()}
        {renderTabs()}
        {renderContent()}

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Feather name="shield" size={12} color={theme.textSecondary} />
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            FHIR R4 | USCDI v6 | TEFCA Compliant | HIPAA Protected
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.downloadBar, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.sm }]}>
        {downloadError ? (
          <Pressable
            style={[styles.errorBanner, { backgroundColor: theme.error + "15" }]}
            onPress={() => setDownloadError(null)}
            testID="banner-download-error"
          >
            <Feather name="alert-circle" size={14} color={theme.error} />
            <Text style={[styles.errorBannerText, { color: theme.error }]} numberOfLines={2}>{downloadError}</Text>
            <Feather name="x" size={14} color={theme.error} />
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.downloadButton, { backgroundColor: theme.primary, opacity: downloading ? 0.7 : 1 }]}
          onPress={handleDownloadPDF}
          disabled={downloading}
          testID="button-download-pdf"
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="download" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.downloadText}>
            {downloading ? "Generating PDF..." : "Download as PDF"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.summaryBadge, { backgroundColor: color + "15" }]}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={12} color={theme.textSecondary} />
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
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
    padding: Spacing.xl,
  },
  loadingText: {
    ...Typography.small,
    marginTop: Spacing.md,
  },
  errorText: {
    ...Typography.h3,
    marginTop: Spacing.lg,
  },
  errorDetail: {
    ...Typography.small,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  retryButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    color: "#FFFFFF",
    ...Typography.body,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  patientCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  patientIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    ...Typography.h3,
  },
  patientMeta: {
    ...Typography.caption,
    marginTop: 2,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  sourceText: {
    ...Typography.caption,
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  summaryBadge: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  summaryCount: {
    ...Typography.h3,
  },
  summaryLabel: {
    ...Typography.caption,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 4,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: Spacing.xs,
  },
  tabActive: {
    elevation: 2,
  },
  tabLabel: {
    ...Typography.caption,
    fontWeight: "600",
  },
  card: {
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    ...Typography.small,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  valueContainer: {
    flexShrink: 0,
  },
  valueText: {
    ...Typography.small,
    fontWeight: "700",
  },
  cardBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailLabel: {
    ...Typography.caption,
    width: 90,
  },
  detailValue: {
    ...Typography.caption,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  footerText: {
    ...Typography.caption,
  },
  downloadBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  downloadText: {
    color: "#FFFFFF",
    ...Typography.body,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  errorBannerText: {
    ...Typography.caption,
    flex: 1,
  },
});
