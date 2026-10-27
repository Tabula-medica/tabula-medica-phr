import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";
import { presentPaywall } from "@/lib/revenuecat";

type BillingCycle = "monthly" | "annual";

interface TierDef {
  id: string;
  name: string;
  tagline: string;
  audience: string;
  price: { monthly: number | null; annual: number | null; custom: boolean };
  features: string[];
  limits: {
    fhirSources: number;
    users: number;
    aiQueriesPerMonth: number;
    exportFormats: string[];
    storageGB: number;
  };
  highlighted: boolean;
  badge?: string;
  contactSales: boolean;
}

interface UserSub {
  tier: string;
  billingCycle: string;
  status: string;
  startDate: string;
  currentPeriodEnd: string;
  trialEndDate?: string;
  cancelAtPeriodEnd: boolean;
}

interface ComparisonRow {
  feature: string;
  basic: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
  government: boolean | string;
}

const TIER_COLORS: Record<string, string> = {
  basic: "#8E8E93",
  professional: "#007AFF",
  enterprise: "#5856D6",
  government: "#34C759",
};

const TIER_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  basic: "user",
  professional: "briefcase",
  enterprise: "layers",
  government: "shield",
};

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const { data: tiersData, isLoading: tiersLoading } = useQuery({
    queryKey: ["subscription-tiers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription/tiers");
      return res.json() as Promise<{ tiers: TierDef[]; comparison: ComparisonRow[] }>;
    },
  });

  const { data: currentSub, isLoading: subLoading } = useQuery({
    queryKey: ["subscription-current"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription/current");
      return res.json() as Promise<{ subscription: UserSub }>;
    },
  });

  if (tiersLoading || subLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <LoadingState />
      </ThemedView>
    );
  }

  const tiers = tiersData?.tiers ?? [];
  const comparison = tiersData?.comparison ?? [];
  const sub = currentSub?.subscription;
  const currentTier = sub?.tier ?? "basic";
  const isTrialing = sub?.status === "trial";

  function getPrice(tier: TierDef): string {
    if (tier.price.custom) return "Custom";
    const price = billingCycle === "monthly" ? tier.price.monthly : tier.price.annual;
    if (price === 0) return "Free";
    if (price == null) return "Custom";
    return `$${price}`;
  }

  function getPriceSubtext(tier: TierDef): string {
    if (tier.price.custom) return "Contact sales";
    if (tier.price.monthly === 0) return "Forever";
    if (billingCycle === "annual" && tier.price.annual != null && tier.price.monthly != null) {
      const monthlyCost = Math.round(tier.price.annual / 12);
      const savings = Math.round(((tier.price.monthly * 12 - tier.price.annual) / (tier.price.monthly * 12)) * 100);
      return `$${monthlyCost}/mo \u00B7 Save ${savings}%`;
    }
    return "/month";
  }

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: Spacing["2xl"] }}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Choose your plan</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            From free personal use to enterprise deployment. No PHI in payment metadata — Apple only sees your tier.
          </ThemedText>
        </View>

        {/* Current plan indicator */}
        {sub ? (
          <Card style={styles.currentPlanCard}>
            <View style={styles.currentPlanRow}>
              <View style={[styles.currentPlanIcon, { backgroundColor: (TIER_COLORS[currentTier] ?? theme.primary) + "20" }]}>
                <Feather
                  name={TIER_ICONS[currentTier] ?? "user"}
                  size={18}
                  color={TIER_COLORS[currentTier] ?? theme.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.currentPlanName}>
                  {tiers.find(t => t.id === currentTier)?.name ?? "Basic"} Plan
                </ThemedText>
                <ThemedText style={[styles.currentPlanStatus, { color: theme.textSecondary }]}>
                  {isTrialing ? `Trial ends ${sub.trialEndDate}` : `Active since ${sub.startDate}`}
                </ThemedText>
              </View>
              <View style={[styles.currentPlanBadge, {
                backgroundColor: isTrialing ? "#FF9F0A20" : "#34C75920",
              }]}>
                <ThemedText style={{
                  fontSize: 10, fontWeight: "600",
                  color: isTrialing ? "#FF9F0A" : "#34C759",
                }}>
                  {isTrialing ? "Trial" : "Active"}
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        {/* Billing toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            onPress={() => setBillingCycle("monthly")}
            style={[
              styles.billingOption,
              { borderColor: theme.border },
              billingCycle === "monthly" && { backgroundColor: theme.primary + "15", borderColor: theme.primary },
            ]}
            accessibilityRole="button"
            testID="billing-monthly"
          >
            <ThemedText style={[
              styles.billingText,
              { color: billingCycle === "monthly" ? theme.primary : theme.textSecondary },
            ]}>
              Monthly
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBillingCycle("annual")}
            style={[
              styles.billingOption,
              { borderColor: theme.border },
              billingCycle === "annual" && { backgroundColor: theme.primary + "15", borderColor: theme.primary },
            ]}
            accessibilityRole="button"
            testID="billing-annual"
          >
            <ThemedText style={[
              styles.billingText,
              { color: billingCycle === "annual" ? theme.primary : theme.textSecondary },
            ]}>
              Annual
            </ThemedText>
            <View style={[styles.saveBadge, { backgroundColor: "#34C75920" }]}>
              <ThemedText style={{ fontSize: 9, fontWeight: "600", color: "#34C759" }}>
                Save 17%
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tier cards */}
        {tiers.map((tier, idx) => {
          const isExpanded = expandedTier === tier.id;
          const isCurrent = currentTier === tier.id;
          const tierColor = TIER_COLORS[tier.id] ?? theme.primary;

          return (
            <Animated.View key={tier.id} entering={FadeInDown.delay(idx * 80)}>
              <Card style={[
                styles.tierCard,
                tier.highlighted && { borderWidth: 1.5, borderColor: tierColor },
              ]} testID={`tier-${tier.id}`}>
                {/* Badge */}
                {tier.badge ? (
                  <View style={[styles.tierBadge, { backgroundColor: tierColor + "18" }]}>
                    <ThemedText style={[styles.tierBadgeText, { color: tierColor }]}>
                      {tier.badge}
                    </ThemedText>
                  </View>
                ) : null}

                {/* Tier header */}
                <TouchableOpacity
                  onPress={() => setExpandedTier(isExpanded ? null : tier.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tierHeader}>
                    <View style={[styles.tierIcon, { backgroundColor: tierColor + "15" }]}>
                      <Feather name={TIER_ICONS[tier.id] ?? "user"} size={22} color={tierColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.tierName}>{tier.name}</ThemedText>
                      <ThemedText style={[styles.tierAudience, { color: theme.textSecondary }]}>
                        {tier.audience}
                      </ThemedText>
                    </View>
                    <View style={styles.tierPriceCol}>
                      <ThemedText style={[styles.tierPrice, { color: tierColor }]}>
                        {getPrice(tier)}
                      </ThemedText>
                      <ThemedText style={[styles.tierPriceSubtext, { color: theme.textSecondary }]}>
                        {getPriceSubtext(tier)}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={[styles.tierTagline, { color: theme.textSecondary }]}>
                    {tier.tagline}
                  </ThemedText>

                  {/* Key features preview */}
                  <View style={styles.tierFeaturesPreview}>
                    {tier.features.slice(0, 4).map((feat, fi) => (
                      <View key={fi} style={styles.tierFeatureRow}>
                        <Feather name="check" size={12} color={tierColor} />
                        <ThemedText style={styles.tierFeatureText}>{feat}</ThemedText>
                      </View>
                    ))}
                    {tier.features.length > 4 ? (
                      <ThemedText style={[styles.tierMoreFeatures, { color: tierColor }]}>
                        +{tier.features.length - 4} more features
                      </ThemedText>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Expanded features */}
                {isExpanded ? (
                  <View style={[styles.tierExpandedSection, { borderTopColor: theme.border }]}>
                    <ThemedText style={[styles.tierExpandedTitle, { color: theme.textSecondary }]}>
                      All features
                    </ThemedText>
                    {tier.features.map((feat, fi) => (
                      <View key={fi} style={styles.tierFeatureRow}>
                        <Feather name="check" size={12} color={tierColor} />
                        <ThemedText style={styles.tierFeatureText}>{feat}</ThemedText>
                      </View>
                    ))}

                    <ThemedText style={[styles.tierExpandedTitle, { color: theme.textSecondary, marginTop: 12 }]}>
                      Limits
                    </ThemedText>
                    <View style={styles.tierLimitRow}>
                      <ThemedText style={[styles.tierLimitLabel, { color: theme.textSecondary }]}>FHIR sources</ThemedText>
                      <ThemedText style={styles.tierLimitValue}>
                        {tier.limits.fhirSources === -1 ? "Unlimited" : tier.limits.fhirSources.toString()}
                      </ThemedText>
                    </View>
                    <View style={styles.tierLimitRow}>
                      <ThemedText style={[styles.tierLimitLabel, { color: theme.textSecondary }]}>Users</ThemedText>
                      <ThemedText style={styles.tierLimitValue}>
                        {tier.limits.users === -1 ? "Unlimited" : tier.limits.users.toString()}
                      </ThemedText>
                    </View>
                    <View style={styles.tierLimitRow}>
                      <ThemedText style={[styles.tierLimitLabel, { color: theme.textSecondary }]}>AI queries / mo</ThemedText>
                      <ThemedText style={styles.tierLimitValue}>
                        {tier.limits.aiQueriesPerMonth === -1 ? "Unlimited" : tier.limits.aiQueriesPerMonth.toString()}
                      </ThemedText>
                    </View>
                    <View style={styles.tierLimitRow}>
                      <ThemedText style={[styles.tierLimitLabel, { color: theme.textSecondary }]}>Storage</ThemedText>
                      <ThemedText style={styles.tierLimitValue}>
                        {tier.limits.storageGB === -1 ? "Unlimited" : `${tier.limits.storageGB} GB`}
                      </ThemedText>
                    </View>
                    <View style={styles.tierLimitRow}>
                      <ThemedText style={[styles.tierLimitLabel, { color: theme.textSecondary }]}>Export formats</ThemedText>
                      <ThemedText style={styles.tierLimitValue}>{tier.limits.exportFormats.join(", ")}</ThemedText>
                    </View>
                  </View>
                ) : null}

                {/* CTA button */}
                {isCurrent ? (
                  <View style={[styles.tierCta, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="check-circle" size={16} color={tierColor} />
                    <ThemedText style={[styles.tierCtaText, { color: tierColor }]}>
                      Current plan
                    </ThemedText>
                  </View>
                ) : tier.contactSales ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL("mailto:sales@tabulamedica.com?subject=Enterprise%20Inquiry")}
                    style={[styles.tierCta, { backgroundColor: tierColor + "12" }]}
                    accessibilityRole="button"
                    testID={`button-contact-${tier.id}`}
                  >
                    <Feather name="mail" size={16} color={tierColor} />
                    <ThemedText style={[styles.tierCtaText, { color: tierColor }]}>
                      Contact sales
                    </ThemedText>
                  </TouchableOpacity>
                ) : tier.id === "professional" && currentTier === "basic" ? (
                  <View style={styles.tierCtaGroup}>
                    <TouchableOpacity
                      onPress={async () => {
                        if (Platform.OS === "web") {
                          Alert.alert(
                            "Subscribe via App",
                            "To subscribe, open Tabula Medica on your iOS or Android device. In-app purchases are handled securely through the App Store or Play Store."
                          );
                        } else {
                          await presentPaywall();
                        }
                      }}
                      style={[styles.tierCtaPrimary, { backgroundColor: tierColor }]}
                      accessibilityRole="button"
                      testID="button-subscribe-pro"
                    >
                      <ThemedText style={styles.tierCtaPrimaryText}>
                        {isTrialing ? "Subscribe via In-App Purchase" : "Start Free Trial & Subscribe"}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Card>
            </Animated.View>
          );
        })}

        {/* Feature comparison table */}
        <TouchableOpacity
          onPress={() => setShowComparison(!showComparison)}
          style={styles.comparisonToggle}
          accessibilityRole="button"
          testID="button-comparison"
        >
          <ThemedText style={[styles.comparisonToggleText, { color: theme.primary }]}>
            {showComparison ? "Hide" : "Show"} full feature comparison
          </ThemedText>
          <Feather
            name={showComparison ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.primary}
          />
        </TouchableOpacity>

        {showComparison ? (
          <Card style={styles.comparisonCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* Header row */}
                <View style={[styles.compRow, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={styles.compFeatureCol}>
                    <ThemedText style={[styles.compHeaderText, { color: theme.textSecondary }]}>
                      Feature
                    </ThemedText>
                  </View>
                  {["Basic", "Pro", "Enterprise", "Gov"].map((label, i) => (
                    <View key={i} style={styles.compValueCol}>
                      <ThemedText style={[styles.compHeaderText, { color: TIER_COLORS[["basic", "professional", "enterprise", "government"][i]] }]}>
                        {label}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                {/* Data rows */}
                {comparison.map((row, ri) => (
                  <View key={ri} style={[styles.compRow, ri % 2 === 0 ? {} : { backgroundColor: theme.backgroundSecondary + "40" }]}>
                    <View style={styles.compFeatureCol}>
                      <ThemedText style={styles.compFeatureText} numberOfLines={2}>
                        {row.feature}
                      </ThemedText>
                    </View>
                    {[row.basic, row.professional, row.enterprise, row.government].map((val, vi) => (
                      <View key={vi} style={styles.compValueCol}>
                        {typeof val === "boolean" ? (
                          <Feather
                            name={val ? "check" : "x"}
                            size={14}
                            color={val ? "#34C759" : "#FF3B3060"}
                          />
                        ) : (
                          <ThemedText style={styles.compValueText} numberOfLines={2}>
                            {val}
                          </ThemedText>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </Card>
        ) : null}

        {/* HIPAA compliance note */}
        <Card style={styles.hipaaNote}>
          <View style={styles.hipaaRow}>
            <Feather name="lock" size={16} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.hipaaTitle}>HIPAA-compliant billing</ThemedText>
              <ThemedText style={[styles.hipaaText, { color: theme.textSecondary }]}>
                Apple In-App Purchase handles billing securely. No Protected Health Information (PHI) is ever sent to Apple — only your anonymous user ID and subscription tier. Your medical records stay encrypted in our HIPAA-compliant backend.
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Enterprise CTA */}
        <Card style={[styles.enterpriseCta, { borderColor: TIER_COLORS.enterprise }]}>
          <Feather name="phone" size={20} color={TIER_COLORS.enterprise} />
          <ThemedText style={styles.enterpriseCtaTitle}>
            Enterprise & Government
          </ThemedText>
          <ThemedText style={[styles.enterpriseCtaText, { color: theme.textSecondary }]}>
            Enterprise and Government licenses include volume discounts, custom integrations, dedicated support SLAs, and multi-site deployment. Contact us for a tailored quote.
          </ThemedText>
          <TouchableOpacity
            onPress={() => Linking.openURL("mailto:enterprise@tabulamedica.com?subject=Enterprise%20Demo%20Request")}
            style={[styles.enterpriseCtaBtn, { backgroundColor: TIER_COLORS.enterprise }]}
            accessibilityRole="button"
            testID="button-enterprise-contact"
          >
            <Feather name="calendar" size={14} color="#fff" style={{ marginRight: 6 }} />
            <ThemedText style={styles.enterpriseCtaBtnText}>
              Schedule a demo
            </ThemedText>
          </TouchableOpacity>
        </Card>

        {/* App Store tips */}
        <View style={styles.tipsSection}>
          <ThemedText style={[styles.tipsTitle, { color: theme.textSecondary }]}>
            Subscription info
          </ThemedText>
          <View style={styles.tipRow}>
            <Feather name="info" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
              Payment charged through Apple App Store or Google Play
            </ThemedText>
          </View>
          <View style={styles.tipRow}>
            <Feather name="info" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
              Subscriptions auto-renew unless cancelled 24 hours before period end
            </ThemedText>
          </View>
          <View style={styles.tipRow}>
            <Feather name="info" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
              Manage subscriptions in your device Settings
            </ThemedText>
          </View>
          <View style={styles.tipRow}>
            <Feather name="info" size={12} color={theme.textSecondary} />
            <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
              Free trial converts to paid subscription if not cancelled
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  headerTitle: { fontSize: 24, fontWeight: "700", marginBottom: 6 },
  headerSubtitle: { fontSize: 13, lineHeight: 19 },
  currentPlanCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  currentPlanRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  currentPlanIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  currentPlanName: { fontSize: 15, fontWeight: "600" },
  currentPlanStatus: { fontSize: 11, marginTop: 2 },
  currentPlanBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  billingToggle: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  billingOption: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1,
  },
  billingText: { fontSize: 14, fontWeight: "500" },
  saveBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tierCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  tierBadge: {
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: BorderRadius.pill, marginBottom: 10,
  },
  tierBadgeText: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  tierHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  tierIcon: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  tierName: { fontSize: 18, fontWeight: "600" },
  tierAudience: { fontSize: 11, marginTop: 2 },
  tierPriceCol: { alignItems: "flex-end" },
  tierPrice: { fontSize: 24, fontWeight: "700" },
  tierPriceSubtext: { fontSize: 10, marginTop: 1 },
  tierTagline: { fontSize: 12, marginTop: 10, marginBottom: 12 },
  tierFeaturesPreview: { gap: 5 },
  tierFeatureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tierFeatureText: { fontSize: 12, flex: 1 },
  tierMoreFeatures: { fontSize: 11, fontWeight: "500", marginTop: 4 },
  tierExpandedSection: { borderTopWidth: 0.5, marginTop: 14, paddingTop: 12 },
  tierExpandedTitle: {
    fontSize: 10, fontWeight: "600", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  tierLimitRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 4,
  },
  tierLimitLabel: { fontSize: 12 },
  tierLimitValue: { fontSize: 12, fontWeight: "500" },
  tierCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md, marginTop: 14,
  },
  tierCtaText: { fontSize: 14, fontWeight: "600" },
  tierCtaGroup: { gap: 8, marginTop: 14 },
  tierCtaPrimary: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: BorderRadius.md,
  },
  tierCtaPrimaryText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  comparisonToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12, marginHorizontal: Spacing.lg,
  },
  comparisonToggleText: { fontSize: 14, fontWeight: "500" },
  comparisonCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, padding: 0 },
  compRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, paddingHorizontal: 8,
  },
  compFeatureCol: { width: 130, paddingRight: 8 },
  compHeaderText: { fontSize: 10, fontWeight: "600" },
  compValueCol: { width: 60, alignItems: "center" },
  compFeatureText: { fontSize: 10 },
  compValueText: { fontSize: 9, textAlign: "center" },
  hipaaNote: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  hipaaRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  hipaaTitle: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  hipaaText: { fontSize: 11, lineHeight: 16 },
  enterpriseCta: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    alignItems: "center", borderWidth: 1,
  },
  enterpriseCtaTitle: { fontSize: 15, fontWeight: "600", marginTop: 8, textAlign: "center" },
  enterpriseCtaText: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
  enterpriseCtaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: BorderRadius.md, marginTop: 12,
  },
  enterpriseCtaBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  tipsSection: { paddingHorizontal: Spacing.lg, marginTop: 4, gap: 6 },
  tipsTitle: {
    fontSize: 10, fontWeight: "600", marginBottom: 2,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  tipText: { fontSize: 11, flex: 1 },
});
