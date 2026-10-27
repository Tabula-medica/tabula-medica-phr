import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";

import { ThemedText } from "@/components/ThemedText";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { TrendSparkline } from "@/components/TrendSparkline";
import { ReadAloudButton, ReadAloudFloatingButton } from "@/components/ReadAloudButton";
import { useTheme } from "@/hooks/useTheme";
import { useAccessibility } from "@/context/AccessibilityContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { HealthRecord, RecordType } from "@/lib/storage";
import { api, RecordAttachment } from "@/lib/api";

type RecordDetailParams = {
  RecordDetail: {
    record: HealthRecord;
  };
};

const RECORD_TYPE_CONFIG: Record<
  RecordType,
  { label: string; icon: keyof typeof Feather.glyphMap; colorKey: keyof typeof Colors.light }
> = {
  visit: { label: "Visit", icon: "user", colorKey: "recordVisit" },
  lab: { label: "Lab Result", icon: "activity", colorKey: "recordLab" },
  medication: { label: "Medication", icon: "package", colorKey: "recordMedication" },
  imaging: { label: "Imaging", icon: "image", colorKey: "recordImaging" },
  procedure: { label: "Procedure", icon: "tool", colorKey: "recordVisit" },
  immunization: { label: "Immunization", icon: "shield", colorKey: "recordLab" },
  allergy: { label: "Allergy", icon: "alert-triangle", colorKey: "warning" },
  vital: { label: "Vital Signs", icon: "heart", colorKey: "recordMedication" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: typeof Colors.light;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        {label}
      </ThemedText>
      <ThemedText type="body" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function StatusBadge({ label, color, theme }: { label: string; color: string; theme: typeof Colors.light }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: `${color}15` }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <ThemedText type="small" style={{ color, fontWeight: "600" }}>
        {label}
      </ThemedText>
    </View>
  );
}

