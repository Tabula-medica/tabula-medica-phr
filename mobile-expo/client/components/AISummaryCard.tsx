import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface SourceCitation {
  id: string;
  recordId: string;
  recordType: string;
  recordTitle: string;
  sourceOrg: string;
  sourceType: "fhir" | "manual" | "tefca" | "aggregator";
  dateRecorded: string;
  excerpt: string;
  confidence?: number;
}

export interface InsightSection {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: string[];
  color?: string;
}

interface AISummaryCardProps {
  summary: string;
  sections?: InsightSection[];
  citations?: SourceCitation[];
  generatedAt?: string;
  modelVersion?: string;
  confidenceLevel?: "high" | "medium" | "low";
  recordCount?: number;
  sourceCount?: number;
  onCitationPress?: (citation: SourceCitation) => void;
  onReportError?: (feedback: string) => void;
  onViewFullSummary?: () => void;
}

export function AISummaryCard({
  summary,
  sections = [],
  citations = [],
  generatedAt,
  modelVersion,
  confidenceLevel = "medium",
  recordCount = 0,
  sourceCount = 0,
  onCitationPress,
  onReportError,
  onViewFullSummary,
}: AISummaryCardProps) {
  const { theme, isDark } = useTheme();
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["Key Trends"]));

  const getSourceIcon = (sourceType: string): keyof typeof Feather.glyphMap => {
    switch (sourceType) {
      case "fhir": return "database";
      case "manual": return "edit-3";
      case "tefca": return "globe";
      case "aggregator": return "layers";
      default: return "file";
    }
  };

  const confidenceConfig = {
    high: { label: "High", color: theme.success, icon: "check-circle" as const },
    medium: { label: "Medium", color: theme.warning, icon: "alert-circle" as const },
    low: { label: "Low", color: theme.error, icon: "alert-triangle" as const },
  };

  const confidence = confidenceConfig[confidenceLevel];

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const handleReportSubmit = () => {
    if (reportText.trim()) {
      onReportError?.(reportText);
      setReportText("");
      setShowReportModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Thank You", "Your feedback helps us improve accuracy.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.05)" }]}>
      <View style={styles.header}>
        <View style={styles.aiLabel}>
          <LinearGradient
            colors={["#8b5cf6", "#6366f1"]}
            style={styles.aiIconGradient}
          >
            <Feather name="cpu" size={12} color="#fff" />
          </LinearGradient>
          <ThemedText style={[styles.aiLabelText, { color: theme.textSecondary }]}>
            AI Health Summary
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.confidencePill, { backgroundColor: confidence.color + "15" }]}>
            <Feather name={confidence.icon} size={10} color={confidence.color} />
            <ThemedText style={{ fontSize: 10, color: confidence.color, fontWeight: "600", marginLeft: 3 }}>
              {confidence.label}
            </ThemedText>
          </View>
          <Pressable
            testID="button-ai-info"
            style={[styles.disclosureBtn, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowDisclosure(!showDisclosure);
            }}
          >
            <Feather name="info" size={14} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      {showDisclosure ? (
        <View style={[styles.disclosureBox, { backgroundColor: `${theme.warning}15`, borderColor: theme.warning }]}>
          <View style={styles.disclosureHeader}>
            <Feather name="alert-circle" size={16} color={theme.warning} />
            <ThemedText style={[styles.disclosureTitle, { color: theme.warning }]}>
              What This Is / What This Isn't
            </ThemedText>
          </View>
          <View style={styles.disclosureContent}>
            <View style={styles.disclosureItem}>
              <Feather name="check" size={14} color={theme.success} />
              <ThemedText style={[styles.disclosureText, { color: theme.text }]}>
                A summary of your health records for quick reference
              </ThemedText>
            </View>
            <View style={styles.disclosureItem}>
              <Feather name="check" size={14} color={theme.success} />
              <ThemedText style={[styles.disclosureText, { color: theme.text }]}>
                Based on structured data from your connected sources
              </ThemedText>
            </View>
            <View style={styles.disclosureItem}>
              <Feather name="x" size={14} color={theme.error} />
              <ThemedText style={[styles.disclosureText, { color: theme.text }]}>
                NOT medical advice or a diagnosis
              </ThemedText>
            </View>
            <View style={styles.disclosureItem}>
              <Feather name="x" size={14} color={theme.error} />
              <ThemedText style={[styles.disclosureText, { color: theme.text }]}>
                NOT a substitute for professional medical consultation
              </ThemedText>
            </View>
          </View>
          {modelVersion || generatedAt ? (
            <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
              {modelVersion ? `Model: ${modelVersion}` : ""}{modelVersion && generatedAt ? " | " : ""}
              {generatedAt ? `Generated: ${new Date(generatedAt).toLocaleString()}` : ""}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <ThemedText style={[styles.summaryText, { color: theme.text }]}>
        {summary}
      </ThemedText>

      {sections.length > 0 ? (
        <View style={styles.sectionsContainer}>
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.title);
            const sectionColor = section.color || theme.primary;
            return (
              <View key={section.title} style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Pressable
                  testID={`section-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
                  style={styles.sectionHeader}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleSection(section.title);
                  }}
                >
                  <View style={[styles.sectionIconBg, { backgroundColor: sectionColor + "15" }]}>
                    <Feather name={section.icon} size={14} color={sectionColor} />
                  </View>
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                    {section.title}
                  </ThemedText>
                  <View style={styles.sectionCountBadge}>
                    <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontWeight: "600" }}>
                      {section.items.length}
                    </ThemedText>
                  </View>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
                </Pressable>
                {isExpanded ? (
                  <View style={styles.sectionItems}>
                    {section.items.map((item, idx) => (
                      <View key={idx} style={styles.sectionItem}>
                        <View style={[styles.sectionBullet, { backgroundColor: sectionColor }]} />
                        <ThemedText style={[styles.sectionItemText, { color: theme.text }]}>
                          {item}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {recordCount > 0 || sourceCount > 0 ? (
        <View style={[styles.confidenceRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Feather name="database" size={12} color={theme.textSecondary} />
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
            Based on {recordCount > 0 ? `${recordCount} records` : "your records"}
            {sourceCount > 0 ? ` from ${sourceCount} source${sourceCount > 1 ? "s" : ""}` : ""}
          </ThemedText>
          <View style={[styles.confidenceDot, { backgroundColor: confidence.color }]} />
          <ThemedText style={{ fontSize: 11, color: confidence.color, fontWeight: "500" }}>
            {confidence.label} confidence
          </ThemedText>
        </View>
      ) : null}

      {citations.length > 0 ? (
        <Pressable
          testID="button-view-sources"
          style={[styles.citationsToggle, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCitations(!showCitations);
          }}
        >
          <Feather name="book-open" size={14} color={theme.primary} />
          <ThemedText style={[styles.citationsToggleText, { color: theme.primary }]}>
            {showCitations ? "Hide sources" : `View ${citations.length} source${citations.length > 1 ? "s" : ""}`}
          </ThemedText>
          <Feather name={showCitations ? "chevron-up" : "chevron-down"} size={14} color={theme.primary} />
        </Pressable>
      ) : null}

      {showCitations && citations.length > 0 ? (
        <View style={styles.citationsList}>
          <ThemedText style={[styles.citationsLabel, { color: theme.textSecondary }]}>
            BASED ON THESE RECORDS
          </ThemedText>
          {citations.map((citation) => (
            <Pressable
              key={citation.id}
              testID={`citation-${citation.id}`}
              style={[styles.citationCard, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => onCitationPress?.(citation)}
            >
              <View style={styles.citationHeader}>
                <View style={[styles.sourceIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather name={getSourceIcon(citation.sourceType)} size={12} color={theme.primary} />
                </View>
                <View style={styles.citationInfo}>
                  <ThemedText style={{ fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
                    {citation.recordTitle}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 11, color: theme.textSecondary }}>
                    {citation.sourceOrg} | {new Date(citation.dateRecorded).toLocaleDateString()}
                  </ThemedText>
                </View>
                <View style={[styles.citationBadge, { 
                  backgroundColor: citation.sourceType === "fhir" ? `${theme.success}15` :
                    citation.sourceType === "manual" ? `${theme.warning}15` : `${theme.primary}15`
                }]}>
                  <ThemedText style={{ 
                    fontSize: 9, 
                    color: citation.sourceType === "fhir" ? theme.success :
                      citation.sourceType === "manual" ? theme.warning : theme.primary,
                    fontWeight: "600",
                  }}>
                    {citation.sourceType.toUpperCase()}
                  </ThemedText>
                </View>
              </View>
              {citation.excerpt ? (
                <View style={[styles.excerptBox, { borderLeftColor: theme.primary }]}>
                  <ThemedText style={{ fontSize: 11, color: theme.textSecondary, fontStyle: "italic" }} numberOfLines={2}>
                    "{citation.excerpt}"
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {onViewFullSummary ? (
        <Pressable
          testID="button-view-full-summary"
          style={[styles.viewFullBtn, { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onViewFullSummary();
          }}
        >
          <ThemedText style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
            View Full Summary
          </ThemedText>
          <Feather name="arrow-right" size={16} color="#fff" />
        </Pressable>
      ) : null}

      <View style={styles.footer}>
        <ThemedText style={{ fontSize: 10, color: theme.textSecondary, fontStyle: "italic", flex: 1 }}>
          Not medical advice. Always consult your healthcare provider.
        </ThemedText>
        <Pressable
          testID="button-report-error"
          style={[styles.reportBtn, { borderColor: theme.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowReportModal(true);
          }}
        >
          <Feather name="flag" size={12} color={theme.textSecondary} />
          <ThemedText style={[styles.reportBtnText, { color: theme.textSecondary }]}>
            Report
          </ThemedText>
        </Pressable>
      </View>

      <Modal
        visible={showReportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowReportModal(false)} style={styles.modalClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">Report Summary Error</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <ThemedText style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
              Help us improve accuracy by reporting issues with this AI summary. Your feedback is reviewed by our quality team.
            </ThemedText>

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              WHAT'S INCORRECT OR CONCERNING?
            </ThemedText>
            <TextInput
              testID="input-report"
              style={[styles.input, { 
                backgroundColor: theme.backgroundDefault, 
                color: theme.text,
                borderColor: theme.border,
              }]}
              placeholder="Describe the issue..."
              placeholderTextColor={theme.textSecondary}
              value={reportText}
              onChangeText={setReportText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <View style={[styles.privacyNote, { backgroundColor: `${theme.primary}10` }]}>
              <Feather name="lock" size={14} color={theme.primary} />
              <ThemedText style={{ fontSize: 12, color: theme.primary, flex: 1 }}>
                Your feedback is used only for quality improvement and does not affect your health records.
              </ThemedText>
            </View>

            <Pressable
              testID="button-submit-report"
              style={[styles.submitBtn, { 
                backgroundColor: reportText.trim() ? theme.primary : theme.backgroundSecondary 
              }]}
              onPress={handleReportSubmit}
              disabled={!reportText.trim()}
            >
              <Feather name="send" size={16} color={reportText.trim() ? "#fff" : theme.textSecondary} />
              <ThemedText style={{ 
                color: reportText.trim() ? "#fff" : theme.textSecondary, 
                fontWeight: "600",
                marginLeft: Spacing.xs,
              }}>
                Submit Feedback
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  aiLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  aiIconGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiLabelText: {
    fontSize: 12,
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  confidencePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  disclosureBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disclosureBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  disclosureHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  disclosureTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  disclosureContent: {
    gap: Spacing.xs,
  },
  disclosureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  disclosureText: {
    fontSize: 12,
    flex: 1,
  },
  metaText: {
    fontSize: 10,
    marginTop: Spacing.sm,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  sectionCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    minHeight: 48,
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginLeft: Spacing.sm,
  },
  sectionCountBadge: {
    marginRight: Spacing.sm,
  },
  sectionItems: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  sectionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  sectionItemText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  citationsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    alignSelf: "flex-start",
  },
  citationsToggleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  citationsList: {
    marginTop: Spacing.md,
  },
  citationsLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  citationCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  citationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sourceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  citationInfo: {
    flex: 1,
  },
  citationBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  excerptBox: {
    marginTop: Spacing.sm,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
  },
  viewFullBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    minHeight: 48,
  },
  footer: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  reportBtnText: {
    fontSize: 11,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalClose: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 120,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});

export default AISummaryCard;
