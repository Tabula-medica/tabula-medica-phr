import React, { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { Spacing, BorderRadius } from "@/constants/theme";

interface DrugCouponProgram {
  id: string;
  drugName: string;
  genericName: string | null;
  manufacturer: string;
  category: string;
  description: string;
  savingsDescription: string;
  couponUrl: string;
  type: "manufacturer_copay" | "patient_assistance" | "discount_program" | "savings_card";
}

interface ImagingType {
  name: string;
  description: string;
  typicalSavingsRange: string;
  commonUses: string[];
}

interface DrugCouponsData {
  programs: DrugCouponProgram[];
  categories: string[];
  grouped: Record<string, DrugCouponProgram[]>;
  totalPrograms: number;
  disclaimer: string;
}

interface RadiologyData {
  provider: {
    name: string;
    description: string;
    websiteUrl: string;
    highlights: string[];
  };
  imagingTypes: ImagingType[];
  savingsTips: string[];
  disclaimer: string;
}

type ActiveTab = "coupons" | "imaging";

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  autoimmune: { icon: "shield", color: "#8B5CF6", label: "Autoimmune" },
  cardiovascular: { icon: "heart", color: "#EF4444", label: "Cardiovascular" },
  diabetes: { icon: "activity", color: "#3B82F6", label: "Diabetes" },
  discount_platform: { icon: "percent", color: "#10B981", label: "Discount Platforms" },
  mental_health: { icon: "smile", color: "#F59E0B", label: "Mental Health" },
  oncology: { icon: "target", color: "#EC4899", label: "Oncology" },
  respiratory: { icon: "wind", color: "#06B6D4", label: "Respiratory" },
  weight_management: { icon: "trending-down", color: "#14B8A6", label: "Weight Management" },
};

const TYPE_LABELS: Record<string, string> = {
  manufacturer_copay: "Copay Card",
  patient_assistance: "Patient Assistance",
  discount_program: "Discount Program",
  savings_card: "Savings Card",
};

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || { icon: "tag" as keyof typeof Feather.glyphMap, color: "#6B7280", label: category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) };
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

export default function SavingsHubScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<ActiveTab>("coupons");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: couponsData, isLoading: couponsLoading, refetch: refetchCoupons } = useQuery<DrugCouponsData>({
    queryKey: ["/api/savings/drug-coupons"],
  });

  const { data: radiologyData, isLoading: radiologyLoading, refetch: refetchRadiology } = useQuery<RadiologyData>({
    queryKey: ["/api/savings/radiology"],
  });

  const filteredPrograms = useMemo(() => {
    if (!couponsData) return [];
    let programs = couponsData.programs;

    if (selectedCategory) {
      programs = programs.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      programs = programs.filter(
        p =>
          p.drugName.toLowerCase().includes(query) ||
          (p.genericName && p.genericName.toLowerCase().includes(query)) ||
          p.manufacturer.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    return programs;
  }, [couponsData, selectedCategory, searchQuery]);

  const isLoading = activeTab === "coupons" ? couponsLoading : radiologyLoading;

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: 100,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              refetchCoupons();
              refetchRadiology();
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
          <Pressable
            testID="button-insurance-learning"
            onPress={() => navigation.navigate("InsuranceLearning")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#3B82F620",
              padding: Spacing.sm,
              borderRadius: BorderRadius.lg,
              borderWidth: 1,
              borderColor: "#3B82F640",
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#3B82F630", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Feather name="book-open" size={14} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" style={{ fontWeight: "700", fontSize: 11 }}>Insurance Guide</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Learn the basics</ThemedText>
            </View>
            <Feather name="chevron-right" size={14} color="#3B82F6" />
          </Pressable>
          <Pressable
            testID="button-uninsured-platform"
            onPress={() => navigation.navigate("UninsuredPlatform")}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#10B98120",
              padding: Spacing.sm,
              borderRadius: BorderRadius.lg,
              borderWidth: 1,
              borderColor: "#10B98140",
            }}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#10B98130", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <Feather name="heart" size={14} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" style={{ fontWeight: "700", fontSize: 11 }}>No Insurance?</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Medicare rates</ThemedText>
            </View>
            <Feather name="chevron-right" size={14} color="#10B981" />
          </Pressable>
        </View>

        <View style={styles.tabContainer}>
          <Pressable
            testID="tab-coupons"
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === "coupons" ? theme.primary : theme.backgroundSecondary,
                borderColor: activeTab === "coupons" ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setActiveTab("coupons")}
          >
            <Feather
              name="dollar-sign"
              size={16}
              color={activeTab === "coupons" ? "#FFFFFF" : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                color: activeTab === "coupons" ? "#FFFFFF" : theme.textSecondary,
                marginLeft: Spacing.xs,
                fontWeight: "600",
              }}
            >
              Drug Coupons
            </ThemedText>
          </Pressable>
          <Pressable
            testID="tab-imaging"
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === "imaging" ? theme.primary : theme.backgroundSecondary,
                borderColor: activeTab === "imaging" ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setActiveTab("imaging")}
          >
            <Feather
              name="image"
              size={16}
              color={activeTab === "imaging" ? "#FFFFFF" : theme.textSecondary}
            />
            <ThemedText
              type="small"
              style={{
                color: activeTab === "imaging" ? "#FFFFFF" : theme.textSecondary,
                marginLeft: Spacing.xs,
                fontWeight: "600",
              }}
            >
              Affordable Imaging
            </ThemedText>
          </Pressable>
        </View>

        {activeTab === "coupons" ? (
          <CouponsSection
            data={couponsData}
            filteredPrograms={filteredPrograms}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            theme={theme}
          />
        ) : (
          <RadiologySection data={radiologyData} theme={theme} />
        )}
      </ScrollView>
    </ThemedView>
  );
}

