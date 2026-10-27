import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Switch,
  TextInput,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeIn, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface AutomationSuggestion {
  id: string;
  ruleId: string;
  ruleName: string;
  triggerType: string;
  triggerDescription: string;
  suggestedAction: string;
  documentType: string | null;
  prefillData: Record<string, any>;
  priority: "low" | "medium" | "high" | "urgent";
  patientId: string;
  recordId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  scenarioType?: string;
  autoCreateDraft?: boolean;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  priority: number;
  enabled: boolean;
}

interface PrefillResult {
  documentType: string;
  documentName: string;
  fields: PrefillField[];
  additionalContext: string;
  confidence: number;
  sourceRecords: string[];
  scenarioType?: string;
  draftReady?: boolean;
}

interface PrefillField {
  key: string;
  label: string;
  value: string;
  source: string;
  confidence: number;
  editable: boolean;
}

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  documentType: string;
  icon: string;
  color: string;
}

interface ScenarioTriggerResult {
  suggestions: AutomationSuggestion[];
  prefillResults: PrefillResult[];
  count: number;
  scenariosMatched: number;
  draftReadyCount: number;
}

type TabType = "suggestions" | "simulate" | "scenarios" | "settings";
type PriorityFilter = "all" | "urgent" | "high" | "medium" | "low";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const PRIORITY_FILTERS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const isExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt).getTime() < Date.now();
};

const TRIGGER_TYPES = [
  { type: "diagnosis_added", label: "New Diagnosis", icon: "plus-circle" as const, color: "#E53E3E" },
  { type: "status_changed", label: "Status Change", icon: "refresh-cw" as const, color: "#DD6B20" },
  { type: "lab_result_added", label: "Lab Result", icon: "droplet" as const, color: "#3182CE" },
  { type: "medication_changed", label: "Medication Change", icon: "package" as const, color: "#38A169" },
  { type: "vitals_recorded", label: "Vitals Recorded", icon: "activity" as const, color: "#805AD5" },
  { type: "visit_completed", label: "Visit Completed", icon: "calendar" as const, color: "#D69E2E" },
];

