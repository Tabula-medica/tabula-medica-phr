import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { Paths, File as ExpoFile } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { Colors, Spacing, BorderRadius, Typography } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { HealthRecord, axiosInstance } from "../lib/api";
import { apiRequest } from "../lib/query-client";

const RECORD_CATEGORIES = [
  { key: "all", label: "All Records", icon: "file-text" },
  { key: "lab", label: "Lab Results", icon: "activity" },
  { key: "medication", label: "Medications", icon: "package" },
  { key: "visit", label: "Visits", icon: "calendar" },
  { key: "imaging", label: "Imaging", icon: "image" },
  { key: "immunization", label: "Immunizations", icon: "shield" },
  { key: "procedure", label: "Procedures", icon: "tool" },
  { key: "allergy", label: "Allergies", icon: "alert-triangle" },
  { key: "vital", label: "Vitals", icon: "heart" },
] as const;

type CategoryKey = (typeof RECORD_CATEGORIES)[number]["key"];

type TimeframeOption = "7d" | "30d" | "90d" | "1y" | "5y" | "all" | "custom";

interface ACOPreset {
  id: string;
  name: string;
  description: string;
  categories: CategoryKey[];
  timeframe: TimeframeOption;
  maxPages: number;
  icon: keyof typeof Feather.glyphMap;
}

const ACO_PRESETS: ACOPreset[] = [
  {
    id: "ed_packet",
    name: "ED Packet",
    description: "1-page emergency summary",
    categories: ["medication", "allergy", "vital"],
    timeframe: "30d",
    maxPages: 1,
    icon: "alert-circle",
  },
  {
    id: "specialist_packet",
    name: "Specialist Packet",
    description: "2-3 page comprehensive referral",
    categories: ["all"],
    timeframe: "1y",
    maxPages: 3,
    icon: "user-check",
  },
  {
    id: "primary_care",
    name: "Primary Care",
    description: "Annual wellness summary",
    categories: ["lab", "medication", "immunization", "vital"],
    timeframe: "1y",
    maxPages: 5,
    icon: "user",
  },
  {
    id: "surgery_prep",
    name: "Surgery Prep",
    description: "Pre-operative clearance packet",
    categories: ["lab", "medication", "allergy", "procedure", "vital"],
    timeframe: "90d",
    maxPages: 4,
    icon: "scissors",
  },
];

const TIMEFRAME_OPTIONS: { key: TimeframeOption; label: string }[] = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "1y", label: "Last Year" },
  { key: "5y", label: "Last 5 Years" },
  { key: "all", label: "All Time" },
];

function getTimeframeStartDate(timeframe: TimeframeOption): Date | null {
  const now = new Date();
  switch (timeframe) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "5y":
      return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    case "all":
    default:
      return null;
  }
}

