import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { StatusBadge, getStatusColor as getStatusColorFromBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type ThemeColors = typeof Colors.light;

interface ConnectedDevice {
  id: string;
  userId: string;
  deviceType: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  status: string;
  batteryLevel: number | null;
  firmwareVersion: string | null;
  lastSyncAt: string | null;
  connectionDetails: any;
  capabilities: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEVICE_TYPES = [
  { id: "blood_pressure_monitor", name: "Blood Pressure Monitor", icon: "heart" as const },
  { id: "glucose_meter", name: "Glucose Meter", icon: "droplet" as const },
  { id: "pulse_oximeter", name: "Pulse Oximeter", icon: "activity" as const },
  { id: "heart_rate_monitor", name: "Heart Rate Monitor", icon: "heart" as const },
  { id: "smart_scale", name: "Smart Scale", icon: "trending-up" as const },
  { id: "thermometer", name: "Thermometer", icon: "thermometer" as const },
  { id: "fitness_tracker", name: "Fitness Tracker", icon: "watch" as const },
  { id: "cgm", name: "Continuous Glucose Monitor", icon: "activity" as const },
  { id: "ecg_monitor", name: "ECG Monitor", icon: "activity" as const },
  { id: "sleep_tracker", name: "Sleep Tracker", icon: "moon" as const },
  { id: "spirometer", name: "Spirometer", icon: "wind" as const },
];

function getDeviceIcon(deviceType: string): keyof typeof Feather.glyphMap {
  const device = DEVICE_TYPES.find(d => d.id === deviceType);
  return device?.icon || "cpu";
}

function getDeviceTypeName(deviceType: string): string {
  const device = DEVICE_TYPES.find(d => d.id === deviceType);
  return device?.name || deviceType.replace(/_/g, " ");
}

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "connected": return colors.success;
    case "disconnected": return colors.textSecondary;
    case "pairing": return colors.warning;
    case "error": return colors.error;
    case "low_battery": return colors.warning;
    default: return colors.textSecondary;
  }
}

