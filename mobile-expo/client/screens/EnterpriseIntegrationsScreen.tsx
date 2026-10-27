import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface WearablePlatform {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
  categories: string[];
  color: string;
  status: "disconnected" | "connected" | "syncing" | "error";
}

const WEARABLE_PLATFORMS: WearablePlatform[] = [
  {
    id: "fitbit",
    name: "Fitbit",
    icon: "watch",
    description: "Steps, heart rate, sleep, SpO2, weight, HRV, stress",
    categories: ["steps", "heart_rate", "sleep", "blood_oxygen", "weight", "hrv", "stress"],
    color: "#00B0B9",
    status: "disconnected",
  },
  {
    id: "garmin",
    name: "Garmin",
    icon: "compass",
    description: "Activities, sleep, pulse ox, respiration, body composition, HRV",
    categories: ["steps", "heart_rate", "sleep", "blood_oxygen", "respiratory_rate", "weight", "hrv"],
    color: "#007CC3",
    status: "disconnected",
  },
  {
    id: "samsung_health",
    name: "Samsung Health",
    icon: "smartphone",
    description: "Steps, heart rate, sleep, blood oxygen, blood pressure, exercise",
    categories: ["steps", "heart_rate", "sleep", "blood_oxygen", "blood_pressure", "weight", "stress"],
    color: "#1428A0",
    status: "disconnected",
  },
  {
    id: "apple_health",
    name: "Apple Health",
    icon: "heart",
    description: "Activity, vitals, sleep, nutrition, body measurements",
    categories: ["steps", "heart_rate", "sleep", "blood_oxygen", "weight"],
    color: "#FF2D55",
    status: "disconnected",
  },
  {
    id: "google_fit",
    name: "Google Fit",
    icon: "activity",
    description: "Steps, heart points, distance, calories, sleep",
    categories: ["steps", "heart_rate", "distance", "calories", "sleep"],
    color: "#4285F4",
    status: "disconnected",
  },
  {
    id: "oura",
    name: "Oura Ring",
    icon: "circle",
    description: "Sleep tracking, readiness, HRV, temperature, activity",
    categories: ["sleep", "hrv", "body_temperature", "steps"],
    color: "#D4AF37",
    status: "disconnected",
  },
  {
    id: "whoop",
    name: "WHOOP",
    icon: "zap",
    description: "Strain, recovery, sleep, HRV, respiratory rate",
    categories: ["hrv", "sleep", "respiratory_rate", "heart_rate"],
    color: "#000000",
    status: "disconnected",
  },
  {
    id: "withings",
    name: "Withings",
    icon: "thermometer",
    description: "Blood pressure, weight, sleep, ECG, temperature",
    categories: ["blood_pressure", "weight", "sleep", "body_temperature"],
    color: "#00BCD4",
    status: "disconnected",
  },
  {
    id: "dexcom",
    name: "Dexcom CGM",
    icon: "droplet",
    description: "Continuous glucose monitoring with real-time readings",
    categories: ["blood_glucose"],
    color: "#68BC45",
    status: "disconnected",
  },
];

interface ImportResult {
  success: boolean;
  platform: string;
  dataPointsImported: number;
  healthGraphEntities: number;
  anomaliesDetected: number;
  categories: string[];
  errors: string[];
}

