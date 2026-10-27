import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deepLinkToUninsurance } from "@/lib/crossAppLink";

const FOLLOWUP_SPECIALTY_HINTS: Record<string, { cptCode: string; specialty: string; label: string }> = {
  "HbA1c": { cptCode: "99213", specialty: "endocrinology", label: "Endocrinology" },
  "Hemoglobin A1c": { cptCode: "99213", specialty: "endocrinology", label: "Endocrinology" },
  "Glucose": { cptCode: "99213", specialty: "endocrinology", label: "Endocrinology" },
  "LDL": { cptCode: "99213", specialty: "cardiology", label: "Cardiology" },
  "LDL Cholesterol": { cptCode: "99213", specialty: "cardiology", label: "Cardiology" },
  "HDL": { cptCode: "99213", specialty: "cardiology", label: "Cardiology" },
  "Total Cholesterol": { cptCode: "99213", specialty: "cardiology", label: "Cardiology" },
  "Triglycerides": { cptCode: "99213", specialty: "cardiology", label: "Cardiology" },
  "TSH": { cptCode: "99213", specialty: "endocrinology", label: "Endocrinology" },
  "Free T4": { cptCode: "99213", specialty: "endocrinology", label: "Endocrinology" },
  "Creatinine": { cptCode: "99213", specialty: "nephrology", label: "Nephrology" },
  "eGFR": { cptCode: "99213", specialty: "nephrology", label: "Nephrology" },
  "BUN": { cptCode: "99213", specialty: "nephrology", label: "Nephrology" },
  "ALT": { cptCode: "99213", specialty: "hepatology", label: "Hepatology" },
  "AST": { cptCode: "99213", specialty: "hepatology", label: "Hepatology" },
  "Bilirubin": { cptCode: "99213", specialty: "hepatology", label: "Hepatology" },
  "WBC": { cptCode: "99213", specialty: "hematology", label: "Hematology" },
  "Hemoglobin": { cptCode: "99213", specialty: "hematology", label: "Hematology" },
  "Platelets": { cptCode: "99213", specialty: "hematology", label: "Hematology" },
  "PSA": { cptCode: "99213", specialty: "urology", label: "Urology" },
  "Vitamin D": { cptCode: "99213", specialty: "endocrinology", label: "Endocrinology" },
  "Iron": { cptCode: "99213", specialty: "hematology", label: "Hematology" },
  "Ferritin": { cptCode: "99213", specialty: "hematology", label: "Hematology" },
};

interface LabComponent {
  name: string;
  value: string;
  valueNumeric?: number;
  units?: string;
  referenceRange?: { low: number; high: number; text: string };
  flag: "normal" | "low" | "high" | "critical_low" | "critical_high";
  isAbnormal: boolean;
  isCritical: boolean;
  interpretation?: string;
  testCode?: string;
}

interface LabResult {
  id: string;
  source: string;
  title: string;
  date: string;
  provider?: string;
  facility?: string;
  summary?: string;
  status: string;
  testCategory: string;
  components: LabComponent[];
  hasAbnormal: boolean;
  hasCritical: boolean;
  abnormalCount: number;
  totalComponents: number;
  orderNumber?: string;
  accessionNumber?: string;
  priority?: string;
  labProvider?: string;
}

interface LabSummary {
  total: number;
  abnormal: number;
  critical: number;
  pending: number;
  normal: number;
}

interface CDSAlert {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendations: string[];
  relatedTests?: string[];
  disclaimer: string;
  source: string;
}

type SortOption = "date" | "testType" | "abnormal";
type FilterOption = "all" | "abnormal" | "resulted" | "pending";

const CATEGORY_LABELS: Record<string, string> = {
  hematology: "Hematology",
  lipid_panel: "Lipid Panel",
  metabolic: "Metabolic",
  thyroid: "Thyroid",
  renal_metabolic: "Kidney & Electrolytes",
  liver: "Liver Function",
  urinalysis: "Urinalysis",
  nutritional: "Nutritional",
  tumor_markers: "Tumor Markers",
  infectious: "Infectious Disease",
  general: "General",
};

const CATEGORY_ICONS: Record<string, string> = {
  hematology: "droplet",
  lipid_panel: "heart",
  metabolic: "activity",
  thyroid: "thermometer",
  renal_metabolic: "filter",
  liver: "clipboard",
  urinalysis: "test-tube" as any,
  nutritional: "sun",
  tumor_markers: "target",
  infectious: "shield",
  general: "file-text",
};