export default function DeviceManagementScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [refreshing, setRefreshing] = useState(false);
  const [addDeviceModalVisible, setAddDeviceModalVisible] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);

  const { data: devices = [], isLoading, refetch } = useQuery<ConnectedDevice[]>({
    queryKey: ["/api/devices"],
  });

  const addDeviceMutation = useMutation({
    mutationFn: async (data: { deviceType: string; name: string }) => {
      console.log("[DeviceManagement] Adding device:", data);
      const response = await apiRequest("POST", "/api/devices", data);
      const result = await response.json();
      console.log("[DeviceManagement] Device added:", result);
      return result;
    },
    onSuccess: () => {
      console.log("[DeviceManagement] Mutation successful, closing modal");
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setAddDeviceModalVisible(false);
      setSelectedDeviceType(null);
      setDeviceName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      console.error("[DeviceManagement] Mutation error:", error);
    },
  });

  const syncDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      setSyncingDeviceId(deviceId);
      const response = await apiRequest("POST", `/api/devices/${deviceId}/sync`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/readings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/dashboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => {
      setSyncingDeviceId(null);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await apiRequest("DELETE", `/api/devices/${deviceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAddDevice = () => {
    console.log("[DeviceManagement] handleAddDevice called", { selectedDeviceType, deviceName });
    if (!selectedDeviceType || !deviceName.trim()) {
      console.log("[DeviceManagement] Validation failed");
      return;
    }
    console.log("[DeviceManagement] Calling mutation");
    addDeviceMutation.mutate({ deviceType: selectedDeviceType, name: deviceName.trim() });
  };

  const handleSyncDevice = (deviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    syncDeviceMutation.mutate(deviceId);
  };

  const handleDeleteDevice = (deviceId: string, deviceName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteDeviceMutation.mutate(deviceId);
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return "Never synced";
    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderDeviceCard = (device: ConnectedDevice, index: number) => (
    <Animated.View
      key={device.id}
      entering={FadeInDown.delay(index * 50).springify()}
      style={[styles.deviceCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
    >
      <View style={styles.deviceHeader}>
        <View style={[styles.deviceIconContainer, { backgroundColor: `${theme.primary}15` }]}>
          <Feather name={getDeviceIcon(device.deviceType)} size={24} color={theme.primary} />
        </View>
        <View style={styles.deviceInfo}>
          <ThemedText type="h4" style={{ color: theme.text }}>{device.name}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {getDeviceTypeName(device.deviceType)}
          </ThemedText>
        </View>
        <StatusBadge label={device.status} color={getStatusColor(device.status, theme)} variant="dot" size="md" />
      </View>

      <View style={[styles.deviceDetails, { borderTopColor: theme.border }]}>
        {device.batteryLevel !== null ? (
          <View style={styles.detailItem}>
            <Feather 
              name={device.batteryLevel < 20 ? "battery" : "battery-charging"} 
              size={14} 
              color={device.batteryLevel < 20 ? theme.warning : theme.textSecondary} 
            />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              {device.batteryLevel}%
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.detailItem}>
          <Feather name="clock" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
            {formatLastSync(device.lastSyncAt)}
          </ThemedText>
        </View>
        {device.firmwareVersion ? (
          <View style={styles.detailItem}>
            <Feather name="cpu" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
              v{device.firmwareVersion}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.deviceActions}>
        <Pressable
          onPress={() => handleSyncDevice(device.id)}
          disabled={syncingDeviceId === device.id}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {syncingDeviceId === device.id ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: 6 }}>Sync</ThemedText>
            </>
          )}
        </Pressable>
        
        <Pressable
          onPress={() => navigation.navigate("RealTimeSensor", { deviceId: device.id, deviceName: device.name })}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: `${theme.primary}15`, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="bar-chart-2" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6 }}>Data</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => handleDeleteDevice(device.id, device.name)}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: `${theme.error}15`, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="trash-2" size={16} color={theme.error} />
        </Pressable>
      </View>
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeInDown.springify()} style={styles.header}>
          <View>
            <ThemedText type="h2" style={{ color: theme.text }}>Connected Devices</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
              Manage your wearables and health sensors
            </ThemedText>
          </View>
        </Animated.View>

        <Pressable
          onPress={() => setAddDeviceModalVisible(true)}
          style={({ pressed }) => [
            styles.addDeviceButton,
            { 
              backgroundColor: `${theme.primary}10`, 
              borderColor: theme.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.addDeviceIcon, { backgroundColor: theme.primary }]}>
            <Feather name="plus" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.addDeviceText}>
            <ThemedText type="h4" style={{ color: theme.primary }}>Add New Device</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Connect a wearable or health sensor
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.primary} />
        </Pressable>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : devices.length === 0 ? (
          <Animated.View entering={FadeInUp.springify()} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="watch" size={40} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ color: theme.text, textAlign: "center", marginTop: Spacing.lg }}>
              No Devices Connected
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
              Connect your wearable devices and health sensors to track your vitals in real-time
            </ThemedText>
          </Animated.View>
        ) : (
          <View style={styles.devicesList}>
            {devices.map((device, index) => renderDeviceCard(device, index))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={addDeviceModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddDeviceModalVisible(false)}
      >
        <ThemedView style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setAddDeviceModalVisible(false)}>
              <ThemedText type="body" style={{ color: theme.primary }}>Cancel</ThemedText>
            </Pressable>
            <ThemedText type="h3" style={{ color: theme.text }}>Add Device</ThemedText>
            <Pressable 
              onPress={handleAddDevice}
              disabled={!selectedDeviceType || !deviceName.trim() || addDeviceMutation.isPending}
              testID="button-add-device"
            >
              <ThemedText 
                type="body" 
                style={{ 
                  color: selectedDeviceType && deviceName.trim() ? theme.primary : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                {addDeviceMutation.isPending ? "Adding..." : "Add"}
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.md }}>
              Device Name
            </ThemedText>
            <TextInput
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="e.g., My Apple Watch"
              placeholderTextColor={theme.textSecondary}
              testID="input-device-name"
              style={[
                styles.input,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.xl, marginBottom: Spacing.md }}>
              Device Type
            </ThemedText>
            <View style={styles.deviceTypeGrid}>
              {DEVICE_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDeviceType(type.id);
                  }}
                  style={({ pressed }) => [
                    styles.deviceTypeCard,
                    { 
                      backgroundColor: selectedDeviceType === type.id 
                        ? `${theme.primary}15` 
                        : theme.backgroundSecondary,
                      borderColor: selectedDeviceType === type.id ? theme.primary : theme.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={[
                    styles.deviceTypeIcon,
                    { backgroundColor: selectedDeviceType === type.id ? theme.primary : `${theme.primary}20` },
                  ]}>
                    <Feather 
                      name={type.icon} 
                      size={20} 
                      color={selectedDeviceType === type.id ? "#FFFFFF" : theme.primary} 
                    />
                  </View>
                  <ThemedText 
                    type="small" 
                    style={{ 
                      color: selectedDeviceType === type.id ? theme.primary : theme.text,
                      textAlign: "center",
                      marginTop: Spacing.xs,
                    }}
                  >
                    {type.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const { width } = Dimensions.get("window");
const cardWidth = (width - Spacing.lg * 2 - Spacing.md) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  addDeviceButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: Spacing.xl,
  },
  addDeviceIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  addDeviceText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  devicesList: {
    gap: Spacing.md,
  },
  deviceCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  deviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  deviceDetails: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  deviceActions: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    minWidth: 70,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  deviceTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  deviceTypeCard: {
    width: cardWidth,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  deviceTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
