import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Share,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface DocTypeField {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

interface DocType {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: DocTypeField[];
}

interface DocSection {
  heading: string;
  content: string;
  aiConfidence: number;
  sources: string[];
}

interface GeneratedDocument {
  title: string;
  sections: DocSection[];
  summary: string;
  disclaimer: string;
  generatedAt: string;
}

type ScreenState = "select" | "configure" | "generating" | "review";

export default function DocumentGenerationScreen() {
  const headerHeight = useHeaderHeight();
  let tabBarHeight = 0;
  try { tabBarHeight = useBottomTabBarHeight(); } catch { tabBarHeight = 0; }
  const { theme } = useTheme();

  const [screenState, setScreenState] = useState<ScreenState>("select");
  const [selectedType, setSelectedType] = useState<DocType | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [editedSections, setEditedSections] = useState<Record<number, string>>({});
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const { data: docTypes, isLoading: typesLoading } = useQuery<DocType[]>({
    queryKey: ["/api/document-generation/types"],
  });

  const generateMutation = useMutation({
    mutationFn: async (params: { documentType: string; fields?: Record<string, string>; additionalContext?: string }) => {
      const res = await apiRequest("POST", "/api/document-generation/generate", params);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedDoc(data);
      const allExpanded = new Set<number>();
      data.sections?.forEach((_: DocSection, i: number) => allExpanded.add(i));
      setExpandedSections(allExpanded);
      setScreenState("review");
    },
    onError: () => {
      setScreenState("configure");
    },
  });

  const handleSelectType = useCallback((docType: DocType) => {
    setSelectedType(docType);
    setFieldValues({});
    setAdditionalContext("");
    setEditedSections({});
    setEditingSection(null);
    if (docType.fields.length === 0) {
      setScreenState("configure");
    } else {
      setScreenState("configure");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    if (!selectedType) return;
    const requiredFields = selectedType.fields.filter(f => f.required);
    const missingRequired = requiredFields.some(f => !fieldValues[f.key]?.trim());
    if (missingRequired) return;

    setScreenState("generating");
    generateMutation.mutate({
      documentType: selectedType.id,
      fields: Object.keys(fieldValues).length > 0 ? fieldValues : undefined,
      additionalContext: additionalContext.trim() || undefined,
    });
  }, [selectedType, fieldValues, additionalContext, generateMutation]);

  const handleBack = useCallback(() => {
    if (screenState === "configure") {
      setScreenState("select");
      setSelectedType(null);
    } else if (screenState === "review") {
      setScreenState("configure");
      setGeneratedDoc(null);
      setEditedSections({});
    }
  }, [screenState]);

  const handleShare = useCallback(async () => {
    if (!generatedDoc) return;
    const text = generatedDoc.sections
      .map((s, i) => `## ${s.heading}\n\n${editedSections[i] || s.content}`)
      .join("\n\n---\n\n");
    const fullText = `${generatedDoc.title}\n\n${text}\n\n---\n${generatedDoc.disclaimer}`;
    try {
      await Share.share({ message: fullText, title: generatedDoc.title });
    } catch {}
  }, [generatedDoc, editedSections]);

  const handleNewDocument = useCallback(() => {
    setScreenState("select");
    setSelectedType(null);
    setFieldValues({});
    setAdditionalContext("");
    setGeneratedDoc(null);
    setEditedSections({});
    setEditingSection(null);
  }, []);

  const toggleSection = useCallback((index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return theme.success;
    if (confidence >= 60) return theme.warning;
    return theme.error;
  };

  const renderTypeSelection = () => (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(300)}>
        <ThemedText type="h2" style={styles.pageTitle}>Generate Document</ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select a document type to create an AI-powered draft based on your health records.
        </ThemedText>
      </Animated.View>

      {typesLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.typeGrid}>
          {docTypes?.map((docType, index) => (
            <Animated.View key={docType.id} entering={FadeInDown.delay(index * 80).duration(300)}>
              <Card
                elevation={1}
                onPress={() => handleSelectType(docType)}
                style={styles.typeCard}
              >
                <View style={[styles.typeIconContainer, { backgroundColor: theme.primary + "15" }]}>
                  <Feather name={docType.icon as any} size={24} color={theme.primary} />
                </View>
                <ThemedText type="h4" style={styles.typeName}>{docType.name}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>
                  {docType.description}
                </ThemedText>
                {docType.fields.length > 0 ? (
                  <View style={[styles.fieldBadge, { backgroundColor: theme.info + "20" }]}>
                    <ThemedText type="small" style={{ color: theme.info, fontSize: 11 }}>
                      {docType.fields.filter(f => f.required).length > 0
                        ? `${docType.fields.filter(f => f.required).length} required field${docType.fields.filter(f => f.required).length > 1 ? "s" : ""}`
                        : "Optional details"}
                    </ThemedText>
                  </View>
                ) : null}
              </Card>
            </Animated.View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderConfiguration = () => (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={handleBack} style={styles.backButton} testID="back-to-types">
        <Feather name="arrow-left" size={20} color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.xs }}>Back</ThemedText>
      </Pressable>

      <Animated.View entering={FadeIn.duration(300)}>
        <View style={styles.configHeader}>
          <View style={[styles.typeIconContainer, { backgroundColor: theme.primary + "15" }]}>
            <Feather name={(selectedType?.icon || "file") as any} size={24} color={theme.primary} />
          </View>
          <View style={styles.configHeaderText}>
            <ThemedText type="h3">{selectedType?.name}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{selectedType?.description}</ThemedText>
          </View>
        </View>
      </Animated.View>

      {selectedType?.fields && selectedType.fields.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Card elevation={1} style={styles.fieldsCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>Details</ThemedText>
            {selectedType.fields.map((field) => (
              <View key={field.key} style={styles.fieldRow}>
                <ThemedText type="body" style={styles.fieldLabel}>
                  {field.label}
                  {field.required ? (
                    <ThemedText type="small" style={{ color: theme.error }}> *</ThemedText>
                  ) : null}
                </ThemedText>
                <TextInput
                  style={[styles.input, {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  }]}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.textSecondary}
                  value={fieldValues[field.key] || ""}
                  onChangeText={(text) => setFieldValues(prev => ({ ...prev, [field.key]: text }))}
                  testID={`field-${field.key}`}
                />
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <Card elevation={1} style={styles.fieldsCard}>
          <ThemedText type="h4" style={styles.sectionTitle}>Additional Context (Optional)</ThemedText>
          <ThemedText type="small" style={[styles.contextHint, { color: theme.textSecondary }]}>
            Add any extra details or preferences for the document.
          </ThemedText>
          <TextInput
            style={[styles.textArea, {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.border,
            }]}
            placeholder="e.g., Include information about my recent surgery..."
            placeholderTextColor={theme.textSecondary}
            value={additionalContext}
            onChangeText={setAdditionalContext}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            testID="additional-context"
          />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(300)}>
        <View style={[styles.disclaimerBox, { backgroundColor: theme.warning + "15", borderColor: theme.warning + "40" }]}>
          <Feather name="alert-triangle" size={16} color={theme.warning} />
          <ThemedText type="small" style={[styles.disclaimerText, { color: theme.textSecondary }]}>
            AI-generated documents are drafts that must be reviewed by a healthcare provider before clinical use. This is not medical advice.
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(350).duration(300)}>
        <Pressable
          style={[styles.generateButton, { backgroundColor: theme.primary }]}
          onPress={handleGenerate}
          testID="generate-button"
        >
          <Feather name="zap" size={20} color="#FFFFFF" />
          <ThemedText type="body" style={styles.generateButtonText}>Generate Document</ThemedText>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );

  const renderGenerating = () => (
    <View style={[styles.centeredFull, { paddingTop: headerHeight }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.generatingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="h3" style={styles.generatingTitle}>Generating Document</ThemedText>
        <ThemedText type="body" style={[styles.generatingSubtitle, { color: theme.textSecondary }]}>
          Analyzing your health records and creating a personalized draft...
        </ThemedText>
        <View style={styles.generatingSteps}>
          {["Gathering health data", "Analyzing records", "Drafting document"].map((step, i) => (
            <Animated.View key={step} entering={FadeInDown.delay(500 + i * 400).duration(300)} style={styles.stepRow}>
              <Feather name="check-circle" size={14} color={theme.success} />
              <ThemedText type="small" style={[styles.stepText, { color: theme.textSecondary }]}>{step}</ThemedText>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    </View>
  );

  const renderReview = () => {
    if (!generatedDoc) return null;

    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.reviewHeader}>
          <Pressable onPress={handleBack} style={styles.backButton} testID="back-to-configure">
            <Feather name="arrow-left" size={20} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, marginLeft: Spacing.xs }}>Back</ThemedText>
          </Pressable>
          <View style={styles.reviewActions}>
            <Pressable
              style={[styles.actionButton, { borderColor: theme.primary }]}
              onPress={handleShare}
              testID="share-button"
            >
              <Feather name="share-2" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>Share</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { borderColor: theme.primary, marginLeft: Spacing.sm }]}
              onPress={handleNewDocument}
              testID="new-document-button"
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>New</ThemedText>
            </Pressable>
          </View>
        </View>

        <Animated.View entering={FadeIn.duration(300)}>
          <Card elevation={2} style={styles.titleCard}>
            <View style={[styles.docIconRow, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="file-text" size={24} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={styles.docTitle}>{generatedDoc.title}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Generated {new Date(generatedDoc.generatedAt).toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </ThemedText>
            {generatedDoc.summary ? (
              <ThemedText type="body" style={[styles.summaryText, { color: theme.textSecondary }]}>
                {generatedDoc.summary}
              </ThemedText>
            ) : null}
          </Card>
        </Animated.View>

        {generatedDoc.sections.map((section, index) => (
          <Animated.View key={index} entering={FadeInDown.delay(index * 80).duration(300)}>
            <Card elevation={1} style={styles.sectionCard}>
              <Pressable
                style={styles.sectionHeader}
                onPress={() => toggleSection(index)}
                testID={`section-toggle-${index}`}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Feather
                    name={expandedSections.has(index) ? "chevron-down" : "chevron-right"}
                    size={18}
                    color={theme.textSecondary}
                  />
                  <ThemedText type="h4" style={styles.sectionHeading}>{section.heading}</ThemedText>
                </View>
                <View style={styles.sectionHeaderRight}>
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(section.aiConfidence) + "20" }]}>
                    <ThemedText type="small" style={{ color: getConfidenceColor(section.aiConfidence), fontSize: 10 }}>
                      {section.aiConfidence}%
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setEditingSection(editingSection === index ? null : index)}
                    style={styles.editIconButton}
                    testID={`edit-section-${index}`}
                  >
                    <Feather
                      name={editingSection === index ? "check" : "edit-2"}
                      size={14}
                      color={theme.primary}
                    />
                  </Pressable>
                </View>
              </Pressable>

              {expandedSections.has(index) ? (
                <View style={styles.sectionBody}>
                  {editingSection === index ? (
                    <TextInput
                      style={[styles.editTextArea, {
                        backgroundColor: theme.backgroundSecondary,
                        color: theme.text,
                        borderColor: theme.primary + "40",
                      }]}
                      value={editedSections[index] !== undefined ? editedSections[index] : section.content}
                      onChangeText={(text) => setEditedSections(prev => ({ ...prev, [index]: text }))}
                      multiline
                      textAlignVertical="top"
                      testID={`edit-area-${index}`}
                    />
                  ) : (
                    <ThemedText type="body" style={styles.sectionContent}>
                      {editedSections[index] !== undefined ? editedSections[index] : section.content}
                    </ThemedText>
                  )}
                  {section.sources.length > 0 ? (
                    <View style={styles.sourcesRow}>
                      <Feather name="database" size={10} color={theme.textSecondary} />
                      <ThemedText type="small" style={[styles.sourcesText, { color: theme.textSecondary }]}>
                        Sources: {section.sources.join(", ")}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.delay(generatedDoc.sections.length * 80 + 100).duration(300)}>
          <View style={[styles.disclaimerBox, { backgroundColor: theme.warning + "15", borderColor: theme.warning + "40" }]}>
            <Feather name="alert-triangle" size={16} color={theme.warning} />
            <ThemedText type="small" style={[styles.disclaimerText, { color: theme.textSecondary }]}>
              {generatedDoc.disclaimer}
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {screenState === "select" ? renderTypeSelection() : null}
      {screenState === "configure" ? renderConfiguration() : null}
      {screenState === "generating" ? renderGenerating() : null}
      {screenState === "review" ? renderReview() : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xl,
  },
  centeredFull: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  pageTitle: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  typeGrid: {
    gap: Spacing.md,
  },
  typeCard: {
    marginBottom: 0,
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  typeName: {
    marginBottom: 4,
  },
  fieldBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: Spacing.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  configHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  configHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fieldsCard: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  fieldRow: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
  },
  contextHint: {
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 18,
    fontSize: 12,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  generatingContainer: {
    alignItems: "center",
  },
  generatingTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  generatingSubtitle: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  generatingSteps: {
    gap: Spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  stepText: {
    fontSize: 13,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  titleCard: {
    marginBottom: Spacing.lg,
  },
  docIconRow: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  docTitle: {
    marginBottom: 4,
  },
  summaryText: {
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  sectionCard: {
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionHeading: {
    marginLeft: Spacing.xs,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  editIconButton: {
    padding: 4,
  },
  sectionBody: {
    marginTop: Spacing.md,
  },
  sectionContent: {
    lineHeight: 22,
  },
  editTextArea: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
  },
  sourcesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 4,
  },
  sourcesText: {
    fontSize: 11,
  },
});