function CouponsSection({
  data,
  filteredPrograms,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  theme,
}: {
  data: DrugCouponsData | undefined;
  filteredPrograms: DrugCouponProgram[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  theme: any;
}) {
  if (!data) return null;

  return (
    <View>
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
        ]}
      >
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          testID="input-search-drugs"
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search drugs, manufacturers..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 ? (
          <Pressable testID="button-clear-search" onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryScrollContent}
      >
        <Pressable
          testID="button-category-all"
          style={[
            styles.categoryChip,
            {
              backgroundColor: !selectedCategory ? theme.primary : theme.backgroundSecondary,
              borderColor: !selectedCategory ? theme.primary : theme.border,
            },
          ]}
          onPress={() => setSelectedCategory(null)}
        >
          <ThemedText
            type="caption"
            style={{
              color: !selectedCategory ? "#FFFFFF" : theme.textSecondary,
              fontWeight: "600",
            }}
          >
            All ({data.totalPrograms})
          </ThemedText>
        </Pressable>
        {data.categories.map(cat => {
          const config = getCategoryConfig(cat);
          const isSelected = selectedCategory === cat;
          return (
            <Pressable
              key={cat}
              testID={`button-category-${cat}`}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? config.color : theme.backgroundSecondary,
                  borderColor: isSelected ? config.color : theme.border,
                },
              ]}
              onPress={() => setSelectedCategory(isSelected ? null : cat)}
            >
              <Feather
                name={config.icon}
                size={12}
                color={isSelected ? "#FFFFFF" : config.color}
                style={{ marginRight: Spacing.xs }}
              />
              <ThemedText
                type="caption"
                style={{
                  color: isSelected ? "#FFFFFF" : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                {config.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
        {filteredPrograms.length} program{filteredPrograms.length !== 1 ? "s" : ""} found
      </ThemedText>

      {filteredPrograms.map(program => (
        <DrugCouponCard key={program.id} program={program} theme={theme} />
      ))}

      {filteredPrograms.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="search" size={32} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md, textAlign: "center" }}>
            No matching programs
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
            Try adjusting your search or category filter
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.disclaimerContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="info" size={14} color={theme.textSecondary} style={{ marginRight: Spacing.sm }} />
        <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1 }}>
          {data.disclaimer}
        </ThemedText>
      </View>
    </View>
  );
}

function DrugCouponCard({ program, theme }: { program: DrugCouponProgram; theme: any }) {
  const config = getCategoryConfig(program.category);

  return (
    <Card
      testID={`card-coupon-${program.id}`}
      style={styles.couponCard}
      onPress={() => openUrl(program.couponUrl)}
      accessibilityLabel={`${program.drugName} savings program`}
      accessibilityHint="Opens the coupon website in your browser"
    >
      <View style={styles.couponHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: config.color + "20" }]}>
          <Feather name={config.icon} size={14} color={config.color} />
        </View>
        <View style={styles.couponTitleArea}>
          <ThemedText type="h4">{program.drugName}</ThemedText>
          {program.genericName ? (
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {program.genericName}
            </ThemedText>
          ) : null}
        </View>
        <View style={[styles.typeBadge, { backgroundColor: theme.primary + "15" }]}>
          <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "600" }}>
            {TYPE_LABELS[program.type] || program.type}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
        {program.manufacturer}
      </ThemedText>

      <ThemedText type="small" style={{ marginTop: Spacing.sm }}>
        {program.description}
      </ThemedText>

      <View style={[styles.savingsHighlight, { backgroundColor: theme.success + "15" }]}>
        <Feather name="dollar-sign" size={14} color={theme.success} style={{ marginRight: Spacing.xs }} />
        <ThemedText type="small" style={{ color: theme.success, fontWeight: "600", flex: 1 }}>
          {program.savingsDescription}
        </ThemedText>
      </View>

      <View style={styles.couponFooter}>
        <Feather name="external-link" size={14} color={theme.primary} />
        <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs, fontWeight: "600" }}>
          Visit Savings Program
        </ThemedText>
      </View>
    </Card>
  );
}

