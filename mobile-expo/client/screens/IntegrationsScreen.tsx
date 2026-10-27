import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

type ThemeColors = typeof Colors.light;

interface Platform {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
  supportedCategories: string[];
  status: string;
}

interface Category {
  key: string;
  label: string;
  description: string;
  count: number;
}

interface AllPlatformsResponse {
  platforms: Platform[];
  categories: Category[];
  totalCount: number;
  ehrStats: {
    totalConnectors: number;
    activeConnectors: number;
    totalPatientReach: number;
    connectorsByType: Record<string, number>;
    connectorsByStatus: Record<string, number>;
  };
}

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  ehr_portal: "monitor",
  wearable: "watch",
  nutrition_tracker: "pie-chart",
  health_app: "heart",
};

const CATEGORY_COLORS: Record<string, string> = {
  ehr_portal: "#3B82F6",
  wearable: "#10B981",
  nutrition_tracker: "#F59E0B",
  health_app: "#EC4899",
};

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  return CATEGORY_ICONS[category] || "grid";
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "#6B7280";
}

function formatPatientReach(reach: number): string {
  if (reach >= 1000000000) return `${(reach / 1000000000).toFixed(1)}B`;
  if (reach >= 1000000) return `${(reach / 1000000).toFixed(0)}M`;
  if (reach >= 1000) return `${(reach / 1000).toFixed(0)}K`;
  return reach.toString();
}

