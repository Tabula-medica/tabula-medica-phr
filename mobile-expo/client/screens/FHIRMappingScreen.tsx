import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingState } from "@/components/ui";
import { BaseModal } from "@/components/ui";
import { FormInput } from "@/components/ui";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;
type FHIRMappingRouteParams = { sourceId?: string };
type RouteProps = RouteProp<{ FHIRMapping: FHIRMappingRouteParams }, "FHIRMapping">;

interface FieldMapping {
  fhirPath: string;
  internalField: string;
  required: boolean;
  transform?: {
    type: string;
    config?: any;
  };
  defaultValue?: any;
}

interface MappingRule {
  id: string;
  name: string;
  description: string | null;
  fhirResourceType: string;
  internalRecordType: string;
  priority: number;
  isActive: boolean;
  isDefault: boolean;
  fieldMappings: FieldMapping[];
  conditions: any[] | null;
  validationRules: any[] | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MappingTemplate {
  id: string;
  name: string;
  fhirResourceType: string;
  internalRecordType: string;
  description: string;
  fieldMappings: FieldMapping[];
  conditions?: any[];
}

const FHIR_RESOURCE_TYPES = [
  "Observation",
  "Condition",
  "MedicationRequest",
  "MedicationStatement",
  "Immunization",
  "Procedure",
  "AllergyIntolerance",
  "Encounter",
  "DiagnosticReport",
];

const INTERNAL_RECORD_TYPES = [
  { value: "lab", label: "Lab Result" },
  { value: "vital", label: "Vital Sign" },
  { value: "medication", label: "Medication" },
  { value: "condition", label: "Condition" },
  { value: "immunization", label: "Immunization" },
  { value: "procedure", label: "Procedure" },
  { value: "allergy", label: "Allergy" },
  { value: "visit", label: "Visit" },
  { value: "imaging", label: "Imaging" },
];

const TRANSFORM_TYPES = [
  { value: "date", label: "Format as Date" },
  { value: "number", label: "Convert to Number" },
  { value: "lowercase", label: "To Lowercase" },
  { value: "uppercase", label: "To Uppercase" },
  { value: "trim", label: "Trim Whitespace" },
  { value: "first", label: "Get First Element" },
  { value: "join", label: "Join Array" },
];

function StatusBadge({ active, theme }: { active: boolean; theme: any }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: active ? theme.success + "20" : theme.textSecondary + "20" },
      ]}
    >
      <ThemedText
        type="small"
        style={{ color: active ? theme.success : theme.textSecondary, fontWeight: "600" }}
      >
        {active ? "Active" : "Inactive"}
      </ThemedText>
    </View>
  );
}

function TypeBadge({ type, theme }: { type: string; theme: any }) {
  const colors: Record<string, string> = {
    Observation: "#3B82F6",
    Condition: "#EF4444",
    MedicationRequest: "#10B981",
    MedicationStatement: "#10B981",
    Immunization: "#F59E0B",
    Procedure: "#8B5CF6",
    AllergyIntolerance: "#EC4899",
    Encounter: "#06B6D4",
    DiagnosticReport: "#6366F1",
  };

  return (
    <View style={[styles.typeBadge, { backgroundColor: (colors[type] || theme.primary) + "20" }]}>
      <ThemedText
        type="small"
        style={{ color: colors[type] || theme.primary, fontWeight: "600" }}
      >
        {type}
      </ThemedText>
    </View>
  );
}

