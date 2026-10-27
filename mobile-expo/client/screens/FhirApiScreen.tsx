import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface FhirStats {
  totalResources: number;
  resourceTypes: Record<string, number>;
  supportedTypes: string[];
  fhirVersion: string;
  lastSync: string | null;
}

interface FhirBundleEntry {
  fullUrl?: string;
  resource?: {
    resourceType: string;
    id?: string;
    meta?: { lastUpdated?: string };
    [key: string]: unknown;
  };
  search?: { mode: string };
}

interface FhirBundle {
  resourceType: string;
  type: string;
  total: number;
  entry?: FhirBundleEntry[];
}

type TabKey = "overview" | "browse" | "import";

const TABS: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "overview", label: "Overview", icon: "bar-chart-2" },
  { key: "browse", label: "Browse", icon: "search" },
  { key: "import", label: "Import/Export", icon: "download" },
];

const RESOURCE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Patient: "user",
  Observation: "activity",
  Condition: "alert-circle",
  Procedure: "scissors",
  MedicationRequest: "package",
  AllergyIntolerance: "alert-triangle",
  Immunization: "shield",
  DiagnosticReport: "file-text",
  Encounter: "calendar",
  DocumentReference: "file",
  CarePlan: "clipboard",
  CareTeam: "users",
  Goal: "target",
  Coverage: "credit-card",
};

const RESOURCE_COLORS: Record<string, string> = {
  Patient: "#3b82f6",
  Observation: "#10b981",
  Condition: "#f59e0b",
  Procedure: "#8b5cf6",
  MedicationRequest: "#ec4899",
  AllergyIntolerance: "#ef4444",
  Immunization: "#06b6d4",
  DiagnosticReport: "#14b8a6",
  Encounter: "#6366f1",
  DocumentReference: "#64748b",
  CarePlan: "#0ea5e9",
  CareTeam: "#a855f7",
  Goal: "#22c55e",
  Coverage: "#f97316",
};

function getResourceTitle(resource: any): string {
  const rt = resource.resourceType;
  switch (rt) {
    case "Patient":
      return resource.name?.[0]?.text || "Patient";
    case "Observation":
      return resource.code?.text || resource.code?.coding?.[0]?.display || "Observation";
    case "Condition":
      return resource.code?.text || resource.code?.coding?.[0]?.display || "Condition";
    case "Procedure":
      return resource.code?.text || "Procedure";
    case "MedicationRequest":
      return resource.medicationCodeableConcept?.text || "Medication";
    case "AllergyIntolerance":
      return resource.code?.text || "Allergy";
    case "Immunization":
      return resource.vaccineCode?.text || "Immunization";
    case "DiagnosticReport":
      return resource.code?.text || "Diagnostic Report";
    case "Encounter":
      return resource.type?.[0]?.text || "Encounter";
    default:
      return resource.title || resource.description?.text || rt;
  }
}