export default function PacketExportScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const [selectedCategories, setSelectedCategories] = useState<Set<CategoryKey>>(new Set(["all"]));
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>("all");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const { data: records = [] } = useQuery<HealthRecord[]>({
    queryKey: ["/api/records"],
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async (params: { categories: string[] | null; dateRangeStart: string | null }) => {
      const response = await apiRequest("POST", "/api/share-links", {
        expiresInHours: 72,
        categories: params.categories,
        dateRangeStart: params.dateRangeStart,
      });
      return response.json();
    },
  });

  const filteredRecords = useMemo(() => {
    const startDate = getTimeframeStartDate(selectedTimeframe);
    let filtered = records;

    if (startDate) {
      filtered = filtered.filter((r) => new Date(r.date) >= startDate);
    }

    if (!selectedCategories.has("all")) {
      filtered = filtered.filter((r) => selectedCategories.has(r.type as CategoryKey));
    }

    return filtered;
  }, [records, selectedCategories, selectedTimeframe]);

  const recordCounts = useMemo(() => {
    return RECORD_CATEGORIES.reduce(
      (acc, cat) => {
        if (cat.key === "all") {
          acc[cat.key] = filteredRecords.length;
        } else {
          acc[cat.key] = filteredRecords.filter((r) => r.type === cat.key).length;
        }
        return acc;
      },
      {} as Record<CategoryKey, number>
    );
  }, [filteredRecords]);

  const previewData = useMemo(() => {
    const byType: Record<string, HealthRecord[]> = {};
    filteredRecords.forEach((r) => {
      if (!byType[r.type]) byType[r.type] = [];
      byType[r.type].push(r);
    });

    const dateRange =
      filteredRecords.length > 0
        ? {
            earliest: filteredRecords.reduce(
              (min, r) => (new Date(r.date) < new Date(min) ? r.date : min),
              filteredRecords[0].date
            ),
            latest: filteredRecords.reduce(
              (max, r) => (new Date(r.date) > new Date(max) ? r.date : max),
              filteredRecords[0].date
            ),
          }
        : null;

    return { byType, dateRange, totalRecords: filteredRecords.length };
  }, [filteredRecords]);

  const applyPreset = (preset: ACOPreset) => {
    setSelectedPreset(preset.id);
    setSelectedCategories(new Set(preset.categories));
    setSelectedTimeframe(preset.timeframe);
  };

  const toggleCategory = (key: CategoryKey) => {
    setSelectedPreset(null);
    const newSelection = new Set(selectedCategories);

    if (key === "all") {
      if (newSelection.has("all")) {
        newSelection.clear();
      } else {
        newSelection.clear();
        newSelection.add("all");
      }
    } else {
      newSelection.delete("all");
      if (newSelection.has(key)) {
        newSelection.delete(key);
      } else {
        newSelection.add(key);
      }
      if (newSelection.size === 0) {
        newSelection.add("all");
      }
    }

    setSelectedCategories(newSelection);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const categories = selectedCategories.has("all") ? undefined : Array.from(selectedCategories);
      const startDate = getTimeframeStartDate(selectedTimeframe);

      const params = new URLSearchParams();
      if (categories) {
        params.append("categories", categories.join(","));
      }
      if (startDate) {
        params.append("dateRangeStart", startDate.toISOString());
      }

      const pdfUrl = `${axiosInstance.defaults.baseURL}/api/export/pdf?${params.toString()}`;

      if (Platform.OS === "web") {
        await WebBrowser.openBrowserAsync(pdfUrl);
        setExportSuccess(true);
      } else {
        const filename = `tabula-medica-${new Date().toISOString().split("T")[0]}.pdf`;
        const file = new ExpoFile(Paths.cache, filename);

        const response = await fetch(pdfUrl);
        if (!response.ok) {
          throw new Error("Failed to download PDF");
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        await file.write(new Uint8Array(arrayBuffer));

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/pdf",
            dialogTitle: "Share Health Records",
            UTI: "com.adobe.pdf",
          });
        }
        setExportSuccess(true);
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateShareLink = async () => {
    try {
      const categories = selectedCategories.has("all") ? null : Array.from(selectedCategories);
      const startDate = getTimeframeStartDate(selectedTimeframe);

      const result = await createShareLinkMutation.mutateAsync({
        categories,
        dateRangeStart: startDate?.toISOString() || null,
      });

      if (result && typeof result === 'object' && 'shareUrl' in result) {
        setShareLink((result as { shareUrl: string }).shareUrl);
        setShowShareModal(true);
      }
    } catch (error) {
      console.error("Share link error:", error);
    }
  };

  const copyShareLink = async () => {
    if (shareLink) {
      await Clipboard.setStringAsync(shareLink);
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="download" size={32} color={theme.primary} />
          </View>
          <Text style={styles.title}>Export Health Packet</Text>
          <Text style={styles.subtitle}>
            Generate a comprehensive PDF or shareable link for healthcare providers
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACO View Presets</Text>
          <Text style={styles.sectionSubtitle}>Quick templates for common healthcare scenarios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
            {ACO_PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                  onPress={() => applyPreset(preset)}
                >
                  <View style={[styles.presetIcon, isSelected && styles.presetIconSelected]}>
                    <Feather
                      name={preset.icon}
                      size={18}
                      color={isSelected ? "#FFFFFF" : theme.primary}
                    />
                  </View>
                  <Text style={[styles.presetName, isSelected && styles.presetNameSelected]}>
                    {preset.name}
                  </Text>
                  <Text style={[styles.presetDesc, isSelected && styles.presetDescSelected]}>
                    {preset.description}
                  </Text>
                  {isSelected ? (
                    <View style={styles.presetCheck}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeframe</Text>
          <View style={styles.timeframeGrid}>
            {TIMEFRAME_OPTIONS.map((option) => {
              const isSelected = selectedTimeframe === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.timeframeChip, isSelected && styles.timeframeChipSelected]}
                  onPress={() => {
                    setSelectedTimeframe(option.key);
                    setSelectedPreset(null);
                  }}
                >
                  <Text style={[styles.timeframeLabel, isSelected && styles.timeframeLabelSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Record Categories</Text>
          <View style={styles.categoriesGrid}>
            {RECORD_CATEGORIES.map((category) => {
              const isSelected = selectedCategories.has(category.key);
              const count = recordCounts[category.key];

              return (
                <Pressable
                  key={category.key}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                    count === 0 && category.key !== "all" && styles.categoryCardDisabled,
                  ]}
                  onPress={() => (count > 0 || category.key === "all" ? toggleCategory(category.key) : null)}
                >
                  <View style={[styles.categoryIcon, isSelected && styles.categoryIconSelected]}>
                    <Feather
                      name={category.icon as keyof typeof Feather.glyphMap}
                      size={20}
                      color={isSelected ? "#FFFFFF" : theme.primary}
                    />
                  </View>
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {category.label}
                  </Text>
                  <Text style={[styles.categoryCount, isSelected && styles.categoryCountSelected]}>
                    {count} {count === 1 ? "record" : "records"}
                  </Text>
                  {isSelected ? (
                    <View style={styles.checkmark}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.previewHeader}>
            <Text style={styles.sectionTitle}>Export Preview</Text>
            <Pressable style={styles.previewButton} onPress={() => setShowPreview(true)}>
              <Feather name="eye" size={14} color={theme.primary} />
              <Text style={styles.previewButtonText}>Full Preview</Text>
            </Pressable>
          </View>
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Records included</Text>
              <Text style={styles.previewValue}>{previewData.totalRecords}</Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Date range</Text>
              <Text style={styles.previewValue}>
                {previewData.dateRange
                  ? `${new Date(previewData.dateRange.earliest).toLocaleDateString()} - ${new Date(previewData.dateRange.latest).toLocaleDateString()}`
                  : "No records"}
              </Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Categories</Text>
              <Text style={styles.previewValue}>
                {Object.keys(previewData.byType).length} types
              </Text>
            </View>
            <View style={styles.previewDivider} />
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Format</Text>
              <Text style={styles.previewValue}>PDF + Share Link</Text>
            </View>
          </View>
        </View>

        <View style={styles.hipaaNotice}>
          <Feather name="shield" size={16} color={theme.warning} />
          <Text style={styles.hipaaText}>
            This document contains protected health information (PHI). Handle according to HIPAA guidelines.
          </Text>
        </View>

        {exportSuccess ? (
          <View style={styles.successBanner}>
            <Feather name="check-circle" size={20} color={theme.success} />
            <Text style={styles.successText}>PDF exported successfully!</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.footerButtons}>
          <Pressable
            style={styles.shareButton}
            onPress={handleCreateShareLink}
            disabled={createShareLinkMutation.isPending || previewData.totalRecords === 0}
          >
            {createShareLinkMutation.isPending ? (
              <ActivityIndicator color={theme.primary} size="small" />
            ) : (
              <>
                <Feather name="link" size={18} color={theme.primary} />
                <Text style={styles.shareButtonText}>Create Share Link</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={isExporting || previewData.totalRecords === 0}
          >
            {isExporting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="file-text" size={18} color="#FFFFFF" />
                <Text style={styles.exportButtonText}>Export PDF</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <Modal visible={showPreview} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={styles.modalTitle}>Export Preview</Text>
            <Pressable onPress={() => setShowPreview(false)} style={styles.modalClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.previewSummary}>
              <Text style={styles.previewSummaryTitle}>
                {previewData.totalRecords} Records Selected
              </Text>
              {previewData.dateRange ? (
                <Text style={styles.previewSummaryDate}>
                  {new Date(previewData.dateRange.earliest).toLocaleDateString()} -{" "}
                  {new Date(previewData.dateRange.latest).toLocaleDateString()}
                </Text>
              ) : null}
            </View>

            {Object.entries(previewData.byType).map(([type, typeRecords]) => (
              <View key={type} style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>
                  {type.charAt(0).toUpperCase() + type.slice(1)} ({typeRecords.length})
                </Text>
                {typeRecords.slice(0, 3).map((record) => (
                  <View key={record.id} style={styles.previewRecordRow}>
                    <Text style={styles.previewRecordTitle} numberOfLines={1}>
                      {record.title}
                    </Text>
                    <Text style={styles.previewRecordDate}>
                      {new Date(record.date).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
                {typeRecords.length > 3 ? (
                  <Text style={styles.previewMore}>+{typeRecords.length - 3} more</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showShareModal} animationType="fade" transparent>
        <View style={styles.shareModalOverlay}>
          <View style={[styles.shareModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.shareModalHeader}>
              <Feather name="link" size={24} color={theme.success} />
              <Text style={styles.shareModalTitle}>Share Link Created</Text>
            </View>
            <Text style={styles.shareModalSubtitle}>
              This link expires in 72 hours and includes all selected records.
            </Text>
            <View style={[styles.shareLinkBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={styles.shareLinkText} numberOfLines={2}>
                {shareLink}
              </Text>
            </View>
            <View style={styles.shareModalButtons}>
              <Pressable style={styles.copyButton} onPress={copyShareLink}>
                <Feather name="copy" size={16} color="#FFFFFF" />
                <Text style={styles.copyButtonText}>Copy Link</Text>
              </Pressable>
              <Pressable
                style={[styles.doneButton, { borderColor: theme.border }]}
                onPress={() => setShowShareModal(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingHorizontal: Spacing.lg,
    },
    header: {
      alignItems: "center",
      marginBottom: Spacing.xl,
    },
    iconContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.h2,
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    subtitle: {
      ...Typography.body,
      color: theme.textSecondary,
      textAlign: "center",
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      ...Typography.h4,
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    sectionSubtitle: {
      ...Typography.small,
      color: theme.textSecondary,
      marginBottom: Spacing.md,
    },
    presetsScroll: {
      marginHorizontal: -Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    presetCard: {
      width: 140,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginRight: Spacing.sm,
      borderWidth: 2,
      borderColor: "transparent",
    },
    presetCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.backgroundSecondary,
    },
    presetIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    presetIconSelected: {
      backgroundColor: theme.primary,
    },
    presetName: {
      ...Typography.small,
      fontWeight: "600",
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    presetNameSelected: {
      color: theme.primary,
    },
    presetDesc: {
      ...Typography.caption,
      color: theme.textSecondary,
    },
    presetDescSelected: {
      color: theme.primary,
    },
    presetCheck: {
      position: "absolute",
      top: Spacing.xs,
      right: Spacing.xs,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    timeframeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.xs,
    },
    timeframeChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.border,
    },
    timeframeChipSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    timeframeLabel: {
      ...Typography.small,
      color: theme.text,
    },
    timeframeLabelSelected: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    categoriesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -Spacing.xs,
    },
    categoryCard: {
      width: "48%",
      marginHorizontal: "1%",
      marginBottom: Spacing.sm,
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 2,
      borderColor: "transparent",
    },
    categoryCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.backgroundSecondary,
    },
    categoryCardDisabled: {
      opacity: 0.5,
    },
    categoryIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    categoryIconSelected: {
      backgroundColor: theme.primary,
    },
    categoryLabel: {
      ...Typography.small,
      fontWeight: "600",
      color: theme.text,
      marginBottom: Spacing.xs,
    },
    categoryLabelSelected: {
      color: theme.primary,
    },
    categoryCount: {
      ...Typography.caption,
      color: theme.textSecondary,
    },
    categoryCountSelected: {
      color: theme.primary,
    },
    checkmark: {
      position: "absolute",
      top: Spacing.sm,
      right: Spacing.sm,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    previewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: Spacing.md,
    },
    previewButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
    },
    previewButtonText: {
      ...Typography.small,
      color: theme.primary,
      fontWeight: "600",
    },
    previewCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
    },
    previewRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    previewLabel: {
      ...Typography.small,
      color: theme.textSecondary,
    },
    previewValue: {
      ...Typography.small,
      fontWeight: "600",
      color: theme.text,
    },
    previewDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: Spacing.sm,
    },
    hipaaNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.backgroundSecondary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    hipaaText: {
      flex: 1,
      ...Typography.caption,
      color: theme.warning,
      lineHeight: 18,
    },
    successBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.backgroundSecondary,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    successText: {
      ...Typography.small,
      fontWeight: "600",
      color: theme.success,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.backgroundRoot,
    },
    footerButtons: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    shareButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    shareButtonText: {
      ...Typography.small,
      fontWeight: "600",
      color: theme.primary,
    },
    exportButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.xs,
    },
    exportButtonDisabled: {
      opacity: 0.6,
    },
    exportButtonText: {
      ...Typography.small,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: Spacing.lg,
      borderBottomWidth: 1,
    },
    modalTitle: {
      ...Typography.h3,
      color: theme.text,
    },
    modalClose: {
      padding: Spacing.xs,
    },
    modalContent: {
      flex: 1,
      padding: Spacing.lg,
    },
    previewSummary: {
      alignItems: "center",
      marginBottom: Spacing.xl,
    },
    previewSummaryTitle: {
      ...Typography.h2,
      color: theme.text,
    },
    previewSummaryDate: {
      ...Typography.small,
      color: theme.textSecondary,
      marginTop: Spacing.xs,
    },
    previewSection: {
      marginBottom: Spacing.lg,
    },
    previewSectionTitle: {
      ...Typography.h4,
      color: theme.text,
      marginBottom: Spacing.sm,
    },
    previewRecordRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    previewRecordTitle: {
      ...Typography.small,
      color: theme.text,
      flex: 1,
    },
    previewRecordDate: {
      ...Typography.caption,
      color: theme.textSecondary,
    },
    previewMore: {
      ...Typography.small,
      color: theme.primary,
      marginTop: Spacing.xs,
    },
    shareModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: Spacing.xl,
    },
    shareModalContent: {
      width: "100%",
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
    },
    shareModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    shareModalTitle: {
      ...Typography.h3,
      color: theme.text,
    },
    shareModalSubtitle: {
      ...Typography.small,
      color: theme.textSecondary,
      marginBottom: Spacing.lg,
    },
    shareLinkBox: {
      padding: Spacing.md,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.lg,
    },
    shareLinkText: {
      ...Typography.small,
      color: theme.text,
      fontFamily: "monospace",
    },
    shareModalButtons: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    copyButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primary,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      gap: Spacing.xs,
    },
    copyButtonText: {
      ...Typography.small,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    doneButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      borderWidth: 1,
    },
    doneButtonText: {
      ...Typography.small,
      fontWeight: "600",
      color: theme.text,
    },
  });