function MappingRuleCard({
  rule,
  theme,
  isDark,
  onEdit,
  onDelete,
  onToggle,
  onValidate,
}: {
  rule: MappingRule;
  theme: any;
  isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onValidate: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        style={[
          styles.ruleCard,
          { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" },
        ]}
        onPress={onEdit}
      >
        <View style={styles.ruleCardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.ruleTypeRow}>
              <TypeBadge type={rule.fhirResourceType} theme={theme} />
              <Feather name="arrow-right" size={14} color={theme.textSecondary} style={{ marginHorizontal: 8 }} />
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                {INTERNAL_RECORD_TYPES.find(t => t.value === rule.internalRecordType)?.label || rule.internalRecordType}
              </ThemedText>
            </View>
            <ThemedText type="h4" style={{ marginTop: 8 }}>
              {rule.name}
            </ThemedText>
            {rule.description ? (
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
                {rule.description}
              </ThemedText>
            ) : null}
          </View>
          <StatusBadge active={rule.isActive} theme={theme} />
        </View>

        <View style={[styles.ruleStats, { borderTopColor: theme.border }]}>
          <View style={styles.statItem}>
            <Feather name="git-merge" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {rule.fieldMappings.length} fields
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="filter" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {rule.conditions?.length || 0} conditions
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <Feather name="check-circle" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {rule.validationRules?.length || 0} validations
            </ThemedText>
          </View>
        </View>

        <View style={styles.ruleActions}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.primary + "15" }]}
            onPress={(e) => { e.stopPropagation(); onValidate(); }}
          >
            <Feather name="play" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>Test</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.warning + "15" }]}
            onPress={(e) => { e.stopPropagation(); onToggle(); }}
          >
            <Feather name={rule.isActive ? "pause" : "play"} size={14} color={theme.warning} />
            <ThemedText type="small" style={{ color: theme.warning, marginLeft: 4 }}>
              {rule.isActive ? "Disable" : "Enable"}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.error + "15" }]}
            onPress={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Feather name="trash-2" size={14} color={theme.error} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function TemplateCard({
  template,
  theme,
  isDark,
  onUse,
}: {
  template: MappingTemplate;
  theme: any;
  isDark: boolean;
  onUse: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.templateCard,
        { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" },
      ]}
      onPress={onUse}
    >
      <View style={styles.templateHeader}>
        <TypeBadge type={template.fhirResourceType} theme={theme} />
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </View>
      <ThemedText type="h4" style={{ marginTop: 8 }}>
        {template.name}
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }} numberOfLines={2}>
        {template.description}
      </ThemedText>
      <View style={[styles.templateStats, { marginTop: 12 }]}>
        <ThemedText type="small" style={{ color: theme.primary }}>
          {template.fieldMappings.length} field mappings
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function FHIRMappingScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const sourceId = route.params?.sourceId;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<MappingRule | null>(null);
  const [testSampleData, setTestSampleData] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "templates" | "codes">("rules");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    fhirResourceType: "Observation",
    internalRecordType: "lab",
    priority: 0,
    fieldMappings: [] as FieldMapping[],
  });

  const { data: rules = [], isLoading: rulesLoading, refetch: refetchRules } = useQuery<MappingRule[]>({
    queryKey: ["/api/fhir/mapping-rules", sourceId],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<MappingTemplate[]>({
    queryKey: ["/api/fhir/mapping-templates"],
  });

  const { data: codeMappings = [], isLoading: codesLoading, refetch: refetchCodes } = useQuery<any[]>({
    queryKey: ["/api/fhir/code-mappings"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/fhir/mapping-rules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/mapping-rules"] });
      setShowCreateModal(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/fhir/mapping-rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/mapping-rules"] });
      setShowCreateModal(false);
      setSelectedRule(null);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/fhir/mapping-rules/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir/mapping-rules"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const validateRuleMutation = useMutation({
    mutationFn: async ({ id, sampleData }: { id: string; sampleData: any }) => {
      const res = await apiRequest("POST", `/api/fhir/mapping-rules/${id}/validate`, { sampleData });
      return res.json();
    },
    onSuccess: (result) => {
      setTestResult(result);
    },
  });

  const previewRuleMutation = useMutation({
    mutationFn: async ({ id, sampleData }: { id: string; sampleData: any }) => {
      const res = await apiRequest("POST", `/api/fhir/mapping-rules/${id}/preview`, { sampleData });
      return res.json();
    },
    onSuccess: (result) => {
      setTestResult(result);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      fhirResourceType: "Observation",
      internalRecordType: "lab",
      priority: 0,
      fieldMappings: [],
    });
  };

  const handleCreateFromTemplate = (template: MappingTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      fhirResourceType: template.fhirResourceType,
      internalRecordType: template.internalRecordType,
      priority: 0,
      fieldMappings: template.fieldMappings,
    });
    setShowCreateModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleEditRule = (rule: MappingRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      fhirResourceType: rule.fhirResourceType,
      internalRecordType: rule.internalRecordType,
      priority: rule.priority,
      fieldMappings: rule.fieldMappings,
    });
    setShowCreateModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDeleteRule = (rule: MappingRule) => {
    Alert.alert(
      "Delete Mapping Rule",
      `Are you sure you want to delete "${rule.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteRuleMutation.mutate(rule.id),
        },
      ]
    );
  };

  const handleToggleRule = (rule: MappingRule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      data: { isActive: !rule.isActive },
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTestRule = (rule: MappingRule) => {
    setSelectedRule(rule);
    setTestResult(null);
    setTestSampleData(JSON.stringify({
      resourceType: rule.fhirResourceType,
      id: "example-123",
      code: {
        text: "Example Test",
        coding: [{ code: "12345", system: "http://loinc.org", display: "Example Test" }],
      },
      valueQuantity: { value: 95, unit: "mg/dL" },
      effectiveDateTime: new Date().toISOString(),
      category: [{ coding: [{ code: "laboratory", system: "http://terminology.hl7.org/CodeSystem/observation-category" }] }],
    }, null, 2));
    setShowTestModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRunTest = () => {
    if (!selectedRule || !testSampleData) return;
    
    try {
      const parsed = JSON.parse(testSampleData);
      previewRuleMutation.mutate({ id: selectedRule.id, sampleData: parsed });
    } catch (e) {
      Alert.alert("Invalid JSON", "Please enter valid JSON sample data");
    }
  };

  const handleSaveRule = () => {
    if (!formData.name || !formData.fhirResourceType || !formData.internalRecordType) {
      Alert.alert("Missing Fields", "Please fill in all required fields");
      return;
    }

    const data = {
      ...formData,
      sourceId: sourceId || null,
      conditions: null,
      validationRules: null,
    };

    if (selectedRule) {
      updateRuleMutation.mutate({ id: selectedRule.id, data });
    } else {
      createRuleMutation.mutate(data);
    }
  };

  const addFieldMapping = () => {
    setFormData({
      ...formData,
      fieldMappings: [
        ...formData.fieldMappings,
        { fhirPath: "", internalField: "", required: false },
      ],
    });
  };

  const updateFieldMapping = (index: number, updates: Partial<FieldMapping>) => {
    const updated = [...formData.fieldMappings];
    updated[index] = { ...updated[index], ...updates };
    setFormData({ ...formData, fieldMappings: updated });
  };

  const removeFieldMapping = (index: number) => {
    const updated = formData.fieldMappings.filter((_, i) => i !== index);
    setFormData({ ...formData, fieldMappings: updated });
  };

  const isLoading = rulesLoading || templatesLoading;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetchRules} />
        }
      >
        <View style={[styles.tabBar, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F3F4F6" }]}>
          {(["rules", "templates", "codes"] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                setActiveTab(tab);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <ThemedText
                type="body"
                style={{
                  color: activeTab === tab ? "#FFFFFF" : theme.textSecondary,
                  fontWeight: activeTab === tab ? "600" : "400",
                }}
              >
                {tab === "rules" ? "My Rules" : tab === "templates" ? "Templates" : "Code Maps"}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <LoadingState message="Loading mappings..." />
        ) : (
          <>
            {activeTab === "rules" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="h3">Mapping Rules</ThemedText>
                  <Button
                    icon="plus"
                    size="sm"
                    onPress={() => {
                      resetForm();
                      setSelectedRule(null);
                      setShowCreateModal(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                  >
                    New Rule
                  </Button>
                </View>

                {rules.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB" }]}>
                    <Feather name="git-merge" size={48} color={theme.textSecondary} />
                    <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                      No Mapping Rules Yet
                    </ThemedText>
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                      Create custom rules to control how FHIR data maps to your health records.
                    </ThemedText>
                    <Button
                      variant="primary"
                      size="md"
                      onPress={() => setActiveTab("templates")}
                      style={{ marginTop: Spacing.lg }}
                    >
                      Browse Templates
                    </Button>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.md }}>
                    {rules.map((rule) => (
                      <MappingRuleCard
                        key={rule.id}
                        rule={rule}
                        theme={theme}
                        isDark={isDark}
                        onEdit={() => handleEditRule(rule)}
                        onDelete={() => handleDeleteRule(rule)}
                        onToggle={() => handleToggleRule(rule)}
                        onValidate={() => handleTestRule(rule)}
                      />
                    ))}
                  </View>
                )}
              </Animated.View>
            ) : null}

            {activeTab === "templates" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                  Mapping Templates
                </ThemedText>
                <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  Start with a pre-built template and customize it for your needs.
                </ThemedText>

                <View style={styles.templatesGrid}>
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      theme={theme}
                      isDark={isDark}
                      onUse={() => handleCreateFromTemplate(template)}
                    />
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {activeTab === "codes" ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="h3">Code Mappings</ThemedText>
                </View>
                <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  Map codes between different terminology systems (LOINC, SNOMED, ICD-10).
                </ThemedText>

                {codeMappings.length === 0 ? (
                  <View style={[styles.emptyState, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB" }]}>
                    <Feather name="book-open" size={48} color={theme.textSecondary} />
                    <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
                      No Code Mappings
                    </ThemedText>
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                      Code mappings help translate between different medical coding systems.
                    </ThemedText>
                  </View>
                ) : (
                  <View style={{ gap: Spacing.sm }}>
                    {codeMappings.map((mapping: any) => (
                      <View
                        key={mapping.id}
                        style={[styles.codeMapItem, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF" }]}
                      >
                        <View style={styles.codeMapContent}>
                          <ThemedText type="body" style={{ fontFamily: "monospace" }}>
                            {mapping.sourceCode}
                          </ThemedText>
                          <Feather name="arrow-right" size={16} color={theme.textSecondary} style={{ marginHorizontal: 8 }} />
                          <ThemedText type="body" style={{ fontFamily: "monospace" }}>
                            {mapping.targetCode}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {mapping.equivalence}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>

      <BaseModal
        visible={showCreateModal}
        onClose={() => { setShowCreateModal(false); setSelectedRule(null); resetForm(); }}
        title={selectedRule ? "Edit Rule" : "New Mapping Rule"}
      >
        <Button
          onPress={handleSaveRule}
          loading={createRuleMutation.isPending || updateRuleMutation.isPending}
          disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
          fullWidth
          style={{ marginBottom: Spacing.lg }}
        >
          Save
        </Button>

        <FormInput
          label="Rule Name *"
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="e.g., Custom Observation Mapping"
        />

        <FormInput
          label="Description"
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="Describe when this mapping should be used"
          multiline
          numberOfLines={3}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <ThemedText type="small" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>FHIR Resource *</ThemedText>
            <View style={[styles.picker, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F3F4F6" }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FHIR_RESOURCE_TYPES.map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.pickerOption,
                      formData.fhirResourceType === type && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => setFormData({ ...formData, fhirResourceType: type })}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: formData.fhirResourceType === type ? "#FFFFFF" : theme.text }}
                    >
                      {type}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        <ThemedText type="small" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>Target Record Type *</ThemedText>
        <View style={styles.recordTypesGrid}>
          {INTERNAL_RECORD_TYPES.map((type) => (
            <Pressable
              key={type.value}
              style={[
                styles.recordTypeOption,
                { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F3F4F6" },
                formData.internalRecordType === type.value && { backgroundColor: theme.primary },
              ]}
              onPress={() => setFormData({ ...formData, internalRecordType: type.value })}
            >
              <ThemedText
                type="small"
                style={{ color: formData.internalRecordType === type.value ? "#FFFFFF" : theme.text }}
              >
                {type.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="small" style={{ marginTop: Spacing.lg }}>Field Mappings</ThemedText>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onPress={addFieldMapping}
          >
            Add Field
          </Button>
        </View>

        {formData.fieldMappings.length === 0 ? (
          <View style={[styles.emptyMappings, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB" }]}>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              No field mappings defined. Add mappings to specify how FHIR fields translate to internal fields.
            </ThemedText>
          </View>
        ) : (
          <View style={{ gap: Spacing.md, marginTop: Spacing.md }}>
            {formData.fieldMappings.map((mapping, index) => (
              <View
                key={index}
                style={[styles.fieldMappingCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB" }]}
              >
                <View style={styles.fieldMappingHeader}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Mapping #{index + 1}
                  </ThemedText>
                  <Pressable onPress={() => removeFieldMapping(index)}>
                    <Feather name="x" size={18} color={theme.error} />
                  </Pressable>
                </View>
                <FormInput
                  value={mapping.fhirPath}
                  onChangeText={(text) => updateFieldMapping(index, { fhirPath: text })}
                  placeholder="FHIR Path (e.g., code.text)"
                />
                <FormInput
                  value={mapping.internalField}
                  onChangeText={(text) => updateFieldMapping(index, { internalField: text })}
                  placeholder="Internal Field (e.g., title)"
                />
                <Pressable
                  style={styles.requiredToggle}
                  onPress={() => updateFieldMapping(index, { required: !mapping.required })}
                >
                  <View style={[styles.checkbox, mapping.required && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                    {mapping.required ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
                  </View>
                  <ThemedText type="small" style={{ marginLeft: 8 }}>Required field</ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </BaseModal>

      <BaseModal
        visible={showTestModal}
        onClose={() => { setShowTestModal(false); setTestResult(null); }}
        title="Test Mapping"
      >
        <Button
          onPress={handleRunTest}
          loading={previewRuleMutation.isPending}
          disabled={previewRuleMutation.isPending}
          fullWidth
          icon="play"
          style={{ marginBottom: Spacing.lg }}
        >
          Run
        </Button>

        <FormInput
          label="Sample FHIR Resource (JSON)"
          value={testSampleData}
          onChangeText={setTestSampleData}
          placeholder="Paste FHIR resource JSON here"
          multiline
          numberOfLines={10}
          style={{ minHeight: 200 }}
        />

        {testResult ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: Spacing.lg }}>
            <ThemedText type="small" style={{ marginBottom: Spacing.sm }}>Transformation Result</ThemedText>
            <View style={[styles.resultCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB" }]}>
              {testResult.fieldTransformations?.map((ft: any, index: number) => (
                <View key={index} style={[styles.transformRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: 1, paddingTop: Spacing.sm }]}>
                  <View style={styles.transformField}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>FHIR Path</ThemedText>
                    <ThemedText type="body" style={{ fontFamily: "monospace" }}>{ft.fhirPath}</ThemedText>
                  </View>
                  <Feather name="arrow-right" size={16} color={theme.textSecondary} style={{ marginHorizontal: 8 }} />
                  <View style={styles.transformField}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>Internal Field</ThemedText>
                    <ThemedText type="body" style={{ fontFamily: "monospace" }}>{ft.internalField}</ThemedText>
                  </View>
                  <View style={[styles.transformValue, { backgroundColor: theme.success + "20" }]}>
                    <ThemedText type="small" style={{ color: theme.success }}>
                      {ft.transformedValue !== undefined ? String(ft.transformedValue).substring(0, 30) : "(empty)"}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <ThemedText type="small" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>Output Preview</ThemedText>
            <View style={[styles.codeBlock, { backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "#1F2937" }]}>
              <ThemedText type="body" style={{ color: "#E5E7EB", fontFamily: "monospace", fontSize: 12 }}>
                {JSON.stringify(testResult.transformedData, null, 2)}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}
      </BaseModal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  ruleCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ruleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ruleTypeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ruleStats: {
    flexDirection: "row",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  ruleActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  templatesGrid: {
    gap: Spacing.md,
  },
  templateCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  templateStats: {
    flexDirection: "row",
  },
  codeMapItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  codeMapContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  picker: {
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  pickerOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginRight: 4,
  },
  recordTypesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  recordTypeOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  emptyMappings: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  fieldMappingCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  fieldMappingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  requiredToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
  },
  resultCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  transformRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    flexWrap: "wrap",
  },
  transformField: {
    flex: 1,
    minWidth: 80,
  },
  transformValue: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
  },
  codeBlock: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    overflow: "hidden",
  },
});
