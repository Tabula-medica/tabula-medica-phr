import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

import type { CountryLedger } from "@/data/empireLedger";
import { useColors } from "@/hooks/useColors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function CountryLedgerCard({ entry }: { entry: CountryLedger }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: expanded ? colors.primary : colors.border,
        },
      ]}
      activeOpacity={0.85}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`${entry.country}. British rule ${entry.ruleYears}. ${entry.summary} ${expanded ? "Tap to collapse" : "Tap to read the record and sources"}`}
      accessibilityState={{ expanded }}
    >
      <View style={styles.topRow}>
        <Text style={styles.flag} accessibilityElementsHidden importantForAccessibility="no">
          {entry.flag}
        </Text>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.country, { color: colors.foreground }]} maxFontSizeMultiplier={2}>
              {entry.country}
            </Text>
            <Text style={[styles.year, { color: colors.primary }]} maxFontSizeMultiplier={2}>
              {entry.ruleYears}
            </Text>
          </View>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} maxFontSizeMultiplier={2}>
            {entry.region} · {entry.colonyType}
          </Text>
          <Text style={[styles.summary, { color: colors.mutedForeground }]} maxFontSizeMultiplier={2}>
            {entry.summary}
          </Text>
        </View>
        <View style={styles.chevronWrap}>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.mutedForeground}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      </View>

      {expanded && (
        <View style={[styles.expanded, { borderTopColor: colors.border }]}>
          {entry.events.map((e, i) => (
            <View key={i} style={styles.eventRow}>
              <Text style={[styles.eventYear, { color: colors.primary }]} maxFontSizeMultiplier={2}>
                {e.year}
              </Text>
              <Text style={[styles.eventText, { color: colors.foreground }]} maxFontSizeMultiplier={2}>
                {e.text}
              </Text>
            </View>
          ))}

          <View style={[styles.block, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.blockLabel, { color: colors.mutedForeground }]} maxFontSizeMultiplier={2}>
              WHAT WAS TAKEN
            </Text>
            <Text style={[styles.takenText, { color: colors.foreground }]} maxFontSizeMultiplier={2}>
              {entry.taken}
            </Text>
          </View>

          <View style={styles.sources}>
            <Text style={[styles.blockLabel, { color: colors.mutedForeground }]} maxFontSizeMultiplier={2}>
              SOURCES
            </Text>
            {entry.sources.map((s, i) => (
              <Text
                key={i}
                style={[styles.sourceItem, { color: colors.mutedForeground, borderLeftColor: colors.border }]}
                maxFontSizeMultiplier={2}
              >
                {s}
              </Text>
            ))}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    minHeight: 48,
  },
  topRow: { flexDirection: "row", gap: 14 },
  flag: { fontSize: 34, lineHeight: 42 },
  content: { flex: 1, gap: 4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  country: { fontSize: 16, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  year: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  chevronWrap: { justifyContent: "center", paddingLeft: 4 },
  expanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  eventRow: { gap: 2 },
  eventYear: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  eventText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  block: { borderRadius: 10, padding: 12, gap: 4 },
  blockLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  takenText: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 19 },
  sources: { gap: 6 },
  sourceItem: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    paddingLeft: 10,
    borderLeftWidth: 1,
  },
});
