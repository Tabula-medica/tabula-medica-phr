import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import * as Haptics from "expo-haptics";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

type SearchOperator = "eq" | "ne" | "gt" | "lt" | "ge" | "le" | "contains" | "exact" | "starts-with" | "missing";

interface SearchParameter {
  id: string;
  name: string;
  path: string;
  type: "string" | "token" | "date" | "number" | "reference" | "quantity" | "uri" | "composite";
  operator: SearchOperator;
  value: string;
  modifier?: string;
  dateRange?: { start?: string; end?: string };
  fuzzyEnabled?: boolean;
}

interface SearchParameterDefinition {
  name: string;
  path: string;
  type: "string" | "token" | "date" | "number" | "reference" | "quantity" | "uri" | "composite";
  description: string;
  supportsFuzzy: boolean;
  supportsRange: boolean;
  commonValues?: string[];
}

interface FHIRResourceDefinition {
  resourceType: string;
  displayName: string;
  description: string;
  commonSearchParams: SearchParameterDefinition[];
  relationships: { targetResource: string; searchParam: string; description: string }[];
}

interface AISearchSuggestion {
  suggestedParameters: SearchParameter[];
  queryDescription: string;
  reasoning: string;
  commonPatterns: string[];
  tips: string[];
}

interface QueryPattern {
  name: string;
  description: string;
  parameters: Partial<SearchParameter>[];
}

const OPERATOR_OPTIONS: { value: SearchOperator; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "eq", label: "Equals", icon: "check" },
  { value: "ne", label: "Not Equals", icon: "x" },
  { value: "gt", label: "Greater Than", icon: "chevron-right" },
  { value: "lt", label: "Less Than", icon: "chevron-left" },
  { value: "ge", label: "Greater or Equal", icon: "chevrons-right" },
  { value: "le", label: "Less or Equal", icon: "chevrons-left" },
  { value: "contains", label: "Contains", icon: "search" },
  { value: "exact", label: "Exact Match", icon: "target" },
  { value: "starts-with", label: "Starts With", icon: "corner-down-right" },
];

const RESOURCE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Patient: "user",
  Observation: "activity",
  Condition: "alert-circle",
  MedicationRequest: "package",
  Encounter: "calendar",
  AllergyIntolerance: "alert-triangle",
  Immunization: "shield",
  Procedure: "tool",
  DiagnosticReport: "file-text",
};

export default function AdvancedFHIRSearchScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const [selectedResourceType, setSelectedResourceType] = useState<string>("Patient");
  const [searchParameters, setSearchParameters] = useState<SearchParameter[]>([]);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [showParameterPicker, setShowParameterPicker] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [naturalQuery, setNaturalQuery] = useState("");
  const [userIntent, setUserIntent] = useState("");
  const { checkFeature, promptProps } = useFeatureGate();

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery<{
    resources: FHIRResourceDefinition[];
  }>({
    queryKey: ["/api/fhir-search/resources"],
  });

  const { data: resourceDef } = useQuery<FHIRResourceDefinition>({
    queryKey: ["/api/fhir-search/resources", selectedResourceType],
    enabled: !!selectedResourceType,
  });

  const { data: patternsData } = useQuery<{ patterns: QueryPattern[] }>({
    queryKey: ["/api/fhir-search/resources", selectedResourceType, "patterns"],
    enabled: !!selectedResourceType,
  });

  const aiSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-search/ai-suggestions", {
        resourceType: selectedResourceType,
        currentParameters: searchParameters,
        userIntent: userIntent || undefined,
      });
      return res.json() as Promise<AISearchSuggestion>;
    },
    onSuccess: () => {
      setShowAISuggestions(true);
    },
  });

  const buildQueryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-search/build-query", {
        parameters: searchParameters,
        combineWith: "AND",
      });
      return res.json() as Promise<{ queryParams: Record<string, string> }>;
    },
  });

  const parseNaturalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-search/parse-natural", {
        query: naturalQuery,
        resourceType: selectedResourceType,
      });
      return res.json() as Promise<{ parameters: SearchParameter[] }>;
    },
    onSuccess: (data) => {
      if (data.parameters.length > 0) {
        setSearchParameters((prev) => [...prev, ...data.parameters]);
        setNaturalQuery("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const addParameter = useCallback((paramDef: SearchParameterDefinition) => {
    const newParam: SearchParameter = {
      id: `param-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: paramDef.name,
      path: paramDef.path,
      type: paramDef.type,
      operator: paramDef.type === "string" && paramDef.supportsFuzzy ? "contains" : "eq",
      value: "",
      fuzzyEnabled: paramDef.supportsFuzzy,
    };
    setSearchParameters((prev) => [...prev, newParam]);
    setShowParameterPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateParameter = useCallback((id: string, updates: Partial<SearchParameter>) => {
    setSearchParameters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const removeParameter = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSearchParameters((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const applyPattern = useCallback((pattern: QueryPattern) => {
    const newParams: SearchParameter[] = pattern.parameters.map((p) => ({
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: p.name || "",
      path: p.path || "",
      type: p.type || "string",
      operator: p.operator || "eq",
      value: p.value || "",
      fuzzyEnabled: false,
    }));
    setSearchParameters(newParams);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const applySuggestions = useCallback((suggestions: SearchParameter[]) => {
    setSearchParameters((prev) => [...prev, ...suggestions]);
    setShowAISuggestions(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const renderParameterCard = (param: SearchParameter) => {
    const paramDef = resourceDef?.commonSearchParams.find((p) => p.name === param.name);
    const showDateRange = param.type === "date";
    const showFuzzyToggle = param.type === "string" && paramDef?.supportsFuzzy;

    return (
      <Card key={param.id} style={styles.parameterCard}>
        <View style={styles.parameterHeader}>
          <View style={styles.parameterInfo}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {param.name}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {paramDef?.description || param.type}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => removeParameter(param.id)}
            style={styles.removeButton}
          >
            <Feather name="x" size={18} color={theme.error} />
          </Pressable>
        </View>

        <View style={styles.parameterControls}>
          <View style={[styles.operatorSelector, { backgroundColor: `${theme.primary}10` }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {OPERATOR_OPTIONS.filter((op) => {
                if (param.type === "date" || param.type === "number" || param.type === "quantity") {
                  return ["eq", "ne", "gt", "lt", "ge", "le"].includes(op.value);
                }
                if (param.type === "string") {
                  return ["eq", "ne", "contains", "exact", "starts-with"].includes(op.value);
                }
                return ["eq", "ne"].includes(op.value);
              }).map((op) => (
                <Pressable
                  key={op.value}
                  onPress={() => updateParameter(param.id, { operator: op.value })}
                  style={[
                    styles.operatorButton,
                    param.operator === op.value && { backgroundColor: theme.primary },
                  ]}
                >
                  <Feather
                    name={op.icon}
                    size={14}
                    color={param.operator === op.value ? "#fff" : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: param.operator === op.value ? "#fff" : theme.text,
                      marginLeft: 4,
                    }}
                  >
                    {op.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {showDateRange ? (
            <View style={styles.dateRangeContainer}>
              <View style={styles.dateInputGroup}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  From
                </ThemedText>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                  value={param.dateRange?.start || ""}
                  onChangeText={(text) =>
                    updateParameter(param.id, {
                      dateRange: { ...param.dateRange, start: text },
                    })
                  }
                />
              </View>
              <View style={styles.dateInputGroup}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  To
                </ThemedText>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.textSecondary}
                  value={param.dateRange?.end || ""}
                  onChangeText={(text) =>
                    updateParameter(param.id, {
                      dateRange: { ...param.dateRange, end: text },
                    })
                  }
                />
              </View>
            </View>
          ) : (
            <TextInput
              style={[styles.valueInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
              placeholder={`Enter ${param.name} value...`}
              placeholderTextColor={theme.textSecondary}
              value={param.value}
              onChangeText={(text) => updateParameter(param.id, { value: text })}
            />
          )}

          {showFuzzyToggle ? (
            <View style={styles.fuzzyToggle}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Fuzzy Match
              </ThemedText>
              <Switch
                value={param.fuzzyEnabled}
                onValueChange={(val) => updateParameter(param.id, { fuzzyEnabled: val })}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={param.fuzzyEnabled ? theme.primary : theme.textSecondary}
              />
            </View>
          ) : null}

          {paramDef?.commonValues && paramDef.commonValues.length > 0 ? (
            <View style={styles.commonValuesContainer}>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>
                Common values:
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {paramDef.commonValues.map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => updateParameter(param.id, { value: val })}
                    style={[
                      styles.commonValueChip,
                      { backgroundColor: param.value === val ? theme.primary : `${theme.primary}15` },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: param.value === val ? "#fff" : theme.primary }}
                    >
                      {val}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  const renderResourcePicker = () => (
    <Modal
      visible={showResourcePicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowResourcePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Select Resource Type</ThemedText>
            <Pressable onPress={() => setShowResourcePicker(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalList}>
            {resourcesData?.resources.map((resource) => (
              <Pressable
                key={resource.resourceType}
                onPress={() => {
                  setSelectedResourceType(resource.resourceType);
                  setSearchParameters([]);
                  setShowResourcePicker(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.resourceOption,
                  selectedResourceType === resource.resourceType && { backgroundColor: `${theme.primary}15` },
                ]}
              >
                <View style={[styles.resourceIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather
                    name={RESOURCE_ICONS[resource.resourceType] || "file"}
                    size={20}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.resourceInfo}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {resource.displayName}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {resource.description}
                  </ThemedText>
                </View>
                {selectedResourceType === resource.resourceType ? (
                  <Feather name="check" size={20} color={theme.primary} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderParameterPicker = () => (
    <Modal
      visible={showParameterPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowParameterPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">Add Search Parameter</ThemedText>
            <Pressable onPress={() => setShowParameterPicker(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalList}>
            {resourceDef?.commonSearchParams.map((param) => {
              const alreadyAdded = searchParameters.some((p) => p.name === param.name);
              return (
                <Pressable
                  key={param.name}
                  onPress={() => !alreadyAdded && addParameter(param)}
                  style={[
                    styles.parameterOption,
                    alreadyAdded && { opacity: 0.5 },
                  ]}
                  disabled={alreadyAdded}
                >
                  <View style={styles.parameterOptionInfo}>
                    <View style={styles.parameterOptionHeader}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {param.name}
                      </ThemedText>
                      <View style={[styles.typeBadge, { backgroundColor: `${theme.primary}15` }]}>
                        <ThemedText type="small" style={{ color: theme.primary }}>
                          {param.type}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {param.description}
                    </ThemedText>
                    <View style={styles.parameterFeatures}>
                      {param.supportsFuzzy ? (
                        <View style={styles.featureBadge}>
                          <Feather name="search" size={10} color={theme.success} />
                          <ThemedText type="small" style={{ color: theme.success, marginLeft: 2 }}>
                            Fuzzy
                          </ThemedText>
                        </View>
                      ) : null}
                      {param.supportsRange ? (
                        <View style={styles.featureBadge}>
                          <Feather name="sliders" size={10} color={theme.link} />
                          <ThemedText type="small" style={{ color: theme.link, marginLeft: 2 }}>
                            Range
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {alreadyAdded ? (
                    <Feather name="check" size={18} color={theme.success} />
                  ) : (
                    <Feather name="plus" size={18} color={theme.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderAISuggestionsModal = () => (
    <Modal
      visible={showAISuggestions}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAISuggestions(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="h3">AI Search Suggestions</ThemedText>
            <Pressable onPress={() => setShowAISuggestions(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {aiSuggestionsMutation.isPending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Analyzing search patterns...
              </ThemedText>
            </View>
          ) : aiSuggestionsMutation.data ? (
            <ScrollView style={styles.modalList}>
              <Card style={StyleSheet.flatten([styles.aiCard, { backgroundColor: `${theme.primary}10` }])}>
                <Feather name="cpu" size={20} color={theme.primary} />
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {aiSuggestionsMutation.data.queryDescription}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                    {aiSuggestionsMutation.data.reasoning}
                  </ThemedText>
                </View>
              </Card>

              <ThemedText type="h4" style={styles.sectionTitle}>
                Suggested Parameters
              </ThemedText>
              {aiSuggestionsMutation.data.suggestedParameters.map((param, idx) => (
                <View key={idx} style={[styles.suggestionItem, { borderColor: theme.border }]}>
                  <View style={styles.suggestionInfo}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {param.name}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      {param.operator} "{param.value || "..."}"
                    </ThemedText>
                  </View>
                </View>
              ))}

              <Pressable
                onPress={() => applySuggestions(aiSuggestionsMutation.data!.suggestedParameters)}
                style={[styles.applyButton, { backgroundColor: theme.primary }]}
              >
                <Feather name="check" size={18} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Apply Suggestions
                </ThemedText>
              </Pressable>

              {aiSuggestionsMutation.data.tips.length > 0 ? (
                <>
                  <ThemedText type="h4" style={styles.sectionTitle}>
                    Search Tips
                  </ThemedText>
                  {aiSuggestionsMutation.data.tips.map((tip, idx) => (
                    <View key={idx} style={styles.tipItem}>
                      <Feather name="info" size={14} color={theme.link} />
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                        {tip}
                      </ThemedText>
                    </View>
                  ))}
                </>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );

  if (resourcesLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading FHIR resources...
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <UpgradePrompt {...promptProps} />
      <View style={styles.headerSection}>
        <ThemedText type="h2">Advanced FHIR Search</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Build complex queries with AI-powered suggestions
        </ThemedText>
      </View>

      <Card style={styles.resourceSelector}>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
          Resource Type
        </ThemedText>
        <Pressable
          onPress={() => setShowResourcePicker(true)}
          style={[styles.selectorButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
        >
          <View style={[styles.resourceIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather
              name={RESOURCE_ICONS[selectedResourceType] || "file"}
              size={20}
              color={theme.primary}
            />
          </View>
          <View style={styles.selectorInfo}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {resourceDef?.displayName || selectedResourceType}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {resourceDef?.description || "Select a resource type"}
            </ThemedText>
          </View>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </Card>

      <Card style={styles.naturalQueryCard}>
        <View style={styles.naturalQueryHeader}>
          <Feather name="message-circle" size={18} color={theme.primary} />
          <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
            Natural Language Search
          </ThemedText>
        </View>
        <TextInput
          style={[styles.naturalQueryInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
          placeholder='e.g., "name contains John" or "date from 2024-01-01"'
          placeholderTextColor={theme.textSecondary}
          value={naturalQuery}
          onChangeText={setNaturalQuery}
          multiline
        />
        <Pressable
          onPress={() => {
            if (!checkFeature("advanced_fhir_search")) return;
            parseNaturalMutation.mutate();
          }}
          disabled={!naturalQuery.trim() || parseNaturalMutation.isPending}
          style={[
            styles.parseButton,
            { backgroundColor: naturalQuery.trim() ? theme.primary : theme.border },
          ]}
        >
          {parseNaturalMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="zap" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", marginLeft: Spacing.xs }}>
                Parse Query
              </ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      {patternsData?.patterns && patternsData.patterns.length > 0 ? (
        <Card style={styles.patternsCard}>
          <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
            Quick Patterns
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {patternsData.patterns.map((pattern, idx) => (
              <Pressable
                key={idx}
                onPress={() => applyPattern(pattern)}
                style={[styles.patternChip, { backgroundColor: `${theme.primary}15` }]}
              >
                <Feather name="zap" size={12} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
                  {pattern.name}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      ) : null}

      <View style={styles.parametersSection}>
        <View style={styles.parametersSectionHeader}>
          <ThemedText type="h4">Search Parameters</ThemedText>
          <View style={styles.parameterActions}>
            <Pressable
              onPress={() => {
                if (!checkFeature("advanced_fhir_search")) return;
                setUserIntent("");
                aiSuggestionsMutation.mutate();
              }}
              style={[styles.aiSuggestButton, { backgroundColor: `${theme.primary}15` }]}
            >
              <Feather name="cpu" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
                AI Suggest
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowParameterPicker(true)}
              style={[styles.addParamButton, { backgroundColor: theme.primary }]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", marginLeft: 4 }}>
                Add
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {searchParameters.length === 0 ? (
          <Card style={styles.emptyState}>
            <Feather name="search" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
              No search parameters added
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
              Add parameters manually, use quick patterns, or get AI suggestions
            </ThemedText>
          </Card>
        ) : (
          searchParameters.map(renderParameterCard)
        )}
      </View>

      {searchParameters.length > 0 ? (
        <Card style={styles.queryPreview}>
          <View style={styles.queryPreviewHeader}>
            <Feather name="code" size={18} color={theme.primary} />
            <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm }}>
              Query Preview
            </ThemedText>
          </View>
          <Pressable
            onPress={() => {
              if (!checkFeature("advanced_fhir_search")) return;
              buildQueryMutation.mutate();
            }}
            disabled={buildQueryMutation.isPending}
            style={[styles.buildButton, { backgroundColor: theme.primary }]}
          >
            {buildQueryMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="play" size={18} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm, fontWeight: "600" }}>
                  Build Query
                </ThemedText>
              </>
            )}
          </Pressable>
          {buildQueryMutation.data ? (
            <View style={[styles.queryOutput, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontFamily: "monospace" }}>
                {`GET /${selectedResourceType}?${Object.entries(buildQueryMutation.data.queryParams)
                  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
                  .join("&")}`}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      ) : null}

      {resourceDef?.relationships && resourceDef.relationships.length > 0 ? (
        <Card style={styles.relationshipsCard}>
          <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
            Related Resources
          </ThemedText>
          {resourceDef.relationships.map((rel, idx) => (
            <View key={idx} style={styles.relationshipItem}>
              <View style={[styles.relationshipIcon, { backgroundColor: `${theme.link}15` }]}>
                <Feather name={RESOURCE_ICONS[rel.targetResource] || "link"} size={14} color={theme.link} />
              </View>
              <View style={styles.relationshipInfo}>
                <ThemedText type="small" style={{ fontWeight: "600" }}>
                  {rel.targetResource}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {rel.description}
                </ThemedText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {renderResourcePicker()}
      {renderParameterPicker()}
      {renderAISuggestionsModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerSection: { marginBottom: Spacing.xl },
  resourceSelector: { marginBottom: Spacing.lg, padding: Spacing.lg },
  selectorButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  resourceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  selectorInfo: { flex: 1 },
  naturalQueryCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  naturalQueryHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  naturalQueryInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: Spacing.sm,
  },
  parseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  patternsCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  patternChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  parametersSection: { marginBottom: Spacing.xl },
  parametersSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  parameterActions: { flexDirection: "row", gap: Spacing.sm },
  aiSuggestButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  addParamButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  emptyState: { padding: Spacing.xl, alignItems: "center" },
  parameterCard: { marginBottom: Spacing.md, padding: Spacing.lg },
  parameterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  parameterInfo: { flex: 1 },
  removeButton: { padding: Spacing.xs },
  parameterControls: { marginTop: Spacing.md },
  operatorSelector: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  operatorButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  valueInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dateRangeContainer: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  dateInputGroup: { flex: 1 },
  dateInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, marginTop: 4 },
  fuzzyToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  commonValuesContainer: { marginTop: Spacing.sm },
  commonValueChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
  },
  queryPreview: { marginBottom: Spacing.lg, padding: Spacing.lg },
  queryPreviewHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  buildButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  queryOutput: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  relationshipsCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  relationshipItem: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  relationshipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  relationshipInfo: { flex: 1, marginLeft: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "flex-end" },
  modalContent: {
    maxHeight: "80%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalList: { maxHeight: 400 },
  resourceOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  resourceInfo: { flex: 1 },
  parameterOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  parameterOptionInfo: { flex: 1 },
  parameterOptionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  parameterFeatures: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
  featureBadge: { flexDirection: "row", alignItems: "center" },
  aiCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.lg },
  sectionTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  suggestionItem: { padding: Spacing.md, borderBottomWidth: 1 },
  suggestionInfo: { flex: 1 },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  tipItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm },
});
