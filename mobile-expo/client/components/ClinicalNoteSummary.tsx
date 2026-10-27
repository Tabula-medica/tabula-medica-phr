import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface ClinicalNoteSummaryData {
  chiefComplaint: string;
  diagnosis: string[];
  treatmentPlan: string;
  followUpInstructions: string;
  keyFindings: string[];
  medicationsDiscussed: string[];
  testsOrdered: string[];
  redFlags: string[];
  confidence: number;
  summaryTimestamp: string;
  sourceAttribution: string;
}

interface ClinicalNote {
  id: string;
  noteType: string;
  title: string;
  chiefComplaint?: string;
  assessment?: string;
  plan?: string;
  fullNoteContent?: string;
}

interface ClinicalNoteSummaryProps {
  note: ClinicalNote;
  theme: typeof Colors.light;
  onSummaryGenerated?: (summary: ClinicalNoteSummaryData) => void;
}

const ERROR_TYPES = [
  { key: "inaccurate", label: "Inaccurate Information" },
  { key: "missing", label: "Missing Important Details" },
  { key: "misleading", label: "Misleading Summary" },
  { key: "wrong_codes", label: "Incorrect Medical Codes" },
  { key: "other", label: "Other" },
];

export function ClinicalNoteSummary({ note, theme, onSummaryGenerated }: ClinicalNoteSummaryProps) {
  const [summary, setSummary] = useState<ClinicalNoteSummaryData | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorType, setErrorType] = useState("");
  const [errorDescription, setErrorDescription] = useState("");
  const [errorSection, setErrorSection] = useState("");

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/clinical-documentation/notes/${note.id}/summarize`);
      return response.json();
    },
    onSuccess: (data) => {
      setSummary(data as ClinicalNoteSummaryData);
      onSummaryGenerated?.(data as ClinicalNoteSummaryData);
    },
  });

  const reportErrorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/clinical-documentation/notes/${note.id}/report-error`, {
        errorType,
        description: errorDescription,
        section: errorSection,
      });
      return response.json();
    },
    onSuccess: () => {
      setShowErrorModal(false);
      setErrorType("");
      setErrorDescription("");
      setErrorSection("");
    },
  });

  const handleGenerateSummary = () => {
    summarizeMutation.mutate();
  };

  const handleReportError = () => {
    if (errorType && errorDescription) {
      reportErrorMutation.mutate();
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return theme.success;
    if (confidence >= 0.75) return theme.warning;
    return theme.error;
  };

  if (!summary) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Card style={StyleSheet.flatten([styles.summaryCard, { backgroundColor: `${theme.primary}08` }])}>
          <View style={styles.generateHeader}>
            <View style={[styles.aiIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="cpu" size={20} color={theme.primary} />
            </View>
            <View style={styles.generateContent}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                AI Clinical Summary
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Generate an AI summary of key clinical information
              </ThemedText>
            </View>
          </View>
          <Pressable
            style={[styles.generateButton, { backgroundColor: theme.primary }]}
            onPress={handleGenerateSummary}
            disabled={summarizeMutation.isPending}
          >
            {summarizeMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="zap" size={16} color="#FFFFFF" />
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.xs }}>
                  Generate Summary
                </ThemedText>
              </>
            )}
          </Pressable>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.springify()}>
      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.aiIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="cpu" size={18} color={theme.primary} />
            </View>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              AI Clinical Summary
            </ThemedText>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(summary.confidence)}15` }]}>
              <ThemedText type="caption" style={{ color: getConfidenceColor(summary.confidence), fontWeight: "600" }}>
                {Math.round(summary.confidence * 100)}% confident
              </ThemedText>
            </View>
          </View>
        </View>

        {summary.redFlags.length > 0 ? (
          <View style={[styles.redFlagsSection, { backgroundColor: `${theme.error}10`, borderColor: theme.error }]}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-triangle" size={14} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, fontWeight: "700", marginLeft: 4 }}>
                RED FLAGS
              </ThemedText>
            </View>
            {summary.redFlags.map((flag, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: theme.error }]} />
                <ThemedText type="small" style={{ color: theme.error, flex: 1 }}>
                  {flag}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            CHIEF COMPLAINT
          </ThemedText>
          <ThemedText type="body">{summary.chiefComplaint}</ThemedText>
        </View>

        {summary.diagnosis.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              DIAGNOSIS
            </ThemedText>
            {summary.diagnosis.map((dx, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: theme.primary }]} />
                <ThemedText type="body" style={{ flex: 1 }}>{dx}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            TREATMENT PLAN
          </ThemedText>
          <ThemedText type="body">{summary.treatmentPlan}</ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            FOLLOW-UP
          </ThemedText>
          <ThemedText type="body">{summary.followUpInstructions}</ThemedText>
        </View>

        {summary.medicationsDiscussed.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              MEDICATIONS
            </ThemedText>
            <View style={styles.chipContainer}>
              {summary.medicationsDiscussed.map((med, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: `${theme.recordMedication}15` }]}>
                  <Feather name="package" size={10} color={theme.recordMedication} />
                  <ThemedText type="caption" style={{ color: theme.recordMedication, marginLeft: 4 }}>
                    {med}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {summary.testsOrdered.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              TESTS ORDERED
            </ThemedText>
            <View style={styles.chipContainer}>
              {summary.testsOrdered.map((test, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: `${theme.recordLab}15` }]}>
                  <Feather name="activity" size={10} color={theme.recordLab} />
                  <ThemedText type="caption" style={{ color: theme.recordLab, marginLeft: 4 }}>
                    {test}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {summary.keyFindings.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              KEY FINDINGS
            </ThemedText>
            {summary.keyFindings.map((finding, i) => (
              <View key={i} style={styles.listItem}>
                <Feather name="check" size={12} color={theme.success} />
                <ThemedText type="small" style={{ marginLeft: 6, flex: 1 }}>{finding}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.attribution, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="info" size={12} color={theme.textSecondary} />
          <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1, marginLeft: 6 }}>
            {summary.sourceAttribution}
          </ThemedText>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.footerButton, { borderColor: theme.border }]}
            onPress={handleGenerateSummary}
            disabled={summarizeMutation.isPending}
          >
            <Feather name="refresh-cw" size={14} color={theme.textSecondary} />
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              Regenerate
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.footerButton, { borderColor: theme.error }]}
            onPress={() => setShowErrorModal(true)}
          >
            <Feather name="flag" size={14} color={theme.error} />
            <ThemedText type="caption" style={{ color: theme.error, marginLeft: 4 }}>
              Report Error
            </ThemedText>
          </Pressable>
        </View>
      </Card>

      <Modal visible={showErrorModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Report Summary Error</ThemedText>
              <Pressable onPress={() => setShowErrorModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Error Type *
              </ThemedText>
              <View style={styles.errorTypeGrid}>
                {ERROR_TYPES.map((type) => (
                  <Pressable
                    key={type.key}
                    style={[
                      styles.errorTypeChip,
                      { backgroundColor: errorType === type.key ? theme.primary : theme.backgroundSecondary },
                    ]}
                    onPress={() => setErrorType(type.key)}
                  >
                    <ThemedText
                      type="caption"
                      style={{ color: errorType === type.key ? "#FFFFFF" : theme.text }}
                    >
                      {type.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Section with Error
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder="e.g., Diagnosis, Treatment Plan..."
                placeholderTextColor={theme.textSecondary}
                value={errorSection}
                onChangeText={setErrorSection}
              />

              <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                Description *
              </ThemedText>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder="Describe the error and what the correct information should be..."
                placeholderTextColor={theme.textSecondary}
                value={errorDescription}
                onChangeText={setErrorDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => setShowErrorModal(false)}
              >
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: errorType && errorDescription ? theme.error : theme.backgroundSecondary },
                ]}
                onPress={handleReportError}
                disabled={!errorType || !errorDescription || reportErrorMutation.isPending}
              >
                {reportErrorMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{ color: errorType && errorDescription ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}
                  >
                    Submit Report
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  generateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  generateContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  redFlagsSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    marginBottom: 4,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: 8,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  attribution: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxHeight: "80%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalScroll: {
    padding: Spacing.lg,
  },
  fieldLabel: {
    marginBottom: 6,
    fontWeight: "600",
  },
  errorTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  errorTypeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    fontSize: 14,
  },
  textArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    fontSize: 14,
    minHeight: 100,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  cancelButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  submitButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
