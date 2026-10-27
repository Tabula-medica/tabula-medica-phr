import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { storage, DataSource } from "@/lib/storage";

type SourceDetailParams = {
  SourceDetail: {
    source: DataSource;
  };
};

const SOURCE_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  hospital: "home",
  clinic: "briefcase",
  pharmacy: "package",
  lab: "activity",
  insurance: "shield",
};

function formatDate(dateString?: string): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function InfoRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  theme: typeof Colors.light;
}) {
  return (
    <View style={styles.infoRow}>
      <View
        style={[styles.infoIcon, { backgroundColor: `${theme.primary}15` }]}
      >
        <Feather name={icon} size={16} color={theme.primary} />
      </View>
      <View style={styles.infoContent}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {label}
        </ThemedText>
        <ThemedText type="body">{value}</ThemedText>
      </View>
    </View>
  );
}

export default function SourceDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<SourceDetailParams, "SourceDetail">>();
  const { source } = route.params;

  const [isSyncing, setIsSyncing] = useState(false);
  const icon = SOURCE_TYPE_ICONS[source.type] || "database";

  const handleSync = async () => {
    setIsSyncing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSyncing(false);
  };

  const handleDisconnect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Disconnect Source",
      `Are you sure you want to disconnect ${source.name}? Your synced records will remain in your timeline.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await storage.removeDataSource(source.id);
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View
          style={[styles.headerIcon, { backgroundColor: `${theme.primary}15` }]}
        >
          <Feather name={icon} size={32} color={theme.primary} />
        </View>
        <ThemedText type="h2" style={styles.headerTitle}>
          {source.name}
        </ThemedText>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: source.connected
                ? `${theme.success}20`
                : `${theme.textSecondary}20`,
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: source.connected
                  ? theme.success
                  : theme.textSecondary,
              },
            ]}
          />
          <ThemedText
            type="small"
            style={{
              color: source.connected ? theme.success : theme.textSecondary,
              fontWeight: "500",
            }}
          >
            {source.connected ? "Connected" : "Disconnected"}
          </ThemedText>
        </View>
      </View>

      <View
        style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <InfoRow
          icon="database"
          label="Type"
          value={source.type.charAt(0).toUpperCase() + source.type.slice(1)}
          theme={theme}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <InfoRow
          icon="file-text"
          label="Records Synced"
          value={`${source.recordCount} records`}
          theme={theme}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <InfoRow
          icon="clock"
          label="Last Synced"
          value={formatDate(source.lastSync)}
          theme={theme}
        />
        {source.fhirEndpoint ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <InfoRow
              icon="link"
              label="FHIR Endpoint"
              value={source.fhirEndpoint}
              theme={theme}
            />
          </>
        ) : null}
      </View>

      <Pressable
        onPress={handleSync}
        disabled={isSyncing}
        style={({ pressed }) => [
          styles.syncButton,
          {
            backgroundColor: theme.primary,
            opacity: pressed || isSyncing ? 0.8 : 1,
          },
        ]}
      >
        {isSyncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Feather name="refresh-cw" size={20} color="#fff" />
        )}
        <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
          {isSyncing ? "Syncing..." : "Sync Now"}
        </ThemedText>
      </Pressable>

      <View
        style={[styles.securityCard, { backgroundColor: theme.backgroundSecondary }]}
      >
        <Feather name="shield" size={20} color={theme.success} />
        <View style={styles.securityContent}>
          <ThemedText type="small" style={{ fontWeight: "500" }}>
            HIPAA Compliant Connection
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            All data transfers are encrypted using TLS 1.3
          </ThemedText>
        </View>
      </View>

      <Pressable
        onPress={handleDisconnect}
        style={({ pressed }) => [
          styles.disconnectButton,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.error,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Feather name="link-2" size={20} color={theme.error} />
        <ThemedText type="body" style={{ color: theme.error, fontWeight: "500" }}>
          Disconnect Source
        </ThemedText>
      </Pressable>

      <ThemedText
        type="caption"
        style={[styles.disclaimer, { color: theme.textSecondary }]}
      >
        Disconnecting will stop syncing new records but will not delete records
        already in your timeline.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoCard: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  securityContent: {
    flex: 1,
    gap: 4,
  },
  disconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  disclaimer: {
    textAlign: "center",
    lineHeight: 18,
  },
});
