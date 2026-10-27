import React, { useState, useMemo } from "react";
import { View, ScrollView, Pressable, StyleSheet, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { MedicareRateCard } from "@/components/MedicareRateCard";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import Animated, { FadeInDown } from "react-native-reanimated";

interface MedicareRateResponse {
  rates: Array<{
    cptCode: string;
    shortDescription: string;
    longDescription: string;
    category: string;
    facilityRate: number;
    nonFacilityRate: number;
    tabulaMedicaRate: number;
    nationalAvgRetail: number;
    savingsPercent: number;
    rvu: { work: number; practice: number; malpractice: number; total: number };
    conversionFactor: number;
    effectiveDate: string;
    hsaEligible: boolean;
  }>;
  totalFound: number;
  categories: string[];
  conversionFactor: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Office Visits": "#3B82F6",
  "Preventive Care": "#10B981",
  "Lab & Pathology": "#8B5CF6",
  "Imaging": "#F97316",
  "Mental Health": "#06B6D4",
  "Procedures": "#EC4899",
  "Dental": "#F59E0B",
};

export default function RateCalculatorScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("q", searchQuery);
  if (selectedCategory) queryParams.set("category", selectedCategory);
  const searchPath = `/api/medicare-rates/search?${queryParams}`;

  const { data, isLoading } = useQuery<MedicareRateResponse>({
    queryKey: [searchPath],
  });

  const rates = data?.rates || [];
  const categories = data?.categories || [];

  if (isLoading) return <LoadingState fullScreen />;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
                <Feather name="dollar-sign" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Medicare 2026 Rate Calculator</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>CMS Physician Fee Schedule Lookup</ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22, color: theme.textSecondary }}>
              Look up any CPT code to see the 2026 Medicare reimbursement rate, your Tabula Direct Access price, and typical retail cost. All prices use the CMS conversion factor of ${data?.conversionFactor || "32.74"}.
            </ThemedText>
          </Card>
        </Animated.View>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: theme.border }}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            testID="input-search-rates"
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => setSearchQuery(searchInput)}
            placeholder="Search CPT code or procedure..."
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Search CPT code or procedure"
            returnKeyType="search"
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: Typography.sizes.body, color: theme.text }}
          />
          {searchInput ? (
            <Pressable onPress={() => { setSearchInput(""); setSearchQuery(""); }} accessibilityRole="button" accessibilityLabel="Clear search">
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable
              testID="filter-all"
              onPress={() => setSelectedCategory(null)}
              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, backgroundColor: !selectedCategory ? theme.primary : theme.backgroundSecondary, borderWidth: 1, borderColor: !selectedCategory ? theme.primary : theme.border }}
              accessibilityRole="tab"
              accessibilityLabel="All categories"
              accessibilityState={{ selected: !selectedCategory }}
            >
              <ThemedText type="small" style={{ fontWeight: "600", color: !selectedCategory ? "#FFF" : theme.textSecondary, fontSize: 11 }}>All</ThemedText>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                testID={`filter-${cat}`}
                onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, backgroundColor: selectedCategory === cat ? (CATEGORY_COLORS[cat] || theme.primary) : theme.backgroundSecondary, borderWidth: 1, borderColor: selectedCategory === cat ? (CATEGORY_COLORS[cat] || theme.primary) : theme.border }}
                accessibilityRole="tab"
                accessibilityLabel={`Filter by ${cat}`}
                accessibilityState={{ selected: selectedCategory === cat }}
              >
                <ThemedText type="small" style={{ fontWeight: "600", color: selectedCategory === cat ? "#FFF" : theme.textSecondary, fontSize: 11 }}>{cat}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
          {rates.length} procedures found
        </ThemedText>

        {rates.map((rate) => (
          <MedicareRateCard key={rate.cptCode} rate={rate} />
        ))}

        {rates.length === 0 ? (
          <Card style={{ padding: Spacing.xl, alignItems: "center" }}>
            <Feather name="search" size={32} color={theme.textSecondary} />
            <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No procedures found</ThemedText>
            <ThemedText type="small" style={{ marginTop: 4, color: theme.textSecondary }}>Try a different search term or category</ThemedText>
          </Card>
        ) : null}

        <Card style={{ padding: Spacing.md, marginTop: Spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="info" size={14} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6, flex: 1, lineHeight: 16, fontSize: 10 }}>
              Rates based on 2026 CMS Physician Fee Schedule, non-facility. Actual prices may vary by locality. This is not a bill or guarantee of coverage.
            </ThemedText>
          </View>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
