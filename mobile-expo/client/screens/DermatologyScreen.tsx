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

type DermatologyCondition = {
  id: string;
  name: string;
  category: string;
  prevalence: string;
  description: string;
  symptoms: string[];
  triggers: string[];
  treatments: string[];
  whenToSeeDoctor: string;
  icdCode: string;
  abcdeRule?: Record<string, string>;
};

type SelfExamGuide = {
  title: string;
  frequency: string;
  description: string;
  steps: { area: string; instruction: string }[];
  abcdeRule: Record<string, string>;
};

type UVGuidance = {
  range: string;
  level: string;
  protection: string;
};

type TabType = "conditions" | "self-exam" | "uv-safety" | "screenings";

const CATEGORY_COLORS: Record<string, string> = {
  "Inflammatory": "#EF4444",
  "Autoimmune": "#8B5CF6",
  "Common": "#3B82F6",
  "Cancer": "#DC2626",
  "Allergic/Irritant": "#F59E0B",
  "Infectious": "#F97316",
};

const CATEGORY_OPTIONS = ["All", "Common", "Inflammatory", "Autoimmune", "Cancer", "Allergic/Irritant", "Infectious"];

export default function DermatologyScreen() {
  const { theme: colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>("conditions");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null);

  const { data: conditionsData, isLoading: loadingConditions } = useQuery<{ conditions: DermatologyCondition[]; total: number }>({
    queryKey: ["/api/dermatology/conditions"],
  });

  const { data: selfExamData } = useQuery<SelfExamGuide>({
    queryKey: ["/api/dermatology/self-exam"],
  });

  const { data: uvData } = useQuery<{ guidance: UVGuidance[] }>({
    queryKey: ["/api/dermatology/uv-guidance"],
  });

  const filteredConditions = useMemo(() => {
    if (!conditionsData?.conditions) return [];
    if (selectedCategory === "All") return conditionsData.conditions;
    return conditionsData.conditions.filter((c) => c.category === selectedCategory);
  }, [conditionsData, selectedCategory]);

  const TABS: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "conditions", label: "Conditions", icon: "book" },
    { key: "self-exam", label: "Self-Exam", icon: "search" },
    { key: "uv-safety", label: "UV Safety", icon: "sun" },
    { key: "screenings", label: "ABCDE Rule", icon: "alert-circle" },
  ];

  const UV_LEVEL_COLORS: Record<string, string> = {
    "Low": "#10B981",
    "Moderate": "#F59E0B",
    "High": "#F97316",
    "Very High": "#EF4444",
    "Extreme": "#DC2626",
  };

  const renderConditionCard = (condition: DermatologyCondition) => {
    const isExpanded = expandedCondition === condition.id;
    const categoryColor = CATEGORY_COLORS[condition.category] || "#6B7280";

    return (
      <Pressable
        key={condition.id}
        style={[styles.conditionCard, { backgroundColor: colors.backgroundSecondary }]}
        onPress={() => setExpandedCondition(isExpanded ? null : condition.id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${condition.name}, ${condition.category}`}
        testID={`condition-${condition.id}`}
      >
        <View style={styles.conditionHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + "20" }]}>
            <ThemedText style={[styles.categoryBadgeText, { color: categoryColor }]}>
              {condition.category}
            </ThemedText>
          </View>
          <ThemedText style={[styles.icdCode, { color: colors.textSecondary }]}>
            ICD: {condition.icdCode}
          </ThemedText>
        </View>

        <ThemedText style={styles.conditionName}>{condition.name}</ThemedText>
        <ThemedText style={[styles.conditionPrevalence, { color: colors.textSecondary }]}>
          {condition.prevalence}
        </ThemedText>
        <ThemedText style={[styles.conditionDescription, { color: colors.textSecondary }]}>
          {condition.description}
        </ThemedText>

        {isExpanded ? (
          <View style={styles.expandedContent}>
            <View style={styles.expandedSection}>
              <ThemedText style={styles.expandedSectionTitle}>Symptoms</ThemedText>
              {condition.symptoms.map((symptom, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Feather name="check-circle" size={14} color="#3B82F6" />
                  <ThemedText style={[styles.listItemText, { color: colors.textSecondary }]}>{symptom}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.expandedSection}>
              <ThemedText style={styles.expandedSectionTitle}>Common Triggers</ThemedText>
              {condition.triggers.map((trigger, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Feather name="alert-triangle" size={14} color="#F59E0B" />
                  <ThemedText style={[styles.listItemText, { color: colors.textSecondary }]}>{trigger}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.expandedSection}>
              <ThemedText style={styles.expandedSectionTitle}>Treatments</ThemedText>
              {condition.treatments.map((treatment, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Feather name="plus-circle" size={14} color="#10B981" />
                  <ThemedText style={[styles.listItemText, { color: colors.textSecondary }]}>{treatment}</ThemedText>
                </View>
              ))}
            </View>

            <View style={[styles.doctorCard, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.doctorCardTitle, { color: "#EF4444" }]}>When to See a Doctor</ThemedText>
                <ThemedText style={[styles.doctorCardText, { color: colors.textSecondary }]}>
                  {condition.whenToSeeDoctor}
                </ThemedText>
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

  const renderSelfExam = () => {
    if (!selfExamData) return <ActivityIndicator size="large" color="#06B6D4" />;
    return (
      <View style={styles.sectionContainer}>
        <ThemedText style={styles.sectionTitle}>{selfExamData.title}</ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          {selfExamData.description}
        </ThemedText>
        <View style={[styles.frequencyBadge, { backgroundColor: "#06B6D420" }]}>
          <Feather name="calendar" size={14} color="#06B6D4" />
          <ThemedText style={[styles.frequencyText, { color: "#06B6D4" }]}>
            Recommended: {selfExamData.frequency}
          </ThemedText>
        </View>

        {selfExamData.steps.map((step, idx) => (
          <View key={idx} style={[styles.stepCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.stepNumber, { backgroundColor: "#06B6D420" }]}>
              <ThemedText style={[styles.stepNumberText, { color: "#06B6D4" }]}>{idx + 1}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.stepArea}>{step.area}</ThemedText>
              <ThemedText style={[styles.stepInstruction, { color: colors.textSecondary }]}>
                {step.instruction}
              </ThemedText>
            </View>
          </View>
        ))}

        <View style={[styles.abcdeCard, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={styles.abcdeTitle}>ABCDE Rule for Mole Assessment</ThemedText>
          <ThemedText style={[styles.abcdeSubtitle, { color: colors.textSecondary }]}>
            Use this checklist when examining any mole or skin lesion
          </ThemedText>
          {Object.entries(selfExamData.abcdeRule).map(([letter, meaning]) => (
            <View key={letter} style={styles.abcdeRow}>
              <View style={[styles.abcdeLetter, { backgroundColor: "#DC262620" }]}>
                <ThemedText style={[styles.abcdeLetterText, { color: "#DC2626" }]}>{letter}</ThemedText>
              </View>
              <ThemedText style={[styles.abcdeText, { color: colors.textSecondary }]}>{meaning}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderUVSafety = () => {
    if (!uvData?.guidance) return <ActivityIndicator size="large" color="#F59E0B" />;
    return (
      <View style={styles.sectionContainer}>
        <ThemedText style={styles.sectionTitle}>UV Index & Sun Safety</ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Understanding UV exposure levels and protective measures for skin health.
        </ThemedText>

        {uvData.guidance.map((item, idx) => (
          <View key={idx} style={[styles.uvCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.uvHeader}>
              <View style={[styles.uvLevelBadge, { backgroundColor: (UV_LEVEL_COLORS[item.level] || "#6B7280") + "20" }]}>
                <ThemedText style={[styles.uvRange, { color: UV_LEVEL_COLORS[item.level] || "#6B7280" }]}>
                  {item.range}
                </ThemedText>
              </View>
              <View style={[styles.uvLevelTag, { backgroundColor: (UV_LEVEL_COLORS[item.level] || "#6B7280") + "15" }]}>
                <ThemedText style={[styles.uvLevel, { color: UV_LEVEL_COLORS[item.level] || "#6B7280" }]}>
                  {item.level}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.uvProtection, { color: colors.textSecondary }]}>
              {item.protection}
            </ThemedText>
          </View>
        ))}

        <View style={[styles.sunscreenTips, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={styles.sunscreenTitle}>Sunscreen Best Practices</ThemedText>
          {[
            "Apply SPF 30+ broad-spectrum sunscreen 15-30 minutes before sun exposure",
            "Reapply every 2 hours, or immediately after swimming/sweating",
            "Use approximately 1 oz (shot glass amount) for full body coverage",
            "Don't forget ears, neck, tops of feet, and scalp (if thinning hair)",
            "UV rays penetrate clouds; wear sunscreen even on overcast days",
            "Check expiration dates; sunscreen loses effectiveness over time",
          ].map((tip, idx) => (
            <View key={idx} style={styles.listItem}>
              <Feather name="sun" size={14} color="#F59E0B" />
              <ThemedText style={[styles.listItemText, { color: colors.textSecondary }]}>{tip}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderABCDE = () => {
    const melanoma = conditionsData?.conditions?.find(c => c.id === "melanoma");
    return (
      <View style={styles.sectionContainer}>
        <ThemedText style={styles.sectionTitle}>Melanoma Detection: ABCDE Rule</ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          The ABCDE rule is a guide to the usual signs of melanoma. Report any changes to your doctor.
        </ThemedText>

        {melanoma?.abcdeRule ? Object.entries(melanoma.abcdeRule).map(([letter, desc]) => (
          <View key={letter} style={[styles.abcdeDetailCard, { backgroundColor: colors.backgroundSecondary }]}>
            <View style={[styles.abcdeDetailLetter, { backgroundColor: "#DC262620" }]}>
              <ThemedText style={[styles.abcdeDetailLetterText, { color: "#DC2626" }]}>{letter}</ThemedText>
            </View>
            <ThemedText style={[styles.abcdeDetailText, { color: colors.textSecondary }]}>
              {desc}
            </ThemedText>
          </View>
        )) : (
          <View style={[styles.abcdeDetailCard, { backgroundColor: colors.backgroundSecondary }]}>
            {["A - Asymmetry: One half doesn't match the other",
              "B - Border: Irregular, ragged, or blurred edges",
              "C - Color: Not uniform; mix of shades",
              "D - Diameter: Larger than 6mm (pencil eraser)",
              "E - Evolving: Changing in size, shape, or color",
            ].map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Feather name="alert-circle" size={14} color="#DC2626" />
                <ThemedText style={[styles.listItemText, { color: colors.textSecondary }]}>{item}</ThemedText>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.disclaimerCard, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
          <Feather name="alert-triangle" size={16} color="#EF4444" />
          <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            This information is for educational purposes. It does not replace professional dermatological evaluation. If you notice any suspicious skin changes, consult a dermatologist immediately.
          </ThemedText>
        </View>
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
          <View style={[styles.headerIconContainer, { backgroundColor: "#06B6D420" }]}>
            <Feather name="eye" size={28} color="#06B6D4" />
          </View>
          <ThemedText style={styles.headerTitle}>Dermatology</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Skin health education, self-examination, and condition reference
          </ThemedText>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key ? [styles.activeTab, { backgroundColor: "#06B6D420" }] : { backgroundColor: colors.backgroundSecondary },
              ]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.key }}
              testID={`tab-${tab.key}`}
            >
              <Feather
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? "#06B6D4" : colors.textSecondary}
              />
              <ThemedText style={[styles.tabText, { color: activeTab === tab.key ? "#06B6D4" : colors.textSecondary }]}>
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab === "conditions" ? (
          <View style={styles.conditionsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
              {CATEGORY_OPTIONS.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.filterChip,
                    selectedCategory === cat
                      ? { backgroundColor: "#06B6D420" }
                      : { backgroundColor: colors.backgroundSecondary },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedCategory === cat }}
                  testID={`filter-${cat}`}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      { color: selectedCategory === cat ? "#06B6D4" : colors.textSecondary },
                    ]}
                  >
                    {cat}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {loadingConditions ? (
              <ActivityIndicator size="large" color="#06B6D4" style={styles.loader} />
            ) : (
              filteredConditions.map(renderConditionCard)
            )}
          </View>
        ) : null}

        {activeTab === "self-exam" ? renderSelfExam() : null}
        {activeTab === "uv-safety" ? renderUVSafety() : null}
        {activeTab === "screenings" ? renderABCDE() : null}
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
  activeTab: {},
  tabText: { fontSize: 13, fontWeight: "600" },
  filterContainer: { gap: 8, paddingBottom: Spacing.md },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  conditionsContainer: { gap: 12 },
  conditionCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 6 },
  conditionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  categoryBadgeText: { fontSize: 11, fontWeight: "600" },
  icdCode: { fontSize: 11 },
  conditionName: { fontSize: 17, fontWeight: "700" },
  conditionPrevalence: { fontSize: 12, fontStyle: "italic" },
  conditionDescription: { fontSize: 13, lineHeight: 19 },
  expandedContent: { gap: 12, marginTop: 8 },
  expandedSection: { gap: 6 },
  expandedSectionTitle: { fontSize: 14, fontWeight: "600" },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  listItemText: { fontSize: 13, flex: 1, lineHeight: 18 },
  doctorCard: {
    flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, gap: 10, alignItems: "flex-start",
  },
  doctorCardTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  doctorCardText: { fontSize: 12, lineHeight: 17 },
  expandIndicator: { alignItems: "center", marginTop: 4 },
  sectionContainer: { gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  sectionDescription: { fontSize: 14, marginBottom: 8 },
  frequencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, alignSelf: "flex-start",
  },
  frequencyText: { fontSize: 13, fontWeight: "500" },
  stepCard: {
    flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 12, alignItems: "center",
  },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
  },
  stepNumberText: { fontSize: 14, fontWeight: "700" },
  stepArea: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  stepInstruction: { fontSize: 13, lineHeight: 18 },
  abcdeCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 10 },
  abcdeTitle: { fontSize: 16, fontWeight: "600" },
  abcdeSubtitle: { fontSize: 13 },
  abcdeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  abcdeLetter: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
  },
  abcdeLetterText: { fontSize: 16, fontWeight: "700" },
  abcdeText: { fontSize: 13, flex: 1 },
  uvCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 8 },
  uvHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  uvLevelBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm, minWidth: 50, alignItems: "center",
  },
  uvRange: { fontSize: 16, fontWeight: "700" },
  uvLevelTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.sm },
  uvLevel: { fontSize: 12, fontWeight: "600" },
  uvProtection: { fontSize: 13, lineHeight: 19 },
  sunscreenTips: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 8 },
  sunscreenTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  abcdeDetailCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 8, flexDirection: "row", alignItems: "flex-start" },
  abcdeDetailLetter: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
  },
  abcdeDetailLetterText: { fontSize: 20, fontWeight: "700" },
  abcdeDetailText: { fontSize: 14, flex: 1, lineHeight: 20 },
  disclaimerCard: {
    flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, gap: 10, alignItems: "flex-start",
  },
  disclaimerText: { fontSize: 12, flex: 1, lineHeight: 18 },
  loader: { marginTop: 40 },
});
