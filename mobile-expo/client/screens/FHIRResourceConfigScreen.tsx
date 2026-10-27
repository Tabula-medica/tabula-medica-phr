import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type RouteProps = RouteProp<ProfileStackParamList, "FHIRResourceConfig">;

interface ResourceConfig {
  resourceType: string;
  category: string;
  description: string;
  enabled: boolean;
  syncDirection: string;
  validationProfile: string | null;
  validationMode: string;
  priority: number;
  mappingToRecordType: string | null;
  lastSyncCount: number;
  lastSyncAt: string | null;
  configured: boolean;
}

interface SupportedResourcesResponse {
  resources: Array<{
    type: string;
    category: string;
    description: string;
    defaultEnabled: boolean;
  }>;
  profiles: Array<{
    id: string;
    name: string;
    description: string;
    region: string;
  }>;
}

const CATEGORIES = [
  { id: "clinical", label: "Clinical", icon: "heart" },
  { id: "medication", label: "Medications", icon: "plus-circle" },
  { id: "administrative", label: "Administrative", icon: "briefcase" },
  { id: "diagnostic", label: "Diagnostic", icon: "activity" },
  { id: "document", label: "Documents", icon: "file-text" },
  { id: "financial", label: "Financial", icon: "credit-card" },
  { id: "privacy", label: "Privacy", icon: "shield" },
  { id: "workflow", label: "Workflow", icon: "git-branch" },
] as const;

const VALIDATION_MODES = [
  { value: "strict", label: "Strict", description: "Block invalid resources" },
  { value: "warning", label: "Warning", description: "Log warnings but import" },
  { value: "skip", label: "Skip", description: "No validation" },
];

const SYNC_DIRECTIONS = [
  { value: "import", label: "Import Only" },
  { value: "export", label: "Export Only" },
  { value: "bidirectional", label: "Bidirectional" },
];