export default function FhirApiScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [resourceDetailId, setResourceDetailId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const { checkFeature, promptProps } = useFeatureGate();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<FhirStats>({
    queryKey: ["/api/fhir/r4/stats"],
  });

  const { data: browseData, isLoading: browseLoading, refetch: refetchBrowse } = useQuery<FhirBundle>({
    queryKey: [`/api/fhir/r4/${selectedType}`],
    enabled: activeTab === "browse" && !!selectedType,
  });

  const exportMutation = useMutation({
    mutationFn: async (types?: string[]) => {
      const params = types?.length ? `?_type=${types.join(",")}` : "";
      const res = await axiosInstance.get(`/api/fhir/r4/$export${params}`);
      return res.data;
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchStats();
    if (selectedType) await refetchBrowse();
    setRefreshing(false);
  }, [refetchStats, refetchBrowse, selectedType]);

  const handleExport = useCallback(async () => {
    if (!checkFeature("bulk_export")) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await exportMutation.mutateAsync(undefined);
      Alert.alert(
        "Export Complete",
        `Exported ${result.total} FHIR resources as a Bundle.`,
      );
    } catch {
      Alert.alert("Export Failed", "Unable to export FHIR data. Please try again.");
    }
  }, [exportMutation, checkFeature]);

  const handleBrowseType = useCallback((type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(type);
    setActiveTab("browse");
  }, []);

  const handleViewResource = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResourceDetailId(id);
    setDetailModalVisible(true);
  }, []);

  const selectedResource = browseData?.entry?.find(e => e.resource?.id === resourceDetailId)?.resource;

  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "browse":
        return renderBrowse();
      case "import":
        return renderImportExport();
      default:
        return null;
    }
  };

  const renderOverview = () => {
    if (statsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={styles.loadingText}>Loading FHIR stats...</ThemedText>
        </View>
      );
    }

    if (!stats) {
      return (
        <View style={styles.emptyContainer}>
          <Feather name="database" size={40} color={theme.textSecondary} />
          <ThemedText style={styles.emptyText}>No FHIR data available</ThemedText>
        </View>
      );
    }

    const typeEntries = Object.entries(stats.resourceTypes).sort((a, b) => b[1] - a[1]);

    return (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: theme.primary }]}>
                  {stats.totalResources}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Total Resources</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: "#10b981" }]}>
                  {Object.keys(stats.resourceTypes).length}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Resource Types</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: "#8b5cf6" }]}>
                  {stats.fhirVersion}
                </ThemedText>
                <ThemedText style={styles.statLabel}>FHIR Version</ThemedText>
              </View>
            </View>
            {stats.lastSync ? (
              <View style={[styles.syncBadge, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="check-circle" size={14} color={theme.primary} />
                <ThemedText style={[styles.syncText, { color: theme.primary }]}>
                  Last synced {new Date(stats.lastSync).toLocaleDateString()}
                </ThemedText>
              </View>
            ) : null}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)}>
          <ThemedText style={styles.sectionTitle}>Resource Breakdown</ThemedText>
          {typeEntries.length > 0 ? (
            typeEntries.map(([type, count]) => (
              <Pressable
                key={type}
                onPress={() => handleBrowseType(type)}
                testID={`resource-type-${type}`}
              >
                <Card style={styles.resourceTypeCard}>
                  <View style={styles.resourceTypeRow}>
                    <View style={[styles.resourceIcon, { backgroundColor: (RESOURCE_COLORS[type] || "#6b7280") + "20" }]}>
                      <Feather
                        name={RESOURCE_ICONS[type] || "box"}
                        size={18}
                        color={RESOURCE_COLORS[type] || "#6b7280"}
                      />
                    </View>
                    <View style={styles.resourceTypeInfo}>
                      <ThemedText style={styles.resourceTypeName}>{type}</ThemedText>
                      <ThemedText style={styles.resourceTypeCount}>{count} record{count !== 1 ? "s" : ""}</ThemedText>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </View>
                </Card>
              </Pressable>
            ))
          ) : (
            <Card style={styles.resourceTypeCard}>
              <ThemedText style={styles.emptyText}>No resources found. Connect a data source or import FHIR data.</ThemedText>
            </Card>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)}>
          <ThemedText style={styles.sectionTitle}>Supported USCDI V3 Types</ThemedText>
          <Card style={styles.supportedTypesCard}>
            <View style={styles.chipContainer}>
              {stats.supportedTypes.map(type => (
                <View
                  key={type}
                  style={[styles.typeChip, { backgroundColor: (RESOURCE_COLORS[type] || "#6b7280") + "15", borderColor: (RESOURCE_COLORS[type] || "#6b7280") + "40" }]}
                >
                  <Feather name={RESOURCE_ICONS[type] || "box"} size={12} color={RESOURCE_COLORS[type] || "#6b7280"} />
                  <ThemedText style={[styles.typeChipText, { color: RESOURCE_COLORS[type] || "#6b7280" }]}>{type}</ThemedText>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    );
  };

  const renderBrowse = () => {
    if (!selectedType) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <ThemedText style={styles.sectionTitle}>Select Resource Type</ThemedText>
          {(stats?.supportedTypes || []).map(type => (
            <Pressable key={type} onPress={() => handleBrowseType(type)} testID={`browse-type-${type}`}>
              <Card style={styles.resourceTypeCard}>
                <View style={styles.resourceTypeRow}>
                  <View style={[styles.resourceIcon, { backgroundColor: (RESOURCE_COLORS[type] || "#6b7280") + "20" }]}>
                    <Feather name={RESOURCE_ICONS[type] || "box"} size={18} color={RESOURCE_COLORS[type] || "#6b7280"} />
                  </View>
                  <View style={styles.resourceTypeInfo}>
                    <ThemedText style={styles.resourceTypeName}>{type}</ThemedText>
                    <ThemedText style={styles.resourceTypeCount}>
                      {stats?.resourceTypes[type] || 0} record{(stats?.resourceTypes[type] || 0) !== 1 ? "s" : ""}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </View>
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      );
    }

    if (browseLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={styles.loadingText}>Searching {selectedType} resources...</ThemedText>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.browseHeader}>
          <Pressable onPress={() => setSelectedType(null)} style={styles.backButton}>
            <Feather name="arrow-left" size={18} color={theme.primary} />
            <ThemedText style={[styles.backText, { color: theme.primary }]}>All Types</ThemedText>
          </Pressable>
          <View style={[styles.browseTypeBadge, { backgroundColor: (RESOURCE_COLORS[selectedType] || "#6b7280") + "20" }]}>
            <Feather name={RESOURCE_ICONS[selectedType] || "box"} size={14} color={RESOURCE_COLORS[selectedType] || "#6b7280"} />
            <ThemedText style={[styles.browseTypeText, { color: RESOURCE_COLORS[selectedType] || "#6b7280" }]}>
              {selectedType} ({browseData?.total || 0})
            </ThemedText>
          </View>
        </View>

        <FlatList
          data={browseData?.entry || []}
          keyExtractor={(item, index) => item.resource?.id || `entry-${index}`}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl, paddingHorizontal: Spacing.lg }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={40} color={theme.textSecondary} />
              <ThemedText style={styles.emptyText}>No {selectedType} resources found</ThemedText>
            </View>
          }
          renderItem={({ item, index }) => {
            const resource = item.resource;
            if (!resource) return null;
            const color = RESOURCE_COLORS[resource.resourceType] || "#6b7280";
            return (
              <Animated.View entering={FadeInDown.delay(index * 50)}>
                <Pressable onPress={() => handleViewResource(resource.id || "")} testID={`resource-${resource.id}`}>
                  <Card style={styles.resourceCard}>
                    <View style={styles.resourceCardRow}>
                      <View style={[styles.resourceIcon, { backgroundColor: color + "20" }]}>
                        <Feather name={RESOURCE_ICONS[resource.resourceType] || "box"} size={16} color={color} />
                      </View>
                      <View style={styles.resourceCardInfo}>
                        <ThemedText style={styles.resourceCardTitle} numberOfLines={1}>
                          {getResourceTitle(resource)}
                        </ThemedText>
                        <ThemedText style={styles.resourceCardMeta}>
                          {resource.meta?.lastUpdated ? new Date(resource.meta.lastUpdated).toLocaleDateString() : "No date"}
                        </ThemedText>
                      </View>
                      <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                    </View>
                  </Card>
                </Pressable>
              </Animated.View>
            );
          }}
        />
      </View>
    );
  };

  const renderImportExport = () => {
    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Animated.View entering={FadeInDown.delay(100)}>
          <ThemedText style={styles.sectionTitle}>Export FHIR Data</ThemedText>
          <Card style={styles.actionCard}>
            <View style={styles.actionCardContent}>
              <View style={[styles.actionIcon, { backgroundColor: "#3b82f620" }]}>
                <Feather name="upload" size={24} color="#3b82f6" />
              </View>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitle}>Export All Resources</ThemedText>
                <ThemedText style={styles.actionDesc}>
                  Download your complete health record as a FHIR R4 Bundle in JSON format
                </ThemedText>
              </View>
            </View>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={handleExport}
              testID="button-export-all"
            >
              {exportMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="download" size={16} color="#fff" />
                  <ThemedText style={styles.actionButtonText}>Export Bundle</ThemedText>
                </>
              )}
            </Pressable>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200)}>
          <ThemedText style={styles.sectionTitle}>Import FHIR Data</ThemedText>
          <Card style={styles.actionCard}>
            <View style={styles.actionCardContent}>
              <View style={[styles.actionIcon, { backgroundColor: "#10b98120" }]}>
                <Feather name="download" size={24} color="#10b981" />
              </View>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitle}>Import FHIR Bundle</ThemedText>
                <ThemedText style={styles.actionDesc}>
                  Import health records from other systems via standard FHIR R4 Bundle format
                </ThemedText>
              </View>
            </View>
            <View style={[styles.importNote, { backgroundColor: theme.primary + "08" }]}>
              <Feather name="info" size={14} color={theme.textSecondary} />
              <ThemedText style={styles.importNoteText}>
                Use the FHIR R4 API endpoint POST /api/fhir/r4/Bundle to import resources programmatically
              </ThemedText>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)}>
          <ThemedText style={styles.sectionTitle}>API Information</ThemedText>
          <Card style={styles.actionCard}>
            <View style={styles.apiInfoRow}>
              <ThemedText style={styles.apiLabel}>Base URL</ThemedText>
              <ThemedText style={styles.apiValue}>/api/fhir/r4</ThemedText>
            </View>
            <View style={styles.apiInfoRow}>
              <ThemedText style={styles.apiLabel}>FHIR Version</ThemedText>
              <ThemedText style={styles.apiValue}>R4 (4.0.1)</ThemedText>
            </View>
            <View style={styles.apiInfoRow}>
              <ThemedText style={styles.apiLabel}>Profiles</ThemedText>
              <ThemedText style={styles.apiValue}>US Core 6.1.0</ThemedText>
            </View>
            <View style={styles.apiInfoRow}>
              <ThemedText style={styles.apiLabel}>Data Standard</ThemedText>
              <ThemedText style={styles.apiValue}>USCDI V3</ThemedText>
            </View>
            <View style={[styles.apiInfoRow, { borderBottomWidth: 0 }]}>
              <ThemedText style={styles.apiLabel}>Auth</ThemedText>
              <ThemedText style={styles.apiValue}>x-user-id header</ThemedText>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)}>
          <ThemedText style={styles.sectionTitle}>Available Endpoints</ThemedText>
          {[
            { method: "GET", path: "/metadata", desc: "Capability statement" },
            { method: "GET", path: "/:type", desc: "Search resources" },
            { method: "GET", path: "/:type/:id", desc: "Read resource" },
            { method: "POST", path: "/:type", desc: "Create resource" },
            { method: "PUT", path: "/:type/:id", desc: "Update resource" },
            { method: "POST", path: "/Bundle", desc: "Import bundle" },
            { method: "GET", path: "/$export", desc: "Export all data" },
            { method: "POST", path: "/$validate", desc: "Validate resource" },
          ].map((ep, idx) => (
            <Card key={idx} style={styles.endpointCard}>
              <View style={styles.endpointRow}>
                <View style={[styles.methodBadge, {
                  backgroundColor: ep.method === "GET" ? "#10b98120" : ep.method === "POST" ? "#3b82f620" : "#f59e0b20",
                }]}>
                  <ThemedText style={[styles.methodText, {
                    color: ep.method === "GET" ? "#10b981" : ep.method === "POST" ? "#3b82f6" : "#f59e0b",
                  }]}>{ep.method}</ThemedText>
                </View>
                <View style={styles.endpointInfo}>
                  <ThemedText style={styles.endpointPath}>{ep.path}</ThemedText>
                  <ThemedText style={styles.endpointDesc}>{ep.desc}</ThemedText>
                </View>
              </View>
            </Card>
          ))}
        </Animated.View>
      </ScrollView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.sm }]}>
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key
                  ? [styles.tabActive, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]
                  : { borderColor: "transparent" },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.key);
              }}
              testID={`tab-${tab.key}`}
            >
              <Feather
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === tab.key ? { color: theme.primary, fontWeight: "600" } : {},
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          {renderTab()}
        </View>
      </View>

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>
              {selectedResource ? getResourceTitle(selectedResource) : "Resource Detail"}
            </ThemedText>
            <Pressable onPress={() => setDetailModalVisible(false)} testID="button-close-detail">
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {selectedResource ? (
              <>
                <View style={[styles.detailBadge, { backgroundColor: (RESOURCE_COLORS[selectedResource.resourceType] || "#6b7280") + "15" }]}>
                  <Feather
                    name={RESOURCE_ICONS[selectedResource.resourceType] || "box"}
                    size={16}
                    color={RESOURCE_COLORS[selectedResource.resourceType] || "#6b7280"}
                  />
                  <ThemedText style={[styles.detailBadgeText, { color: RESOURCE_COLORS[selectedResource.resourceType] || "#6b7280" }]}>
                    {selectedResource.resourceType}
                  </ThemedText>
                </View>
                <Card style={styles.jsonCard}>
                  <ThemedText style={styles.jsonText}>
                    {JSON.stringify(selectedResource, null, 2)}
                  </ThemedText>
                </Card>
              </>
            ) : (
              <ThemedText>No resource selected</ThemedText>
            )}
          </ScrollView>
        </ThemedView>
      </Modal>

      <UpgradePrompt {...promptProps} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    gap: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
  },
  tabActive: {},
  tabText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    paddingVertical: Spacing["4xl"],
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  statsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: 6,
  },
  syncText: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  resourceTypeCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  resourceTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  resourceIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  resourceTypeInfo: {
    flex: 1,
  },
  resourceTypeName: {
    fontSize: 15,
    fontWeight: "600",
  },
  resourceTypeCount: {
    fontSize: 12,
    marginTop: 2,
  },
  supportedTypesCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  browseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "500",
  },
  browseTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  browseTypeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  resourceCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  resourceCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  resourceCardInfo: {
    flex: 1,
  },
  resourceCardTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  resourceCardMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  actionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  actionCardContent: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionDesc: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  importNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  importNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  apiInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb30",
  },
  apiLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  apiValue: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  endpointCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  endpointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  methodBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    minWidth: 48,
    alignItems: "center",
  },
  methodText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  endpointInfo: {
    flex: 1,
  },
  endpointPath: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  endpointDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    paddingTop: Spacing["2xl"],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb30",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalContent: {
    padding: Spacing.lg,
  },
  detailBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
    marginBottom: Spacing.md,
  },
  detailBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  jsonCard: {
    padding: Spacing.md,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 16,
  },
});
