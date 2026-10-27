import React, { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius } from "@/constants/theme";

type GeneticTest = {
  id: string;
  name: string;
  category: string;
  gene?: string;
  inheritance: string;
  incidence: string;
  timing: string;
  method: string;
  description: string;
  usRUSP: boolean;
  internationalGuidance: string;
  treatmentAvailable: boolean;
  criticalTimeframe?: string;
  regions: string[];
};

type RegionInfo = {
  panel: string;
  authority: string;
  conditions: string;
  coverage: string;
  notes: string;
};

type TabType = "all" | "rusp" | "international" | "regions";

const CATEGORY_COLORS: Record<string, string> = {
  "Amino Acid Disorders": "#3B82F6",
  "Endocrine Disorders": "#F59E0B",
  "Organic Acid Disorders": "#8B5CF6",
  "Hemoglobin Disorders": "#EF4444",
  "Respiratory/Multi-System": "#06B6D4",
  "Fatty Acid Oxidation Disorders": "#F97316",
  "Enzyme Deficiencies": "#10B981",
  "Immune Deficiency": "#EC4899",
  "Neuromuscular": "#6366F1",
  "Lysosomal Storage Disorders": "#D946EF",
  "Peroxisomal Disorders": "#14B8A6",
  "Cardiac": "#EF4444",
  "Hearing": "#8B5CF6",
  "Metabolic": "#3B82F6",
  "Neurodevelopmental": "#F59E0B",
  "Infectious": "#F97316",
};

