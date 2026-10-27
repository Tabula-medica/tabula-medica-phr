import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import Animated, { FadeInDown } from "react-native-reanimated";

export type PaymentLane = "A_INSTAMED" | "B_VA_CCN";

interface PaymentLaneSelectorProps {
  selectedLane: PaymentLane | null;
  onSelectLane: (lane: PaymentLane) => void;
  totalAmount?: number;
  disabled?: boolean;
}

interface LaneConfig {
  key: PaymentLane;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  details: string[];
  patientCost: string;
  processingTime: string;
  badge: string;
}

const LANES: LaneConfig[] = [
  {
    key: "A_INSTAMED",
    title: "Self-Pay (Lane A)",
    subtitle: "Pay today with card, ACH, or HSA",
    icon: "credit-card",
    color: "#3B82F6",
    details: [
      "Accepts credit/debit, ACH bank transfer, HSA/FSA cards",
      "ACH settles in 24 hours, no processing fee",
      "Card payments: 2.75% processing fee",
      "Sliding scale discount may apply based on income",
      "PPDR dispute rights if bill exceeds GFE by $400+",
    ],
    patientCost: "Medicare-based rate",
    processingTime: "24-48 hours",
    badge: "INSTAMED SECURE",
  },
  {
    key: "B_VA_CCN",
    title: "VA Community Care (Lane B)",
    subtitle: "VA pays through Optum CCN",
    icon: "flag",
    color: "#10B981",
    details: [
      "For veterans with VA Community Care referral",
      "VA pays the full amount through Optum CCN",
      "Patient responsibility: $0.00",
      "Requires valid VA referral number",
      "Claims processed via ANSI X12 837P v5010",
      "Payment to provider within 30 days",
    ],
    patientCost: "$0.00",
    processingTime: "30 days (VA to provider)",
    badge: "VA CCN AUTHORIZED",
  },
];

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

export function PaymentLaneSelector({ selectedLane, onSelectLane, totalAmount, disabled }: PaymentLaneSelectorProps) {
  const { theme } = useTheme();
  const [expandedLane, setExpandedLane] = useState<PaymentLane | null>(null);

  return (
    <View>
      <View style={styles.header}>
        <Feather name="git-branch" size={18} color={theme.primary} />
        <ThemedText type="subtitle" style={[styles.headerTitle, { color: theme.text }]}>Payment Lane</ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md, lineHeight: 18 }}>
        Select how this visit will be paid. VA veterans with Community Care authorization pay $0.
      </ThemedText>

      {LANES.map((lane, index) => {
        const isSelected = selectedLane === lane.key;
        const isExpanded = expandedLane === lane.key;
        return (
          <Animated.View key={lane.key} entering={FadeInDown.duration(300).delay(index * 100)}>
            <Pressable
              testID={`lane-${lane.key}`}
              onPress={() => {
                if (!disabled) {
                  onSelectLane(lane.key);
                  setExpandedLane(isExpanded ? null : lane.key);
                }
              }}
              style={{ opacity: disabled ? 0.5 : 1 }}
              accessibilityRole="radio"
              accessibilityLabel={`${lane.title}, ${lane.subtitle}`}
              accessibilityState={{ selected: isSelected, disabled }}
            >
              <Card style={[
                styles.laneCard,
                isSelected ? { borderWidth: 2, borderColor: lane.color } : { borderWidth: 1, borderColor: theme.border },
              ]}>
                <View style={styles.laneHeader}>
                  <View style={[styles.radioOuter, { borderColor: isSelected ? lane.color : theme.border }]}>
                    {isSelected ? <View style={[styles.radioInner, { backgroundColor: lane.color }]} /> : null}
                  </View>
                  <View style={[styles.laneIcon, { backgroundColor: lane.color + "20" }]}>
                    <Feather name={lane.icon} size={20} color={lane.color} />
                  </View>
                  <View style={styles.laneContent}>
                    <ThemedText type="subtitle" style={{ fontWeight: "700" }}>{lane.title}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{lane.subtitle}</ThemedText>
                  </View>
                </View>

                <View style={styles.laneMeta}>
                  <View style={[styles.laneBadge, { backgroundColor: lane.color + "15", borderColor: lane.color + "30" }]}>
                    <Feather name="shield" size={10} color={lane.color} />
                    <ThemedText type="small" style={{ color: lane.color, fontWeight: "700", fontSize: 9, marginLeft: 4 }}>{lane.badge}</ThemedText>
                  </View>
                  <View style={styles.laneMetaRow}>
                    <View style={styles.laneMetaItem}>
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Patient Cost</ThemedText>
                      <ThemedText type="small" style={{ fontWeight: "700", color: lane.key === "B_VA_CCN" ? "#10B981" : theme.text }}>
                        {lane.key === "A_INSTAMED" && totalAmount ? formatCurrency(totalAmount) : lane.patientCost}
                      </ThemedText>
                    </View>
                    <View style={styles.laneMetaItem}>
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Settlement</ThemedText>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>{lane.processingTime}</ThemedText>
                    </View>
                  </View>
                </View>

                {isExpanded ? (
                  <View style={[styles.laneDetails, { borderTopColor: theme.border }]}>
                    {lane.details.map((detail, i) => (
                      <View key={i} style={styles.detailRow}>
                        <Feather name="check-circle" size={12} color={lane.color} style={{ marginTop: 2 }} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1, marginLeft: 8, lineHeight: 18 }}>{detail}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  headerTitle: { fontWeight: "700", marginLeft: 8 },
  laneCard: { marginBottom: Spacing.md, padding: Spacing.lg },
  laneHeader: { flexDirection: "row", alignItems: "center" },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  laneIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
  laneContent: { flex: 1 },
  laneMeta: { marginTop: Spacing.md },
  laneBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1, alignSelf: "flex-start", marginBottom: Spacing.sm },
  laneMetaRow: { flexDirection: "row", gap: Spacing.lg },
  laneMetaItem: {},
  laneDetails: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 0.5 },
  detailRow: { flexDirection: "row", marginBottom: 6 },
});
