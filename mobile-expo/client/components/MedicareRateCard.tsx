import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import Animated, { FadeIn } from "react-native-reanimated";

interface MedicareRate {
  cptCode: string;
  shortDescription: string;
  longDescription?: string;
  category: string;
  facilityRate: number;
  nonFacilityRate: number;
  tabulaMedicaRate: number;
  nationalAvgRetail: number;
  savingsPercent: number;
  rvu?: { work: number; practice: number; malpractice: number; total: number };
  conversionFactor?: number;
  effectiveDate?: string;
  hsaEligible?: boolean;
}

interface MedicareRateCardProps {
  rate: MedicareRate;
  onAddToGFE?: (rate: MedicareRate) => void;
  compact?: boolean;
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

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  "Office Visits": "user",
  "Preventive Care": "shield",
  "Lab & Pathology": "activity",
  "Imaging": "image",
  "Mental Health": "smile",
  "Procedures": "tool",
  "Dental": "sun",
};

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function MedicareRateCard({ rate, onAddToGFE, compact }: MedicareRateCardProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[rate.category] || "#6B7280";
  const savings = rate.nationalAvgRetail - rate.tabulaMedicaRate;

  return (
    <Pressable testID={`rate-card-${rate.cptCode}`} onPress={() => setExpanded(!expanded)}>
      <Card style={[styles.card, compact ? styles.cardCompact : undefined]}>
        <View style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: catColor + "20" }]}>
            <Feather name={CATEGORY_ICONS[rate.category] || "file-text"} size={compact ? 16 : 18} color={catColor} />
          </View>
          <View style={styles.content}>
            <ThemedText type="small" style={styles.cptLabel}>CPT {rate.cptCode}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }} numberOfLines={expanded ? 3 : 1}>
              {rate.shortDescription}
            </ThemedText>
          </View>
          <View style={styles.priceColumn}>
            <ThemedText type="subtitle" style={styles.price}>{formatCurrency(rate.tabulaMedicaRate)}</ThemedText>
            <ThemedText type="small" style={[styles.retailPrice, { color: theme.textSecondary }]}>
              {formatCurrency(rate.nationalAvgRetail)}
            </ThemedText>
          </View>
        </View>

        {expanded ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.expandedSection}>
            <View style={styles.savingsBanner}>
              <Feather name="trending-down" size={14} color="#10B981" />
              <ThemedText type="small" style={styles.savingsText}>
                You Save {formatCurrency(savings)} ({rate.savingsPercent}% off retail)
              </ThemedText>
            </View>

            <View style={styles.rateGrid}>
              <View style={styles.rateItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>Medicare Rate</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{formatCurrency(rate.nonFacilityRate)}</ThemedText>
              </View>
              <View style={styles.rateItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>Your Price</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700", color: "#10B981" }}>{formatCurrency(rate.tabulaMedicaRate)}</ThemedText>
              </View>
              <View style={styles.rateItem}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>Retail Price</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600", color: "#EF4444" }}>{formatCurrency(rate.nationalAvgRetail)}</ThemedText>
              </View>
            </View>

            {rate.rvu ? (
              <View style={[styles.rvuSection, { borderTopColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 4 }}>RVU Breakdown</ThemedText>
                <View style={styles.rateGrid}>
                  <View style={styles.rateItem}>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Work</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>{rate.rvu.work}</ThemedText>
                  </View>
                  <View style={styles.rateItem}>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Practice</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>{rate.rvu.practice}</ThemedText>
                  </View>
                  <View style={styles.rateItem}>
                    <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Malpractice</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>{rate.rvu.malpractice}</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={styles.badges}>
              {rate.hsaEligible ? (
                <View style={[styles.badge, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}>
                  <Feather name="credit-card" size={10} color="#10B981" />
                  <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700", fontSize: 10, marginLeft: 4 }}>HSA ELIGIBLE</ThemedText>
                </View>
              ) : null}
              <View style={[styles.badge, { backgroundColor: "#3B82F615", borderColor: "#3B82F630" }]}>
                <Feather name="shield" size={10} color="#3B82F6" />
                <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700", fontSize: 10, marginLeft: 4 }}>CMS PFS 2026</ThemedText>
              </View>
            </View>

            {onAddToGFE ? (
              <Pressable testID={`button-add-gfe-${rate.cptCode}`} onPress={() => onAddToGFE(rate)} style={[styles.addButton, { backgroundColor: theme.primary }]}>
                <Feather name="plus" size={14} color="#FFF" />
                <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700", marginLeft: 4 }}>Add to Good Faith Estimate</ThemedText>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm, padding: Spacing.md },
  cardCompact: { padding: Spacing.sm },
  row: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  content: { flex: 1 },
  cptLabel: { fontWeight: "700" },
  priceColumn: { alignItems: "flex-end" },
  price: { fontWeight: "800", color: "#10B981" },
  retailPrice: { textDecorationLine: "line-through", fontSize: 11 },
  expandedSection: { marginTop: Spacing.md },
  savingsBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#10B98115", borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  savingsText: { color: "#10B981", fontWeight: "700", marginLeft: 6 },
  rateGrid: { flexDirection: "row", justifyContent: "space-between" },
  rateItem: { flex: 1 },
  rvuSection: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 0.5 },
  badges: { flexDirection: "row", gap: 6, marginTop: Spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1, alignSelf: "flex-start" },
  addButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: BorderRadius.md, marginTop: Spacing.md },
});