function TypeSpecificDetails({
  type,
  details,
  theme,
}: {
  type: string;
  details: Record<string, any>;
  theme: typeof Colors.light;
}) {
  if (!details || Object.keys(details).length === 0) return null;

  const renderField = (label: string, key: string) => {
    const value = details[key];
    if (value === undefined || value === null || value === "") return null;
    return <DetailRow key={key} label={label} value={String(value)} theme={theme} />;
  };

  const renderDivider = () => (
    <View style={[styles.divider, { backgroundColor: theme.border }]} />
  );

  const getLabStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "critical") return theme.error;
    if (s === "abnormal") return theme.warning;
    return theme.success;
  };

  const getSeverityColor = (severity: string) => {
    const s = severity.toLowerCase();
    if (s === "severe") return theme.error;
    if (s === "moderate") return theme.warning;
    return theme.success;
  };

  const getAllergyStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "active") return theme.error;
    return theme.textSecondary;
  };

  let sectionTitle = "";
  let fields: React.ReactNode[] = [];

  switch (type) {
    case "lab": {
      sectionTitle = "Lab Details";
      const fieldDefs = [
        { label: "Test Name", key: "testName" },
        { label: "Result Value", key: "resultValue" },
        { label: "Reference Range", key: "referenceRange" },
        { label: "Units", key: "units" },
        { label: "Ordering Provider", key: "orderingProvider" },
        { label: "Specimen Type", key: "specimenType" },
        { label: "Collection Date", key: "collectionDate" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      if (details.status) {
        fields.splice(4, 0,
          <View key="status" style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Status
            </ThemedText>
            <View style={{ marginTop: 4 }}>
              <StatusBadge label={details.status} color={getLabStatusColor(details.status)} theme={theme} />
            </View>
          </View>
        );
      }
      break;
    }
    case "medication": {
      sectionTitle = "Medication Info";
      const fieldDefs = [
        { label: "Drug Name", key: "drugName" },
        { label: "Dosage", key: "dosage" },
        { label: "Frequency", key: "frequency" },
        { label: "Route", key: "route" },
        { label: "Prescriber", key: "prescriber" },
        { label: "Start Date", key: "startDate" },
        { label: "End Date", key: "endDate" },
        { label: "Refills Remaining", key: "refillsRemaining" },
        { label: "Pharmacy", key: "pharmacy" },
        { label: "Side Effects", key: "sideEffects" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      break;
    }
    case "imaging": {
      sectionTitle = "Imaging Report";
      const fieldDefs = [
        { label: "Modality", key: "modality" },
        { label: "Body Region", key: "bodyRegion" },
        { label: "Findings", key: "findings" },
        { label: "Impression", key: "impression" },
        { label: "Radiologist", key: "radiologist" },
        { label: "Facility", key: "facility" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      break;
    }
    case "visit": {
      sectionTitle = "Visit Summary";
      const fieldDefs = [
        { label: "Visit Type", key: "visitType" },
        { label: "Chief Complaint", key: "chiefComplaint" },
        { label: "Diagnosis", key: "diagnosis" },
        { label: "Treatment Plan", key: "treatmentPlan" },
        { label: "Follow-Up Date", key: "followUpDate" },
        { label: "Attending Provider", key: "attendingProvider" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      break;
    }
    case "procedure": {
      sectionTitle = "Procedure Details";
      const fieldDefs = [
        { label: "Procedure Name", key: "procedureName" },
        { label: "CPT Code", key: "cptCode" },
        { label: "Surgeon", key: "surgeon" },
        { label: "Anesthesia Type", key: "anesthesiaType" },
        { label: "Duration", key: "duration" },
        { label: "Complications", key: "complications" },
        { label: "Post-Op Instructions", key: "postOpInstructions" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      break;
    }
    case "immunization": {
      sectionTitle = "Immunization Record";
      const fieldDefs = [
        { label: "Vaccine Name", key: "vaccineName" },
        { label: "Lot Number", key: "lotNumber" },
        { label: "Manufacturer", key: "manufacturer" },
        { label: "Dose Number", key: "doseNumber" },
        { label: "Site", key: "site" },
        { label: "Administered By", key: "administeredBy" },
        { label: "Next Dose Due", key: "nextDoseDue" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      break;
    }
    case "allergy": {
      sectionTitle = "Allergy Details";
      const fieldDefs = [
        { label: "Allergen", key: "allergen" },
        { label: "Reaction Type", key: "reactionType" },
        { label: "Onset Date", key: "onsetDate" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      if (details.severity) {
        fields.splice(2, 0,
          <View key="severity" style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Severity
            </ThemedText>
            <View style={{ marginTop: 4 }}>
              <StatusBadge label={details.severity} color={getSeverityColor(details.severity)} theme={theme} />
            </View>
          </View>
        );
      }
      if (details.status) {
        fields.push(
          <View key="allergyStatus" style={styles.detailRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Status
            </ThemedText>
            <View style={{ marginTop: 4 }}>
              <StatusBadge label={details.status} color={getAllergyStatusColor(details.status)} theme={theme} />
            </View>
          </View>
        );
      }
      break;
    }
    case "vital": {
      sectionTitle = "Vital Signs";
      const fieldDefs = [
        { label: "Blood Pressure", key: "bloodPressure" },
        { label: "Heart Rate", key: "heartRate" },
        { label: "Temperature", key: "temperature" },
        { label: "Respiratory Rate", key: "respiratoryRate" },
        { label: "SpO2", key: "spO2" },
        { label: "Weight", key: "weight" },
        { label: "Height", key: "height" },
        { label: "BMI", key: "bmi" },
      ];
      fields = fieldDefs.map(f => renderField(f.label, f.key)).filter(Boolean);
      break;
    }
    default:
      return null;
  }

  if (fields.length === 0) return null;

  return (
    <View
      style={[styles.detailsCard, { backgroundColor: theme.backgroundDefault }]}
      testID={`section-${type}-details`}
    >
      <ThemedText type="h4" style={styles.sectionLabel}>
        {sectionTitle}
      </ThemedText>
      {fields.map((field, index) => (
        <React.Fragment key={index}>
          {field}
          {index < fields.length - 1 ? renderDivider() : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function AttachmentsSection({ recordId, theme }: { recordId: string; theme: typeof Colors.light }) {
  const [attachments, setAttachments] = useState<RecordAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAttachments();
  }, []);

  const loadAttachments = async () => {
    try {
      const data = await api.records.getAttachments(recordId);
      setAttachments(data);
    } catch (error) {
      console.error("Error loading attachments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setIsUploading(true);
      const asset = result.assets[0];
      await api.records.uploadAttachment(recordId, asset.uri, asset.name);
      await loadAttachments();
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    try {
      await api.records.deleteAttachment(recordId, attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={[styles.attachmentsCard, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.attachmentsHeader}>
        <ThemedText type="h4">Documents</ThemedText>
        <Pressable onPress={handleUpload} disabled={isUploading} testID="button-upload-document">
          {isUploading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Feather name="plus-circle" size={24} color={theme.primary} />
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginVertical: Spacing.lg }} />
      ) : attachments.length === 0 ? (
        <View style={styles.emptyAttachments}>
          <Feather name="file" size={32} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            No documents attached
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Tap + to add PDFs or images
          </ThemedText>
        </View>
      ) : (
        attachments.map((attachment) => (
          <View key={attachment.id} style={[styles.attachmentRow, { borderColor: theme.border }]}>
            <Feather
              name={attachment.fileType.includes("pdf") ? "file-text" : "image"}
              size={20}
              color={theme.primary}
            />
            <View style={{ flex: 1 }}>
              <ThemedText type="body" numberOfLines={1}>{attachment.fileName}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {formatFileSize(attachment.fileSize)}
              </ThemedText>
            </View>
            <Pressable onPress={() => handleDelete(attachment.id)} testID={`button-delete-attachment-${attachment.id}`}>
              <Feather name="trash-2" size={18} color={theme.error} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

export default function RecordDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { settings } = useAccessibility();
  const route = useRoute<RouteProp<RecordDetailParams, "RecordDetail">>();
  const { record } = route.params;

  const config = RECORD_TYPE_CONFIG[record.type] || RECORD_TYPE_CONFIG.visit;
  const recordColor = theme[config.colorKey] as string;

  const fullReadAloudText = [
    `${config.label}: ${record.title}`,
    `Date: ${formatDate(record.date)}`,
    `Provider: ${record.provider}`,
    record.summary ? `Summary: ${record.summary}` : "",
    record.details
      ? Object.entries(record.details).map(([k, v]) => `${k}: ${v}`).join(". ")
      : "",
  ].filter(Boolean).join(". ");

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: record.title,
        message: `${record.title}\n\nDate: ${formatDate(record.date)}\nProvider: ${record.provider}\n\n${record.summary}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.typeBadge,
          { backgroundColor: `${recordColor}15`, alignSelf: "flex-start" },
        ]}
      >
        <Feather name={config.icon} size={14} color={recordColor} />
        <ThemedText type="caption" style={{ color: recordColor, fontWeight: "600" }}>
          {config.label}
        </ThemedText>
      </View>

      <ThemedText type="h1" style={styles.title}>
        {record.title}
      </ThemedText>

      <View style={styles.metaRow}>
        <Feather name="calendar" size={16} color={theme.textSecondary} />
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {formatDate(record.date)}
        </ThemedText>
      </View>

      <View style={styles.metaRow}>
        <Feather name="map-pin" size={16} color={theme.textSecondary} />
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {record.provider}
        </ThemedText>
      </View>

      {settings.readAloudEnabled ? (
        <View style={styles.readAloudRow}>
          <ReadAloudButton
            text={fullReadAloudText}
            label="Read This Record"
          />
        </View>
      ) : null}

      <View
        style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={styles.sectionHeader}>
          <ThemedText type="h4" style={{ flex: 1 }}>
            Summary
          </ThemedText>
          {settings.readAloudEnabled ? (
            <ReadAloudButton text={record.summary} compact />
          ) : null}
        </View>
        <ThemedText type="body" style={styles.summaryText}>
          {record.summary}
        </ThemedText>
      </View>

      {record.details && Object.keys(record.details).length > 0 ? (
        <View
          style={[styles.detailsCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText type="h4" style={styles.sectionLabel}>
            Details
          </ThemedText>
          {Object.entries(record.details).map(([key, value]) => (
            <React.Fragment key={key}>
              <DetailRow label={key} value={value} theme={theme} />
              {Object.keys(record.details!).indexOf(key) <
              Object.keys(record.details!).length - 1 ? (
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
              ) : null}
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {record.details ? (
        <TypeSpecificDetails type={record.type} details={record.details} theme={theme} />
      ) : null}

      <TrendSparkline
        recordId={record.id}
        recordType={record.type}
        activeRecordId={record.id}
      />

      <AttachmentsSection recordId={record.id} theme={theme} />

      <Pressable
        onPress={handleShare}
        style={({ pressed }) => [
          styles.shareButton,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        testID="button-share-record"
      >
        <Feather name="share" size={18} color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.primary, fontWeight: "500" }}>
          Share Record
        </ThemedText>
      </Pressable>

      <View style={[styles.provenanceSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionLabel}>
          Data Provenance
        </ThemedText>
        <ProvenanceBadge
          sourceType={(record as any).sourceType || "fhir"}
          sourceOrg={(record as any).sourceOrg || record.provider}
          dateCreated={record.date}
          dateImported={record.lastSynced}
          recordType={config.label}
          coding={(record as any).coding}
          rawData={(record as any).rawFhirData}
        />
      </View>

      <View style={styles.footer}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          Last synced {formatTime(record.lastSynced)} on{" "}
          {new Date(record.lastSynced).toLocaleDateString()}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.lg,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
  },
  summaryText: {
    lineHeight: 24,
  },
  detailsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    paddingVertical: Spacing.sm,
  },
  detailValue: {
    marginTop: 4,
  },
  divider: {
    height: 1,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  provenanceSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.lg,
  },
  readAloudRow: {
    marginTop: Spacing.lg,
    alignItems: "flex-start",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  attachmentsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  attachmentsHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: Spacing.md,
  },
  emptyAttachments: {
    alignItems: "center" as const,
    paddingVertical: Spacing.xl,
  },
  attachmentRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
});