function StatusBadge({ status, theme }: { status: string; theme: ThemeColors }) {
  const badgeColor = status === "active" ? theme.success : status === "beta" ? "#F59E0B" : theme.textSecondary;
  return (
    <View style={[styles.statusBadge, { backgroundColor: badgeColor + "20" }]}>
      <View style={[styles.statusDot, { backgroundColor: badgeColor }]} />
      <ThemedText style={[styles.statusText, { color: badgeColor }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </ThemedText>
    </View>
  );
}

function CategoryHeader({
  category,
  index,
  theme,
}: {
  category: Category;
  index: number;
  theme: ThemeColors;
}) {
  const color = getCategoryColor(category.key);
  const icon = getCategoryIcon(category.key);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      style={[styles.categoryHeader]}
    >
      <View style={[styles.categoryIconContainer, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={styles.categoryInfo}>
        <ThemedText type="h4">{category.label}</ThemedText>
        <ThemedText style={[styles.categoryDescription, { color: theme.textSecondary }]}>
          {category.description}
        </ThemedText>
      </View>
      <View style={[styles.countBadge, { backgroundColor: color + "15" }]}>
        <ThemedText style={[styles.countText, { color }]}>{category.count}</ThemedText>
      </View>
    </Animated.View>
  );
}

function PlatformCard({
  platform,
  index,
  theme,
  onPress,
}: {
  platform: Platform;
  index: number;
  theme: ThemeColors;
  onPress: () => void;
}) {
  const iconName = (platform.icon || "grid") as keyof typeof Feather.glyphMap;
  const categoryColor = getCategoryColor(platform.category);

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [
          styles.platformCard,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
        ]}
        testID={`platform-card-${platform.id}`}
      >
        <View style={[styles.platformIconContainer, { backgroundColor: categoryColor + "12" }]}>
          <Feather name={iconName} size={22} color={categoryColor} />
        </View>
        <View style={styles.platformInfo}>
          <View style={styles.platformHeader}>
            <ThemedText type="body" numberOfLines={1} style={[styles.platformName, { fontWeight: "600" }]}>
              {platform.name}
            </ThemedText>
            <StatusBadge status={platform.status} theme={theme} />
          </View>
          <ThemedText
            numberOfLines={2}
            style={[styles.platformDescription, { color: theme.textSecondary }]}
          >
            {platform.description}
          </ThemedText>
          <View style={styles.platformTags}>
            {platform.supportedCategories.slice(0, 4).map((cat) => (
              <View
                key={cat}
                style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={[styles.tagText, { color: theme.textSecondary }]}>
                  {cat.replace(/_/g, " ")}
                </ThemedText>
              </View>
            ))}
            {platform.supportedCategories.length > 4 ? (
              <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.tagText, { color: theme.textSecondary }]}>
                  +{platform.supportedCategories.length - 4} more
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

function StatsBar({ stats, theme }: { stats: AllPlatformsResponse["ehrStats"]; theme: ThemeColors }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(0).springify()}
      style={[styles.statsBar, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.statItem}>
        <ThemedText type="h3" style={{ color: theme.primary }}>
          {stats.totalConnectors + Object.keys(stats.connectorsByType).length}
        </ThemedText>
        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
          Total Platforms
        </ThemedText>
      </View>
      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
      <View style={styles.statItem}>
        <ThemedText type="h3" style={{ color: "#10B981" }}>
          {stats.activeConnectors}
        </ThemedText>
        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
          Active
        </ThemedText>
      </View>
      <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
      <View style={styles.statItem}>
        <ThemedText type="h3" style={{ color: "#3B82F6" }}>
          {formatPatientReach(stats.totalPatientReach)}
        </ThemedText>
        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
          Patient Reach
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export default function IntegrationsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery<AllPlatformsResponse>({
    queryKey: ["/api/integrations/all-platforms"],
  });

  const filteredPlatforms = useCallback(() => {
    if (!data) return [];
    let platforms = data.platforms;

    if (selectedCategory) {
      platforms = platforms.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      platforms = platforms.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.supportedCategories.some((c) => c.toLowerCase().includes(query))
      );
    }

    return platforms;
  }, [data, searchQuery, selectedCategory]);

  const handlePlatformPress = useCallback((platform: Platform) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading integrations...
        </ThemedText>
      </ThemedView>
    );
  }

  const platforms = filteredPlatforms();
  const categories = data?.categories || [];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={[styles.healthKitCard, { backgroundColor: theme.backgroundDefault, borderColor: "#FF2D5520" }]}>
            <View style={styles.healthKitHeader}>
              <View style={[styles.healthKitIconContainer, { backgroundColor: "#FF2D5515" }]}>
                <Feather name="heart" size={24} color="#FF2D55" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="h4">Apple Health Integration</ThemedText>
                <ThemedText style={[styles.healthKitSubtext, { color: theme.textSecondary }]}>
                  HealthKit data access
                </ThemedText>
              </View>
              <StatusBadge status="active" theme={theme} />
            </View>
            <ThemedText style={[styles.healthKitDescription, { color: theme.textSecondary }]}>
              Tabula Medica reads and writes health data from Apple Health (HealthKit) to provide a unified view of your records. This includes heart rate, steps, sleep, blood pressure, blood oxygen, and more.
            </ThemedText>
            <View style={styles.healthKitCategories}>
              {["Heart Rate", "Steps", "Sleep", "Blood Pressure", "Blood Oxygen", "ECG"].map((cat) => (
                <View key={cat} style={[styles.healthKitTag, { backgroundColor: "#FF2D5510" }]}>
                  <Feather name="activity" size={10} color="#FF2D55" />
                  <ThemedText style={[styles.healthKitTagText, { color: "#FF2D55" }]}>{cat}</ThemedText>
                </View>
              ))}
            </View>
            <View style={[styles.healthKitNotice, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="shield" size={14} color={theme.textSecondary} />
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, flex: 1 }}>
                HealthKit data stays on your device and is only shared with your explicit permission. All data is encrypted end-to-end per HIPAA standards.
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        {data?.ehrStats ? <StatsBar stats={data.ehrStats} theme={theme} /> : null}

        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search platforms..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            testID="search-input"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} testID="clear-search">
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <Pressable
            onPress={() => {
              setSelectedCategory(null);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.filterChip,
              {
                backgroundColor: !selectedCategory ? theme.primary : theme.backgroundDefault,
              },
            ]}
            testID="filter-all"
          >
            <ThemedText
              style={[
                styles.filterText,
                { color: !selectedCategory ? "#FFFFFF" : theme.text },
              ]}
            >
              All
            </ThemedText>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => {
                setSelectedCategory(selectedCategory === cat.key ? null : cat.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedCategory === cat.key
                      ? getCategoryColor(cat.key)
                      : theme.backgroundDefault,
                },
              ]}
              testID={`filter-${cat.key}`}
            >
              <Feather
                name={getCategoryIcon(cat.key)}
                size={14}
                color={selectedCategory === cat.key ? "#FFFFFF" : theme.text}
                style={{ marginRight: 4 }}
              />
              <ThemedText
                style={[
                  styles.filterText,
                  { color: selectedCategory === cat.key ? "#FFFFFF" : theme.text },
                ]}
              >
                {cat.label} ({cat.count})
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {!selectedCategory
          ? categories.map((cat, catIndex) => {
              const catPlatforms = platforms.filter((p) => p.category === cat.key);
              if (catPlatforms.length === 0) return null;
              return (
                <View key={cat.key} style={styles.categorySection}>
                  <CategoryHeader category={cat} index={catIndex} theme={theme} />
                  {catPlatforms.map((platform, idx) => (
                    <PlatformCard
                      key={platform.id}
                      platform={platform}
                      index={catIndex * 5 + idx}
                      theme={theme}
                      onPress={() => handlePlatformPress(platform)}
                    />
                  ))}
                </View>
              );
            })
          : platforms.map((platform, idx) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                index={idx}
                theme={theme}
                onPress={() => handlePlatformPress(platform)}
              />
            ))}

        {platforms.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={48} color={theme.textSecondary} />
            <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
              No platforms found
            </ThemedText>
            <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
              Try adjusting your search or filters
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    textAlign: "center",
    marginTop: Spacing.md,
  },
  statsBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: Spacing.sm,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  filterScroll: {
    marginBottom: Spacing.md,
    flexGrow: 0,
  },
  filterContainer: {
    gap: Spacing.xs,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryDescription: {
    fontSize: 12,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countText: {
    fontSize: 13,
    fontWeight: "600",
  },
  platformCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  platformIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  platformInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  platformHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 2,
  },
  platformName: {
    flex: 1,
  },
  platformDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  platformTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  tagText: {
    fontSize: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyDescription: {
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  healthKitCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  healthKitHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  healthKitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  healthKitSubtext: {
    fontSize: 12,
    marginTop: 1,
  },
  healthKitDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.sm,
  },
  healthKitCategories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  healthKitTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  healthKitTagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  healthKitNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: 8,
    gap: Spacing.xs,
  },
});
