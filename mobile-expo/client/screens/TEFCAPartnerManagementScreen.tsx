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
  TextInput,
  Switch,
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
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuthContext } from "@/context/AuthContext";

interface PartnerEndpoint {
  name: string;
  baseUrl: string;
  fhirVersion: string;
  authMethod: string;
  status: string;
  capabilities: string[];
  lastHealthCheck: string;
}

interface Partner {
  id: string;
  name: string;
  type: "qhin" | "hie" | "participant";
  status: "active" | "pending" | "suspended";
  supportedExchangePurposes: string[];
  organizationCount: number;
  endpoints: PartnerEndpoint[];
  isBuiltIn: boolean;
  supportedUscdiVersions: string[];
  connectionDate?: string;
}

interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  details: {
    endpointReachable: boolean;
    authValid: boolean;
    fhirCapable: boolean;
    uscdiCompliant: boolean;
  };
  error?: string;
}

interface Onboarding {
  id: string;
  partnerName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  partnerType: "qhin" | "hie" | "participant";
  apiKey: string;
  onboardingToken: string;
  status: "invited" | "submitted" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
  fhirEndpoint: string | null;
  authMethod: string | null;
  testResult: ConnectionTestResult | null;
}

type TabKey = "partners" | "register" | "onboard";

const USCDI_VERSIONS = ["v1", "v2", "v3", "v4", "v5", "v6"];
const PARTNER_TYPES: { value: string; label: string }[] = [
  { value: "qhin", label: "QHIN" },
  { value: "hie", label: "HIE" },
  { value: "participant", label: "Participant" },
];
const AUTH_METHODS: { value: string; label: string }[] = [
  { value: "OAuth2", label: "OAuth 2.0" },
  { value: "SMART", label: "SMART on FHIR" },
  { value: "mTLS", label: "Mutual TLS" },
];