export default function GeneticScreeningScreen() {
  const { theme: colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  const { data: allTestsData, isLoading } = useQuery<{ tests: GeneticTest[]; total: number }>({
    queryKey: ["/api/genetic-screening/all"],
  });

  const { data: regionsData } = useQuery<{ regions: Record<string, RegionInfo> }>({
    queryKey: ["/api/genetic-screening/regions"],
  });

  const filteredTests = useMemo(() => {
    if (!allTestsData?.tests) return [];
    let tests = allTestsData.tests;
    if (activeTab === "rusp") {
      tests = tests.filter((t) => t.usRUSP);
    } else if (activeTab === "international") {
      tests = tests.filter((t) => !t.usRUSP);
    }
    if (selectedCategory !== "All") {
      tests = tests.filter((t) => t.category === selectedCategory);
    }
    return tests;
  }, [allTestsData, activeTab, selectedCategory]);

  const categories = useMemo(() => {
    if (!allTestsData?.tests) return ["All"];
    const cats = [...new Set(allTestsData.tests.map((t) => t.category))];
    return ["All", ...cats.sort()];
  }, [allTestsData]);

  const TABS: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "all", label: "All Tests", icon: "list" },
    { key: "rusp", label: "US RUSP", icon: "flag" },
    { key: "international", label: "International", icon: "globe" },
    { key: "regions", label: "By Region", icon: "map" },
  ];

  const renderTestCard = (test: GeneticTest) => {
    const isExpanded = expandedTest === test.id;
    const catColor = CATEGORY_COLORS[test.category] || "#6B7280";

    return (
      <Pressable
        key={test.id}
        style={[styles.testCard, { backgroundColor: colors.backgroundSecondary }]}
        onPress={() => setExpandedTest(isExpanded ? null : test.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${test.name}, ${test.category}`}
        testID={`test-${test.id}`}
      >
        <View style={styles.testHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor + "20" }]}>
            <ThemedText style={[styles.categoryBadgeText, { color: catColor }]}>{test.category}</ThemedText>
          </View>
          <View style={styles.testBadges}>
            {test.usRUSP ? (
              <View style={[styles.ruspBadge, { backgroundColor: "#3B82F620" }]}>
                <ThemedText style={[styles.ruspBadgeText, { color: "#3B82F6" }]}>US RUSP</ThemedText>
              </View>
            ) : null}
            {test.treatmentAvailable ? (
              <View style={[styles.treatmentBadge, { backgroundColor: "#10B98120" }]}>
                <Feather name="check-circle" size={10} color="#10B981" />
                <ThemedText style={[styles.treatmentBadgeText, { color: "#10B981" }]}>Treatable</ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <ThemedText style={styles.testName}>{test.name}</ThemedText>
        {test.gene ? (
          <ThemedText style={[styles.testGene, { color: colors.textSecondary }]}>
            Gene: {test.gene} | {test.inheritance}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.testGene, { color: colors.textSecondary }]}>
            {test.inheritance}
          </ThemedText>
        )}
        <ThemedText style={[styles.testIncidence, { color: colors.textSecondary }]}>
          Incidence: {test.incidence}
        </ThemedText>

        {isExpanded ? (
          <View style={styles.expandedContent}>
            <ThemedText style={[styles.testDescription, { color: colors.textSecondary }]}>
              {test.description}
            </ThemedText>

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: "#3B82F620" }]}>
                <Feather name="clock" size={14} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.detailLabel}>Timing</ThemedText>
                <ThemedText style={[styles.detailValue, { color: colors.textSecondary }]}>{test.timing}</ThemedText>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: "#8B5CF620" }]}>
                <Feather name="tool" size={14} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.detailLabel}>Method</ThemedText>
                <ThemedText style={[styles.detailValue, { color: colors.textSecondary }]}>{test.method}</ThemedText>
              </View>
            </View>

            {test.criticalTimeframe ? (
              <View style={[styles.criticalCard, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.criticalTitle, { color: "#EF4444" }]}>Critical Timeframe</ThemedText>
                  <ThemedText style={[styles.criticalText, { color: colors.textSecondary }]}>
                    {test.criticalTimeframe}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <View style={[styles.guidanceCard, { backgroundColor: "#06B6D415" }]}>
              <Feather name="globe" size={16} color="#06B6D4" />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.guidanceTitle, { color: "#06B6D4" }]}>International Guidance</ThemedText>
                <ThemedText style={[styles.guidanceText, { color: colors.textSecondary }]}>
                  {test.internationalGuidance}
                </ThemedText>
              </View>
            </View>

            <View style={styles.regionsList}>
              <ThemedText style={styles.regionsLabel}>Screened in:</ThemedText>
              <View style={styles.regionsChips}>
                {test.regions.map((region, idx) => (
                  <View key={idx} style={[styles.regionChip, { backgroundColor: "#6366F120" }]}>
                    <ThemedText style={[styles.regionChipText, { color: "#6366F1" }]}>{region}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.expandIndicator}>
          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
        </View>
      </Pressable>
    );
  };

  const renderRegions = () => {
    if (!regionsData?.regions) return <ActivityIndicator size="large" color="#6366F1" />;

    return (
      <View style={styles.regionsContainer}>
        <ThemedText style={styles.sectionTitle}>Screening Programs by Region</ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Newborn screening programs vary significantly worldwide. Here's an overview of major regional programs.
        </ThemedText>

        {Object.entries(regionsData.regions).map(([regionName, info]) => (
          <View key={regionName} style={[styles.regionCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.regionCardHeader}>
              <Feather name="map-pin" size={18} color="#6366F1" />
              <ThemedText style={styles.regionCardName}>{regionName}</ThemedText>
            </View>

            <View style={styles.regionDetail}>
              <ThemedText style={styles.regionDetailLabel}>Panel:</ThemedText>
              <ThemedText style={[styles.regionDetailValue, { color: colors.textSecondary }]}>{info.panel}</ThemedText>
            </View>
            <View style={styles.regionDetail}>
              <ThemedText style={styles.regionDetailLabel}>Authority:</ThemedText>
              <ThemedText style={[styles.regionDetailValue, { color: colors.textSecondary }]}>{info.authority}</ThemedText>
            </View>
            <View style={styles.regionDetail}>
              <ThemedText style={styles.regionDetailLabel}>Conditions:</ThemedText>
              <ThemedText style={[styles.regionDetailValue, { color: colors.textSecondary }]}>{info.conditions}</ThemedText>
            </View>
            <View style={styles.regionDetail}>
              <ThemedText style={styles.regionDetailLabel}>Coverage:</ThemedText>
              <ThemedText style={[styles.regionDetailValue, { color: colors.textSecondary }]}>{info.coverage}</ThemedText>
            </View>

            <View style={[styles.regionNote, { backgroundColor: "#6366F110" }]}>
              <Feather name="info" size={14} color="#6366F1" />
              <ThemedText style={[styles.regionNoteText, { color: colors.textSecondary }]}>{info.notes}</ThemedText>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={[styles.headerIconContainer, { backgroundColor: "#6366F120" }]}>
            <Feather name="code" size={28} color="#6366F1" />
          </View>
          <ThemedText style={styles.headerTitle}>Genetic Screening</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Newborn genetic disease screening protocols - US & worldwide
          </ThemedText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key ? { backgroundColor: "#6366F120" } : { backgroundColor: colors.backgroundSecondary },
              ]}
              onPress={() => { setActiveTab(tab.key); setSelectedCategory("All"); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
              testID={`tab-${tab.key}`}
            >
              <Feather
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? "#6366F1" : colors.textSecondary}
              />
              <ThemedText style={[styles.tabText, { color: activeTab === tab.key ? "#6366F1" : colors.textSecondary }]}>
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab !== "regions" ? (
          <>
            <View style={[styles.statsRow, { marginBottom: Spacing.md }]}>
              <View style={[styles.statBadge, { backgroundColor: "#3B82F620" }]}>
                <ThemedText style={[styles.statBadgeNumber, { color: "#3B82F6" }]}>
                  {filteredTests.filter(t => t.usRUSP).length}
                </ThemedText>
                <ThemedText style={[styles.statBadgeLabel, { color: "#3B82F6" }]}>RUSP</ThemedText>
              </View>
              <View style={[styles.statBadge, { backgroundColor: "#06B6D420" }]}>
                <ThemedText style={[styles.statBadgeNumber, { color: "#06B6D4" }]}>
                  {filteredTests.filter(t => !t.usRUSP).length}
                </ThemedText>
                <ThemedText style={[styles.statBadgeLabel, { color: "#06B6D4" }]}>International</ThemedText>
              </View>
              <View style={[styles.statBadge, { backgroundColor: "#10B98120" }]}>
                <ThemedText style={[styles.statBadgeNumber, { color: "#10B981" }]}>
                  {filteredTests.filter(t => t.treatmentAvailable).length}
                </ThemedText>
                <ThemedText style={[styles.statBadgeLabel, { color: "#10B981" }]}>Treatable</ThemedText>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.filterChip,
                    selectedCategory === cat ? { backgroundColor: "#6366F120" } : { backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  testID={`filter-${cat}`}
                >
                  <ThemedText
                    style={[styles.filterChipText, { color: selectedCategory === cat ? "#6366F1" : colors.textSecondary }]}
                  >
                    {cat}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {isLoading ? (
              <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
            ) : (
              <View style={styles.testsContainer}>
                {filteredTests.map(renderTestCard)}
              </View>
            )}
          </>
        ) : (
          renderRegions()
        )}

        <View style={[styles.disclaimerCard, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
          <Feather name="alert-triangle" size={16} color="#F59E0B" />
          <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            This information is for educational purposes only. Screening availability, methods, and guidelines vary by location and change over time. Always consult your healthcare provider for specific screening recommendations.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md },
  headerSection: { alignItems: "center", marginBottom: Spacing.lg },
  headerIconContainer: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  headerSubtitle: { fontSize: 14, textAlign: "center" },
  tabScroll: { marginBottom: Spacing.md },
  tabContainer: { gap: 8, paddingBottom: 4 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.md,
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  statBadge: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: BorderRadius.md,
  },
  statBadgeNumber: { fontSize: 20, fontWeight: "700" },
  statBadgeLabel: { fontSize: 11, fontWeight: "500" },
  filterContainer: { gap: 8, paddingBottom: Spacing.md },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  testsContainer: { gap: 12 },
  testCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 4 },
  testHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  categoryBadgeText: { fontSize: 10, fontWeight: "600" },
  testBadges: { flexDirection: "row", gap: 6 },
  ruspBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  ruspBadgeText: { fontSize: 10, fontWeight: "600" },
  treatmentBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm,
  },
  treatmentBadgeText: { fontSize: 10, fontWeight: "600" },
  testName: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  testGene: { fontSize: 12 },
  testIncidence: { fontSize: 12 },
  expandedContent: { gap: 12, marginTop: 8 },
  testDescription: { fontSize: 13, lineHeight: 19 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailIcon: {
    width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
  },
  detailLabel: { fontSize: 12, fontWeight: "600" },
  detailValue: { fontSize: 12, lineHeight: 17 },
  criticalCard: {
    flexDirection: "row", padding: Spacing.sm, borderRadius: BorderRadius.md,
    borderWidth: 1, gap: 8, alignItems: "flex-start",
  },
  criticalTitle: { fontSize: 12, fontWeight: "600" },
  criticalText: { fontSize: 12, lineHeight: 17 },
  guidanceCard: {
    flexDirection: "row", padding: Spacing.sm, borderRadius: BorderRadius.md, gap: 8, alignItems: "flex-start",
  },
  guidanceTitle: { fontSize: 12, fontWeight: "600" },
  guidanceText: { fontSize: 12, lineHeight: 17 },
  regionsList: { gap: 6 },
  regionsLabel: { fontSize: 12, fontWeight: "600" },
  regionsChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  regionChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  regionChipText: { fontSize: 10, fontWeight: "500" },
  expandIndicator: { alignItems: "center", marginTop: 4 },
  regionsContainer: { gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  sectionDescription: { fontSize: 14, marginBottom: Spacing.md },
  regionCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 8 },
  regionCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  regionCardName: { fontSize: 17, fontWeight: "700" },
  regionDetail: { flexDirection: "row", gap: 8 },
  regionDetailLabel: { fontSize: 13, fontWeight: "600", minWidth: 80 },
  regionDetailValue: { fontSize: 13, flex: 1, lineHeight: 18 },
  regionNote: {
    flexDirection: "row", padding: Spacing.sm, borderRadius: BorderRadius.sm, gap: 8, alignItems: "flex-start",
  },
  regionNoteText: { fontSize: 12, flex: 1, lineHeight: 17 },
  disclaimerCard: {
    flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, gap: 10, alignItems: "flex-start", marginTop: Spacing.lg,
  },
  disclaimerText: { fontSize: 12, flex: 1, lineHeight: 18 },
  loader: { marginTop: 40 },
});
