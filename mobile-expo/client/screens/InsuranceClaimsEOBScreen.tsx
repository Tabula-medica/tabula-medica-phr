import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Claim {
  id: string;
  date: string;
  provider: string;
  billed: number;
  allowed: number;
  paid: number;
  patientResponsibility: number;
  status: string;
  type: string;
  cptCode: string;
  explanation: string;
}

interface CostItem {
  title: string;
  description: string;
  example: string;
  met?: number;
  total?: number;
  amounts?: Record<string, number>;
  rate?: number;
  keyFields?: string[];
}

interface ClaimsData {
  insuranceInfo: any[];
  claims: Claim[];
  costEducation: Record<string, CostItem>;
}

type TabKey = "claims" | "understand" | "tracker";

export default function InsuranceClaimsEOBScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("claims");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [expandedConcept, setExpandedConcept] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ClaimsData>({
    queryKey: ["/api/insurance/claims-eob"],
  });

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "claims", label: "Claims & EOB", icon: "file-text" },
    { key: "understand", label: "Understand Costs", icon: "help-circle" },
    { key: "tracker", label: "Cost Tracker", icon: "trending-up" },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case "processed": return "#10b981";
      case "processing": return "#f59e0b";
      case "denied": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const renderClaim = (claim: Claim) => {
    const isExpanded = expandedClaim === claim.id;
    const sColor = statusColor(claim.status);
    return (
      <Animated.View key={claim.id} entering={FadeInDown.duration(200)}>
        <Pressable
          testID={`claim-${claim.id}`}
          onPress={() => setExpandedClaim(isExpanded ? null : claim.id)}
          style={[styles.claimCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <View style={styles.claimTop}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.claimProvider, { color: theme.text }]}>{claim.provider}</ThemedText>
              <View style={styles.claimMeta}>
                <ThemedText style={[styles.claimDate, { color: theme.textSecondary }]}>
                  {new Date(claim.date).toLocaleDateString()}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: `${sColor}15` }]}>
                  <ThemedText style={[styles.statusText, { color: sColor }]}>{claim.status}</ThemedText>
                </View>
                <ThemedText style={[styles.claimType, { color: theme.textSecondary }]}>{claim.type}</ThemedText>
              </View>
            </View>
            <View style={styles.claimAmounts}>
              <ThemedText style={[styles.claimYouOwe, { color: claim.patientResponsibility > 0 ? "#ef4444" : "#10b981" }]}>
                ${claim.patientResponsibility}
              </ThemedText>
              <ThemedText style={[styles.claimYouOweLabel, { color: theme.textSecondary }]}>you owe</ThemedText>
            </View>
          </View>

          {isExpanded ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.claimDetails, { borderColor: cardBorder }]}>
              <View style={styles.eobGrid}>
                <View style={styles.eobItem}>
                  <ThemedText style={[styles.eobLabel, { color: theme.textSecondary }]}>Billed</ThemedText>
                  <ThemedText style={[styles.eobValue, { color: theme.text }]}>${claim.billed}</ThemedText>
                </View>
                <View style={styles.eobItem}>
                  <ThemedText style={[styles.eobLabel, { color: theme.textSecondary }]}>Allowed</ThemedText>
                  <ThemedText style={[styles.eobValue, { color: theme.text }]}>${claim.allowed}</ThemedText>
                </View>
                <View style={styles.eobItem}>
                  <ThemedText style={[styles.eobLabel, { color: theme.textSecondary }]}>Plan Paid</ThemedText>
                  <ThemedText style={[styles.eobValue, { color: "#10b981" }]}>${claim.paid}</ThemedText>
                </View>
                <View style={styles.eobItem}>
                  <ThemedText style={[styles.eobLabel, { color: theme.textSecondary }]}>Your Cost</ThemedText>
                  <ThemedText style={[styles.eobValue, { color: "#ef4444" }]}>${claim.patientResponsibility}</ThemedText>
                </View>
              </View>
              <View style={styles.eobRow}>
                <ThemedText style={[styles.eobLabel, { color: theme.textSecondary }]}>CPT Code:</ThemedText>
                <ThemedText style={[styles.eobSmall, { color: theme.text }]}>{claim.cptCode}</ThemedText>
              </View>
              <View style={[styles.explanationBox, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}15` }]}>
                <Feather name="info" size={13} color={theme.primary} />
                <ThemedText style={[styles.explanationText, { color: theme.text }]}>{claim.explanation}</ThemedText>
              </View>
            </Animated.View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  const renderConcept = (key: string, item: CostItem) => {
    const isExpanded = expandedConcept === key;
    const iconMap: Record<string, any> = {
      deductible: "target",
      copay: "dollar-sign",
      coinsurance: "percent",
      outOfPocketMax: "shield",
      eob: "file-text",
    };
    const colorMap: Record<string, string> = {
      deductible: "#ef4444",
      copay: "#3b82f6",
      coinsurance: "#f59e0b",
      outOfPocketMax: "#10b981",
      eob: "#8b5cf6",
    };

    return (
      <Animated.View key={key} entering={FadeInDown.duration(200)}>
        <Pressable
          testID={`concept-${key}`}
          onPress={() => setExpandedConcept(isExpanded ? null : key)}
          style={[styles.conceptCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        >
          <View style={styles.conceptTop}>
            <View style={[styles.conceptIcon, { backgroundColor: `${colorMap[key] || "#6b7280"}12` }]}>
              <Feather name={iconMap[key] || "help-circle"} size={16} color={colorMap[key] || "#6b7280"} />
            </View>
            <ThemedText style={[styles.conceptTitle, { color: theme.text }]}>{item.title}</ThemedText>
            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
          </View>

          {isExpanded ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.conceptBody, { borderColor: cardBorder }]}>
              <ThemedText style={[styles.conceptDesc, { color: theme.text }]}>{item.description}</ThemedText>

              {item.met !== undefined && item.total !== undefined ? (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <ThemedText style={[styles.progressMet, { color: theme.text }]}>${item.met} of ${item.total}</ThemedText>
                    <ThemedText style={[styles.progressPct, { color: theme.primary }]}>{Math.round((item.met / item.total) * 100)}%</ThemedText>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: `${colorMap[key] || "#6b7280"}15` }]}>
                    <View style={[styles.progressFill, { width: `${(item.met / item.total) * 100}%`, backgroundColor: colorMap[key] || "#6b7280" }]} />
                  </View>
                  <ThemedText style={[styles.progressRemaining, { color: theme.textSecondary }]}>
                    ${item.total - item.met} remaining
                  </ThemedText>
                </View>
              ) : null}

              {item.amounts ? (
                <View style={styles.amountsGrid}>
                  {Object.entries(item.amounts).map(([k, v]) => (
                    <View key={k} style={[styles.amountItem, { borderColor: cardBorder }]}>
                      <ThemedText style={[styles.amountLabel, { color: theme.textSecondary }]}>{k.replace(/([A-Z])/g, " $1").trim()}</ThemedText>
                      <ThemedText style={[styles.amountValue, { color: theme.text }]}>${v}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              {item.rate !== undefined ? (
                <View style={[styles.rateBox, { backgroundColor: `${colorMap[key]}08`, borderColor: `${colorMap[key]}20` }]}>
                  <ThemedText style={[styles.rateText, { color: colorMap[key] }]}>Your rate: {item.rate}%</ThemedText>
                </View>
              ) : null}

              {item.keyFields ? (
                <View style={styles.keyFieldsSection}>
                  <ThemedText style={[styles.keyFieldsTitle, { color: theme.text }]}>What to look for on your EOB:</ThemedText>
                  {item.keyFields.map((f, i) => (
                    <View key={i} style={styles.keyFieldItem}>
                      <Feather name="check" size={12} color="#10b981" />
                      <ThemedText style={[styles.keyFieldText, { color: theme.text }]}>{f}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={[styles.exampleBox, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}15` }]}>
                <Feather name="book-open" size={13} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.exampleLabel, { color: theme.primary }]}>Example</ThemedText>
                  <ThemedText style={[styles.exampleText, { color: theme.text }]}>{item.example}</ThemedText>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          {tabs.map(t => (
            <Pressable
              key={t.key}
              testID={`tab-${t.key}`}
              onPress={() => setActiveTab(t.key)}
              style={[styles.tabBtn, {
                backgroundColor: activeTab === t.key ? theme.primary : cardBg,
                borderColor: activeTab === t.key ? theme.primary : cardBorder,
              }]}
            >
              <Feather name={t.icon} size={13} color={activeTab === t.key ? "#fff" : theme.text} />
              <ThemedText style={[styles.tabText, { color: activeTab === t.key ? "#fff" : theme.text }]}>{t.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading claims data...</ThemedText>
          </View>
        ) : data ? (
          <>
            {activeTab === "claims" ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Claims & Explanation of Benefits</ThemedText>
                <ThemedText style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  Tap a claim to see the full EOB breakdown and understand your costs
                </ThemedText>

                <View style={[styles.eobTip, { backgroundColor: "#3b82f608", borderColor: "#3b82f620" }]}>
                  <Feather name="info" size={14} color="#3b82f6" />
                  <ThemedText style={[styles.eobTipText, { color: theme.text }]}>
                    An EOB is not a bill. It explains how your insurance processed a claim and what you may owe.
                  </ThemedText>
                </View>

                {data.claims.map(renderClaim)}
              </Animated.View>
            ) : null}

            {activeTab === "understand" ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Understanding Your Insurance Costs</ThemedText>
                <ThemedText style={[styles.sectionSub, { color: theme.textSecondary }]}>
                  Learn what deductibles, copays, coinsurance, and out-of-pocket maximums mean — in plain language
                </ThemedText>
                {data.costEducation ? Object.entries(data.costEducation).map(([k, v]) => renderConcept(k, v)) : null}
              </Animated.View>
            ) : null}

            {activeTab === "tracker" ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Annual Cost Tracker</ThemedText>

                {data.costEducation?.deductible ? (
                  <View style={[styles.trackerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.trackerHeader}>
                      <Feather name="target" size={16} color="#ef4444" />
                      <ThemedText style={[styles.trackerTitle, { color: theme.text }]}>Deductible</ThemedText>
                    </View>
                    <View style={styles.trackerAmounts}>
                      <ThemedText style={[styles.trackerMet, { color: "#ef4444" }]}>${data.costEducation.deductible.met}</ThemedText>
                      <ThemedText style={[styles.trackerOf, { color: theme.textSecondary }]}>of ${data.costEducation.deductible.total}</ThemedText>
                    </View>
                    <View style={[styles.trackerBar, { backgroundColor: "#ef444415" }]}>
                      <View style={[styles.trackerFill, { width: `${((data.costEducation.deductible.met || 0) / (data.costEducation.deductible.total || 1)) * 100}%`, backgroundColor: "#ef4444" }]} />
                    </View>
                    <ThemedText style={[styles.trackerRemaining, { color: theme.textSecondary }]}>
                      ${(data.costEducation.deductible.total || 0) - (data.costEducation.deductible.met || 0)} remaining until insurance starts paying more
                    </ThemedText>
                  </View>
                ) : null}

                {data.costEducation?.outOfPocketMax ? (
                  <View style={[styles.trackerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.trackerHeader}>
                      <Feather name="shield" size={16} color="#10b981" />
                      <ThemedText style={[styles.trackerTitle, { color: theme.text }]}>Out-of-Pocket Maximum</ThemedText>
                    </View>
                    <View style={styles.trackerAmounts}>
                      <ThemedText style={[styles.trackerMet, { color: "#10b981" }]}>${data.costEducation.outOfPocketMax.met}</ThemedText>
                      <ThemedText style={[styles.trackerOf, { color: theme.textSecondary }]}>of ${data.costEducation.outOfPocketMax.total}</ThemedText>
                    </View>
                    <View style={[styles.trackerBar, { backgroundColor: "#10b98115" }]}>
                      <View style={[styles.trackerFill, { width: `${((data.costEducation.outOfPocketMax.met || 0) / (data.costEducation.outOfPocketMax.total || 1)) * 100}%`, backgroundColor: "#10b981" }]} />
                    </View>
                    <ThemedText style={[styles.trackerRemaining, { color: theme.textSecondary }]}>
                      ${(data.costEducation.outOfPocketMax.total || 0) - (data.costEducation.outOfPocketMax.met || 0)} remaining until plan pays 100%
                    </ThemedText>
                  </View>
                ) : null}

                <View style={[styles.totalSpent, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <ThemedText style={[styles.totalLabel, { color: theme.textSecondary }]}>Total Out-of-Pocket This Year</ThemedText>
                  <ThemedText style={[styles.totalValue, { color: theme.text }]}>
                    ${data.claims.reduce((sum, c) => sum + c.patientResponsibility, 0)}
                  </ThemedText>
                  <ThemedText style={[styles.totalBreakdown, { color: theme.textSecondary }]}>
                    Across {data.claims.length} claims
                  </ThemedText>
                </View>

                {data.costEducation?.copay?.amounts ? (
                  <View style={[styles.copayGuide, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <ThemedText style={[styles.copayTitle, { color: theme.text }]}>Your Copay Amounts</ThemedText>
                    {Object.entries(data.costEducation.copay.amounts).map(([k, v]) => (
                      <View key={k} style={[styles.copayRow, { borderColor: cardBorder }]}>
                        <ThemedText style={[styles.copayType, { color: theme.text }]}>{k.replace(/([A-Z])/g, " $1").trim()}</ThemedText>
                        <ThemedText style={[styles.copayAmount, { color: "#3b82f6" }]}>${v}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  tabScroll: { marginBottom: Spacing.md },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, marginRight: 6 },
  tabText: { fontSize: 12, fontWeight: "600" },
  loadingBox: { padding: Spacing.xl, alignItems: "center" },
  loadingText: { fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 2 },
  sectionSub: { fontSize: 13, marginBottom: Spacing.md, lineHeight: 18 },
  eobTip: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.md },
  eobTipText: { fontSize: 13, lineHeight: 18, flex: 1 },
  claimCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs },
  claimTop: { flexDirection: "row", justifyContent: "space-between" },
  claimProvider: { fontSize: 15, fontWeight: "600" },
  claimMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  claimDate: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  statusText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  claimType: { fontSize: 11 },
  claimAmounts: { alignItems: "flex-end" },
  claimYouOwe: { fontSize: 18, fontWeight: "700" },
  claimYouOweLabel: { fontSize: 10 },
  claimDetails: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  eobGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  eobItem: { width: "47%", flexGrow: 1 },
  eobLabel: { fontSize: 11 },
  eobValue: { fontSize: 16, fontWeight: "600" },
  eobRow: { flexDirection: "row", gap: 4, marginBottom: Spacing.xs },
  eobSmall: { fontSize: 12 },
  explanationBox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  explanationText: { fontSize: 13, lineHeight: 18, flex: 1 },
  conceptCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs },
  conceptTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  conceptIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  conceptTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  conceptBody: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  conceptDesc: { fontSize: 14, lineHeight: 21, marginBottom: Spacing.sm },
  progressSection: { marginBottom: Spacing.sm },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  progressMet: { fontSize: 14, fontWeight: "600" },
  progressPct: { fontSize: 14, fontWeight: "700" },
  progressTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  progressRemaining: { fontSize: 12, marginTop: 4 },
  amountsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs, marginBottom: Spacing.sm },
  amountItem: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, flexGrow: 1 },
  amountLabel: { fontSize: 11, textTransform: "capitalize" },
  amountValue: { fontSize: 16, fontWeight: "600" },
  rateBox: { padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: "center", marginBottom: Spacing.sm },
  rateText: { fontSize: 15, fontWeight: "700" },
  keyFieldsSection: { marginBottom: Spacing.sm },
  keyFieldsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  keyFieldItem: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 },
  keyFieldText: { fontSize: 13 },
  exampleBox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  exampleLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  exampleText: { fontSize: 13, lineHeight: 18 },
  trackerCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  trackerHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  trackerTitle: { fontSize: 15, fontWeight: "600" },
  trackerAmounts: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: Spacing.xs },
  trackerMet: { fontSize: 28, fontWeight: "800" },
  trackerOf: { fontSize: 14 },
  trackerBar: { height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 4 },
  trackerFill: { height: "100%", borderRadius: 6 },
  trackerRemaining: { fontSize: 12, lineHeight: 17 },
  totalSpent: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center", marginBottom: Spacing.sm },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 32, fontWeight: "800", marginVertical: 4 },
  totalBreakdown: { fontSize: 12 },
  copayGuide: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  copayTitle: { fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm },
  copayRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  copayType: { fontSize: 14, textTransform: "capitalize" },
  copayAmount: { fontSize: 14, fontWeight: "600" },
});
