import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

type StandardType = "FHIR_R4" | "FHIR_STU3" | "C-CDA" | "HL7v2";
type ProfileType = "US_CORE" | "ARGONAUT" | "IPS" | "AU_CORE" | "UK_CORE";

interface MappingResult {
  success: boolean;
  sourceStandard: string;
  targetStandard: string;
  mappedData: unknown;
  mappingDetails: Array<{
    sourceField: string;
    targetField: string;
    transformation: string;
    confidence: number;
  }>;
  warnings: string[];
  errors: string[];
}

interface ValidationResult {
  isValid: boolean;
  resourceType: string;
  severity: string;
  issues: Array<{
    severity: string;
    code: string;
    message: string;
    location: string;
  }>;
  suggestions: Array<{
    type: string;
    field: string;
    suggestedValue: unknown;
    reason: string;
  }>;
}

const STANDARDS: Array<{ id: StandardType; label: string; description: string; icon: keyof typeof Feather.glyphMap }> = [
  { id: "FHIR_R4", label: "FHIR R4", description: "HL7 FHIR Release 4", icon: "database" },
  { id: "FHIR_STU3", label: "FHIR STU3", description: "HL7 FHIR STU3", icon: "archive" },
  { id: "C-CDA", label: "C-CDA", description: "Consolidated Clinical Document", icon: "file-text" },
  { id: "HL7v2", label: "HL7 v2", description: "HL7 Version 2 Messages", icon: "message-square" },
];

const PROFILES: Array<{ id: ProfileType; label: string; description: string }> = [
  { id: "US_CORE", label: "US Core", description: "US healthcare standard" },
  { id: "ARGONAUT", label: "Argonaut", description: "Core data for interoperability" },
  { id: "IPS", label: "IPS", description: "International Patient Summary" },
  { id: "AU_CORE", label: "AU Core", description: "Australian healthcare standard" },
  { id: "UK_CORE", label: "UK Core", description: "UK healthcare standard" },
];

const SAMPLE_FHIR_OBSERVATION = {
  resourceType: "Observation",
  id: "example-blood-glucose",
  status: "final",
  code: {
    coding: [
      {
        system: "http://loinc.org",
        code: "2339-0",
        display: "Glucose [Mass/volume] in Blood",
      },
    ],
  },
  effectiveDateTime: "2024-01-15T09:30:00Z",
  valueQuantity: {
    value: 95,
    unit: "mg/dL",
    system: "http://unitsofmeasure.org",
    code: "mg/dL",
  },
  subject: {
    reference: "Patient/example",
  },
};

