import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { api, DataSource } from "@/lib/api";
import { ConnectionHealthNotices } from "@/components/ConnectionHealthNotices";
import { useConnectionHealth } from "@/hooks/useConnectionHealth";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SOURCE_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  hospital: "home",
  clinic: "briefcase",
  pharmacy: "package",
  lab: "activity",
  insurance: "shield",
};

function formatLastSync(dateString?: string): string {
  if (!dateString) return "Never synced";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "Synced just now";
  if (diffHours < 24) return `Synced ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Synced yesterday";
  if (diffDays < 7) return `Synced ${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SourceCard({
  source,
  index,
  onPress,
  onDisconnect,
  theme,
}: {
  source: DataSource;
  index: number;
  onPress: () => void;
  onDisconnect: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const scale = useSharedValue(1);
  const icon = SOURCE_TYPE_ICONS[source.type] || "database";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onDisconnect}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle]}
    >
      <Animated.View
        entering={FadeInDown.delay(index * 80).springify()}
        style={[styles.sourceCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <View
          style={[styles.sourceIcon, { backgroundColor: `${theme.primary}15` }]}
        >
          <Feather name={icon} size={22} color={theme.primary} />
        </View>
        <View style={styles.sourceContent}>
          <View style={styles.sourceHeader}>
            <ThemedText type="h4" numberOfLines={1} style={styles.sourceName}>
              {source.name}
            </ThemedText>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: source.isConnected
                    ? `${theme.success}20`
                    : `${theme.textSecondary}20`,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: source.isConnected
                      ? theme.success
                      : theme.textSecondary,
                  },
                ]}
              />
              <ThemedText
                type="caption"
                style={{
                  color: source.isConnected ? theme.success : theme.textSecondary,
                }}
              >
                {source.isConnected ? "Connected" : "Disconnected"}
              </ThemedText>
            </View>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatLastSync(source.lastSyncAt || undefined)}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {source.recordCount} records synced
          </ThemedText>
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.textSecondary}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const connectionHealth = useConnectionHealth();
  const refetchHealth = connectionHealth.refetch;

  const [sources, setSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadSources = useCallback(async () => {
    try {
      const data = await api.sources.list();
      setSources(data);
    } catch (error) {
      console.error("Error loading sources:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadSources();
    await refetchHealth();
    setIsRefreshing(false);
  }, [loadSources, refetchHealth]);

  const handleAddSource = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("AddSource");
  }, [navigation]);

  const handleSourcePress = useCallback(
    (source: DataSource) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("SourceDetail", { source });
    },
    [navigation]
  );

  const handleDisconnect = useCallback(
    (source: DataSource) => {
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
              await api.sources.delete(source.id);
              await loadSources();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    },
    [loadSources]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-sources.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Sources Connected
      </ThemedText>
      <ThemedText
        type="body"
        style={[styles.emptyText, { color: theme.textSecondary }]}
      >
        Connect your healthcare providers{"\n"}to sync your health records
      </ThemedText>
      <Pressable
        onPress={handleAddSource}
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="plus" size={20} color="#fff" />
        <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
          Add First Source
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={sources}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SourceCard
            source={item}
            index={index}
            onPress={() => handleSourcePress(item)}
            onDisconnect={() => handleDisconnect(item)}
            theme={theme}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          sources.length === 0 && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        ListHeaderComponent={
          <View>
            <ConnectionHealthNotices
              health={connectionHealth.data?.health ?? []}
              onReconnect={(sourceType) => navigation.navigate("ProfileTab", {
                screen: "ConnectHealthRecords",
                params: { reconnectSource: sourceType },
              })}
            />
            {connectionHealth.isError ? (
              <Pressable onPress={() => { void connectionHealth.refetch(); }} accessibilityRole="button">
                <ThemedText style={{ color: theme.textSecondary }}>
                  Could not check connection status. Tap to retry.
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.navigate("Integrations");
              }}
              style={({ pressed }) => [
                styles.integrationsButton,
                { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}30`, opacity: pressed ? 0.8 : 1 },
              ]}
              testID="browse-integrations"
            >
              <View style={[styles.integrationsIconWrap, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="grid" size={20} color={theme.primary} />
              </View>
              <View style={styles.integrationsTextWrap}>
                <ThemedText type="h4">Browse Integrations</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Connect EHR portals, wearables, and health apps
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.primary} />
            </Pressable>
            {sources.length > 0 ? (
              <View style={styles.header}>
                <ThemedText type="h2">Data Sources</ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Long press a source to disconnect
                </ThemedText>
              </View>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {sources.length > 0 ? (
        <Pressable
          onPress={handleAddSource}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: theme.primary,
              bottom: tabBarHeight + Spacing.lg,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: Spacing.sm,
  },
  sourceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  sourceIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceContent: {
    flex: 1,
    gap: 2,
  },
  sourceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  sourceName: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyImage: {
    width: 180,
    height: 180,
    marginBottom: Spacing.xl,
    opacity: 0.9,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xl,
  },
  integrationsButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  integrationsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  integrationsTextWrap: {
    flex: 1,
    gap: 2,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