export default function AutomatedDataEntryScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { theme: colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>("suggestions");
  const [refreshing, setRefreshing] = useState(false);
  const [showPrefillModal, setShowPrefillModal] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutomationSuggestion | null>(null);
  const [prefillResult, setPrefillResult] = useState<PrefillResult | null>(null);
  const [simulateTrigger, setSimulateTrigger] = useState<string>("");
  const [simulateTitle, setSimulateTitle] = useState("");
  const [simulateStatus, setSimulateStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [hideExpired, setHideExpired] = useState(false);
  const [scenarioResult, setScenarioResult] = useState<ScenarioTriggerResult | null>(null);
  const [showScenarioResults, setShowScenarioResults] = useState(false);
  const [scenarioDiagnosis, setScenarioDiagnosis] = useState("");
  const [scenarioStatus, setScenarioStatus] = useState("");
  const [scenarioTriggerType, setScenarioTriggerType] = useState<string>("");
  const [editingFields, setEditingFields] = useState<Record<string, string>>({});

  const { data: suggestions = [], isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<AutomationSuggestion[]>({
    queryKey: ["/api/automation/suggestions"],
  });

  const { data: rules = [] } = useQuery<AutomationRule[]>({
    queryKey: ["/api/automation/rules"],
  });

  const { data: settings } = useQuery<{ enabled: boolean; mutedRules: string[] }>({
    queryKey: ["/api/automation/settings"],
  });

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ["/api/automation/stats"],
  });

  const { data: scenarios = [] } = useQuery<ScenarioTemplate[]>({
    queryKey: ["/api/automation/scenarios"],
  });

  const triggerMutation = useMutation({
    mutationFn: async (params: { type: string; data: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/automation/trigger", params);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automation/stats"] });
    },
  });

  const prefillMutation = useMutation({
    mutationFn: async (params: { documentType: string; triggerData: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/automation/prefill", params);
      return res.json();
    },
    onSuccess: (data: PrefillResult) => {
      setPrefillResult(data);
      setShowPrefillModal(true);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/automation/suggestions/${id}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automation/stats"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/automation/suggestions/${id}/dismiss`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/suggestions"] });
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (newSettings: { enabled?: boolean; mutedRules?: string[] }) => {
      const res = await apiRequest("PUT", "/api/automation/settings", newSettings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/settings"] });
    },
  });

  const scenarioTriggerMutation = useMutation({
    mutationFn: async (params: { type: string; data: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/automation/scenario-trigger", params);
      return res.json();
    },
    onSuccess: (data: ScenarioTriggerResult) => {
      setScenarioResult(data);
      setShowScenarioResults(true);
      setEditingFields({});
      queryClient.invalidateQueries({ queryKey: ["/api/automation/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/automation/stats"] });
    },
  });

  const filteredSuggestions = useMemo(() => {
    let result = [...suggestions];
    if (hideExpired) {
      result = result.filter(s => !isExpired(s.expiresAt));
    }
    if (priorityFilter !== "all") {
      result = result.filter(s => s.priority === priorityFilter);
    }
    result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));
    return result;
  }, [suggestions, priorityFilter, hideExpired]);

  const expiredCount = useMemo(() => suggestions.filter(s => isExpired(s.expiresAt)).length, [suggestions]);

  const allSelected = filteredSuggestions.length > 0 && filteredSuggestions.every(s => selectedIds.has(s.id));

  const toggleSelectAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSuggestions.map(s => s.id)));
    }
  }, [allSelected, filteredSuggestions]);

  const toggleSelect = useCallback((id: string) => {
    Haptics.selectionAsync();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBatchAccept = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    selectedIds.forEach(id => acceptMutation.mutate(id));
    setSelectedIds(new Set());
  }, [selectedIds, acceptMutation]);

  const handleBatchDismiss = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    selectedIds.forEach(id => dismissMutation.mutate(id));
    setSelectedIds(new Set());
  }, [selectedIds, dismissMutation]);

  const handleClearExpired = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHideExpired(true);
    setSelectedIds(prev => {
      const next = new Set(prev);
      suggestions.filter(s => isExpired(s.expiresAt)).forEach(s => next.delete(s.id));
      return next;
    });
  }, [suggestions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchSuggestions();
    setRefreshing(false);
  }, [refetchSuggestions]);

  const handleAcceptSuggestion = (suggestion: AutomationSuggestion) => {
    setSelectedSuggestion(suggestion);
    acceptMutation.mutate(suggestion.id);
    if (suggestion.documentType) {
      prefillMutation.mutate({
        documentType: suggestion.documentType,
        triggerData: suggestion.prefillData,
      });
    }
  };

  const handleSimulateTrigger = () => {
    if (!simulateTrigger) return;
    const data: Record<string, any> = { title: simulateTitle || "Test Record" };
    if (simulateTrigger === "status_changed") {
      data.newStatus = simulateStatus || "discharged";
    }
    triggerMutation.mutate({ type: simulateTrigger, data });
    setSimulateTitle("");
    setSimulateStatus("");
  };

  const handleScenarioTrigger = () => {
    if (!scenarioTriggerType) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const data: Record<string, any> = {};
    if (scenarioTriggerType === "diagnosis_added" || scenarioTriggerType === "diagnosis_updated") {
      data.title = scenarioDiagnosis || "General condition";
    }
    if (scenarioTriggerType === "status_changed") {
      data.newStatus = scenarioStatus || "discharged";
    }
    scenarioTriggerMutation.mutate({ type: scenarioTriggerType, data });
  };

  const handleFieldEdit = (key: string, value: string) => {
    setEditingFields(prev => ({ ...prev, [key]: value }));
  };

  const getScenarioIcon = (icon: string): keyof typeof Feather.glyphMap => {
    const validIcons: Record<string, keyof typeof Feather.glyphMap> = {
      send: "send",
      users: "users",
      "log-out": "log-out",
      "edit-3": "edit-3",
      "arrow-right-circle": "arrow-right-circle",
    };
    return validIcons[icon] || "file-text";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return colors.error;
      case "high": return "#DD6B20";
      case "medium": return colors.primary;
      default: return colors.textSecondary;
    }
  };

  const getPriorityIcon = (priority: string): keyof typeof Feather.glyphMap => {
    switch (priority) {
      case "urgent": return "alert-circle";
      case "high": return "alert-triangle";
      case "medium": return "info";
      default: return "minus-circle";
    }
  };

  const getTriggerIcon = (type: string): keyof typeof Feather.glyphMap => {
    const found = TRIGGER_TYPES.find(t => t.type === type);
    return found?.icon || "zap";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return colors.success;
    if (confidence >= 0.6) return "#DD6B20";
    return colors.error;
  };

  const renderTab = (tab: TabType, label: string, icon: keyof typeof Feather.glyphMap) => (
    <Pressable
      key={tab}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: activeTab === tab }}
      style={[styles.tab, { borderBottomColor: activeTab === tab ? colors.primary : "transparent" }]}
      onPress={() => setActiveTab(tab)}
      testID={`tab-${tab}`}
    >
      <Feather name={icon} size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} />
      <ThemedText style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderSuggestionCard = (suggestion: AutomationSuggestion, index: number) => {
    const expired = isExpired(suggestion.expiresAt);
    const selected = selectedIds.has(suggestion.id);

    return (
      <Animated.View key={suggestion.id} entering={FadeInDown.delay(index * 60).duration(300)}>
        <Card style={[styles.suggestionCard, expired ? { opacity: 0.5 } : undefined]}>
          <View style={styles.suggestionTopRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Select suggestion ${suggestion.ruleName}`}
              accessibilityState={{ checked: selected }}
              style={[
                styles.checkbox,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : "transparent",
                },
              ]}
              onPress={() => toggleSelect(suggestion.id)}
              testID={`select-${suggestion.id}`}
            >
              {selected ? <Feather name="check" size={12} color="#fff" /> : null}
            </Pressable>
            <View style={styles.suggestionHeaderBadges}>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(suggestion.priority) + "15" }]}>
                <Feather name={getPriorityIcon(suggestion.priority)} size={12} color={getPriorityColor(suggestion.priority)} />
                <ThemedText style={[styles.priorityText, { color: getPriorityColor(suggestion.priority) }]}>
                  {suggestion.priority.toUpperCase()}
                </ThemedText>
              </View>
              <View style={[styles.triggerBadge, { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name={getTriggerIcon(suggestion.triggerType)} size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.triggerBadgeText, { color: colors.textSecondary }]}>
                  {suggestion.triggerType.replace(/_/g, " ")}
                </ThemedText>
              </View>
              {expired ? (
                <View style={[styles.expiredBadge, { backgroundColor: colors.error + "15" }]}>
                  <Feather name="clock" size={10} color={colors.error} />
                  <ThemedText style={[styles.expiredBadgeText, { color: colors.error }]}>Expired</ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <ThemedText
            style={[
              styles.suggestionTitle,
              { color: colors.text },
              expired ? styles.expiredStrikethrough : undefined,
            ]}
          >
            {suggestion.ruleName}
          </ThemedText>
          <ThemedText style={[styles.suggestionTrigger, { color: colors.textSecondary }]}>
            {suggestion.triggerDescription}
          </ThemedText>
          <ThemedText style={[styles.suggestionAction, { color: colors.text }]} numberOfLines={3}>
            {suggestion.suggestedAction}
          </ThemedText>

          {suggestion.documentType ? (
            <View style={[styles.docTypeBadge, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <Feather name="file-text" size={14} color={colors.primary} />
              <ThemedText style={[styles.docTypeText, { color: colors.primary }]}>
                {suggestion.documentType.replace(/_/g, " ")}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.suggestionActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={suggestion.documentType ? "Create document" : "Accept suggestion"}
              accessibilityState={{ disabled: acceptMutation.isPending || prefillMutation.isPending || expired }}
              style={[styles.acceptButton, { backgroundColor: colors.success + "15" }]}
              onPress={() => handleAcceptSuggestion(suggestion)}
              disabled={acceptMutation.isPending || prefillMutation.isPending || expired}
              testID={`accept-${suggestion.id}`}
            >
              {(acceptMutation.isPending && selectedSuggestion?.id === suggestion.id) ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <>
                  <Feather name="check" size={14} color={expired ? colors.textSecondary : colors.success} />
                  <ThemedText style={[styles.actionBtnText, { color: expired ? colors.textSecondary : colors.success }]}>
                    {suggestion.documentType ? "Create Document" : "Accept"}
                  </ThemedText>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss suggestion"
              accessibilityState={{ disabled: dismissMutation.isPending }}
              style={[styles.dismissButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => dismissMutation.mutate(suggestion.id)}
              disabled={dismissMutation.isPending}
              testID={`dismiss-${suggestion.id}`}
            >
              <Feather name="x" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.actionBtnText, { color: colors.textSecondary }]}>Dismiss</ThemedText>
            </Pressable>
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderSuggestionsTab = () => (
    <View>
      {stats ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.primary + "10" }]}>
              <ThemedText style={[styles.statNumber, { color: colors.primary }]}>{stats.suggestionsGenerated || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Generated</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.success + "10" }]}>
              <ThemedText style={[styles.statNumber, { color: colors.success }]}>{stats.suggestionsAccepted || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Accepted</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#DD6B20" + "10" }]}>
              <ThemedText style={[styles.statNumber, { color: "#DD6B20" }]}>{stats.documentsPrefilled || 0}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Pre-filled</ThemedText>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {suggestions.length > 0 ? (
        <Animated.View entering={FadeIn.duration(200)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterRowContent}
          >
            {PRIORITY_FILTERS.map(f => (
              <Pressable
                key={f.value}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${f.label} priority`}
                accessibilityState={{ selected: priorityFilter === f.value }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: priorityFilter === f.value ? colors.primary + "15" : colors.backgroundSecondary,
                    borderColor: priorityFilter === f.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setPriorityFilter(f.value)}
                testID={`filter-${f.value}`}
              >
                <ThemedText
                  style={[
                    styles.filterChipText,
                    { color: priorityFilter === f.value ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {f.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.toolbarRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={allSelected ? "Deselect all suggestions" : "Select all suggestions"}
              accessibilityState={{ checked: allSelected }}
              style={styles.selectAllBtn}
              onPress={toggleSelectAll}
              testID="button-select-all"
            >
              <Feather
                name={allSelected ? "check-square" : "square"}
                size={16}
                color={colors.primary}
              />
              <ThemedText style={[styles.selectAllText, { color: colors.primary }]}>
                {allSelected ? "Deselect All" : "Select All"}
              </ThemedText>
            </Pressable>
            {expiredCount > 0 && !hideExpired ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Clear ${expiredCount} expired suggestions`}
                style={[styles.clearExpiredBtn, { backgroundColor: colors.error + "10" }]}
                onPress={handleClearExpired}
                testID="button-clear-expired"
              >
                <Feather name="trash-2" size={13} color={colors.error} />
                <ThemedText style={[styles.clearExpiredText, { color: colors.error }]}>
                  Clear Expired ({expiredCount})
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {suggestionsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : filteredSuggestions.length > 0 ? (
        filteredSuggestions.map((s, i) => renderSuggestionCard(s, i))
      ) : suggestions.length > 0 ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={styles.emptyCard}>
            <Feather name="filter" size={36} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No matching suggestions</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Try adjusting the priority filter or clearing expired items to see results.
            </ThemedText>
          </Card>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconComposition}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + "10" }]}>
                <Feather name="cpu" size={28} color={colors.primary} />
              </View>
              <View style={[styles.emptyIconOverlap, { backgroundColor: colors.success + "15", borderColor: colors.backgroundDefault }]}>
                <Feather name="file-plus" size={16} color={colors.success} />
              </View>
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No suggestions yet</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Simulate a clinical event to generate AI-powered document suggestions based on your health data.
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Simulate a trigger"
              style={[styles.emptyCta, { backgroundColor: colors.primary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab("simulate");
              }}
              testID="button-go-simulate"
            >
              <Feather name="play-circle" size={16} color="#fff" />
              <ThemedText style={styles.emptyCtaText}>Simulate a Trigger</ThemedText>
            </Pressable>
          </Card>
        </Animated.View>
      )}
    </View>
  );

  const renderSimulateTab = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.simulateCard}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Test Automation Triggers</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Simulate clinical events to see what document suggestions would be generated.
          </ThemedText>

          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Event Type</ThemedText>
          <View style={styles.triggerGrid}>
            {TRIGGER_TYPES.map(t => (
              <Pressable
                key={t.type}
                accessibilityRole="radio"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: simulateTrigger === t.type }}
                style={[
                  styles.triggerOption,
                  {
                    backgroundColor: simulateTrigger === t.type ? t.color + "15" : colors.backgroundSecondary,
                    borderColor: simulateTrigger === t.type ? t.color : colors.border,
                  },
                ]}
                onPress={() => setSimulateTrigger(t.type)}
                testID={`trigger-${t.type}`}
              >
                <Feather name={t.icon} size={16} color={simulateTrigger === t.type ? t.color : colors.textSecondary} />
                <ThemedText
                  style={[styles.triggerOptionText, { color: simulateTrigger === t.type ? t.color : colors.textSecondary }]}
                >
                  {t.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {simulateTrigger === "status_changed" ? "New Status" : "Record Title"}
          </ThemedText>
          {simulateTrigger === "status_changed" ? (
            <View style={styles.statusOptions}>
              {["discharged", "transferred", "referred"].map(s => (
                <Pressable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityLabel={s.charAt(0).toUpperCase() + s.slice(1)}
                  accessibilityState={{ selected: simulateStatus === s }}
                  style={[
                    styles.statusOption,
                    {
                      backgroundColor: simulateStatus === s ? colors.primary + "15" : colors.backgroundSecondary,
                      borderColor: simulateStatus === s ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSimulateStatus(s)}
                  testID={`status-${s}`}
                >
                  <ThemedText style={[styles.statusOptionText, { color: simulateStatus === s ? colors.primary : colors.text }]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : (
            <TextInput
              accessibilityLabel="Record title"
              style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., Type 2 Diabetes, Hypertension"
              placeholderTextColor={colors.textSecondary}
              value={simulateTitle}
              onChangeText={setSimulateTitle}
              testID="input-simulate-title"
            />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Run simulation"
            accessibilityState={{ disabled: !simulateTrigger || triggerMutation.isPending }}
            style={[
              styles.simulateButton,
              { backgroundColor: simulateTrigger ? colors.primary : colors.border },
            ]}
            onPress={handleSimulateTrigger}
            disabled={!simulateTrigger || triggerMutation.isPending}
            testID="button-simulate"
          >
            {triggerMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="zap" size={16} color="#fff" />
                <ThemedText style={styles.simulateButtonText}>Run Simulation</ThemedText>
              </>
            )}
          </Pressable>

          {triggerMutation.isSuccess ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <View style={[styles.resultBanner, { backgroundColor: colors.success + "10", borderColor: colors.success + "30" }]}>
                <Feather name="check-circle" size={16} color={colors.success} />
                <ThemedText style={[styles.resultText, { color: colors.success }]}>
                  {(triggerMutation.data as any)?.count || 0} suggestion(s) generated. Check the Suggestions tab.
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <Card style={styles.simulateCard}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>How It Works</ThemedText>
          <View style={styles.howItWorksList}>
            {[
              { icon: "edit-3" as const, text: "Add or update a health record (diagnosis, medication, lab, vital, or visit)" },
              { icon: "cpu" as const, text: "The automation engine evaluates matching rules against your clinical data" },
              { icon: "file-plus" as const, text: "Relevant document suggestions appear with AI pre-filled fields" },
              { icon: "check-square" as const, text: "Accept a suggestion to create the document with data already populated" },
            ].map((item, i) => (
              <View key={i} style={styles.howItWorksItem}>
                <View style={[styles.stepBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name={item.icon} size={16} color={colors.primary} />
                </View>
                <ThemedText style={[styles.howItWorksText, { color: colors.text }]}>{item.text}</ThemedText>
              </View>
            ))}
          </View>
        </Card>
      </Animated.View>
    </View>
  );

  const renderScenariosTab = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.simulateCard}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Clinical Scenarios</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Trigger scenario-based automation to pre-fill clinical documents with AI-powered field values and confidence scoring.
          </ThemedText>

          <View style={styles.scenarioCardsGrid}>
            {scenarios.map((scenario, idx) => (
              <Animated.View key={scenario.id} entering={FadeInDown.delay(idx * 50).duration(250)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${scenario.name}: ${scenario.description}`}
                  accessibilityState={{ selected: scenarioTriggerType === scenario.triggerType }}
                  style={[
                    styles.scenarioCard,
                    {
                      backgroundColor: scenarioTriggerType === scenario.triggerType && scenario.id.includes(scenarioTriggerType.includes("status") ? "discharge" : "referral")
                        ? (scenario.color || colors.primary) + "15"
                        : colors.backgroundSecondary,
                      borderColor: scenarioTriggerType === scenario.triggerType
                        ? (scenario.color || colors.primary) + "50"
                        : colors.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setScenarioTriggerType(scenario.triggerType);
                  }}
                  testID={`scenario-${scenario.id}`}
                >
                  <View style={[styles.scenarioIconBg, { backgroundColor: (scenario.color || colors.primary) + "15" }]}>
                    <Feather name={getScenarioIcon(scenario.icon)} size={18} color={scenario.color || colors.primary} />
                  </View>
                  <ThemedText style={[styles.scenarioCardTitle, { color: colors.text }]} numberOfLines={1}>
                    {scenario.name}
                  </ThemedText>
                  <ThemedText style={[styles.scenarioCardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {scenario.description}
                  </ThemedText>
                  <View style={[styles.scenarioDocBadge, { backgroundColor: (scenario.color || colors.primary) + "10" }]}>
                    <Feather name="file-text" size={10} color={scenario.color || colors.primary} />
                    <ThemedText style={[styles.scenarioDocBadgeText, { color: scenario.color || colors.primary }]}>
                      {scenario.documentType.replace(/_/g, " ")}
                    </ThemedText>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {scenarioTriggerType ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <View style={[styles.scenarioInputSection, { borderTopColor: colors.border }]}>
                {scenarioTriggerType === "status_changed" ? (
                  <>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>New Patient Status</ThemedText>
                    <View style={styles.statusOptions}>
                      {["discharged", "transferred", "referred"].map(s => (
                        <Pressable
                          key={s}
                          accessibilityRole="radio"
                          accessibilityLabel={s.charAt(0).toUpperCase() + s.slice(1)}
                          accessibilityState={{ selected: scenarioStatus === s }}
                          style={[
                            styles.statusOption,
                            {
                              backgroundColor: scenarioStatus === s ? colors.primary + "15" : colors.backgroundSecondary,
                              borderColor: scenarioStatus === s ? colors.primary : colors.border,
                            },
                          ]}
                          onPress={() => setScenarioStatus(s)}
                          testID={`scenario-status-${s}`}
                        >
                          <ThemedText style={[styles.statusOptionText, { color: scenarioStatus === s ? colors.primary : colors.text }]}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>Diagnosis / Condition</ThemedText>
                    <TextInput
                      accessibilityLabel="Diagnosis or condition"
                      style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g., Type 2 Diabetes, Hypertension, COPD"
                      placeholderTextColor={colors.textSecondary}
                      value={scenarioDiagnosis}
                      onChangeText={setScenarioDiagnosis}
                      testID="input-scenario-diagnosis"
                    />
                  </>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Generate pre-filled document"
                  accessibilityState={{ disabled: scenarioTriggerMutation.isPending }}
                  style={[
                    styles.simulateButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleScenarioTrigger}
                  disabled={scenarioTriggerMutation.isPending}
                  testID="button-scenario-trigger"
                >
                  {scenarioTriggerMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="cpu" size={16} color="#fff" />
                      <ThemedText style={styles.simulateButtonText}>Generate Pre-filled Document</ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          ) : null}
        </Card>
      </Animated.View>

      {showScenarioResults && scenarioResult ? (
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={[styles.scenarioResultBanner, { backgroundColor: colors.success + "10", borderColor: colors.success + "30" }]}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <View style={styles.scenarioResultBannerInfo}>
              <ThemedText style={[styles.scenarioResultBannerTitle, { color: colors.success }]}>
                {scenarioResult.count} document(s) generated
              </ThemedText>
              <ThemedText style={[styles.scenarioResultBannerSub, { color: colors.textSecondary }]}>
                {scenarioResult.draftReadyCount} draft-ready with high confidence
              </ThemedText>
            </View>
          </View>

          {scenarioResult.prefillResults.map((result, idx) => (
            <Animated.View key={idx} entering={FadeInDown.delay(150 + idx * 80).duration(300)}>
              <Card style={styles.scenarioResultCard}>
                <View style={styles.scenarioResultHeader}>
                  <View style={styles.scenarioResultHeaderLeft}>
                    <Feather name="file-text" size={18} color={colors.primary} />
                    <View>
                      <ThemedText style={[styles.scenarioResultDocName, { color: colors.text }]}>
                        {result.documentName}
                      </ThemedText>
                      <View style={styles.scenarioConfRow}>
                        <View style={[
                          styles.confidenceDot,
                          { backgroundColor: getConfidenceColor(result.confidence) },
                        ]} />
                        <ThemedText style={[styles.scenarioConfText, { color: colors.textSecondary }]}>
                          {Math.round(result.confidence * 100)}% overall confidence
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  {result.draftReady ? (
                    <View style={[styles.draftReadyBadge, { backgroundColor: colors.success + "15" }]}>
                      <Feather name="check" size={12} color={colors.success} />
                      <ThemedText style={[styles.draftReadyText, { color: colors.success }]}>Draft Ready</ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={styles.scenarioFieldsList}>
                  {result.fields.map((field, fi) => (
                    <View key={fi} style={[styles.scenarioField, { borderBottomColor: colors.border }]}>
                      <View style={styles.scenarioFieldHeader}>
                        <ThemedText style={[styles.scenarioFieldLabel, { color: colors.textSecondary }]}>
                          {field.label}
                        </ThemedText>
                        <View style={styles.scenarioFieldMeta}>
                          <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(field.confidence) }]} />
                          <ThemedText style={[styles.scenarioFieldSource, { color: colors.textSecondary }]}>
                            {field.source} ({Math.round(field.confidence * 100)}%)
                          </ThemedText>
                        </View>
                      </View>
                      {field.editable ? (
                        <TextInput
                          accessibilityLabel={field.label}
                          style={[
                            styles.scenarioFieldInput,
                            {
                              backgroundColor: colors.backgroundDefault,
                              color: colors.text,
                              borderColor: colors.border,
                            },
                          ]}
                          value={editingFields[field.key] !== undefined ? editingFields[field.key] : field.value}
                          onChangeText={(text) => handleFieldEdit(field.key, text)}
                          multiline
                          testID={`field-${field.key}`}
                        />
                      ) : (
                        <ThemedText style={[styles.scenarioFieldValue, { color: colors.text }]}>
                          {field.value || "Not available"}
                        </ThemedText>
                      )}
                    </View>
                  ))}
                </View>

                {result.additionalContext ? (
                  <View style={[styles.contextBox, { backgroundColor: colors.backgroundDefault }]}>
                    <ThemedText style={[styles.contextLabel, { color: colors.textSecondary }]}>
                      Clinical Context
                    </ThemedText>
                    <ThemedText style={[styles.contextValue, { color: colors.text }]}>
                      {result.additionalContext}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.scenarioResultActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Create document for ${result.documentName}`}
                    style={[styles.generateButton, { backgroundColor: colors.primary, flex: 1 }]}
                    onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      const mergedFields = result.fields.map(f => ({
                        ...f,
                        value: editingFields[f.key] !== undefined ? editingFields[f.key] : f.value,
                      }));
                      navigation.navigate("DocumentGeneration", {
                        prefillType: result.documentType,
                        prefillData: { ...result, fields: mergedFields },
                      });
                    }}
                    testID={`button-create-doc-${idx}`}
                  >
                    <Feather name="file-plus" size={16} color="#fff" />
                    <ThemedText style={styles.generateButtonText}>Create Document</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Review ${result.documentName} details`}
                    style={[styles.scenarioReviewBtn, { backgroundColor: colors.backgroundSecondary }]}
                    onPress={() => {
                      setPrefillResult(result);
                      setShowPrefillModal(true);
                    }}
                    testID={`button-review-${idx}`}
                  >
                    <Feather name="eye" size={16} color={colors.primary} />
                  </Pressable>
                </View>

                <ThemedText style={[styles.disclaimer, { color: colors.textSecondary }]}>
                  Pre-filled data is AI-generated from your health records. Review all fields before finalizing. This is not medical advice.
                </ThemedText>
              </Card>
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );

  const renderSettingsTab = () => (
    <View>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={[styles.settingTitle, { color: colors.text }]}>Enable Automation</ThemedText>
              <ThemedText style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Automatically suggest documents when clinical data changes
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel="Enable automation"
              accessibilityState={{ checked: settings?.enabled !== false }}
              value={settings?.enabled !== false}
              onValueChange={(value) => settingsMutation.mutate({ enabled: value })}
              trackColor={{ false: colors.border, true: colors.primary + "60" }}
              thumbColor={settings?.enabled !== false ? colors.primary : colors.textSecondary}
              testID="switch-automation-enabled"
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <ThemedText style={[styles.rulesHeader, { color: colors.text }]}>Automation Rules</ThemedText>
        <ThemedText style={[styles.rulesSubheader, { color: colors.textSecondary }]}>
          These rules determine when document suggestions are triggered
        </ThemedText>
        {rules.map((rule, index) => (
          <Animated.View key={rule.id} entering={FadeInDown.delay(150 + index * 40).duration(300)}>
            <Card style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <View style={styles.ruleInfo}>
                  <Feather name={getTriggerIcon(rule.triggerType)} size={16} color={colors.primary} />
                  <ThemedText style={[styles.ruleName, { color: colors.text }]}>{rule.name}</ThemedText>
                </View>
                <Switch
                  accessibilityLabel={`Toggle rule: ${rule.name}`}
                  value={!(settings?.mutedRules || []).includes(rule.id)}
                  onValueChange={(value) => {
                    const current = settings?.mutedRules || [];
                    const updated = value
                      ? current.filter(id => id !== rule.id)
                      : [...current, rule.id];
                    settingsMutation.mutate({ mutedRules: updated });
                  }}
                  trackColor={{ false: colors.border, true: colors.primary + "60" }}
                  thumbColor={!(settings?.mutedRules || []).includes(rule.id) ? colors.primary : colors.textSecondary}
                />
              </View>
              <ThemedText style={[styles.ruleDesc, { color: colors.textSecondary }]}>{rule.description}</ThemedText>
              <View style={[styles.ruleMeta, { borderTopColor: colors.border }]}>
                <ThemedText style={[styles.ruleMetaText, { color: colors.textSecondary }]}>
                  Trigger: {rule.triggerType.replace(/_/g, " ")}
                </ThemedText>
                <ThemedText style={[styles.ruleMetaText, { color: colors.textSecondary }]}>
                  Priority: {rule.priority}
                </ThemedText>
              </View>
            </Card>
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );

  const renderPrefillModal = () => (
    <Modal visible={showPrefillModal} animationType="slide" transparent testID="modal-prefill">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              Pre-filled Document
            </ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Close prefill modal" onPress={() => { setShowPrefillModal(false); setPrefillResult(null); }} testID="button-close-prefill">
              <Feather name="x" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {prefillMutation.isPending ? (
            <View style={styles.prefillLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText style={[styles.prefillLoadingText, { color: colors.textSecondary }]}>
                Analyzing patient data and pre-filling fields...
              </ThemedText>
            </View>
          ) : prefillResult ? (
            <ScrollView style={styles.prefillScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.prefillDocHeader, { backgroundColor: colors.primary + "10" }]}>
                <Feather name="file-text" size={20} color={colors.primary} />
                <View style={styles.prefillDocInfo}>
                  <ThemedText style={[styles.prefillDocName, { color: colors.primary }]}>
                    {prefillResult.documentName}
                  </ThemedText>
                  <View style={styles.prefillConfRow}>
                    <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(prefillResult.confidence) }]} />
                    <ThemedText style={[styles.prefillConfText, { color: colors.textSecondary }]}>
                      {Math.round(prefillResult.confidence * 100)}% confidence
                    </ThemedText>
                  </View>
                </View>
              </View>

              {prefillResult.fields.map((field, i) => (
                <View key={i} style={[styles.prefillField, { borderBottomColor: colors.border }]}>
                  <View style={styles.prefillFieldHeader}>
                    <ThemedText style={[styles.prefillFieldLabel, { color: colors.textSecondary }]}>
                      {field.label}
                    </ThemedText>
                    <View style={styles.prefillFieldMeta}>
                      <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(field.confidence) }]} />
                      <ThemedText style={[styles.prefillSourceText, { color: colors.textSecondary }]}>
                        {field.source}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.prefillFieldValue, { color: colors.text }]}>
                    {field.value || "Not available"}
                  </ThemedText>
                </View>
              ))}

              {prefillResult.additionalContext ? (
                <View style={[styles.contextBox, { backgroundColor: colors.backgroundSecondary }]}>
                  <ThemedText style={[styles.contextLabel, { color: colors.textSecondary }]}>
                    Additional Context
                  </ThemedText>
                  <ThemedText style={[styles.contextValue, { color: colors.text }]}>
                    {prefillResult.additionalContext}
                  </ThemedText>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate document from prefilled data"
                style={[styles.generateButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowPrefillModal(false);
                  navigation.navigate("DocumentGeneration", {
                    prefillType: prefillResult.documentType,
                    prefillData: prefillResult,
                  });
                }}
                testID="button-generate-from-prefill"
              >
                <Feather name="file-plus" size={18} color="#fff" />
                <ThemedText style={styles.generateButtonText}>Generate Document</ThemedText>
              </Pressable>

              <ThemedText style={[styles.disclaimer, { color: colors.textSecondary }]}>
                Pre-filled data is AI-generated from your health records. Review all fields before finalizing the document. This is not medical advice.
              </ThemedText>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: colors.text }]}>Automated Data Entry</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              AI-powered document suggestions based on your clinical data changes
            </ThemedText>
          </View>

          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {renderTab("suggestions", "Suggestions", "bell")}
            {renderTab("scenarios", "Scenarios", "layers")}
            {renderTab("simulate", "Simulate", "play-circle")}
            {renderTab("settings", "Settings", "settings")}
          </View>
        </Animated.View>

        {activeTab === "suggestions" ? renderSuggestionsTab() : null}
        {activeTab === "scenarios" ? renderScenariosTab() : null}
        {activeTab === "simulate" ? renderSimulateTab() : null}
        {activeTab === "settings" ? renderSettingsTab() : null}
      </ScrollView>

      {renderPrefillModal()}

      {selectedIds.size > 0 ? (
        <Animated.View
          entering={FadeInUp.duration(250)}
          style={[
            styles.floatingBar,
            {
              backgroundColor: colors.backgroundDefault,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + Spacing.sm,
            },
          ]}
        >
          <ThemedText style={[styles.floatingBarCount, { color: colors.textSecondary }]}>
            {selectedIds.size} selected
          </ThemedText>
          <View style={styles.floatingBarActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Accept all ${selectedIds.size} selected suggestions`}
              style={[styles.floatingBarBtn, { backgroundColor: colors.success + "15" }]}
              onPress={handleBatchAccept}
              testID="button-batch-accept"
            >
              <Feather name="check-circle" size={16} color={colors.success} />
              <ThemedText style={[styles.floatingBarBtnText, { color: colors.success }]}>Accept All</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Dismiss all ${selectedIds.size} selected suggestions`}
              style={[styles.floatingBarBtn, { backgroundColor: colors.error + "10" }]}
              onPress={handleBatchDismiss}
              testID="button-batch-dismiss"
            >
              <Feather name="x-circle" size={16} color={colors.error} />
              <ThemedText style={[styles.floatingBarBtnText, { color: colors.error }]}>Dismiss All</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl * 3,
  },
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    gap: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  loader: {
    marginTop: Spacing.xl * 2,
  },
  filterRow: {
    marginBottom: Spacing.sm,
  },
  filterRowContent: {
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  clearExpiredBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    gap: 5,
  },
  clearExpiredText: {
    fontSize: 12,
    fontWeight: "600",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  suggestionHeaderBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    flex: 1,
  },
  expiredBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 3,
  },
  expiredBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  expiredStrikethrough: {
    textDecorationLine: "line-through",
    textDecorationStyle: "solid",
  },
  emptyIconComposition: {
    width: 72,
    height: 72,
    marginBottom: Spacing.sm,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconOverlap: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: 8,
  },
  emptyCtaText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  floatingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  floatingBarCount: {
    fontSize: 13,
    fontWeight: "600",
  },
  floatingBarActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  floatingBarBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  floatingBarBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  suggestionCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  suggestionHeader: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "700",
  },
  triggerBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  triggerBadgeText: {
    fontSize: 10,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  suggestionTrigger: {
    fontSize: 12,
    marginBottom: 6,
  },
  suggestionAction: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  docTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 6,
    marginBottom: Spacing.sm,
  },
  docTypeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  suggestionActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  dismissButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  simulateCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  triggerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  triggerOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  triggerOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  statusOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  simulateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  simulateButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
    gap: 8,
  },
  resultText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  howItWorksList: {
    gap: Spacing.md,
  },
  howItWorksItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  howItWorksText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  settingsCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  rulesHeader: {
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 2,
    marginTop: Spacing.sm,
  },
  rulesSubheader: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  ruleCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  ruleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  ruleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: Spacing.sm,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  ruleDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  ruleMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  ruleMetaText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  prefillLoading: {
    alignItems: "center",
    padding: Spacing.xl * 2,
  },
  prefillLoadingText: {
    fontSize: 14,
    marginTop: Spacing.md,
  },
  prefillScroll: {
    paddingHorizontal: Spacing.md,
  },
  prefillDocHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  prefillDocInfo: {
    flex: 1,
  },
  prefillDocName: {
    fontSize: 16,
    fontWeight: "600",
  },
  prefillConfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  prefillConfText: {
    fontSize: 12,
  },
  prefillField: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  prefillFieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  prefillFieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  prefillFieldMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  prefillSourceText: {
    fontSize: 10,
  },
  prefillFieldValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  contextBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    gap: 8,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: 11,
    textAlign: "center",
    marginTop: Spacing.md,
    fontStyle: "italic",
    lineHeight: 16,
  },
  scenarioCardsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  scenarioCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  scenarioIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  scenarioCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  scenarioCardDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  scenarioDocBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  scenarioDocBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  scenarioInputSection: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
  },
  scenarioResultBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  scenarioResultBannerInfo: {
    flex: 1,
  },
  scenarioResultBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  scenarioResultBannerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  scenarioResultCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  scenarioResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  scenarioResultHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  scenarioResultDocName: {
    fontSize: 16,
    fontWeight: "600",
  },
  scenarioConfRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  scenarioConfText: {
    fontSize: 11,
  },
  draftReadyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  draftReadyText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scenarioFieldsList: {
    marginBottom: Spacing.sm,
  },
  scenarioField: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scenarioFieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  scenarioFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  scenarioFieldMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scenarioFieldSource: {
    fontSize: 9,
  },
  scenarioFieldValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  scenarioFieldInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 36,
  },
  scenarioResultActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  scenarioReviewBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