export default function LabResultsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { theme: colors } = useTheme();
  const queryClient = useQueryClient();

  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCDSAlerts, setShowCDSAlerts] = useState(false);
  const [cdsAlerts, setCdsAlerts] = useState<CDSAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery<{
    results: LabResult[];
    summary: LabSummary;
    categories: string[];
  }>({
    queryKey: ["/api/lab-results/consolidated", sortBy, sortOrder, filterStatus, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterCategory !== "all") params.set("testType", filterCategory);
      const baseUrl = getApiUrl();
      const url = new URL(`/api/lab-results/consolidated?${params.toString()}`, baseUrl);
      const headers: Record<string, string> = {};
      const userId = await AsyncStorage.getItem("@tabula_medica_user_id");
      if (userId) headers["x-user-id"] = userId;
      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lab results");
      return res.json();
    },
  });

  const results = data?.results || [];
  const summary = data?.summary || { total: 0, abnormal: 0, critical: 0, pending: 0, normal: 0 };
  const categories = data?.categories || [];

  const cdsAlertsMutation = useMutation({
    mutationFn: async (abnormalResults: LabResult[]) => {
      const res = await apiRequest("POST", "/api/cds/lab-alerts", { abnormalResults });
      return res.json();
    },
    onSuccess: (data: any) => {
      setCdsAlerts(data.alerts || []);
      setShowCDSAlerts(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const abnormalResults = useMemo(() => results.filter(r => r.hasAbnormal), [results]);

  const handleResultPress = useCallback((result: LabResult) => {
    setSelectedResult(result);
    setShowDetailModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleAnalyzeAbnormals = useCallback(() => {
    if (abnormalResults.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cdsAlertsMutation.mutate(abnormalResults);
  }, [abnormalResults]);

  const toggleSort = useCallback((field: SortOption) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [sortBy]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case "critical_low":
      case "critical_high":
        return colors.error;
      case "low":
        return "#3B82F6";
      case "high":
        return colors.warning;
      default:
        return colors.success;
    }
  };

  const getFlagLabel = (flag: string) => {
    switch (flag) {
      case "critical_low": return "CRIT LOW";
      case "critical_high": return "CRIT HIGH";
      case "low": return "LOW";
      case "high": return "HIGH";
      default: return "NORMAL";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return colors.error;
      case "high": return "#EF4444";
      case "moderate": return colors.warning;
      case "low": return colors.info;
      default: return colors.textSecondary;
    }
  };

  const renderSummaryBanner = () => (
    <Animated.View entering={FadeInDown.delay(50)}>
      <View style={styles.summaryRow}>
        <Pressable
          style={[styles.summaryCard, { backgroundColor: `${colors.success}12` }]}
          onPress={() => { setFilterStatus("all"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          testID="summary-total"
        >
          <ThemedText style={[styles.summaryNumber, { color: colors.success }]}>{summary.total}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.summaryCard, { backgroundColor: `${colors.warning}12` }]}
          onPress={() => { setFilterStatus("abnormal"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          testID="summary-abnormal"
        >
          <ThemedText style={[styles.summaryNumber, { color: colors.warning }]}>{summary.abnormal}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>Abnormal</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.summaryCard, { backgroundColor: `${colors.error}12` }]}
          onPress={() => { setFilterStatus("abnormal"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          testID="summary-critical"
        >
          <ThemedText style={[styles.summaryNumber, { color: colors.error }]}>{summary.critical}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>Critical</ThemedText>
        </Pressable>

        <Pressable
          style={[styles.summaryCard, { backgroundColor: `${colors.primary}12` }]}
          onPress={() => { setFilterStatus("pending"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          testID="summary-pending"
        >
          <ThemedText style={[styles.summaryNumber, { color: colors.primary }]}>{summary.pending}</ThemedText>
          <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>Pending</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderSortBar = () => (
    <Animated.View entering={FadeInDown.delay(100)}>
      <View style={styles.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScrollContent}>
          {([
            { key: "date", label: "Date", icon: "calendar" },
            { key: "testType", label: "Test Type", icon: "layers" },
            { key: "abnormal", label: "Abnormal First", icon: "alert-triangle" },
          ] as const).map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.sortButton,
                { borderColor: sortBy === option.key ? colors.primary : colors.border },
                sortBy === option.key ? { backgroundColor: `${colors.primary}12` } : {},
              ]}
              onPress={() => toggleSort(option.key)}
              testID={`sort-${option.key}`}
            >
              <Feather name={option.icon as any} size={14} color={sortBy === option.key ? colors.primary : colors.textSecondary} />
              <ThemedText style={[styles.sortButtonText, { color: sortBy === option.key ? colors.primary : colors.textSecondary }]}>
                {option.label}
              </ThemedText>
              {sortBy === option.key ? (
                <Feather name={sortOrder === "asc" ? "arrow-up" : "arrow-down"} size={12} color={colors.primary} />
              ) : null}
            </Pressable>
          ))}

          <Pressable
            style={[
              styles.sortButton,
              { borderColor: filterStatus !== "all" || filterCategory !== "all" ? colors.primary : colors.border },
              filterStatus !== "all" || filterCategory !== "all" ? { backgroundColor: `${colors.primary}12` } : {},
            ]}
            onPress={() => { setShowFilterModal(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            testID="filter-button"
          >
            <Feather name="filter" size={14} color={filterStatus !== "all" || filterCategory !== "all" ? colors.primary : colors.textSecondary} />
            <ThemedText style={[styles.sortButtonText, { color: filterStatus !== "all" || filterCategory !== "all" ? colors.primary : colors.textSecondary }]}>
              Filter
            </ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    </Animated.View>
  );

  const renderCDSBanner = () => {
    if (abnormalResults.length === 0) return null;

    return (
      <Animated.View entering={FadeInDown.delay(150)}>
        <Pressable
          onPress={handleAnalyzeAbnormals}
          testID="cds-analyze-button"
        >
          <Card style={{ ...styles.cdsBanner, borderColor: colors.warning }}>
            <View style={styles.cdsBannerContent}>
              <View style={[styles.cdsBannerIcon, { backgroundColor: `${colors.warning}15` }]}>
                <Feather name="alert-triangle" size={22} color={colors.warning} />
              </View>
              <View style={styles.cdsBannerText}>
                <ThemedText style={[styles.cdsBannerTitle, { color: colors.text }]}>
                  {abnormalResults.length} Abnormal Result{abnormalResults.length !== 1 ? "s" : ""} Found
                </ThemedText>
                <ThemedText style={[styles.cdsBannerSubtitle, { color: colors.textSecondary }]}>
                  Tap to analyze with Clinical Decision Support
                </ThemedText>
              </View>
              {cdsAlertsMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <Feather name="zap" size={20} color={colors.warning} />
              )}
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  const renderLabResultCard = ({ item, index }: { item: LabResult; index: number }) => {
    const categoryLabel = CATEGORY_LABELS[item.testCategory] || item.testCategory;
    const isPending = item.status === "submitted" || item.status === "collected" || item.status === "pending" || item.status === "draft";

    return (
      <Animated.View entering={FadeInDown.delay(200 + index * 30)}>
        <Pressable
          onPress={() => handleResultPress(item)}
          testID={`lab-result-card-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${formatDate(item.date)}${item.hasCritical ? ", critical values" : item.hasAbnormal ? ", abnormal values" : ", normal"}`}
          accessibilityHint="View lab result details"
        >
          <Card style={{
            ...styles.resultCard,
            ...(item.hasCritical ? { borderLeftColor: colors.error, borderLeftWidth: 4 } : {}),
            ...(item.hasAbnormal && !item.hasCritical ? { borderLeftColor: colors.warning, borderLeftWidth: 4 } : {}),
          }}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleRow}>
                <View style={[styles.categoryBadge, { backgroundColor: `${colors.primary}12` }]}>
                  <Feather name={(CATEGORY_ICONS[item.testCategory] || "file-text") as any} size={14} color={colors.primary} />
                </View>
                <View style={styles.resultTitleInfo}>
                  <ThemedText style={[styles.resultTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </ThemedText>
                  <View style={styles.resultMeta}>
                    <ThemedText style={[styles.resultDate, { color: colors.textSecondary }]}>
                      {formatDate(item.date)}
                    </ThemedText>
                    <ThemedText style={[styles.resultCategory, { color: colors.textSecondary }]}>
                      {categoryLabel}
                    </ThemedText>
                  </View>
                </View>
              </View>

              {isPending ? (
                <View style={[styles.statusBadge, { backgroundColor: `${colors.primary}15` }]}>
                  <ThemedText style={[styles.statusText, { color: colors.primary }]}>Pending</ThemedText>
                </View>
              ) : item.hasCritical ? (
                <View style={[styles.statusBadge, { backgroundColor: `${colors.error}15` }]}>
                  <Feather name="alert-circle" size={12} color={colors.error} />
                  <ThemedText style={[styles.statusText, { color: colors.error }]}>Critical</ThemedText>
                </View>
              ) : item.hasAbnormal ? (
                <View style={[styles.statusBadge, { backgroundColor: `${colors.warning}15` }]}>
                  <Feather name="alert-triangle" size={12} color={colors.warning} />
                  <ThemedText style={[styles.statusText, { color: colors.warning }]}>{item.abnormalCount} Abnormal</ThemedText>
                </View>
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15` }]}>
                  <Feather name="check-circle" size={12} color={colors.success} />
                  <ThemedText style={[styles.statusText, { color: colors.success }]}>Normal</ThemedText>
                </View>
              )}
            </View>

            {item.components.length > 0 && !isPending ? (
              <View style={[styles.componentsPreview, { borderTopColor: colors.border }]}>
                {item.components
                  .sort((a, b) => {
                    if (a.isCritical && !b.isCritical) return -1;
                    if (!a.isCritical && b.isCritical) return 1;
                    if (a.isAbnormal && !b.isAbnormal) return -1;
                    if (!a.isAbnormal && b.isAbnormal) return 1;
                    return 0;
                  })
                  .slice(0, 4)
                  .map((comp, idx) => (
                    <View key={idx} style={styles.componentRow}>
                      <ThemedText style={[styles.componentName, { color: colors.text }]} numberOfLines={1}>
                        {comp.name}
                      </ThemedText>
                      <View style={styles.componentValueRow}>
                        <ThemedText style={[styles.componentValue, { color: getFlagColor(comp.flag) }]}>
                          {comp.value} {comp.units || ""}
                        </ThemedText>
                        {comp.isAbnormal ? (
                          <View style={[styles.flagBadge, { backgroundColor: `${getFlagColor(comp.flag)}15` }]}>
                            <ThemedText style={[styles.flagText, { color: getFlagColor(comp.flag) }]}>
                              {getFlagLabel(comp.flag)}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                {item.components.length > 4 ? (
                  <ThemedText style={[styles.moreComponents, { color: colors.primary }]}>
                    +{item.components.length - 4} more components
                  </ThemedText>
                ) : null}
              </View>
            ) : null}

            {item.components.length > 0 && !isPending ? (
              <Pressable
                onPress={() => {
                  setExpandedResults(prev => {
                    const next = new Set(prev);
                    if (next.has(item.id)) {
                      next.delete(item.id);
                    } else {
                      next.add(item.id);
                    }
                    return next;
                  });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.expandButton, { borderTopColor: colors.border }]}
                testID={`expand-result-${item.id}`}
              >
                <Feather name={expandedResults.has(item.id) ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                <ThemedText style={[styles.expandButtonText, { color: colors.primary }]}>
                  {expandedResults.has(item.id) ? "Collapse" : `View All ${item.components.length} Components`}
                </ThemedText>
              </Pressable>
            ) : null}

            {expandedResults.has(item.id) ? (
              <View style={[styles.expandedComponents, { borderTopColor: colors.border }]}>
                {item.components
                  .sort((a, b) => {
                    if (a.isCritical && !b.isCritical) return -1;
                    if (!a.isCritical && b.isCritical) return 1;
                    if (a.isAbnormal && !b.isAbnormal) return -1;
                    if (!a.isAbnormal && b.isAbnormal) return 1;
                    return 0;
                  })
                  .map((comp, idx) => (
                    <View key={idx} style={[styles.expandedComponentRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.expandedComponentLeft}>
                        <ThemedText style={[styles.componentName, { color: colors.text }]}>
                          {comp.name}
                        </ThemedText>
                        {comp.referenceRange ? (
                          <ThemedText style={[styles.referenceText, { color: colors.textSecondary }]}>
                            Ref: {comp.referenceRange.text}
                          </ThemedText>
                        ) : null}
                      </View>
                      <View style={styles.expandedComponentRight}>
                        <ThemedText style={[styles.componentValue, { color: getFlagColor(comp.flag), fontWeight: "700" }]}>
                          {comp.value} {comp.units || ""}
                        </ThemedText>
                        {comp.isAbnormal ? (
                          <View style={[styles.flagBadge, { backgroundColor: `${getFlagColor(comp.flag)}15` }]}>
                            <ThemedText style={[styles.flagText, { color: getFlagColor(comp.flag) }]}>
                              {getFlagLabel(comp.flag)}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                {selectedResult?.id !== item.id ? (
                  <Pressable
                    onPress={() => handleResultPress(item)}
                    style={[styles.fullDetailsButton, { backgroundColor: `${colors.primary}10` }]}
                    testID={`full-details-${item.id}`}
                  >
                    <Feather name="maximize-2" size={14} color={colors.primary} />
                    <ThemedText style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginLeft: 6 }}>
                      Full Details
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {item.facility ? (
              <View style={styles.facilityRow}>
                <Feather name="map-pin" size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.facilityText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.facility}
                </ThemedText>
              </View>
            ) : null}

            {(item.hasAbnormal || item.hasCritical) ? (() => {
              const flaggedWithHint = item.components.find((c) => (c.isCritical || c.isAbnormal) && FOLLOWUP_SPECIALTY_HINTS[c.name]);
              const hint = flaggedWithHint ? FOLLOWUP_SPECIALTY_HINTS[flaggedWithHint.name] : null;
              if (!hint) return null;
              return (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    deepLinkToUninsurance({
                      // @ts-ignore
        saidPatientId: getUserId(),
                      cptCode: hint.cptCode,
                      specialty: hint.specialty,
                    });
                  }}
                  style={({ pressed }) => [
                    styles.followUpButton,
                    {
                      backgroundColor: item.hasCritical ? `${colors.error}12` : `${colors.primary}12`,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Book follow-up appointment for ${hint.label}`}
                  accessibilityHint={`Opens Uninsurance to book a ${hint.label} follow-up visit`}
                  testID={`book-followup-${item.id}`}
                >
                  <Feather name="calendar" size={14} color={item.hasCritical ? colors.error : colors.primary} />
                  <ThemedText style={{ color: item.hasCritical ? colors.error : colors.primary, fontSize: 13, fontWeight: "600", marginLeft: 6 }}>
                    Book {hint.label} follow-up at $82
                  </ThemedText>
                  <Feather name="external-link" size={12} color={item.hasCritical ? colors.error : colors.primary} style={{ marginLeft: "auto" }} />
                </Pressable>
              );
            })() : null}
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  const renderDetailModal = () => {
    if (!selectedResult) return null;

    return (
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowDetailModal(false)} testID="close-detail-modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Lab Result Details</ThemedText>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          >
            <View style={styles.detailSection}>
              <ThemedText style={[styles.detailTitle, { color: colors.text }]}>{selectedResult.title}</ThemedText>
              <View style={styles.detailMetaRow}>
                <View style={styles.detailMetaItem}>
                  <Feather name="calendar" size={14} color={colors.textSecondary} />
                  <ThemedText style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                    {formatDate(selectedResult.date)}
                  </ThemedText>
                </View>
                {selectedResult.facility ? (
                  <View style={styles.detailMetaItem}>
                    <Feather name="map-pin" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                      {selectedResult.facility}
                    </ThemedText>
                  </View>
                ) : null}
                {selectedResult.orderNumber ? (
                  <View style={styles.detailMetaItem}>
                    <Feather name="hash" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.detailMetaText, { color: colors.textSecondary }]}>
                      Order #{selectedResult.orderNumber}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            {selectedResult.hasAbnormal ? (
              <Card style={{ ...styles.abnormalSummaryCard, borderColor: colors.warning }}>
                <View style={styles.abnormalSummaryContent}>
                  <Feather name="alert-triangle" size={18} color={colors.warning} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText style={[styles.abnormalSummaryTitle, { color: colors.warning }]}>
                      {selectedResult.abnormalCount} Abnormal Value{selectedResult.abnormalCount !== 1 ? "s" : ""} Detected
                    </ThemedText>
                    <ThemedText style={[styles.abnormalSummaryDesc, { color: colors.textSecondary }]}>
                      Review flagged results below. Consult your healthcare provider for interpretation.
                    </ThemedText>
                  </View>
                </View>
              </Card>
            ) : null}

            <ThemedText style={[styles.sectionHeader, { color: colors.text }]}>
              Test Components ({selectedResult.components.length})
            </ThemedText>

            {selectedResult.components
              .sort((a, b) => {
                if (a.isCritical && !b.isCritical) return -1;
                if (!a.isCritical && b.isCritical) return 1;
                if (a.isAbnormal && !b.isAbnormal) return -1;
                if (!a.isAbnormal && b.isAbnormal) return 1;
                return 0;
              })
              .map((comp, idx) => (
                <Animated.View key={idx} entering={FadeIn.delay(idx * 30)}>
                  <Card style={{
                    ...styles.componentCard,
                    ...(comp.isCritical ? { borderLeftColor: colors.error, borderLeftWidth: 3 } : {}),
                    ...(comp.isAbnormal && !comp.isCritical ? { borderLeftColor: colors.warning, borderLeftWidth: 3 } : {}),
                  }}>
                    <View style={styles.componentDetailRow}>
                      <ThemedText style={[styles.componentDetailName, { color: colors.text }]}>
                        {comp.name}
                      </ThemedText>
                      <View style={styles.componentDetailValueContainer}>
                        <ThemedText style={[styles.componentDetailValue, { color: getFlagColor(comp.flag), fontWeight: comp.isAbnormal ? "700" : "500" }]}>
                          {comp.value} {comp.units || ""}
                        </ThemedText>
                        {comp.isAbnormal ? (
                          <View style={[styles.detailFlagBadge, { backgroundColor: `${getFlagColor(comp.flag)}15` }]}>
                            <ThemedText style={[styles.detailFlagText, { color: getFlagColor(comp.flag) }]}>
                              {getFlagLabel(comp.flag)}
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    {comp.referenceRange ? (
                      <View style={styles.referenceRangeRow}>
                        <ThemedText style={[styles.referenceLabel, { color: colors.textSecondary }]}>
                          Reference Range:
                        </ThemedText>
                        <ThemedText style={[styles.referenceValue, { color: colors.textSecondary }]}>
                          {comp.referenceRange.text}
                        </ThemedText>
                      </View>
                    ) : null}
                    {comp.isAbnormal && comp.referenceRange ? (
                      <View style={styles.rangeBarContainer}>
                        <View style={[styles.rangeBar, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.rangeNormal,
                              {
                                backgroundColor: `${colors.success}30`,
                                left: "20%",
                                width: "60%",
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.rangeMarker,
                              {
                                backgroundColor: getFlagColor(comp.flag),
                                left: comp.flag === "low" || comp.flag === "critical_low" ? "10%" : "85%",
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ) : null}
                  </Card>
                </Animated.View>
              ))}

            {selectedResult.hasAbnormal ? (
              <Pressable
                style={[styles.analyzeButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowDetailModal(false);
                  setTimeout(() => handleAnalyzeAbnormals(), 300);
                }}
                testID="detail-analyze-button"
              >
                <Feather name="zap" size={18} color="#fff" />
                <ThemedText style={styles.analyzeButtonText}>Analyze with CDS</ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={[styles.modal, { backgroundColor: colors.backgroundRoot }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setShowFilterModal(false)} testID="close-filter-modal">
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Filter Results</ThemedText>
          <Pressable
            onPress={() => {
              setFilterStatus("all");
              setFilterCategory("all");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            testID="clear-filters"
          >
            <ThemedText style={[styles.clearText, { color: colors.primary }]}>Clear</ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <ThemedText style={[styles.filterSectionTitle, { color: colors.text }]}>Status</ThemedText>
          {(["all", "abnormal", "resulted", "pending"] as FilterOption[]).map((option) => (
            <Pressable
              key={option}
              style={[
                styles.filterOption,
                filterStatus === option ? { backgroundColor: `${colors.primary}12` } : {},
              ]}
              onPress={() => { setFilterStatus(option); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              testID={`filter-status-${option}`}
            >
              <ThemedText style={[styles.filterOptionText, { color: filterStatus === option ? colors.primary : colors.text }]}>
                {option === "all" ? "All Results" : option === "abnormal" ? "Abnormal Only" : option === "resulted" ? "Resulted" : "Pending"}
              </ThemedText>
              {filterStatus === option ? (
                <Feather name="check" size={18} color={colors.primary} />
              ) : null}
            </Pressable>
          ))}

          <ThemedText style={[styles.filterSectionTitle, { color: colors.text, marginTop: Spacing.lg }]}>
            Test Category
          </ThemedText>
          <Pressable
            style={[
              styles.filterOption,
              filterCategory === "all" ? { backgroundColor: `${colors.primary}12` } : {},
            ]}
            onPress={() => { setFilterCategory("all"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            testID="filter-category-all"
          >
            <ThemedText style={[styles.filterOptionText, { color: filterCategory === "all" ? colors.primary : colors.text }]}>
              All Categories
            </ThemedText>
            {filterCategory === "all" ? <Feather name="check" size={18} color={colors.primary} /> : null}
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.filterOption,
                filterCategory === cat ? { backgroundColor: `${colors.primary}12` } : {},
              ]}
              onPress={() => { setFilterCategory(cat); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              testID={`filter-category-${cat}`}
            >
              <View style={styles.filterCategoryRow}>
                <Feather name={(CATEGORY_ICONS[cat] || "file-text") as any} size={16} color={filterCategory === cat ? colors.primary : colors.textSecondary} />
                <ThemedText style={[styles.filterOptionText, { color: filterCategory === cat ? colors.primary : colors.text }]}>
                  {CATEGORY_LABELS[cat] || cat}
                </ThemedText>
              </View>
              {filterCategory === cat ? <Feather name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.filterFooter, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.applyButton, { backgroundColor: colors.primary }]}
            onPress={() => { setShowFilterModal(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            testID="apply-filters"
          >
            <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const renderCDSModal = () => (
    <Modal
      visible={showCDSAlerts}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCDSAlerts(false)}
    >
      <View style={[styles.modal, { backgroundColor: colors.backgroundRoot }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setShowCDSAlerts(false)} testID="close-cds-modal">
            <Feather name="x" size={24} color={colors.text} />
          </Pressable>
          <ThemedText style={[styles.modalTitle, { color: colors.text }]}>CDS Lab Alerts</ThemedText>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <View style={[styles.cdsDisclaimer, { backgroundColor: `${colors.warning}10` }]}>
            <Feather name="info" size={16} color={colors.warning} />
            <ThemedText style={[styles.cdsDisclaimerText, { color: colors.textSecondary }]}>
              AI-generated clinical decision support. Not a substitute for professional medical judgment.
            </ThemedText>
          </View>

          {cdsAlerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={48} color={colors.success} />
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Significant Alerts</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                No clinically significant patterns detected in your abnormal results.
              </ThemedText>
            </View>
          ) : (
            cdsAlerts.map((alert, idx) => (
              <Animated.View key={alert.id || idx} entering={FadeInDown.delay(idx * 50)}>
                <Card style={{
                  ...styles.cdsAlertCard,
                  borderLeftColor: getSeverityColor(alert.severity),
                  borderLeftWidth: 4,
                }}>
                  <View style={styles.cdsAlertHeader}>
                    <View style={[styles.severityBadge, { backgroundColor: `${getSeverityColor(alert.severity)}15` }]}>
                      <ThemedText style={[styles.severityText, { color: getSeverityColor(alert.severity) }]}>
                        {(alert.severity || "info").toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={[styles.categoryTag, { backgroundColor: `${colors.primary}12` }]}>
                      <ThemedText style={[styles.categoryTagText, { color: colors.primary }]}>
                        {(alert.category || "").replace(/_/g, " ")}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={[styles.cdsAlertTitle, { color: colors.text }]}>
                    {alert.title}
                  </ThemedText>
                  <ThemedText style={[styles.cdsAlertDesc, { color: colors.textSecondary }]}>
                    {alert.description}
                  </ThemedText>

                  {alert.recommendations && alert.recommendations.length > 0 ? (
                    <View style={styles.recommendationsSection}>
                      <ThemedText style={[styles.recommendationsTitle, { color: colors.text }]}>
                        Recommendations
                      </ThemedText>
                      {alert.recommendations.map((rec, rIdx) => (
                        <View key={rIdx} style={styles.recommendationRow}>
                          <Feather name="chevron-right" size={14} color={colors.primary} />
                          <ThemedText style={[styles.recommendationText, { color: colors.text }]}>
                            {rec}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {alert.relatedTests && alert.relatedTests.length > 0 ? (
                    <View style={styles.relatedTestsSection}>
                      <ThemedText style={[styles.relatedTestsTitle, { color: colors.textSecondary }]}>
                        Suggested Follow-up Tests
                      </ThemedText>
                      <View style={styles.relatedTestsTags}>
                        {alert.relatedTests.map((test, tIdx) => (
                          <View key={tIdx} style={[styles.relatedTestTag, { backgroundColor: `${colors.primary}10`, borderColor: colors.primary }]}>
                            <ThemedText style={[styles.relatedTestText, { color: colors.primary }]}>{test}</ThemedText>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </Card>
              </Animated.View>
            ))
          )}

          <Pressable
            style={[styles.viewCDSButton, { borderColor: colors.primary }]}
            onPress={() => {
              setShowCDSAlerts(false);
              navigation.navigate("ClinicalDecisionSupport");
            }}
            testID="view-full-cds"
          >
            <Feather name="activity" size={18} color={colors.primary} />
            <ThemedText style={[styles.viewCDSButtonText, { color: colors.primary }]}>
              View Full Clinical Decision Support
            </ThemedText>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading lab results...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={results}
        renderItem={renderLabResultCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={
          <>
            {renderSummaryBanner()}
            {renderSortBar()}
            {renderCDSBanner()}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="clipboard" size={48} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Lab Results</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {filterStatus !== "all" || filterCategory !== "all"
                ? "No results match your current filters. Try adjusting them."
                : "Your lab results will appear here once they are available."}
            </ThemedText>
            {filterStatus !== "all" || filterCategory !== "all" ? (
              <Pressable
                style={[styles.resetButton, { backgroundColor: colors.primary }]}
                onPress={() => { setFilterStatus("all"); setFilterCategory("all"); }}
                testID="reset-filters"
              >
                <ThemedText style={styles.resetButtonText}>Reset Filters</ThemedText>
              </Pressable>
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      />

      {renderDetailModal()}
      {renderFilterModal()}
      {renderCDSModal()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  loadingText: { fontSize: 14 },
  listContent: { paddingHorizontal: Spacing.lg },
  summaryRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  summaryNumber: { fontSize: 24, fontWeight: "700" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  sortBar: { marginBottom: Spacing.md },
  sortScrollContent: { gap: Spacing.sm },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  sortButtonText: { fontSize: 13, fontWeight: "500" },
  cdsBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cdsBannerContent: { flexDirection: "row", alignItems: "center" },
  cdsBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cdsBannerText: { flex: 1, marginLeft: Spacing.sm },
  cdsBannerTitle: { fontSize: 15, fontWeight: "600" },
  cdsBannerSubtitle: { fontSize: 12, marginTop: 2 },
  resultCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  resultTitleRow: { flex: 1, flexDirection: "row", alignItems: "flex-start", marginRight: Spacing.sm },
  categoryBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  resultTitleInfo: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: "600" },
  resultMeta: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
  resultDate: { fontSize: 12 },
  resultCategory: { fontSize: 12 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  componentsPreview: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  componentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  componentName: { fontSize: 13, flex: 1 },
  componentValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  componentValue: { fontSize: 13, fontWeight: "500" },
  flagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  flagText: { fontSize: 10, fontWeight: "700" },
  moreComponents: { fontSize: 12, fontWeight: "500", marginTop: 4 },
  facilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  facilityText: { fontSize: 11 },
  followUpButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalBody: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  clearText: { fontSize: 15, fontWeight: "500" },
  detailSection: { marginBottom: Spacing.lg },
  detailTitle: { fontSize: 22, fontWeight: "700", marginBottom: Spacing.sm },
  detailMetaRow: { gap: Spacing.sm },
  detailMetaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailMetaText: { fontSize: 13 },
  abnormalSummaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  abnormalSummaryContent: { flexDirection: "row", alignItems: "flex-start" },
  abnormalSummaryTitle: { fontSize: 15, fontWeight: "600" },
  abnormalSummaryDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionHeader: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.md },
  componentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  componentDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  componentDetailName: { fontSize: 14, fontWeight: "500", flex: 1 },
  componentDetailValueContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  componentDetailValue: { fontSize: 15 },
  detailFlagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailFlagText: { fontSize: 11, fontWeight: "700" },
  referenceRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  referenceLabel: { fontSize: 12 },
  referenceValue: { fontSize: 12, fontWeight: "500" },
  rangeBarContainer: { marginTop: 8, paddingHorizontal: Spacing.sm },
  rangeBar: {
    height: 8,
    borderRadius: 4,
    position: "relative",
    overflow: "hidden",
  },
  rangeNormal: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  rangeMarker: {
    position: "absolute",
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  analyzeButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  filterSectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  filterOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: 4,
  },
  filterOptionText: { fontSize: 15, fontWeight: "500" },
  filterCategoryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  applyButton: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  applyButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cdsDisclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  cdsDisclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600" },
  emptySubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: Spacing.lg },
  resetButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  resetButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  cdsAlertCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  cdsAlertHeader: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  severityText: { fontSize: 10, fontWeight: "700" },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryTagText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  cdsAlertTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cdsAlertDesc: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  recommendationsSection: { marginTop: Spacing.sm },
  recommendationsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  recommendationRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  recommendationText: { flex: 1, fontSize: 13, lineHeight: 18 },
  relatedTestsSection: { marginTop: Spacing.sm },
  relatedTestsTitle: { fontSize: 12, fontWeight: "500", marginBottom: 6 },
  relatedTestsTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  relatedTestTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  relatedTestText: { fontSize: 12, fontWeight: "500" },
  viewCDSButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  viewCDSButtonText: { fontSize: 15, fontWeight: "600" },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: 4,
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  expandedComponents: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  expandedComponentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expandedComponentLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  expandedComponentRight: {
    alignItems: "flex-end",
  },
  referenceText: {
    fontSize: 11,
    marginTop: 2,
  },
  fullDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.sm,
  },
});
