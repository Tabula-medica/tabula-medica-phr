import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/hooks/useTheme";
import { Card } from "@/components/Card";
import { MetricCard, StatsGrid } from "@/components/MetricCard";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface DataQualityOverview {
  validation: {
    totalValidations: number;
    validRate: number;
    topIssues: Array<{ code: string; count: number }>;
  };
  terminology: {
    totalMappings: number;
    verifiedMappings: number;
    systemCoverage: number;
  };
  harmonization: {
    canonicalViews: number;
    averageScore: number;
    unresolvedConflicts: number;
    terminologyMappings: number;
  };
}

interface ValidationSummary {
  totalValidations: number;
  validCount: number;
  invalidCount: number;
  bySeverity: Record<string, number>;
  byResourceType: Record<string, { valid: number; invalid: number }>;
  commonIssues: Array<{ code: string; count: number }>;
}

interface TerminologyStats {
  totalMappings: number;
  bySourceSystem: Record<string, number>;
  byTargetSystem: Record<string, number>;
  byEquivalenceType: Record<string, number>;
  verifiedCount: number;
}

interface DataConflict {
  id: string;
  field: string;
  conflictType: string;
  values: Array<{ sourceId: string; value: unknown }>;
  isResolved: boolean;
  createdAt: string;
}

type TabType = "overview" | "validation" | "terminology" | "conflicts";

