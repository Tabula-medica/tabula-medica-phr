import React, { useState, useCallback } from "react";
import {
  View, StyleSheet, ScrollView, Pressable, Share, ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const PATIENT_REPORTED_COLOR = "#2563EB";

interface PertinentItem {
  category: string;
  name: string;
  detail?: string;
  source: "patient" | "provider" | "ehr";
  highlighted: boolean;
  clinicalNote?: string;
}

interface ProviderSummary {
  patientName: string;
  dateOfBirth: string;
  gender: string;
  preferredLanguage: string;
  lastReviewDate: string;
  conditions: PertinentItem[];
  surgeries: PertinentItem[];
  familyHistory: PertinentItem[];
  medications: PertinentItem[];
  allergies: PertinentItem[];
  lifestyle: {
    smoking: string;
    alcohol: string;
    exercise: string;
  };
  pertinentPositives: string[];
  reviewDue: boolean;
}

export default function ProviderShareSummaryScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: summary, isLoading, isError, refetch } = useQuery<ProviderSummary>({
    queryKey: ["/api/provider-share-summary"],
  });

  const toggleItem = useCallback((key: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const selectAllPertinent = useCallback(() => {
    if (!summary) return;
    const keys = new Set<string>();
    const addHighlighted = (items: PertinentItem[], prefix: string) => {
      items.forEach((item, idx) => { if (item.highlighted) keys.add(`${prefix}-${idx}`); });
    };
    addHighlighted(summary.conditions, "cond");
    addHighlighted(summary.surgeries, "surg");
    addHighlighted(summary.familyHistory, "fam");
    addHighlighted(summary.medications, "med");
    addHighlighted(summary.allergies, "allg");
    setSelectedItems(keys);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
  }, [summary]);

  const generateShareText = useCallback(() => {
    if (!summary) return "";
    const lines: string[] = [];
    lines.push(`PATIENT HEALTH SUMMARY FOR PROVIDER VISIT`);
    lines.push(`==========================================`);
    lines.push(`Patient: ${summary.patientName}`);
    if (summary.dateOfBirth) lines.push(`DOB: ${summary.dateOfBirth}`);
    if (summary.gender) lines.push(`Gender: ${summary.gender}`);
    if (summary.preferredLanguage && summary.preferredLanguage !== "English") {
      lines.push(`Preferred Language: ${summary.preferredLanguage}`);
    }
    lines.push(`Last Self-Review: ${summary.lastReviewDate || "Not yet reviewed"}`);
    lines.push("");

    if (summary.pertinentPositives.length > 0) {
      lines.push(`PERTINENT POSITIVES (Highlighted for Provider)`);
      lines.push(`----------------------------------------------`);
      summary.pertinentPositives.forEach(p => lines.push(`  * ${p}`));
      lines.push("");
    }

    const addSection = (title: string, items: PertinentItem[], prefix: string) => {
      const relevant = showAll ? items : items.filter((_, idx) => selectedItems.has(`${prefix}-${idx}`) || _.highlighted);
      if (relevant.length === 0) return;
      lines.push(title.toUpperCase());
      lines.push("-".repeat(title.length));
      relevant.forEach(item => {
        const src = item.source === "patient" ? " [Patient-Reported]" : item.source === "ehr" ? " [EHR-Verified]" : "";
        lines.push(`  ${item.name}${item.detail ? ` - ${item.detail}` : ""}${src}`);
        if (item.clinicalNote) lines.push(`    Note: ${item.clinicalNote}`);
      });
      lines.push("");
    };

    addSection("Active Conditions", summary.conditions, "cond");
    addSection("Surgical History", summary.surgeries, "surg");
    addSection("Family History (First-Degree)", summary.familyHistory, "fam");
    addSection("Current Medications", summary.medications, "med");
    addSection("Allergies", summary.allergies, "allg");

    if (summary.lifestyle.smoking || summary.lifestyle.alcohol || summary.lifestyle.exercise) {
      lines.push("LIFESTYLE");
      lines.push("---------");
      if (summary.lifestyle.smoking) lines.push(`  Smoking: ${summary.lifestyle.smoking}`);
      if (summary.lifestyle.alcohol) lines.push(`  Alcohol: ${summary.lifestyle.alcohol}`);
      if (summary.lifestyle.exercise) lines.push(`  Exercise: ${summary.lifestyle.exercise}`);
      lines.push("");
    }

    lines.push(`---`);
    lines.push(`Generated by Tabula Medica | Items marked [Patient-Reported] are self-reported and pending provider confirmation.`);
    return lines.join("\n");
  }, [summary, selectedItems, showAll]);

  const handleShare = useCallback(async () => {
    const text = generateShareText();
    if (!text) return;
    try {
      await Share.share({ message: text, title: "Patient Health Summary" });
    } catch {}
  }, [generateShareText]);

  const handleCopy = useCallback(async () => {
    const text = generateShareText();
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    setTimeout(() => setCopied(false), 2000);
  }, [generateShareText]);

  const renderItemRow = (item: PertinentItem, key: string, index: number) => {
    const isPatientReported = item.source === "patient";
    const isSelected = selectedItems.has(key);
    const isHighlighted = item.highlighted;

    return (
      <Pressable
        key={key}
        testID={`share-item-${key}`}
        onPress={() => toggleItem(key)}
        style={[
          styles.itemRow,
          {
            backgroundColor: isSelected
              ? `${theme.primary}08`
              : isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
            borderColor: isSelected ? theme.primary : isHighlighted ? `${PATIENT_REPORTED_COLOR}40` : theme.border,
            borderLeftWidth: isHighlighted ? 3 : 1,
            borderLeftColor: isHighlighted ? PATIENT_REPORTED_COLOR : (isSelected ? theme.primary : theme.border),
          },
        ]}
      >
        <View style={styles.itemCheckbox}>
          <View style={[
            styles.checkbox,
            {
              borderColor: isSelected ? theme.primary : theme.border,
              backgroundColor: isSelected ? theme.primary : "transparent",
            },
          ]}>
            {isSelected ? <Feather name="check" size={12} color="#fff" /> : null}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText
            style={[
              styles.itemName,
              {
                color: isPatientReported ? PATIENT_REPORTED_COLOR : theme.text,
                fontStyle: isPatientReported ? "italic" : "normal",
              },
            ]}
          >
            {item.name}
          </ThemedText>
          {item.detail ? (
            <ThemedText
              style={[
                styles.itemDetail,
                {
                  color: isPatientReported ? `${PATIENT_REPORTED_COLOR}99` : theme.textSecondary,
                  fontStyle: isPatientReported ? "italic" : "normal",
                },
              ]}
            >
              {item.detail}
            </ThemedText>
          ) : null}
          {item.clinicalNote ? (
            <ThemedText style={[styles.clinicalNote, { color: theme.warning }]}>
              {item.clinicalNote}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.itemBadges}>
          {isPatientReported ? (
            <View style={[styles.sourceBadge, { backgroundColor: `${PATIENT_REPORTED_COLOR}12` }]}>
              <ThemedText style={[styles.sourceBadgeText, { color: PATIENT_REPORTED_COLOR }]}>Self</ThemedText>
            </View>
          ) : (
            <View style={[styles.sourceBadge, { backgroundColor: `${theme.success}12` }]}>
              <ThemedText style={[styles.sourceBadgeText, { color: theme.success }]}>Verified</ThemedText>
            </View>
          )}
          {isHighlighted ? (
            <View style={[styles.pertinentBadge, { backgroundColor: `${theme.warning}15` }]}>
              <Feather name="alert-circle" size={10} color={theme.warning} />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderSection = (
    title: string,
    icon: keyof typeof Feather.glyphMap,
    items: PertinentItem[],
    prefix: string,
    delay: number,
  ) => {
    if (!items || items.length === 0) return null;
    const highlightedCount = items.filter(i => i.highlighted).length;
    return (
      <Animated.View entering={FadeInDown.delay(delay).springify()}>
        <View style={styles.sectionHeaderRow}>
          <Feather name={icon} size={18} color={theme.primary} />
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{title}</ThemedText>
          {highlightedCount > 0 ? (
            <View style={[styles.highlightCount, { backgroundColor: `${PATIENT_REPORTED_COLOR}12` }]}>
              <Feather name="flag" size={10} color={PATIENT_REPORTED_COLOR} />
              <ThemedText style={[styles.highlightCountText, { color: PATIENT_REPORTED_COLOR }]}>
                {highlightedCount} pertinent
              </ThemedText>
            </View>
          ) : null}
        </View>
        {items.map((item, idx) => renderItemRow(item, `${prefix}-${idx}`, idx))}
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing["2xl"] }} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Preparing your health summary...
        </ThemedText>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight, alignItems: "center", justifyContent: "center" }]}>
        <Feather name="alert-triangle" size={40} color={theme.error} />
        <ThemedText style={{ color: theme.text, fontSize: 16, fontWeight: "600", marginTop: Spacing.md }}>
          Unable to Load Summary
        </ThemedText>
        <ThemedText style={{ color: theme.textSecondary, fontSize: 14, textAlign: "center", marginTop: Spacing.sm, paddingHorizontal: Spacing.xl }}>
          We could not retrieve your health summary. Please check your connection and try again.
        </ThemedText>
        <Pressable
          testID="button-retry-summary"
          onPress={() => refetch()}
          style={{ backgroundColor: theme.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.lg }}
        >
          <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (!summary) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <View style={styles.emptyState}>
          <Feather name="file-text" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Health Data</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Complete your health profile to generate a provider summary.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Card style={[styles.headerCard, { borderColor: theme.border }]}>
            <View style={styles.headerTop}>
              <View style={[styles.headerIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="share-2" size={24} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Provider Visit Summary</ThemedText>
                <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                  Select items to share with your provider
                </ThemedText>
              </View>
            </View>

            {summary.reviewDue ? (
              <View style={[styles.reviewBanner, { backgroundColor: `${theme.warning}10`, borderColor: `${theme.warning}30` }]}>
                <Feather name="clock" size={16} color={theme.warning} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <ThemedText style={[styles.reviewBannerTitle, { color: theme.warning }]}>Annual Review Due</ThemedText>
                  <ThemedText style={[styles.reviewBannerText, { color: theme.textSecondary }]}>
                    It has been over a year since you last reviewed your health information. Tap items below to confirm they are still accurate.
                  </ThemedText>
                </View>
              </View>
            ) : null}

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: PATIENT_REPORTED_COLOR }]} />
                <ThemedText style={[styles.legendText, { color: theme.textSecondary, fontStyle: "italic" }]}>
                  Patient-reported (blue italic)
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: theme.success }]} />
                <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
                  Provider-verified
                </ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        {summary.pertinentPositives.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Card style={[styles.pertinentCard, { borderColor: `${PATIENT_REPORTED_COLOR}30`, borderLeftWidth: 4, borderLeftColor: PATIENT_REPORTED_COLOR }]}>
              <View style={styles.pertinentHeader}>
                <Feather name="flag" size={18} color={PATIENT_REPORTED_COLOR} />
                <ThemedText style={[styles.pertinentTitle, { color: theme.text }]}>
                  Pertinent Positives
                </ThemedText>
              </View>
              <ThemedText style={[styles.pertinentHint, { color: theme.textSecondary }]}>
                Clinically significant items recommended for sharing
              </ThemedText>
              {summary.pertinentPositives.map((item, idx) => (
                <View key={idx} style={styles.pertinentRow}>
                  <Feather name="chevron-right" size={14} color={PATIENT_REPORTED_COLOR} />
                  <ThemedText style={[styles.pertinentText, { color: theme.text }]}>{item}</ThemedText>
                </View>
              ))}
              <Pressable
                testID="btn-select-pertinent"
                onPress={selectAllPertinent}
                style={[styles.selectPertinentBtn, { backgroundColor: `${PATIENT_REPORTED_COLOR}10`, borderColor: `${PATIENT_REPORTED_COLOR}30` }]}
              >
                <Feather name="check-square" size={14} color={PATIENT_REPORTED_COLOR} />
                <ThemedText style={[styles.selectPertinentText, { color: PATIENT_REPORTED_COLOR }]}>
                  Select All Pertinent Items
                </ThemedText>
              </Pressable>
            </Card>
          </Animated.View>
        ) : null}

        {renderSection("Active Conditions", "heart", summary.conditions, "cond", 160)}
        {renderSection("Surgical History", "scissors", summary.surgeries, "surg", 240)}
        {renderSection("Family History", "users", summary.familyHistory, "fam", 320)}
        {renderSection("Medications", "package", summary.medications, "med", 400)}
        {renderSection("Allergies", "alert-triangle", summary.allergies, "allg", 480)}

        {summary.lifestyle.smoking || summary.lifestyle.alcohol || summary.lifestyle.exercise ? (
          <Animated.View entering={FadeInDown.delay(560).springify()}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="activity" size={18} color={theme.primary} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Lifestyle</ThemedText>
            </View>
            <View style={[styles.lifestyleRow, { backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: theme.border }]}>
              {summary.lifestyle.smoking ? (
                <View style={styles.lifestyleItem}>
                  <ThemedText style={[styles.lifestyleLabel, { color: theme.textSecondary }]}>Smoking</ThemedText>
                  <ThemedText style={[styles.lifestyleValue, { color: theme.text }]}>{summary.lifestyle.smoking}</ThemedText>
                </View>
              ) : null}
              {summary.lifestyle.alcohol ? (
                <View style={styles.lifestyleItem}>
                  <ThemedText style={[styles.lifestyleLabel, { color: theme.textSecondary }]}>Alcohol</ThemedText>
                  <ThemedText style={[styles.lifestyleValue, { color: theme.text }]}>{summary.lifestyle.alcohol}</ThemedText>
                </View>
              ) : null}
              {summary.lifestyle.exercise ? (
                <View style={styles.lifestyleItem}>
                  <ThemedText style={[styles.lifestyleLabel, { color: theme.textSecondary }]}>Exercise</ThemedText>
                  <ThemedText style={[styles.lifestyleValue, { color: theme.text }]}>{summary.lifestyle.exercise}</ThemedText>
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.sm }]}>
        <View style={styles.bottomInfo}>
          <ThemedText style={[styles.selectedCount, { color: theme.textSecondary }]}>
            {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""} selected
          </ThemedText>
          <Pressable onPress={() => setShowAll(!showAll)}>
            <ThemedText style={[styles.toggleAllText, { color: theme.primary }]}>
              {showAll ? "Share selected only" : "Share all"}
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.bottomActions}>
          <Pressable
            testID="btn-copy-summary"
            onPress={handleCopy}
            style={[styles.actionBtn, styles.copyBtn, { borderColor: theme.border }]}
          >
            <Feather name={copied ? "check" : "copy"} size={18} color={theme.text} />
            <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>
              {copied ? "Copied" : "Copy"}
            </ThemedText>
          </Pressable>
          <Pressable
            testID="btn-share-summary"
            onPress={handleShare}
            style={[styles.actionBtn, styles.shareBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="share" size={18} color="#fff" />
            <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>Share with Provider</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingText: { textAlign: "center", marginTop: Spacing.lg, fontSize: 14 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 120 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: Spacing.md },
  emptySubtitle: { fontSize: 14, textAlign: "center", marginTop: Spacing.sm, paddingHorizontal: Spacing.xl },
  headerCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  headerTop: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  headerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  reviewBanner: { flexDirection: "row", alignItems: "flex-start", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  reviewBannerTitle: { fontSize: 14, fontWeight: "700" },
  reviewBannerText: { fontSize: 12, marginTop: 2, lineHeight: 18 },
  legendRow: { flexDirection: "row", marginTop: Spacing.md, gap: Spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11 },
  pertinentCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  pertinentHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  pertinentTitle: { fontSize: 16, fontWeight: "700" },
  pertinentHint: { fontSize: 12, marginTop: 4, marginBottom: Spacing.sm },
  pertinentRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  pertinentText: { fontSize: 14, flex: 1 },
  selectPertinentBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md, justifyContent: "center" },
  selectPertinentText: { fontSize: 13, fontWeight: "600" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
  highlightCount: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  highlightCountText: { fontSize: 11, fontWeight: "600" },
  itemRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: 6 },
  itemCheckbox: { marginRight: Spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "500" },
  itemDetail: { fontSize: 12, marginTop: 2 },
  clinicalNote: { fontSize: 11, marginTop: 4, fontWeight: "500" },
  itemBadges: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: Spacing.sm },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  sourceBadgeText: { fontSize: 10, fontWeight: "600" },
  pertinentBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  lifestyleRow: { flexDirection: "row", borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.lg },
  lifestyleItem: { flex: 1 },
  lifestyleLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  lifestyleValue: { fontSize: 14, marginTop: 2 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingTop: Spacing.sm, paddingHorizontal: Spacing.lg, borderTopWidth: 1 },
  bottomInfo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  selectedCount: { fontSize: 12 },
  toggleAllText: { fontSize: 13, fontWeight: "600" },
  bottomActions: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg },
  copyBtn: { borderWidth: 1 },
  shareBtn: {},
  actionBtnText: { fontSize: 14, fontWeight: "600" },
});