export default function EnterpriseIntegrationsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [platforms, setPlatforms] = useState<WearablePlatform[]>(WEARABLE_PLATFORMS);
  const [refreshing, setRefreshing] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<WearablePlatform | null>(null);
  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  const handleConnect = useCallback(async (platformId: string) => {
    setConnectingPlatform(platformId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest("POST", "/api/wearables/connect", {
        platform: platformId,
        connectionType: "oauth2",
      });
      const data = await response.json();

      setPlatforms(prev =>
        prev.map(p =>
          p.id === platformId ? { ...p, status: "connected" as const } : p
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Connect error:", error);
      setPlatforms(prev =>
        prev.map(p =>
          p.id === platformId ? { ...p, status: "error" as const } : p
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setConnectingPlatform(null);
    }
  }, []);

  const handleSync = useCallback(async (platformId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlatforms(prev =>
      prev.map(p =>
        p.id === platformId ? { ...p, status: "syncing" as const } : p
      )
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPlatforms(prev =>
        prev.map(p =>
          p.id === platformId ? { ...p, status: "connected" as const } : p
        )
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPlatforms(prev =>
        prev.map(p =>
          p.id === platformId ? { ...p, status: "error" as const } : p
        )
      );
    }
  }, []);

  const handleImportPress = useCallback((platform: WearablePlatform) => {
    setSelectedPlatform(platform);
    setImportData("");
    setImportResult(null);
    setImportModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleImportSubmit = useCallback(async () => {
    if (!selectedPlatform || !importData.trim()) return;

    setImporting(true);
    try {
      let parsedData: any;
      try {
        parsedData = JSON.parse(importData);
      } catch {
        setImportResult({
          success: false,
          platform: selectedPlatform.id,
          dataPointsImported: 0,
          healthGraphEntities: 0,
          anomaliesDetected: 0,
          categories: [],
          errors: ["Invalid JSON format. Please paste valid JSON data from your wearable export."],
        });
        setImporting(false);
        setResultModalVisible(true);
        return;
      }

      const response = await apiRequest(
        "POST",
        `/api/wearables/import/${selectedPlatform.id}`,
        parsedData
      );
      const result = await response.json();

      setImportResult(result as ImportResult);
      setImportModalVisible(false);
      setResultModalVisible(true);

      if (result.success) {
        setPlatforms(prev =>
          prev.map(p =>
            p.id === selectedPlatform.id ? { ...p, status: "connected" as const } : p
          )
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({
        success: false,
        platform: selectedPlatform.id,
        dataPointsImported: 0,
        healthGraphEntities: 0,
        anomaliesDetected: 0,
        categories: [],
        errors: ["Failed to import data. Please try again."],
      });
      setResultModalVisible(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setImporting(false);
    }
  }, [selectedPlatform, importData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected": return theme.success;
      case "syncing": return theme.warning;
      case "error": return theme.error;
      default: return theme.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected": return "Connected";
      case "syncing": return "Syncing...";
      case "error": return "Error";
      default: return "Not Connected";
    }
  };

  const connectedCount = platforms.filter(p => p.status === "connected").length;

  const renderPlatformCard = (platform: WearablePlatform, index: number) => (
    <Animated.View
      key={platform.id}
      entering={FadeInDown.delay(index * 60).springify()}
    >
      <Card
        elevation={1}
        style={styles.platformCard}
      >
        <View style={styles.platformHeader}>
          <View style={[styles.platformIconContainer, { backgroundColor: `${platform.color}15` }]}>
            <Feather name={platform.icon} size={24} color={platform.color} />
          </View>
          <View style={styles.platformInfo}>
            <ThemedText type="h4">{platform.name}</ThemedText>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(platform.status) }]} />
              <ThemedText type="small" style={{ color: getStatusColor(platform.status) }}>
                {getStatusText(platform.status)}
              </ThemedText>
            </View>
          </View>
          {platform.status === "syncing" ? (
            <ActivityIndicator size="small" color={theme.warning} />
          ) : null}
        </View>

        <ThemedText type="small" style={[styles.platformDescription, { color: theme.textSecondary }]}>
          {platform.description}
        </ThemedText>

        <View style={styles.categoryTags}>
          {platform.categories.slice(0, 4).map(cat => (
            <View key={cat} style={[styles.categoryTag, { backgroundColor: `${platform.color}10`, borderColor: `${platform.color}30` }]}>
              <ThemedText type="small" style={{ color: platform.color, fontSize: 11 }}>
                {cat.replace(/_/g, " ")}
              </ThemedText>
            </View>
          ))}
          {platform.categories.length > 4 ? (
            <View style={[styles.categoryTag, { backgroundColor: `${theme.textSecondary}10`, borderColor: `${theme.textSecondary}30` }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                +{platform.categories.length - 4} more
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.platformActions}>
          {platform.status === "disconnected" ? (
            <Pressable
              testID={`button-connect-${platform.id}`}
              onPress={() => handleConnect(platform.id)}
              disabled={connectingPlatform === platform.id}
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: platform.color, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              {connectingPlatform === platform.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="link" size={14} color="#FFFFFF" />
                  <ThemedText type="small" style={styles.actionButtonText}>Connect</ThemedText>
                </>
              )}
            </Pressable>
          ) : null}

          {platform.status === "connected" || platform.status === "error" ? (
            <>
              <Pressable
                testID={`button-sync-${platform.id}`}
                onPress={() => handleSync(platform.id)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="refresh-cw" size={14} color="#FFFFFF" />
                <ThemedText type="small" style={styles.actionButtonText}>Sync</ThemedText>
              </Pressable>
              <Pressable
                testID={`button-import-${platform.id}`}
                onPress={() => handleImportPress(platform)}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.importButton,
                  { borderColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="download" size={14} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4, fontWeight: "600" }}>
                  Import Data
                </ThemedText>
              </Pressable>
            </>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeInDown.springify()}>
          <Card elevation={2} style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryIconContainer, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="cpu" size={28} color={theme.primary} />
              </View>
              <View style={styles.summaryInfo}>
                <ThemedText type="h3">Wearable Connectors</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {connectedCount} of {platforms.length} platforms connected
                </ThemedText>
              </View>
            </View>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <ThemedText type="h3" style={{ color: theme.primary }}>{platforms.length}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Platforms</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <ThemedText type="h3" style={{ color: theme.success }}>{connectedCount}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Connected</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <ThemedText type="h3" style={{ color: theme.info }}>20+</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Data Types</ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        <ThemedText type="h4" style={styles.sectionTitle}>All Platforms</ThemedText>

        {platforms.map((platform, index) => renderPlatformCard(platform, index))}
      </ScrollView>

      <Modal
        visible={importModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setImportModalVisible(false)}>
              <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="h4">
              Import {selectedPlatform?.name} Data
            </ThemedText>
            <Pressable
              testID="button-submit-import"
              onPress={handleImportSubmit}
              disabled={importing || !importData.trim()}
            >
              {importing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <ThemedText
                  type="body"
                  style={{ color: importData.trim() ? theme.primary : theme.textSecondary, fontWeight: "600" }}
                >
                  Import
                </ThemedText>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            <Card elevation={1} style={{ marginBottom: Spacing.md }}>
              <View style={styles.infoRow}>
                <Feather name="info" size={16} color={theme.info} />
                <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, marginLeft: Spacing.sm }}>
                  Paste your exported JSON data from {selectedPlatform?.name}. The data will be parsed, normalized,
                  mapped to FHIR standards, and added to your Health Graph with full lineage tracking.
                </ThemedText>
              </View>
            </Card>

            <ThemedText type="small" style={[styles.inputLabel, { color: theme.textSecondary }]}>
              JSON Data
            </ThemedText>
            <TextInput
              testID="input-import-data"
              style={[
                styles.importInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              multiline
              placeholder='{"activities": [...], "heartRate": [...], "sleep": [...]}'
              placeholderTextColor={theme.textSecondary}
              value={importData}
              onChangeText={setImportData}
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Card elevation={1} style={{ marginTop: Spacing.md }}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginBottom: Spacing.xs }}>
                Supported Data Categories
              </ThemedText>
              <View style={styles.categoryTags}>
                {selectedPlatform?.categories.map(cat => (
                  <View
                    key={cat}
                    style={[
                      styles.categoryTag,
                      {
                        backgroundColor: `${selectedPlatform.color}10`,
                        borderColor: `${selectedPlatform.color}30`,
                      },
                    ]}
                  >
                    <ThemedText type="small" style={{ color: selectedPlatform.color, fontSize: 11 }}>
                      {cat.replace(/_/g, " ")}
                    </ThemedText>
                  </View>
                )) || null}
              </View>
            </Card>

            <Card elevation={1} style={{ marginTop: Spacing.md }}>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginBottom: Spacing.xs }}>
                Processing Pipeline
              </ThemedText>
              {["Import & Parse", "Normalization", "Validation", "FHIR Mapping", "Vocabulary Translation"].map((step, i) => (
                <View key={step} style={styles.pipelineStep}>
                  <View style={[styles.pipelineNumber, { backgroundColor: `${theme.primary}15` }]}>
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700" }}>{i + 1}</ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.text }}>{step}</ThemedText>
                </View>
              ))}
            </Card>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={resultModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setResultModalVisible(false)}
      >
        <View style={styles.resultOverlay}>
          <View style={[styles.resultModal, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.resultIconContainer, { backgroundColor: importResult?.success ? `${theme.success}15` : `${theme.error}15` }]}>
              <Feather
                name={importResult?.success ? "check-circle" : "alert-circle"}
                size={40}
                color={importResult?.success ? theme.success : theme.error}
              />
            </View>

            <ThemedText type="h3" style={{ textAlign: "center", marginTop: Spacing.md }}>
              {importResult?.success ? "Import Successful" : "Import Failed"}
            </ThemedText>

            {importResult?.success ? (
              <View style={styles.resultStats}>
                <View style={styles.resultStatRow}>
                  <Feather name="database" size={16} color={theme.primary} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    {importResult.dataPointsImported} data points imported
                  </ThemedText>
                </View>
                <View style={styles.resultStatRow}>
                  <Feather name="git-branch" size={16} color={theme.info} />
                  <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                    {importResult.healthGraphEntities} Health Graph entities
                  </ThemedText>
                </View>
                {importResult.anomaliesDetected > 0 ? (
                  <View style={styles.resultStatRow}>
                    <Feather name="alert-triangle" size={16} color={theme.warning} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                      {importResult.anomaliesDetected} anomalies detected
                    </ThemedText>
                  </View>
                ) : null}
                <View style={styles.resultStatRow}>
                  <Feather name="tag" size={16} color={theme.success} />
                  <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                    Categories: {importResult.categories.join(", ")}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {importResult?.errors && importResult.errors.length > 0 ? (
              <View style={[styles.errorContainer, { backgroundColor: `${theme.error}10`, borderColor: `${theme.error}30` }]}>
                {importResult.errors.map((err, i) => (
                  <ThemedText key={i} type="small" style={{ color: theme.error }}>
                    {err}
                  </ThemedText>
                ))}
              </View>
            ) : null}

            <Pressable
              testID="button-dismiss-result"
              onPress={() => setResultModalVisible(false)}
              style={({ pressed }) => [
                styles.dismissButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>Done</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
  },
  statItem: {
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  platformCard: {
    marginBottom: Spacing.md,
  },
  platformHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  platformIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  platformInfo: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  platformDescription: {
    marginBottom: Spacing.sm,
  },
  categoryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: Spacing.sm,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  platformActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  importButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  inputLabel: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  importInput: {
    minHeight: 200,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 13,
    fontFamily: "monospace",
  },
  pipelineStep: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  pipelineNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  resultModal: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 360,
  },
  resultIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  resultStats: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  resultStatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  dismissButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
});