function RadiologySection({ data, theme }: { data: RadiologyData | undefined; theme: any }) {
  if (!data) return null;

  return (
    <View>
      <Card
        testID="card-radiology-provider"
        style={styles.providerCard}
        onPress={() => openUrl(data.provider.websiteUrl)}
        accessibilityLabel="RadiologyAssist website"
        accessibilityHint="Opens RadiologyAssist.com in your browser"
      >
        <View style={styles.providerHeader}>
          <View style={[styles.providerIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="image" size={24} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="h3">{data.provider.name}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.success, fontWeight: "600" }}>
              Save 50-80% vs Hospital Pricing
            </ThemedText>
          </View>
          <Feather name="external-link" size={18} color={theme.primary} />
        </View>

        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          {data.provider.description}
        </ThemedText>

        {data.provider.highlights.map((highlight, index) => (
          <View key={index} style={styles.highlightRow}>
            <Feather name="check-circle" size={14} color={theme.success} style={{ marginRight: Spacing.sm }} />
            <ThemedText type="small" style={{ flex: 1 }}>
              {highlight}
            </ThemedText>
          </View>
        ))}

        <View style={[styles.visitButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700" }}>
            Visit RadiologyAssist.com
          </ThemedText>
          <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: Spacing.sm }} />
        </View>
      </Card>

      <ThemedText type="h3" style={{ marginTop: Spacing["2xl"], marginBottom: Spacing.md }}>
        Common Imaging Types
      </ThemedText>

      {data.imagingTypes.map((imaging, index) => (
        <ImagingTypeCard key={index} imaging={imaging} theme={theme} />
      ))}

      <ThemedText type="h3" style={{ marginTop: Spacing["2xl"], marginBottom: Spacing.md }}>
        Tips for Saving on Imaging
      </ThemedText>

      <Card testID="card-savings-tips" style={styles.tipsCard}>
        {data.savingsTips.map((tip, index) => (
          <View key={index} style={styles.tipRow}>
            <View style={[styles.tipNumber, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "700" }}>
                {index + 1}
              </ThemedText>
            </View>
            <ThemedText type="small" style={{ flex: 1 }}>
              {tip}
            </ThemedText>
          </View>
        ))}
      </Card>

      <View style={[styles.disclaimerContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="info" size={14} color={theme.textSecondary} style={{ marginRight: Spacing.sm }} />
        <ThemedText type="caption" style={{ color: theme.textSecondary, flex: 1 }}>
          {data.disclaimer}
        </ThemedText>
      </View>
    </View>
  );
}

function ImagingTypeCard({ imaging, theme }: { imaging: ImagingType; theme: any }) {
  return (
    <Card
      testID={`card-imaging-${imaging.name.split(" ")[0].toLowerCase()}`}
      style={styles.imagingCard}
    >
      <ThemedText type="h4">{imaging.name}</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
        {imaging.description}
      </ThemedText>

      <View style={[styles.priceRange, { backgroundColor: theme.success + "15" }]}>
        <Feather name="dollar-sign" size={14} color={theme.success} />
        <ThemedText type="small" style={{ color: theme.success, fontWeight: "600", marginLeft: Spacing.xs }}>
          {imaging.typicalSavingsRange}
        </ThemedText>
      </View>

      <View style={styles.usesContainer}>
        {imaging.commonUses.map((use, i) => (
          <View key={i} style={[styles.useBadge, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {use}
            </ThemedText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm : Spacing.xs,
  },
  categoryScroll: {
    marginBottom: Spacing.md,
  },
  categoryScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  disclaimerContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.lg,
  },
  couponCard: {
    marginBottom: Spacing.md,
  },
  couponHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  couponTitleArea: {
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  savingsHighlight: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.md,
  },
  couponFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  providerCard: {
    marginBottom: Spacing.md,
  },
  providerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: Spacing.sm,
  },
  visitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  imagingCard: {
    marginBottom: Spacing.md,
  },
  priceRange: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.sm,
  },
  usesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  useBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  tipsCard: {
    marginBottom: Spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
});