export default function InteroperabilityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"mapping" | "validation">("mapping");
  const [sourceStandard, setSourceStandard] = useState<StandardType>("FHIR_R4");
  const [targetStandard, setTargetStandard] = useState<StandardType>("C-CDA");
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>("US_CORE");
  const [isLoading, setIsLoading] = useState(false);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleMapping = useCallback(async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data } = await axiosInstance.post("/api/interoperability/map", {
        sourceData: SAMPLE_FHIR_OBSERVATION,
        sourceStandard,
        targetStandard,
      });

      setMappingResult(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || "Failed to map resource";
      Alert.alert("Mapping Failed", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [sourceStandard, targetStandard]);

  const handleValidation = useCallback(async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data } = await axiosInstance.post("/api/interoperability/validate-profile", {
        resource: SAMPLE_FHIR_OBSERVATION,
        profileType: selectedProfile,
        strictMode: false,
      });

      setValidationResult(data);
      Haptics.notificationAsync(
        data.isValid
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || "Failed to validate resource";
      Alert.alert("Validation Failed", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProfile]);

  const renderTabButton = (tab: "mapping" | "validation", label: string, icon: keyof typeof Feather.glyphMap) => (
    <Pressable
      onPress={() => {
        setActiveTab(tab);
        Haptics.selectionAsync();
      }}
      style={[
        styles.tabButton,
        {
          backgroundColor: activeTab === tab ? theme.primary : "transparent",
          borderColor: theme.border,
        },
      ]}
    >
      <Feather
        name={icon}
        size={18}
        color={activeTab === tab ? "#FFFFFF" : theme.text}
      />
      <ThemedText
        type="small"
        style={{
          marginLeft: Spacing.xs,
          color: activeTab === tab ? "#FFFFFF" : theme.text,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderStandardSelector = (
    label: string,
    selected: StandardType,
    onSelect: (s: StandardType) => void,
    exclude?: StandardType
  ) => (
    <View style={styles.selectorContainer}>
      <ThemedText type="small" style={[styles.selectorLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      <View style={styles.standardsGrid}>
        {STANDARDS.filter(s => s.id !== exclude).map((standard) => (
          <Pressable
            key={standard.id}
            onPress={() => {
              onSelect(standard.id);
              Haptics.selectionAsync();
            }}
            style={[
              styles.standardOption,
              {
                backgroundColor: selected === standard.id
                  ? theme.primary + "20"
                  : theme.backgroundSecondary,
                borderColor: selected === standard.id ? theme.primary : theme.border,
              },
            ]}
          >
            <Feather
              name={standard.icon}
              size={20}
              color={selected === standard.id ? theme.primary : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                marginTop: Spacing.xs,
                color: selected === standard.id ? theme.primary : theme.text,
              }}
            >
              {standard.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderProfileSelector = () => (
    <View style={styles.selectorContainer}>
      <ThemedText type="small" style={[styles.selectorLabel, { color: theme.textSecondary }]}>
        Validation Profile
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profilesScroll}>
        {PROFILES.map((profile) => (
          <Pressable
            key={profile.id}
            onPress={() => {
              setSelectedProfile(profile.id);
              Haptics.selectionAsync();
            }}
            style={[
              styles.profileOption,
              {
                backgroundColor: selectedProfile === profile.id
                  ? theme.primary + "20"
                  : theme.backgroundSecondary,
                borderColor: selectedProfile === profile.id ? theme.primary : theme.border,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: selectedProfile === profile.id ? theme.primary : theme.text,
              }}
            >
              {profile.label}
            </ThemedText>
            <ThemedText
              type="caption"
              style={{ color: theme.textSecondary, marginTop: 2 }}
            >
              {profile.description}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderMappingResult = () => {
    if (!mappingResult) return null;

    return (
      <Animated.View entering={FadeInDown.springify()}>
        <Card variant="glass" style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: mappingResult.success ? theme.success + "20" : theme.error + "20" }
            ]}>
              <Feather
                name={mappingResult.success ? "check-circle" : "x-circle"}
                size={16}
                color={mappingResult.success ? theme.success : theme.error}
              />
              <ThemedText
                type="small"
                style={{
                  marginLeft: Spacing.xs,
                  color: mappingResult.success ? theme.success : theme.error,
                }}
              >
                {mappingResult.success ? "Mapping Successful" : "Mapping Failed"}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            {mappingResult.sourceStandard} → {mappingResult.targetStandard}
          </ThemedText>

          {mappingResult.mappingDetails.length > 0 ? (
            <View style={styles.detailsSection}>
              <ThemedText type="small" style={[styles.detailsTitle, { color: theme.text }]}>
                Mapping Details ({mappingResult.mappingDetails.length})
              </ThemedText>
              {mappingResult.mappingDetails.slice(0, 3).map((detail, index) => (
                <View key={index} style={[styles.detailRow, { borderColor: theme.border }]}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {detail.sourceField} → {detail.targetField}
                  </ThemedText>
                  <View style={styles.confidenceBar}>
                    <View
                      style={[
                        styles.confidenceFill,
                        {
                          width: `${detail.confidence * 100}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {mappingResult.warnings.length > 0 ? (
            <View style={[styles.warningBox, { backgroundColor: theme.warning + "10" }]}>
              <Feather name="alert-triangle" size={14} color={theme.warning} />
              <ThemedText type="small" style={{ color: theme.warning, marginLeft: Spacing.xs, flex: 1 }}>
                {mappingResult.warnings[0]}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderValidationResult = () => {
    if (!validationResult) return null;

    const errorCount = validationResult.issues.filter(i => i.severity === "error").length;
    const warningCount = validationResult.issues.filter(i => i.severity === "warning").length;

    return (
      <Animated.View entering={FadeInDown.springify()}>
        <Card variant="glass" style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: validationResult.isValid ? theme.success + "20" : theme.error + "20" }
            ]}>
              <Feather
                name={validationResult.isValid ? "check-circle" : "alert-circle"}
                size={16}
                color={validationResult.isValid ? theme.success : theme.error}
              />
              <ThemedText
                type="small"
                style={{
                  marginLeft: Spacing.xs,
                  color: validationResult.isValid ? theme.success : theme.error,
                }}
              >
                {validationResult.isValid ? "Valid Resource" : "Validation Issues Found"}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            {validationResult.resourceType} • Profile: {selectedProfile}
          </ThemedText>

          <View style={styles.issuesSummary}>
            <View style={[styles.issueBadge, { backgroundColor: theme.error + "15" }]}>
              <ThemedText type="h4" style={{ color: theme.error }}>{errorCount}</ThemedText>
              <ThemedText type="small" style={{ color: theme.error }}>Errors</ThemedText>
            </View>
            <View style={[styles.issueBadge, { backgroundColor: theme.warning + "15" }]}>
              <ThemedText type="h4" style={{ color: theme.warning }}>{warningCount}</ThemedText>
              <ThemedText type="small" style={{ color: theme.warning }}>Warnings</ThemedText>
            </View>
            <View style={[styles.issueBadge, { backgroundColor: theme.success + "15" }]}>
              <ThemedText type="h4" style={{ color: theme.success }}>
                {validationResult.suggestions.length}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.success }}>Suggestions</ThemedText>
            </View>
          </View>

          {validationResult.issues.length > 0 ? (
            <View style={styles.detailsSection}>
              <ThemedText type="small" style={[styles.detailsTitle, { color: theme.text }]}>
                Issues
              </ThemedText>
              {validationResult.issues.slice(0, 3).map((issue, index) => (
                <View key={index} style={[styles.issueRow, { borderColor: theme.border }]}>
                  <Feather
                    name={issue.severity === "error" ? "x-circle" : "alert-triangle"}
                    size={14}
                    color={issue.severity === "error" ? theme.error : theme.warning}
                  />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText type="small" style={{ color: theme.text }}>
                      {issue.message}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {issue.location}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).springify()}>
          <ThemedText type="h2" style={styles.title}>
            Interoperability
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            Map FHIR resources to C-CDA, HL7v2 and validate against profiles
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={styles.tabContainer}>
            {renderTabButton("mapping", "Standards Mapping", "repeat")}
            {renderTabButton("validation", "Profile Validation", "shield")}
          </View>
        </Animated.View>

        {activeTab === "mapping" ? (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Card variant="elevated" style={styles.sectionCard}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Convert Health Data
              </ThemedText>

              {renderStandardSelector("Source Standard", sourceStandard, setSourceStandard)}

              <View style={styles.arrowContainer}>
                <Feather name="arrow-down" size={24} color={theme.primary} />
              </View>

              {renderStandardSelector("Target Standard", targetStandard, setTargetStandard, sourceStandard)}

              <Pressable
                onPress={handleMapping}
                disabled={isLoading || sourceStandard === targetStandard}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: isLoading || sourceStandard === targetStandard ? 0.5 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="shuffle" size={18} color="#FFFFFF" />
                    <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                      Map Sample Resource
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </Card>

            {renderMappingResult()}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Card variant="elevated" style={styles.sectionCard}>
              <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                Validate Against Profile
              </ThemedText>

              {renderProfileSelector()}

              <View style={[styles.sampleResourceBox, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}>
                  Sample Resource
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.text }}>
                  Observation: Blood Glucose (95 mg/dL)
                </ThemedText>
              </View>

              <Pressable
                onPress={handleValidation}
                disabled={isLoading}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: isLoading ? 0.5 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check-square" size={18} color="#FFFFFF" />
                    <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                      Validate Resource
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </Card>

            {renderValidationResult()}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card variant="outlined" style={styles.infoCard}>
            <Feather name="info" size={20} color={theme.primary} />
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>
                Supported Conversions
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                FHIR R4 ↔ C-CDA • FHIR R4 ↔ HL7v2 • FHIR STU3 ↔ FHIR R4
              </ThemedText>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  selectorContainer: {
    marginBottom: Spacing.md,
  },
  selectorLabel: {
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  standardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  standardOption: {
    flex: 1,
    minWidth: "45%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  arrowContainer: {
    alignItems: "center",
    marginVertical: Spacing.sm,
  },
  profilesScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  profileOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.sm,
    minWidth: 100,
  },
  sampleResourceBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  resultCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  detailsSection: {
    marginTop: Spacing.lg,
  },
  detailsTitle: {
    marginBottom: Spacing.sm,
  },
  detailRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    marginTop: Spacing.xs,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 2,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  issuesSummary: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  issueBadge: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
});