export default function DataQualityScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const { data: overview, isLoading: overviewLoading } = useQuery<DataQualityOverview>({
    queryKey: ["/api/data-quality/overview"],
  });

  const { data: validationSummary, isLoading: validationLoading } = useQuery<ValidationSummary>({
    queryKey: ["/api/validation/summary"],
    enabled: activeTab === "validation",
  });

  const { data: terminologyStats, isLoading: terminologyLoading } = useQuery<TerminologyStats>({
    queryKey: ["/api/terminology/statistics"],
    enabled: activeTab === "terminology",
  });

  const { data: conflicts, isLoading: conflictsLoading } = useQuery<DataConflict[]>({
    queryKey: ["/api/harmonization/conflicts"],
    enabled: activeTab === "conflicts",
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/terminology/seed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terminology/statistics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-quality/overview"] });
    },
  });

  const renderTab = (tab: TabType, label: string, icon: keyof typeof Feather.glyphMap) => (
    <Pressable
      key={tab}
      style={[
        styles.tab,
        activeTab === tab && { backgroundColor: theme.primary },
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Feather
        name={icon}
        size={16}
        color={activeTab === tab ? "#fff" : theme.textSecondary}
      />
      <Text
        style={[
          styles.tabText,
          { color: activeTab === tab ? "#fff" : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  const renderOverview = () => {
    if (overviewLoading || !overview) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    return (
      <>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Data Quality Score
        </Text>
        
        <Card style={StyleSheet.flatten([styles.scoreCard, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreValue, { color: getScoreColor(overview.validation.validRate) }]}>
              {overview.validation.validRate}%
            </Text>
            <Text style={[styles.scoreLabel, { color: theme.textSecondary }]}>
              Valid Resources
            </Text>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Quick Stats
        </Text>

        <StatsGrid>
          <MetricCard value={overview.validation.totalValidations} label="Validations" icon="check-circle" color={theme.success} />
          <MetricCard value={overview.terminology.totalMappings} label="Mappings" icon="git-merge" color={theme.primary} />
          <MetricCard value={overview.harmonization.canonicalViews} label="Canonical Views" icon="layers" color={theme.primary} />
          <MetricCard value={overview.harmonization.unresolvedConflicts} label="Conflicts" icon="alert-triangle" color={theme.warning} />
        </StatsGrid>

        {overview.validation.topIssues.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Top Validation Issues
            </Text>
            <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
              {overview.validation.topIssues.map((issue, index) => (
                <View key={issue.code} style={styles.issueRow}>
                  <View style={styles.issueInfo}>
                    <Text style={[styles.issueCode, { color: theme.text }]} numberOfLines={1}>
                      {formatIssueCode(issue.code)}
                    </Text>
                  </View>
                  <View style={[styles.issueBadge, { backgroundColor: theme.error + "20" }]}>
                    <Text style={[styles.issueBadgeText, { color: theme.error }]}>
                      {issue.count}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </>
    );
  };

  const renderValidation = () => {
    if (validationLoading || !validationSummary) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    const total = validationSummary.totalValidations || 1;

    return (
      <>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Validation Summary
        </Text>

        <View style={styles.validationStats}>
          <Card style={StyleSheet.flatten([styles.validationCard, { backgroundColor: theme.success + "15" }]) as ViewStyle}>
            <Feather name="check" size={20} color={theme.success} />
            <Text style={[styles.validationValue, { color: theme.success }]}>
              {validationSummary.validCount}
            </Text>
            <Text style={[styles.validationLabel, { color: theme.textSecondary }]}>
              Valid ({Math.round((validationSummary.validCount / total) * 100)}%)
            </Text>
          </Card>

          <Card style={StyleSheet.flatten([styles.validationCard, { backgroundColor: theme.error + "15" }]) as ViewStyle}>
            <Feather name="x" size={20} color={theme.error} />
            <Text style={[styles.validationValue, { color: theme.error }]}>
              {validationSummary.invalidCount}
            </Text>
            <Text style={[styles.validationLabel, { color: theme.textSecondary }]}>
              Invalid ({Math.round((validationSummary.invalidCount / total) * 100)}%)
            </Text>
          </Card>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          By Severity
        </Text>
        <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
          {Object.entries(validationSummary.bySeverity).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No validation data yet
            </Text>
          ) : (
            Object.entries(validationSummary.bySeverity).map(([severity, count]) => (
              <View key={severity} style={styles.severityRow}>
                <View style={styles.severityInfo}>
                  <View style={[styles.severityDot, { backgroundColor: getSeverityColor(severity) }]} />
                  <Text style={[styles.severityName, { color: theme.text }]}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Text>
                </View>
                <Text style={[styles.severityCount, { color: theme.textSecondary }]}>
                  {count}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          By Resource Type
        </Text>
        <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
          {Object.entries(validationSummary.byResourceType).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No validation data yet
            </Text>
          ) : (
            Object.entries(validationSummary.byResourceType).map(([type, data]) => (
              <View key={type} style={styles.resourceTypeRow}>
                <Text style={[styles.resourceTypeName, { color: theme.text }]}>
                  {type}
                </Text>
                <View style={styles.resourceTypeStats}>
                  <Text style={[styles.resourceTypeStat, { color: theme.success }]}>
                    {data.valid} valid
                  </Text>
                  <Text style={[styles.resourceTypeStat, { color: theme.error }]}>
                    {data.invalid} invalid
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </>
    );
  };

  const renderTerminology = () => {
    if (terminologyLoading || !terminologyStats) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    return (
      <>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Terminology Mappings
        </Text>

        <View style={styles.terminologyStats}>
          <Card style={StyleSheet.flatten([styles.terminologyCard, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
            <Text style={[styles.terminologyValue, { color: theme.primary }]}>
              {terminologyStats.totalMappings}
            </Text>
            <Text style={[styles.terminologyLabel, { color: theme.textSecondary }]}>
              Total Mappings
            </Text>
          </Card>

          <Card style={StyleSheet.flatten([styles.terminologyCard, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
            <Text style={[styles.terminologyValue, { color: theme.success }]}>
              {terminologyStats.verifiedCount}
            </Text>
            <Text style={[styles.terminologyLabel, { color: theme.textSecondary }]}>
              Verified
            </Text>
          </Card>
        </View>

        <Pressable
          style={[styles.seedButton, { backgroundColor: theme.primary }]}
          onPress={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
        >
          {seedMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="database" size={16} color="#fff" />
              <Text style={styles.seedButtonText}>Seed Common Mappings</Text>
            </>
          )}
        </Pressable>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          By Source System
        </Text>
        <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
          {Object.entries(terminologyStats.bySourceSystem).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No mappings yet. Tap "Seed Common Mappings" to add initial data.
            </Text>
          ) : (
            Object.entries(terminologyStats.bySourceSystem).map(([system, count]) => (
              <View key={system} style={styles.systemRow}>
                <Text style={[styles.systemName, { color: theme.text }]} numberOfLines={1}>
                  {formatSystemName(system)}
                </Text>
                <Text style={[styles.systemCount, { color: theme.textSecondary }]}>
                  {count}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          By Equivalence Type
        </Text>
        <Card style={StyleSheet.flatten([styles.section, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
          {Object.entries(terminologyStats.byEquivalenceType).length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No mappings yet
            </Text>
          ) : (
            Object.entries(terminologyStats.byEquivalenceType).map(([type, count]) => (
              <View key={type} style={styles.equivalenceRow}>
                <Text style={[styles.equivalenceName, { color: theme.text }]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
                <Text style={[styles.equivalenceCount, { color: theme.textSecondary }]}>
                  {count}
                </Text>
              </View>
            ))
          )}
        </Card>
      </>
    );
  };

  const renderConflicts = () => {
    if (conflictsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    const unresolvedConflicts = conflicts?.filter(c => !c.isResolved) || [];

    return (
      <>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Unresolved Data Conflicts
        </Text>

        {unresolvedConflicts.length === 0 ? (
          <Card style={StyleSheet.flatten([styles.emptyCard, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}>
            <Feather name="check-circle" size={48} color={theme.success} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              No Conflicts
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              All data conflicts have been resolved
            </Text>
          </Card>
        ) : (
          unresolvedConflicts.map((conflict) => (
            <Card 
              key={conflict.id} 
              style={StyleSheet.flatten([styles.conflictCard, { backgroundColor: theme.backgroundDefault }]) as ViewStyle}
            >
              <View style={styles.conflictHeader}>
                <View style={[styles.conflictTypeBadge, { backgroundColor: getConflictTypeColor(conflict.conflictType) + "20" }]}>
                  <Text style={[styles.conflictTypeText, { color: getConflictTypeColor(conflict.conflictType) }]}>
                    {conflict.conflictType.replace("_", " ")}
                  </Text>
                </View>
                <Text style={[styles.conflictDate, { color: theme.textSecondary }]}>
                  {new Date(conflict.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              <Text style={[styles.conflictField, { color: theme.text }]}>
                Field: {conflict.field}
              </Text>
              
              <Text style={[styles.conflictValuesLabel, { color: theme.textSecondary }]}>
                Conflicting Values:
              </Text>
              {conflict.values.slice(0, 3).map((val, index) => (
                <View key={index} style={styles.conflictValueRow}>
                  <Text style={[styles.conflictSource, { color: theme.textSecondary }]} numberOfLines={1}>
                    {val.sourceId.substring(0, 8)}...
                  </Text>
                  <Text style={[styles.conflictValue, { color: theme.text }]} numberOfLines={1}>
                    {typeof val.value === "object" ? JSON.stringify(val.value).substring(0, 30) : String(val.value)}
                  </Text>
                </View>
              ))}
            </Card>
          ))
        )}
      </>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return theme.success;
    if (score >= 70) return theme.warning;
    return theme.error;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "fatal": return theme.error;
      case "error": return theme.error;
      case "warning": return theme.warning;
      case "information": return theme.primary;
      default: return theme.textSecondary;
    }
  };

  const getConflictTypeColor = (type: string) => {
    switch (type) {
      case "value_mismatch": return theme.warning;
      case "date_mismatch": return theme.primary;
      case "duplicate": return theme.primary;
      case "semantic": return theme.error;
      default: return theme.textSecondary;
    }
  };

  const formatIssueCode = (code: string) => {
    return code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatSystemName = (system: string) => {
    const names: Record<string, string> = {
      "http://snomed.info/sct": "SNOMED CT",
      "http://loinc.org": "LOINC",
      "http://hl7.org/fhir/sid/icd-10": "ICD-10",
      "http://hl7.org/fhir/sid/icd-10-cm": "ICD-10-CM",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
    };
    return names[system] || system.split("/").pop() || system;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing["3xl"] },
      ]}
    >
      <View style={styles.tabs}>
        {renderTab("overview", "Overview", "pie-chart")}
        {renderTab("validation", "Validation", "check-circle")}
        {renderTab("terminology", "Terminology", "git-merge")}
        {renderTab("conflicts", "Conflicts", "alert-triangle")}
      </View>

      {activeTab === "overview" && renderOverview()}
      {activeTab === "validation" && renderValidation()}
      {activeTab === "terminology" && renderTerminology()}
      {activeTab === "conflicts" && renderConflicts()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  tabText: {
    ...Typography.small,
    fontWeight: "600",
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  scoreCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  scoreCircle: {
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "700",
  },
  scoreLabel: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  section: {
    padding: Spacing.md,
  },
  issueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  issueInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  issueCode: {
    ...Typography.small,
    fontWeight: "500",
  },
  issueBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  issueBadgeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  validationStats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  validationCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  validationValue: {
    ...Typography.h2,
    marginTop: Spacing.sm,
  },
  validationLabel: {
    ...Typography.small,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  severityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  severityInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  severityName: {
    ...Typography.body,
  },
  severityCount: {
    ...Typography.body,
    fontWeight: "600",
  },
  resourceTypeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  resourceTypeName: {
    ...Typography.body,
    fontWeight: "500",
  },
  resourceTypeStats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  resourceTypeStat: {
    ...Typography.small,
    fontWeight: "600",
  },
  terminologyStats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  terminologyCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  terminologyValue: {
    ...Typography.h2,
  },
  terminologyLabel: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  seedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  seedButtonText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  systemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  systemName: {
    ...Typography.body,
    flex: 1,
    marginRight: Spacing.md,
  },
  systemCount: {
    ...Typography.body,
    fontWeight: "600",
  },
  equivalenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  equivalenceName: {
    ...Typography.body,
  },
  equivalenceCount: {
    ...Typography.body,
    fontWeight: "600",
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyTitle: {
    ...Typography.h4,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  conflictCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  conflictHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  conflictTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  conflictTypeText: {
    ...Typography.small,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  conflictDate: {
    ...Typography.small,
  },
  conflictField: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  conflictValuesLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  conflictValueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  conflictSource: {
    ...Typography.small,
    width: 70,
  },
  conflictValue: {
    ...Typography.small,
    flex: 1,
  },
});
