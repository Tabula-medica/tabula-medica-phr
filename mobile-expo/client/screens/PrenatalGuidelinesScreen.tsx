import React, { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type PrenatalGuideline = {
  name: string;
  category: string;
  trimester: string;
  timing: string;
  description: string;
  importance: "required" | "recommended" | "optional";
};

type PrenatalData = {
  guidelines: PrenatalGuideline[];
  total: number;
};

const TRIMESTER_OPTIONS = ["All", "First Trimester", "Second Trimester", "Third Trimester"];

const TRIMESTER_MAP: Record<string, string> = {
  "First Trimester": "first",
  "Second Trimester": "second",
  "Third Trimester": "third",
};

const CATEGORY_OPTIONS = [
  "All",
  "Routine Labs",
  "Imaging",
  "Genetic Screening",
  "Vaccinations",
  "Monitoring",
  "Nutrition",
  "Mental Health",
  "Education",
  "Initial Visit",
];

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  "Routine Labs": { icon: "clipboard", color: "#3B82F6" },
  "Imaging": { icon: "image", color: "#F97316" },
  "Genetic Screening": { icon: "code", color: "#8B5CF6" },
  "Vaccinations": { icon: "shield", color: "#10B981" },
  "Monitoring": { icon: "activity", color: "#EF4444" },
  "Nutrition": { icon: "coffee", color: "#F59E0B" },
  "Mental Health": { icon: "smile", color: "#EC4899" },
  "Education": { icon: "book-open", color: "#06B6D4" },
  "Initial Visit": { icon: "user-plus", color: "#6366F1" },
};

const TRIMESTER_COLORS: Record<string, string> = {
  first: "#8B5CF6",
  second: "#3B82F6",
  third: "#10B981",
  all: "#6B7280",
  any: "#6B7280",
};

const IMPORTANCE_COLORS: Record<string, string> = {
  required: "#EF4444",
  recommended: "#3B82F6",
  optional: "#6B7280",
};

export default function PrenatalGuidelinesScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [selectedTrimester, setSelectedTrimester] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data, isLoading, refetch } = useQuery<PrenatalData>({
    queryKey: ["/api/guidelines/prenatal"],
  });

  const filteredGuidelines = useMemo(() => {
    if (!data) return [];
    return data.guidelines.filter((g) => {
      const trimesterMatch =
        selectedTrimester === "All" ||
        g.trimester === TRIMESTER_MAP[selectedTrimester] ||
        g.trimester === "all" ||
        g.trimester === "any";
      const categoryMatch =
        selectedCategory === "All" || g.category === selectedCategory;
      return trimesterMatch && categoryMatch;
    });
  }, [data, selectedTrimester, selectedCategory]);

  const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
    return CATEGORY_CONFIG[category]?.icon || "file-text";
  };

  const getCategoryColor = (category: string): string => {
    return CATEGORY_CONFIG[category]?.color || "#6B7280";
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading prenatal guidelines...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>
          Prenatal Care Guidelines
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Evidence-based recommendations for each stage of pregnancy
        </ThemedText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: Spacing.md }}
        >
          {TRIMESTER_OPTIONS.map((option) => {
            const isActive = selectedTrimester === option;
            return (
              <Pressable
                key={option}
                testID={`filter-trimester-${option}`}
                onPress={() => setSelectedTrimester(option)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? theme.primary : "transparent",
                    borderColor: isActive ? theme.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: isActive ? "#FFFFFF" : theme.text }}
                >
                  {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: Spacing.lg }}
        >
          {CATEGORY_OPTIONS.map((option) => {
            const isActive = selectedCategory === option;
            const catColor = CATEGORY_CONFIG[option]?.color || theme.primary;
            return (
              <Pressable
                key={option}
                testID={`filter-category-${option}`}
                onPress={() => setSelectedCategory(option)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isActive ? catColor : "transparent",
                    borderColor: isActive ? catColor : theme.border,
                  },
                ]}
              >
                {option !== "All" ? (
                  <Feather
                    name={getCategoryIcon(option)}
                    size={12}
                    color={isActive ? "#FFFFFF" : catColor}
                    style={{ marginRight: 4 }}
                  />
                ) : null}
                <ThemedText
                  type="caption"
                  style={{ color: isActive ? "#FFFFFF" : theme.text }}
                >
                  {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {filteredGuidelines.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={40} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}
            >
              No guidelines match the selected filters
            </ThemedText>
          </View>
        ) : (
          filteredGuidelines.map((guideline, index) => {
            const catColor = getCategoryColor(guideline.category);
            return (
              <View
                key={`${guideline.name}-${index}`}
                testID={`card-guideline-${index}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.backgroundDefault,
                    ...Shadows.glass,
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: catColor + "15" },
                    ]}
                  >
                    <Feather
                      name={getCategoryIcon(guideline.category)}
                      size={20}
                      color={catColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {guideline.name}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                      numberOfLines={3}
                    >
                      {guideline.description}
                    </ThemedText>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: TRIMESTER_COLORS[guideline.trimester] + "20" },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{
                            color: TRIMESTER_COLORS[guideline.trimester],
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {guideline.trimester === "all" || guideline.trimester === "any"
                            ? "All Trimesters"
                            : `${guideline.trimester.charAt(0).toUpperCase() + guideline.trimester.slice(1)} Trimester`}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: IMPORTANCE_COLORS[guideline.importance] + "20" },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{
                            color: IMPORTANCE_COLORS[guideline.importance],
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {guideline.importance.charAt(0).toUpperCase() + guideline.importance.slice(1)}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: theme.backgroundSecondary },
                        ]}
                      >
                        <Feather name="clock" size={9} color={theme.textSecondary} />
                        <ThemedText
                          type="caption"
                          style={{
                            color: theme.textSecondary,
                            fontSize: 10,
                            marginLeft: 3,
                          }}
                        >
                          {guideline.timing}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
});