function StatusBadge({ status, theme }: { status: string; theme: any }) {
  const color =
    status === "active" ? theme.success :
    status === "pending" ? theme.warning :
    status === "suspended" ? theme.error : theme.textSecondary;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <View style={[styles.statusBadge, { backgroundColor: color + "18" }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <ThemedText style={[styles.statusText, { color }]}>{label}</ThemedText>
    </View>
  );
}

function TypeBadge({ type, theme }: { type: string; theme: any }) {
  const color =
    type === "qhin" ? theme.primary :
    type === "hie" ? theme.info :
    theme.textSecondary;
  return (
    <View style={[styles.typeBadge, { backgroundColor: color + "14" }]}>
      <ThemedText style={[styles.typeText, { color }]}>{type.toUpperCase()}</ThemedText>
    </View>
  );
}

function CheckItem({ label, passed, theme }: { label: string; passed: boolean; theme: any }) {
  return (
    <View style={styles.checkItem}>
      <Feather
        name={passed ? "check-circle" : "x-circle"}
        size={16}
        color={passed ? theme.success : theme.error}
      />
      <ThemedText style={[styles.checkLabel, { color: passed ? theme.text : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function TEFCAPartnerManagementScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<TabKey>("partners");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEndpoint, setFormEndpoint] = useState("");
  const [formType, setFormType] = useState("participant");
  const [formAuthMethod, setFormAuthMethod] = useState("OAuth2");
  const [selectedUscdiVersions, setSelectedUscdiVersions] = useState<string[]>(["v3"]);

  const partnersQuery = useQuery({
    queryKey: ["/api/tefca/partners"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers["x-user-id"] = user.id;
      }
      const res = await fetch(new URL("/api/tefca/partners", getApiUrl()).toString(), {
        headers,
      });
      if (!res.ok) throw new Error("Failed to load partners");
      return res.json() as Promise<{ partners: Partner[]; stats: any }>;
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tefca/partners", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners"] });
      resetForm();
      setActiveTab("partners");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const testMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      setTestingId(partnerId);
      const res = await apiRequest("POST", `/api/tefca/partners/${partnerId}/test`);
      return res.json() as Promise<ConnectionTestResult>;
    },
    onSuccess: (result) => {
      setTestResult(result);
      setTestingId(null);
      Haptics.notificationAsync(
        result.success
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    },
    onError: () => {
      setTestingId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ partnerId, enabled }: { partnerId: string; enabled: boolean }) => {
      setTogglingId(partnerId);
      const res = await apiRequest("PATCH", `/api/tefca/partners/${partnerId}/status`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners"] });
      setTogglingId(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    onError: () => {
      setTogglingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const res = await apiRequest("DELETE", `/api/tefca/partners/${partnerId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners"] });
      setSelectedPartner(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const [obName, setObName] = useState("");
  const [obContact, setObContact] = useState("");
  const [obPhone, setObPhone] = useState("");
  const [obEmail, setObEmail] = useState("");
  const [obType, setObType] = useState("participant");
  const [showOnboardResult, setShowOnboardResult] = useState<Onboarding | null>(null);

  const onboardingsQuery = useQuery({
    queryKey: ["/api/tefca/partners/onboard"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers["x-user-id"] = user.id;
      }
      const res = await fetch(new URL("/api/tefca/partners/onboard", getApiUrl()).toString(), {
        headers,
      });
      if (!res.ok) throw new Error("Failed to load onboardings");
      return res.json() as Promise<{ onboardings: Onboarding[] }>;
    },
    enabled: activeTab === "onboard",
  });

  const initiateOnboardMutation = useMutation({
    mutationFn: async (data: { partnerName: string; contactName: string; contactPhone: string; contactEmail: string; partnerType: string }) => {
      const res = await apiRequest("POST", "/api/tefca/partners/onboard", data);
      return res.json() as Promise<{ onboarding: Onboarding; message: string; smsSent: boolean }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners/onboard"] });
      setShowOnboardResult(result.onboarding);
      setObName(""); setObContact(""); setObPhone(""); setObEmail(""); setObType("participant");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const deleteOnboardMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/tefca/partners/onboard/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners/onboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleInitiateOnboard = useCallback(() => {
    if (!obName.trim() || !obContact.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    initiateOnboardMutation.mutate({
      partnerName: obName.trim(),
      contactName: obContact.trim(),
      contactPhone: obPhone.trim(),
      contactEmail: obEmail.trim(),
      partnerType: obType,
    });
  }, [obName, obContact, obPhone, obEmail, obType]);

  const isObFormValid = obName.trim() && obContact.trim();

  const resetForm = useCallback(() => {
    setFormId("");
    setFormName("");
    setFormEndpoint("");
    setFormType("participant");
    setFormAuthMethod("OAuth2");
    setSelectedUscdiVersions(["v3"]);
  }, []);

  const toggleUscdiVersion = useCallback((version: string) => {
    setSelectedUscdiVersions(prev =>
      prev.includes(version)
        ? prev.filter(v => v !== version)
        : [...prev, version]
    );
  }, []);

  const handleRegister = useCallback(() => {
    if (!formId.trim() || !formName.trim() || !formEndpoint.trim() || selectedUscdiVersions.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    registerMutation.mutate({
      id: formId.trim().toLowerCase().replace(/\s+/g, "-"),
      name: formName.trim(),
      endpointUrl: formEndpoint.trim(),
      supportedUscdiVersions: selectedUscdiVersions,
      type: formType,
      authMethod: formAuthMethod,
    });
  }, [formId, formName, formEndpoint, selectedUscdiVersions, formType, formAuthMethod]);

  const handleTestConnection = useCallback((partnerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTestResult(null);
    testMutation.mutate(partnerId);
  }, []);

  const handleToggle = useCallback((partnerId: string, currentlyActive: boolean) => {
    toggleMutation.mutate({ partnerId, enabled: !currentlyActive });
  }, []);

  const partners = partnersQuery.data?.partners || [];
  const stats = partnersQuery.data?.stats;
  const isFormValid = formId.trim() && formName.trim() && formEndpoint.trim() && selectedUscdiVersions.length > 0;

  const renderStatsBar = () => {
    if (!stats) return null;
    return (
      <Animated.View entering={FadeInDown.delay(100)}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.statValue, { color: theme.primary }]}>
              {partners.length}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total Partners
            </ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.statValue, { color: theme.success }]}>
              {partners.filter(p => p.status === "active").length}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Active
            </ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.statValue, { color: theme.warning }]}>
              {partners.filter(p => p.status === "pending").length}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Pending
            </ThemedText>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {([
        { key: "partners" as TabKey, label: "Partners", icon: "globe" as const },
        { key: "onboard" as TabKey, label: "Onboard", icon: "user-plus" as const },
        { key: "register" as TabKey, label: "Register", icon: "plus-circle" as const },
      ]).map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            testID={`tab-${tab.key}`}
            style={[
              styles.tab,
              { backgroundColor: isActive ? theme.primary + "18" : "transparent" },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab.key);
            }}
          >
            <Feather name={tab.icon} size={16} color={isActive ? theme.primary : theme.textSecondary} />
            <ThemedText style={[styles.tabLabel, { color: isActive ? theme.primary : theme.textSecondary }]}>
              {tab.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  const renderPartnerCard = ({ item, index }: { item: Partner; index: number }) => {
    const endpoint = item.endpoints[0];
    const isToggling = togglingId === item.id;
    const isTesting = testingId === item.id;

    return (
      <Animated.View entering={FadeInDown.delay(index * 60)}>
        <Card style={styles.partnerCard} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setTestResult(null);
          setSelectedPartner(item);
        }}>
          <View style={styles.partnerHeader}>
            <View style={styles.partnerTitleRow}>
              <View style={[styles.partnerIcon, { backgroundColor: theme.primary + "14" }]}>
                <Feather
                  name={item.type === "qhin" ? "globe" : item.type === "hie" ? "share-2" : "server"}
                  size={18}
                  color={theme.primary}
                />
              </View>
              <View style={styles.partnerInfo}>
                <ThemedText style={styles.partnerName}>{item.name}</ThemedText>
                <View style={styles.badgeRow}>
                  <TypeBadge type={item.type} theme={theme} />
                  <StatusBadge status={item.status} theme={theme} />
                </View>
              </View>
            </View>
            <View style={styles.toggleArea}>
              {isToggling ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Switch
                  testID={`switch-partner-${item.id}`}
                  value={item.status === "active"}
                  onValueChange={() => handleToggle(item.id, item.status === "active")}
                  trackColor={{ false: theme.border, true: theme.success + "60" }}
                  thumbColor={item.status === "active" ? theme.success : theme.textSecondary}
                />
              )}
            </View>
          </View>

          {endpoint ? (
            <View style={[styles.endpointRow, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="link" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.endpointUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                {endpoint.baseUrl}
              </ThemedText>
              <ThemedText style={[styles.fhirBadge, { color: theme.info }]}>
                FHIR {endpoint.fhirVersion}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.partnerMeta}>
            <View style={styles.metaItem}>
              <Feather name="layers" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                USCDI {item.supportedUscdiVersions?.join(", ") || "v3"}
              </ThemedText>
            </View>
            {item.isBuiltIn ? (
              <View style={[styles.builtInBadge, { backgroundColor: theme.primary + "14" }]}>
                <ThemedText style={[styles.builtInText, { color: theme.primary }]}>Built-in</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              testID={`btn-test-${item.id}`}
              style={[styles.actionBtn, { backgroundColor: theme.info + "14" }]}
              onPress={(e) => {
                e.stopPropagation?.();
                handleTestConnection(item.id);
              }}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color={theme.info} />
              ) : (
                <>
                  <Feather name="wifi" size={14} color={theme.info} />
                  <ThemedText style={[styles.actionBtnText, { color: theme.info }]}>Test</ThemedText>
                </>
              )}
            </Pressable>
            {!item.isBuiltIn ? (
              <Pressable
                testID={`btn-delete-${item.id}`}
                style={[styles.actionBtn, { backgroundColor: theme.error + "14" }]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  deleteMutation.mutate(item.id);
                }}
              >
                <Feather name="trash-2" size={14} color={theme.error} />
                <ThemedText style={[styles.actionBtnText, { color: theme.error }]}>Remove</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderRegisterForm = () => (
    <ScrollView
      contentContainerStyle={[styles.formContainer, { paddingBottom: insets.bottom + Spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.delay(100)}>
        <Card style={styles.formCard}>
          <ThemedText style={styles.formTitle}>Register New QHIN Participant</ThemedText>
          <ThemedText style={[styles.formSubtitle, { color: theme.textSecondary }]}>
            Add a new partner to the TEFCA network for health data exchange.
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Partner ID</ThemedText>
            <TextInput
              testID="input-partner-id"
              style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., my-organization"
              placeholderTextColor={theme.textSecondary}
              value={formId}
              onChangeText={setFormId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Organization Name</ThemedText>
            <TextInput
              testID="input-partner-name"
              style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g., Acme Health Network"
              placeholderTextColor={theme.textSecondary}
              value={formName}
              onChangeText={setFormName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Endpoint URL</ThemedText>
            <TextInput
              testID="input-endpoint-url"
              style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="https://api.example.com/fhir/r4"
              placeholderTextColor={theme.textSecondary}
              value={formEndpoint}
              onChangeText={setFormEndpoint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Partner Type</ThemedText>
            <View style={styles.optionRow}>
              {PARTNER_TYPES.map(pt => (
                <Pressable
                  key={pt.value}
                  testID={`option-type-${pt.value}`}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: formType === pt.value ? theme.primary + "18" : theme.backgroundSecondary,
                      borderColor: formType === pt.value ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setFormType(pt.value)}
                >
                  <ThemedText style={[styles.optionChipText, { color: formType === pt.value ? theme.primary : theme.text }]}>
                    {pt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Authentication Method</ThemedText>
            <View style={styles.optionRow}>
              {AUTH_METHODS.map(am => (
                <Pressable
                  key={am.value}
                  testID={`option-auth-${am.value}`}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: formAuthMethod === am.value ? theme.info + "18" : theme.backgroundSecondary,
                      borderColor: formAuthMethod === am.value ? theme.info : theme.border,
                    },
                  ]}
                  onPress={() => setFormAuthMethod(am.value)}
                >
                  <ThemedText style={[styles.optionChipText, { color: formAuthMethod === am.value ? theme.info : theme.text }]}>
                    {am.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText style={styles.fieldLabel}>Supported USCDI Versions</ThemedText>
            <View style={styles.optionRow}>
              {USCDI_VERSIONS.map(version => {
                const isSelected = selectedUscdiVersions.includes(version);
                return (
                  <Pressable
                    key={version}
                    testID={`option-uscdi-${version}`}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: isSelected ? theme.success + "18" : theme.backgroundSecondary,
                        borderColor: isSelected ? theme.success : theme.border,
                      },
                    ]}
                    onPress={() => toggleUscdiVersion(version)}
                  >
                    <ThemedText style={[styles.optionChipText, { color: isSelected ? theme.success : theme.text }]}>
                      {version.toUpperCase()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {registerMutation.error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.error + "14" }]}>
              <Feather name="alert-circle" size={14} color={theme.error} />
              <ThemedText style={[styles.errorText, { color: theme.error }]}>
                {(registerMutation.error as any)?.message || "Registration failed. Please try again."}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            testID="btn-register-partner"
            style={[
              styles.registerBtn,
              { backgroundColor: isFormValid ? theme.primary : theme.border },
            ]}
            onPress={handleRegister}
            disabled={!isFormValid || registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="plus-circle" size={18} color="#fff" />
                <ThemedText style={styles.registerBtnText}>Register Partner</ThemedText>
              </>
            )}
          </Pressable>
        </Card>
      </Animated.View>
    </ScrollView>
  );

  const renderPartnerDetail = () => {
    if (!selectedPartner) return null;
    const endpoint = selectedPartner.endpoints[0];
    return (
      <Modal visible={!!selectedPartner} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{selectedPartner.name}</ThemedText>
              <Pressable
                testID="btn-close-detail"
                onPress={() => {
                  setSelectedPartner(null);
                  setTestResult(null);
                }}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Status</ThemedText>
                <StatusBadge status={selectedPartner.status} theme={theme} />
              </View>
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Type</ThemedText>
                <TypeBadge type={selectedPartner.type} theme={theme} />
              </View>
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Partner ID</ThemedText>
                <ThemedText style={styles.detailValue}>{selectedPartner.id}</ThemedText>
              </View>
              {endpoint ? (
                <>
                  <View style={styles.detailRow}>
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Endpoint</ThemedText>
                    <ThemedText style={[styles.detailValue, { fontSize: 12 }]} numberOfLines={2}>
                      {endpoint.baseUrl}
                    </ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>FHIR Version</ThemedText>
                    <ThemedText style={styles.detailValue}>{endpoint.fhirVersion}</ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Auth Method</ThemedText>
                    <ThemedText style={styles.detailValue}>{endpoint.authMethod}</ThemedText>
                  </View>
                </>
              ) : null}
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>USCDI Versions</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {selectedPartner.supportedUscdiVersions?.map(v => v.toUpperCase()).join(", ") || "V3"}
                </ThemedText>
              </View>
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Purposes</ThemedText>
                <ThemedText style={[styles.detailValue, { fontSize: 12 }]}>
                  {selectedPartner.supportedExchangePurposes.map(p => p.replace(/_/g, " ")).join(", ")}
                </ThemedText>
              </View>

              <Pressable
                testID="btn-test-detail"
                style={[styles.testBtn, { backgroundColor: theme.info + "18" }]}
                onPress={() => handleTestConnection(selectedPartner.id)}
                disabled={testingId === selectedPartner.id}
              >
                {testingId === selectedPartner.id ? (
                  <ActivityIndicator size="small" color={theme.info} />
                ) : (
                  <>
                    <Feather name="wifi" size={16} color={theme.info} />
                    <ThemedText style={[styles.testBtnText, { color: theme.info }]}>Test Connection</ThemedText>
                  </>
                )}
              </Pressable>

              {testResult ? (
                <View style={[
                  styles.testResultBox,
                  { backgroundColor: testResult.success ? theme.success + "14" : theme.error + "14" },
                ]}>
                  <View style={styles.testResultHeader}>
                    <Feather
                      name={testResult.success ? "check-circle" : "alert-circle"}
                      size={20}
                      color={testResult.success ? theme.success : theme.error}
                    />
                    <ThemedText style={[
                      styles.testResultTitle,
                      { color: testResult.success ? theme.success : theme.error },
                    ]}>
                      {testResult.success ? "Connection Successful" : "Connection Failed"}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.latencyDetail, { color: theme.textSecondary }]}>
                    Latency: {testResult.latencyMs}ms
                  </ThemedText>
                  {testResult.error ? (
                    <ThemedText style={[styles.testError, { color: theme.error }]}>
                      {testResult.error}
                    </ThemedText>
                  ) : null}
                  <View style={styles.checkList}>
                    <CheckItem label="Endpoint Reachable" passed={testResult.details.endpointReachable} theme={theme} />
                    <CheckItem label="Authentication Valid" passed={testResult.details.authValid} theme={theme} />
                    <CheckItem label="FHIR Capable" passed={testResult.details.fhirCapable} theme={theme} />
                    <CheckItem label="USCDI Compliant" passed={testResult.details.uscdiCompliant} theme={theme} />
                  </View>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable
                  testID="btn-toggle-detail"
                  style={[
                    styles.modalActionBtn,
                    {
                      backgroundColor: selectedPartner.status === "active"
                        ? theme.warning + "18"
                        : theme.success + "18",
                    },
                  ]}
                  onPress={() => {
                    handleToggle(selectedPartner.id, selectedPartner.status === "active");
                    setSelectedPartner({
                      ...selectedPartner,
                      status: selectedPartner.status === "active" ? "suspended" : "active",
                    });
                  }}
                >
                  <Feather
                    name={selectedPartner.status === "active" ? "pause-circle" : "play-circle"}
                    size={16}
                    color={selectedPartner.status === "active" ? theme.warning : theme.success}
                  />
                  <ThemedText style={[
                    styles.modalActionText,
                    { color: selectedPartner.status === "active" ? theme.warning : theme.success },
                  ]}>
                    {selectedPartner.status === "active" ? "Disable Partner" : "Enable Partner"}
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const getOnboardStatusColor = (status: string) => {
    switch (status) {
      case "completed": return theme.success;
      case "submitted": return theme.info;
      case "invited": return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const getOnboardStatusIcon = (status: string): "check-circle" | "upload" | "mail" | "clock" => {
    switch (status) {
      case "completed": return "check-circle";
      case "submitted": return "upload";
      case "invited": return "mail";
      default: return "clock";
    }
  };

  const renderOnboardCard = ({ item, index }: { item: Onboarding; index: number }) => {
    const statusColor = getOnboardStatusColor(item.status);
    return (
      <Animated.View entering={FadeInDown.delay(index * 60)}>
        <Card style={styles.partnerCard}>
          <View style={styles.partnerHeader}>
            <View style={styles.partnerTitleRow}>
              <View style={[styles.partnerIcon, { backgroundColor: statusColor + "14" }]}>
                <Feather name={getOnboardStatusIcon(item.status)} size={18} color={statusColor} />
              </View>
              <View style={styles.partnerInfo}>
                <ThemedText style={styles.partnerName}>{item.partnerName}</ThemedText>
                <View style={styles.badgeRow}>
                  <TypeBadge type={item.partnerType} theme={theme} />
                  <StatusBadge status={item.status} theme={theme} />
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.obDetailSection, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.obDetailRow}>
              <Feather name="user" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.obDetailText, { color: theme.textSecondary }]}>
                {item.contactName}
              </ThemedText>
            </View>
            {item.contactEmail ? (
              <View style={styles.obDetailRow}>
                <Feather name="mail" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.obDetailText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.contactEmail}
                </ThemedText>
              </View>
            ) : null}
            {item.contactPhone ? (
              <View style={styles.obDetailRow}>
                <Feather name="phone" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.obDetailText, { color: theme.textSecondary }]}>
                  {item.contactPhone}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={[styles.obDetailSection, { backgroundColor: theme.backgroundSecondary, marginTop: 6 }]}>
            <View style={styles.obDetailRow}>
              <Feather name="key" size={12} color={theme.info} />
              <ThemedText style={[styles.obDetailText, { color: theme.info, fontSize: 10, fontFamily: "monospace" }]} numberOfLines={1}>
                {item.apiKey.substring(0, 16)}...
              </ThemedText>
            </View>
            <View style={styles.obDetailRow}>
              <Feather name="hash" size={12} color={theme.primary} />
              <ThemedText style={[styles.obDetailText, { color: theme.primary, fontSize: 10, fontFamily: "monospace" }]} numberOfLines={1}>
                {item.onboardingToken.substring(0, 12)}...
              </ThemedText>
            </View>
          </View>

          {item.fhirEndpoint ? (
            <View style={[styles.endpointRow, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="link" size={12} color={theme.success} />
              <ThemedText style={[styles.endpointUrl, { color: theme.success }]} numberOfLines={1}>
                {item.fhirEndpoint}
              </ThemedText>
            </View>
          ) : null}

          {item.testResult ? (
            <View style={[styles.obTestResult, { backgroundColor: item.testResult.success ? theme.success + "14" : theme.error + "14" }]}>
              <Feather
                name={item.testResult.success ? "check-circle" : "alert-circle"}
                size={14}
                color={item.testResult.success ? theme.success : theme.error}
              />
              <ThemedText style={[styles.obTestText, { color: item.testResult.success ? theme.success : theme.error }]}>
                {item.testResult.success ? `Connected (${item.testResult.latencyMs}ms)` : "Connection failed"}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.partnerMeta}>
            <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </ThemedText>
            {item.status !== "completed" ? (
              <Pressable
                testID={`btn-cancel-onboard-${item.id}`}
                style={[styles.actionBtn, { backgroundColor: theme.error + "14" }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  deleteOnboardMutation.mutate(item.id);
                }}
              >
                <Feather name="x" size={14} color={theme.error} />
                <ThemedText style={[styles.actionBtnText, { color: theme.error }]}>Cancel</ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderOnboardTab = () => {
    const onboardings = onboardingsQuery.data?.onboardings || [];
    return (
      <ScrollView
        contentContainerStyle={[styles.formContainer, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <Card style={styles.formCard}>
            <ThemedText style={styles.formTitle}>Initiate Partner Onboarding</ThemedText>
            <ThemedText style={[styles.formSubtitle, { color: theme.textSecondary }]}>
              Send setup instructions and an API key to a new partner. They will receive a notification with their unique onboarding token.
            </ThemedText>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Partner Organization Name</ThemedText>
              <TextInput
                testID="input-ob-name"
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., Regional Medical Center"
                placeholderTextColor={theme.textSecondary}
                value={obName}
                onChangeText={setObName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Contact Person Name</ThemedText>
              <TextInput
                testID="input-ob-contact"
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g., Dr. Jane Smith"
                placeholderTextColor={theme.textSecondary}
                value={obContact}
                onChangeText={setObContact}
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Contact Phone (for SMS notification)</ThemedText>
              <TextInput
                testID="input-ob-phone"
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="+1234567890"
                placeholderTextColor={theme.textSecondary}
                value={obPhone}
                onChangeText={setObPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Contact Email</ThemedText>
              <TextInput
                testID="input-ob-email"
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                placeholder="admin@partner.org"
                placeholderTextColor={theme.textSecondary}
                value={obEmail}
                onChangeText={setObEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={styles.fieldLabel}>Partner Type</ThemedText>
              <View style={styles.optionRow}>
                {PARTNER_TYPES.map(pt => (
                  <Pressable
                    key={pt.value}
                    testID={`option-ob-type-${pt.value}`}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: obType === pt.value ? theme.primary + "18" : theme.backgroundSecondary,
                        borderColor: obType === pt.value ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setObType(pt.value)}
                  >
                    <ThemedText style={[styles.optionChipText, { color: obType === pt.value ? theme.primary : theme.text }]}>
                      {pt.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {initiateOnboardMutation.error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.error + "14" }]}>
                <Feather name="alert-circle" size={14} color={theme.error} />
                <ThemedText style={[styles.errorText, { color: theme.error }]}>
                  {(initiateOnboardMutation.error as any)?.message || "Onboarding initiation failed."}
                </ThemedText>
              </View>
            ) : null}

            <Pressable
              testID="btn-initiate-onboard"
              style={[
                styles.registerBtn,
                { backgroundColor: isObFormValid ? theme.primary : theme.border },
              ]}
              onPress={handleInitiateOnboard}
              disabled={!isObFormValid || initiateOnboardMutation.isPending}
            >
              {initiateOnboardMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#fff" />
                  <ThemedText style={styles.registerBtnText}>Send Onboarding Invitation</ThemedText>
                </>
              )}
            </Pressable>
          </Card>
        </Animated.View>

        {showOnboardResult ? (
          <Animated.View entering={FadeInDown.delay(200)}>
            <Card style={[styles.formCard, { marginTop: Spacing.md }]}>
              <View style={styles.obSuccessHeader}>
                <Feather name="check-circle" size={24} color={theme.success} />
                <ThemedText style={[styles.formTitle, { color: theme.success, marginBottom: 0 }]}>
                  Invitation Sent
                </ThemedText>
              </View>
              <ThemedText style={[styles.formSubtitle, { color: theme.textSecondary }]}>
                Share the following credentials with {showOnboardResult.partnerName}:
              </ThemedText>

              <View style={[styles.obCredentialBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ThemedText style={[styles.obCredLabel, { color: theme.textSecondary }]}>Onboarding Token</ThemedText>
                <ThemedText style={[styles.obCredValue, { color: theme.text }]} selectable>
                  {showOnboardResult.onboardingToken}
                </ThemedText>
              </View>

              <View style={[styles.obCredentialBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ThemedText style={[styles.obCredLabel, { color: theme.textSecondary }]}>API Key</ThemedText>
                <ThemedText style={[styles.obCredValue, { color: theme.text }]} selectable>
                  {showOnboardResult.apiKey}
                </ThemedText>
              </View>

              <Pressable
                testID="btn-dismiss-onboard-result"
                style={[styles.actionBtn, { backgroundColor: theme.primary + "14", alignSelf: "center", marginTop: Spacing.sm }]}
                onPress={() => setShowOnboardResult(null)}
              >
                <Feather name="check" size={14} color={theme.primary} />
                <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>Done</ThemedText>
              </Pressable>
            </Card>
          </Animated.View>
        ) : null}

        {onboardings.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(300)}>
            <ThemedText style={[styles.obSectionTitle, { color: theme.text }]}>
              Onboarding Progress ({onboardings.length})
            </ThemedText>
            {onboardings.map((ob, index) => (
              <View key={ob.id} style={{ marginBottom: Spacing.sm }}>
                {renderOnboardCard({ item: ob, index })}
              </View>
            ))}
          </Animated.View>
        ) : null}
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (activeTab === "onboard") return renderOnboardTab();
    if (activeTab === "register") return renderRegisterForm();

    if (partnersQuery.isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading partners...</ThemedText>
        </View>
      );
    }

    if (partnersQuery.isError) {
      return (
        <View style={styles.centerContainer}>
          <Feather name="alert-circle" size={40} color={theme.error} />
          <ThemedText style={[styles.errorTitle, { color: theme.error }]}>Failed to load partners</ThemedText>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: theme.primary }]}
            onPress={() => partnersQuery.refetch()}
          >
            <ThemedText style={styles.retryBtnText}>Retry</ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <FlatList
        data={partners}
        keyExtractor={item => item.id}
        renderItem={renderPartnerCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={partnersQuery.isFetching}
            onRefresh={() => partnersQuery.refetch()}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="globe" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>No partners registered</ThemedText>
            <Pressable
              style={[styles.addBtn, { backgroundColor: theme.primary }]}
              onPress={() => setActiveTab("register")}
            >
              <ThemedText style={styles.addBtnText}>Add Partner</ThemedText>
            </Pressable>
          </View>
        }
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={{ paddingTop: headerHeight + Spacing.sm }}>
        {renderStatsBar()}
        {renderTabs()}
      </View>
      {renderContent()}
      {renderPartnerDetail()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statBox: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  listContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  partnerCard: { padding: Spacing.md },
  partnerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  partnerTitleRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.sm },
  partnerIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerInfo: { flex: 1 },
  partnerName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  badgeRow: { flexDirection: "row", gap: 6 },
  toggleArea: { paddingLeft: Spacing.sm },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeText: { fontSize: 10, fontWeight: "700" },
  endpointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  endpointUrl: { flex: 1, fontSize: 11 },
  fhirBadge: { fontSize: 10, fontWeight: "700" },
  partnerMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11 },
  builtInBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  builtInText: { fontSize: 10, fontWeight: "600" },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
    paddingTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  formContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  formCard: { padding: Spacing.lg },
  formTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  formSubtitle: { fontSize: 13, marginBottom: Spacing.lg },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  textInput: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionChipText: { fontSize: 13, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  errorText: { fontSize: 13, flex: 1 },
  registerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  registerBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  loadingText: { fontSize: 14, marginTop: Spacing.sm },
  errorTitle: { fontSize: 16, fontWeight: "600" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md },
  retryBtnText: { color: "#fff", fontWeight: "600" },
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: Spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  addBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md },
  addBtnText: { color: "#fff", fontWeight: "600" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: Spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { padding: Spacing.lg, gap: Spacing.sm },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: { fontSize: 13, fontWeight: "500" },
  detailValue: { fontSize: 14, fontWeight: "600", maxWidth: "55%", textAlign: "right" },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  testBtnText: { fontSize: 15, fontWeight: "600" },
  testResultBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  testResultHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  testResultTitle: { fontSize: 15, fontWeight: "700" },
  latencyDetail: { fontSize: 12, marginBottom: 8 },
  testError: { fontSize: 12, marginBottom: 8 },
  checkList: { gap: 6 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkLabel: { fontSize: 13 },
  modalActions: { marginTop: Spacing.lg, gap: Spacing.sm },
  modalActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  modalActionText: { fontSize: 15, fontWeight: "600" },
  obDetailSection: {
    padding: 10,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    gap: 6,
  },
  obDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  obDetailText: { fontSize: 12, flex: 1 },
  obTestResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: BorderRadius.sm,
    marginTop: 8,
  },
  obTestText: { fontSize: 12, fontWeight: "600" },
  obSuccessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Spacing.sm,
  },
  obCredentialBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  obCredLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  obCredValue: { fontSize: 12, fontFamily: "monospace" },
  obSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
});
