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

type NewbornScreening = {
  name: string;
  category: string;
  timing: string;
  method: string;
  description: string;
  importance: "required" | "recommended";
};

type NewbornData = {
  guidelines: NewbornScreening[];
  total: number;
};

const CATEGORY_OPTIONS = [
  "All",
  "Metabolic",
  "Endocrine",
  "Hemoglobin",
  "Hearing",
  "Heart",
  "Other",
  "Infectious Disease",
  "Developmental",
];

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  "Metabolic": { icon: "droplet", color: "#3B82F6" },
  "Endocrine": { icon: "thermometer", color: "#F59E0B" },
  "Hemoglobin": { icon: "heart", color: "#EF4444" },
  "Hearing": { icon: "headphones", color: "#8B5CF6" },
  "Heart": { icon: "activity", color: "#EC4899" },
  "Other": { icon: "plus-circle", color: "#6B7280" },
  "Infectious Disease": { icon: "alert-triangle", color: "#F97316" },
  "Developmental": { icon: "trending-up", color: "#10B981" },
};

const IMPORTANCE_COLORS: Record<string, string> = {
  required: "#EF4444",
  recommended: "#3B82F6",
};

export default function NewbornScreeningScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const { data, isLoading, refetch } = useQuery<NewbornData>({
    queryKey: ["/api/guidelines/newborn-screening"],
  });

  const filteredGuidelines = useMemo(() => {
    if (!data) return [];
    if (selectedCategory === "All") return data.guidelines;
    return data.guidelines.filter((g) => g.category === selectedCategory);
  }, [data, selectedCategory]);

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
          Loading newborn screening guidelines...
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
          Newborn Screening
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Essential screenings and tests for newborns
        </ThemedText>

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
              No screenings match the selected filter
            </ThemedText>
          </View>
        ) : (
          filteredGuidelines.map((screening, index) => {
            const catColor = getCategoryColor(screening.category);
            return (
              <View
                key={`${screening.name}-${index}`}
                testID={`card-screening-${index}`}
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
                      name={getCategoryIcon(screening.category)}
                      size={20}
                      color={catColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      {screening.name}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                      numberOfLines={3}
                    >
                      {screening.description}
                    </ThemedText>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: catColor + "15" },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{
                            color: catColor,
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {screening.method}
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
                          {screening.timing}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: IMPORTANCE_COLORS[screening.importance] + "20" },
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={{
                            color: IMPORTANCE_COLORS[screening.importance],
                            fontSize: 10,
                            fontWeight: "600",
                          }}
                        >
                          {screening.importance.charAt(0).toUpperCase() + screening.importance.slice(1)}
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