export default function FHIRResourceConfigScreen() {
  const route = useRoute<RouteProps>();
  const { sourceId, sourceName } = route.params;
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  
  const colorScheme = isDark ? "dark" : "light";
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceConfig | null>(null);
  const [localConfigs, setLocalConfigs] = useState<Map<string, Partial<ResourceConfig>>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  const { data: supportedResources } = useQuery<SupportedResourcesResponse>({
    queryKey: ["/api/fhir/supported-resources"],
  });

  const { data: resourceConfigs, isLoading } = useQuery<ResourceConfig[]>({
    queryKey: [`/api/fhir-connections/${sourceId}/resource-configs`],
  });

  const updateConfigsMutation = useMutation({
    mutationFn: async (configs: Array<{ resourceType: string; enabled: boolean; validationProfile?: string | null }>) => {
      return apiRequest("PUT", `/api/fhir-connections/${sourceId}/resource-configs`, { configs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fhir-connections/${sourceId}/resource-configs`] });
      setLocalConfigs(new Map());
      setHasChanges(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const getEffectiveConfig = useCallback((config: ResourceConfig): ResourceConfig => {
    const localOverrides = localConfigs.get(config.resourceType);
    if (localOverrides) {
      return { ...config, ...localOverrides };
    }
    return config;
  }, [localConfigs]);

  const toggleResource = useCallback((resourceType: string, currentEnabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newConfigs = new Map(localConfigs);
    const current = newConfigs.get(resourceType) || {};
    newConfigs.set(resourceType, { ...current, enabled: !currentEnabled });
    setLocalConfigs(newConfigs);
    setHasChanges(true);
  }, [localConfigs]);

  const openConfigModal = useCallback((config: ResourceConfig) => {
    setSelectedResource(getEffectiveConfig(config));
    setConfigModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [getEffectiveConfig]);

  const saveResourceConfig = useCallback((updates: Partial<ResourceConfig>) => {
    if (!selectedResource) return;
    
    const newConfigs = new Map(localConfigs);
    newConfigs.set(selectedResource.resourceType, {
      ...newConfigs.get(selectedResource.resourceType),
      ...updates,
    });
    setLocalConfigs(newConfigs);
    setHasChanges(true);
    setConfigModalVisible(false);
  }, [localConfigs, selectedResource]);

  const saveAllChanges = useCallback(async () => {
    if (!resourceConfigs) return;
    
    const configsToSave = resourceConfigs.map(config => {
      const local = localConfigs.get(config.resourceType);
      return {
        resourceType: config.resourceType,
        enabled: local?.enabled ?? config.enabled,
        validationProfile: local?.validationProfile ?? config.validationProfile,
        validationMode: local?.validationMode ?? config.validationMode,
        syncDirection: local?.syncDirection ?? config.syncDirection,
      };
    });
    
    await updateConfigsMutation.mutateAsync(configsToSave);
  }, [resourceConfigs, localConfigs, updateConfigsMutation]);

  const filteredConfigs = useMemo(() => {
    if (!resourceConfigs) return [];
    if (!selectedCategory) return resourceConfigs;
    return resourceConfigs.filter(c => c.category === selectedCategory);
  }, [resourceConfigs, selectedCategory]);

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    const cat = CATEGORIES.find(c => c.id === category);
    return (cat?.icon || "circle") as keyof typeof Feather.glyphMap;
  };

  const getEnabledCount = useCallback((category: string | null) => {
    if (!resourceConfigs) return { enabled: 0, total: 0 };
    const filtered = category 
      ? resourceConfigs.filter(c => c.category === category)
      : resourceConfigs;
    const enabledConfigs = filtered.map(c => getEffectiveConfig(c));
    return {
      enabled: enabledConfigs.filter(c => c.enabled).length,
      total: filtered.length,
    };
  }, [resourceConfigs, getEffectiveConfig]);

  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme].primary} />
          <ThemedText style={styles.loadingText}>Loading resource configuration...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const totalStats = getEnabledCount(null);

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.md }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View style={styles.headerInfo}>
            <ThemedText style={styles.title}>Resource Sync Settings</ThemedText>
            <ThemedText style={styles.subtitle}>
              Configure which FHIR resources to sync from {sourceName}
            </ThemedText>
          </View>
          
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{totalStats.enabled}</ThemedText>
              <ThemedText style={styles.statLabel}>Enabled</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{totalStats.total}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Types</ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            <Pressable
              style={[
                styles.categoryChip,
                selectedCategory === null && styles.categoryChipActive,
              ]}
              onPress={() => {
                setSelectedCategory(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather 
                name="grid" 
                size={16} 
                color={selectedCategory === null ? "#fff" : Colors[colorScheme].text} 
              />
              <ThemedText style={[
                styles.categoryLabel,
                selectedCategory === null && styles.categoryLabelActive,
              ]}>
                All ({totalStats.enabled}/{totalStats.total})
              </ThemedText>
            </Pressable>
            {CATEGORIES.map(category => {
              const stats = getEnabledCount(category.id);
              return (
                <Pressable
                  key={category.id}
                  style={[
                    styles.categoryChip,
                    selectedCategory === category.id && styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Feather 
                    name={category.icon as keyof typeof Feather.glyphMap} 
                    size={16} 
                    color={selectedCategory === category.id ? "#fff" : Colors[colorScheme].text} 
                  />
                  <ThemedText style={[
                    styles.categoryLabel,
                    selectedCategory === category.id && styles.categoryLabelActive,
                  ]}>
                    {category.label} ({stats.enabled}/{stats.total})
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Resource Types {selectedCategory ? `- ${CATEGORIES.find(c => c.id === selectedCategory)?.label}` : ""}
          </ThemedText>
          
          <View style={styles.resourceList}>
            {filteredConfigs.map((config, index) => {
              const effectiveConfig = getEffectiveConfig(config);
              return (
                <Animated.View
                  key={config.resourceType}
                  entering={FadeInDown.duration(200).delay(50 * Math.min(index, 10))}
                >
                  <Pressable 
                    style={styles.resourceCard}
                    onPress={() => openConfigModal(config)}
                  >
                    <View style={styles.resourceHeader}>
                      <View style={styles.resourceInfo}>
                        <View style={[styles.resourceIcon, effectiveConfig.enabled && styles.resourceIconEnabled]}>
                          <Feather 
                            name={getCategoryIcon(config.category)} 
                            size={18} 
                            color={effectiveConfig.enabled ? Colors[colorScheme].primary : Colors[colorScheme].textSecondary} 
                          />
                        </View>
                        <View style={styles.resourceTextContainer}>
                          <ThemedText style={styles.resourceType}>{config.resourceType}</ThemedText>
                          <ThemedText style={styles.resourceDescription}>{config.description}</ThemedText>
                        </View>
                      </View>
                      
                      <Switch
                        value={effectiveConfig.enabled}
                        onValueChange={() => toggleResource(config.resourceType, effectiveConfig.enabled)}
                        trackColor={{ false: Colors[colorScheme].border, true: Colors[colorScheme].primary }}
                        thumbColor="#fff"
                      />
                    </View>
                    
                    {effectiveConfig.enabled ? (
                      <View style={styles.resourceDetails}>
                        <View style={styles.detailBadge}>
                          <ThemedText style={styles.detailBadgeText}>
                            {effectiveConfig.syncDirection === "import" ? "Import" : 
                             effectiveConfig.syncDirection === "export" ? "Export" : "Bidirectional"}
                          </ThemedText>
                        </View>
                        {effectiveConfig.validationProfile ? (
                          <View style={[styles.detailBadge, styles.profileBadge]}>
                            <ThemedText style={styles.detailBadgeText}>{effectiveConfig.validationProfile}</ThemedText>
                          </View>
                        ) : null}
                        {effectiveConfig.lastSyncCount > 0 ? (
                          <ThemedText style={styles.lastSyncText}>
                            {effectiveConfig.lastSyncCount} records synced
                          </ThemedText>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {hasChanges ? (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.saveBar, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            style={styles.discardButton}
            onPress={() => {
              setLocalConfigs(new Map());
              setHasChanges(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <ThemedText style={styles.discardText}>Discard</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.saveButton, updateConfigsMutation.isPending && styles.saveButtonDisabled]}
            onPress={saveAllChanges}
            disabled={updateConfigsMutation.isPending}
          >
            {updateConfigsMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="check" size={18} color="#fff" />
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      <Modal
        visible={configModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <ResourceConfigModal
          resource={selectedResource}
          profiles={supportedResources?.profiles || []}
          onSave={saveResourceConfig}
          onClose={() => setConfigModalVisible(false)}
          colorScheme={colorScheme}
        />
      </Modal>
    </ThemedView>
  );
}

interface ResourceConfigModalProps {
  resource: ResourceConfig | null;
  profiles: Array<{ id: string; name: string; description: string; region: string }>;
  onSave: (updates: Partial<ResourceConfig>) => void;
  onClose: () => void;
  colorScheme: "light" | "dark";
}

function ResourceConfigModal({ resource, profiles, onSave, onClose, colorScheme }: ResourceConfigModalProps) {
  const [syncDirection, setSyncDirection] = useState(resource?.syncDirection || "import");
  const [validationProfile, setValidationProfile] = useState(resource?.validationProfile || null);
  const [validationMode, setValidationMode] = useState(resource?.validationMode || "warning");
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createModalStyles(colorScheme), [colorScheme]);

  if (!resource) return null;

  return (
    <View style={[styles.modalContainer, { paddingTop: insets.top + Spacing.md }]}>
      <View style={styles.modalHeader}>
        <ThemedText style={styles.modalTitle}>Configure {resource.resourceType}</ThemedText>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close resource configuration">
          <Feather name="x" size={24} color={Colors[colorScheme].text} />
        </Pressable>
      </View>

      <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
        <View style={styles.modalSection}>
          <ThemedText style={styles.modalSectionTitle}>Sync Direction</ThemedText>
          <View style={styles.optionList}>
            {SYNC_DIRECTIONS.map(option => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionButton,
                  syncDirection === option.value && styles.optionButtonActive,
                ]}
                onPress={() => {
                  setSyncDirection(option.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <ThemedText style={[
                  styles.optionLabel,
                  syncDirection === option.value && styles.optionLabelActive,
                ]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.modalSection}>
          <ThemedText style={styles.modalSectionTitle}>Validation Profile</ThemedText>
          <ThemedText style={styles.modalSectionDescription}>
            Apply standards-based validation during sync
          </ThemedText>
          <View style={styles.profileList}>
            <Pressable
              style={[
                styles.profileButton,
                validationProfile === null && styles.profileButtonActive,
              ]}
              onPress={() => {
                setValidationProfile(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <ThemedText style={[
                styles.profileName,
                validationProfile === null && styles.profileNameActive,
              ]}>
                None (Basic Validation)
              </ThemedText>
            </Pressable>
            {profiles.map(profile => (
              <Pressable
                key={profile.id}
                style={[
                  styles.profileButton,
                  validationProfile === profile.id && styles.profileButtonActive,
                ]}
                onPress={() => {
                  setValidationProfile(profile.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.profileInfo}>
                  <ThemedText style={[
                    styles.profileName,
                    validationProfile === profile.id && styles.profileNameActive,
                  ]}>
                    {profile.name}
                  </ThemedText>
                  <ThemedText style={styles.profileDescription}>{profile.description}</ThemedText>
                </View>
                <View style={styles.profileRegion}>
                  <Feather name="globe" size={12} color={Colors[colorScheme].textSecondary} />
                  <ThemedText style={styles.profileRegionText}>{profile.region}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.modalSection}>
          <ThemedText style={styles.modalSectionTitle}>Validation Mode</ThemedText>
          <View style={styles.optionList}>
            {VALIDATION_MODES.map(option => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionButton,
                  validationMode === option.value && styles.optionButtonActive,
                ]}
                onPress={() => {
                  setValidationMode(option.value);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <ThemedText style={[
                  styles.optionLabel,
                  validationMode === option.value && styles.optionLabelActive,
                ]}>
                  {option.label}
                </ThemedText>
                <ThemedText style={styles.optionDescription}>{option.description}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.modalFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable style={styles.cancelButton} onPress={onClose}>
          <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          style={styles.applyButton}
          onPress={() => {
            onSave({
              syncDirection,
              validationProfile,
              validationMode,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <ThemedText style={styles.applyButtonText}>Apply</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: "light" | "dark") =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors[theme].backgroundDefault,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      marginTop: Spacing.md,
      color: Colors[theme].textSecondary,
    },
    header: {
      marginBottom: Spacing.lg,
    },
    headerInfo: {
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      marginBottom: Spacing.xs,
    },
    subtitle: {
      fontSize: 14,
      color: Colors[theme].textSecondary,
    },
    statsCard: {
      flexDirection: "row",
      backgroundColor: Colors[theme].backgroundSecondary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    statItem: {
      flex: 1,
      alignItems: "center",
    },
    statDivider: {
      width: 1,
      height: 40,
      backgroundColor: Colors[theme].border,
    },
    statValue: {
      fontSize: 32,
      fontWeight: "700",
      color: Colors[theme].primary,
    },
    statLabel: {
      fontSize: 12,
      color: Colors[theme].textSecondary,
      marginTop: Spacing.xs,
    },
    section: {
      marginBottom: Spacing.xl,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: Spacing.md,
    },
    categoryScroll: {
      paddingVertical: Spacing.xs,
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: Colors[theme].backgroundSecondary,
      borderRadius: BorderRadius.full,
      marginRight: Spacing.sm,
      gap: Spacing.xs,
    },
    categoryChipActive: {
      backgroundColor: Colors[theme].primary,
    },
    categoryLabel: {
      fontSize: 13,
      fontWeight: "500",
    },
    categoryLabelActive: {
      color: "#fff",
    },
    resourceList: {
      gap: Spacing.md,
    },
    resourceCard: {
      backgroundColor: Colors[theme].backgroundSecondary,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    resourceHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    resourceInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    resourceIcon: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.md,
      backgroundColor: Colors[theme].backgroundDefault,
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    resourceIconEnabled: {
      backgroundColor: `${Colors[theme].primary}15`,
    },
    resourceTextContainer: {
      flex: 1,
    },
    resourceType: {
      fontSize: 15,
      fontWeight: "600",
    },
    resourceDescription: {
      fontSize: 12,
      color: Colors[theme].textSecondary,
      marginTop: 2,
    },
    resourceDetails: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: Colors[theme].border,
      gap: Spacing.sm,
    },
    detailBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      backgroundColor: Colors[theme].backgroundDefault,
      borderRadius: BorderRadius.sm,
    },
    profileBadge: {
      backgroundColor: `${Colors[theme].primary}15`,
    },
    detailBadgeText: {
      fontSize: 11,
      fontWeight: "500",
      color: Colors[theme].textSecondary,
    },
    lastSyncText: {
      fontSize: 11,
      color: Colors[theme].textSecondary,
      marginLeft: "auto",
    },
    saveBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      padding: Spacing.md,
      backgroundColor: Colors[theme].backgroundSecondary,
      borderTopWidth: 1,
      borderTopColor: Colors[theme].border,
      gap: Spacing.md,
    },
    discardButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors[theme].border,
    },
    discardText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors[theme].textSecondary,
    },
    saveButton: {
      flex: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
      backgroundColor: Colors[theme].primary,
      borderRadius: BorderRadius.md,
      gap: Spacing.xs,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
  });

const createModalStyles = (theme: "light" | "dark") =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: Colors[theme].backgroundDefault,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: Colors[theme].border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
    },
    closeButton: {
      padding: Spacing.xs,
    },
    modalContent: {
      flex: 1,
    },
    modalScrollContent: {
      padding: Spacing.lg,
    },
    modalSection: {
      marginBottom: Spacing.xl,
    },
    modalSectionTitle: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: Spacing.xs,
    },
    modalSectionDescription: {
      fontSize: 13,
      color: Colors[theme].textSecondary,
      marginBottom: Spacing.md,
    },
    optionList: {
      gap: Spacing.sm,
    },
    optionButton: {
      padding: Spacing.md,
      backgroundColor: Colors[theme].backgroundSecondary,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors[theme].border,
    },
    optionButtonActive: {
      borderColor: Colors[theme].primary,
      backgroundColor: `${Colors[theme].primary}10`,
    },
    optionLabel: {
      fontSize: 14,
      fontWeight: "600",
    },
    optionLabelActive: {
      color: Colors[theme].primary,
    },
    optionDescription: {
      fontSize: 12,
      color: Colors[theme].textSecondary,
      marginTop: 4,
    },
    profileList: {
      gap: Spacing.sm,
    },
    profileButton: {
      padding: Spacing.md,
      backgroundColor: Colors[theme].backgroundSecondary,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors[theme].border,
    },
    profileButtonActive: {
      borderColor: Colors[theme].primary,
      backgroundColor: `${Colors[theme].primary}10`,
    },
    profileInfo: {
      marginBottom: Spacing.xs,
    },
    profileName: {
      fontSize: 14,
      fontWeight: "600",
    },
    profileNameActive: {
      color: Colors[theme].primary,
    },
    profileDescription: {
      fontSize: 12,
      color: Colors[theme].textSecondary,
      marginTop: 2,
    },
    profileRegion: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    profileRegionText: {
      fontSize: 11,
      color: Colors[theme].textSecondary,
    },
    modalFooter: {
      flexDirection: "row",
      padding: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors[theme].border,
      gap: Spacing.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors[theme].border,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors[theme].textSecondary,
    },
    applyButton: {
      flex: 2,
      paddingVertical: Spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors[theme].primary,
      borderRadius: BorderRadius.md,
    },
    applyButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
  });
