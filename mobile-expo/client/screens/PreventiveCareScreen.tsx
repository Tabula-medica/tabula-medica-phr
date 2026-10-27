import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  SCREENINGS,
  VACCINATIONS,
  AGE_GROUPS,
  CATEGORY_LABELS,
  USPSTF_GRADES,
  type Screening,
  type Vaccination,
} from "./preventive-care-data";

type ViewMode = "age" | "screenings" | "vaccinations";

function GradeBadge({ grade }: { grade: string }) {
  const info = USPSTF_GRADES[grade];
  if (!info) return null;
  return (
    <View style={[styles.gradeBadge, { backgroundColor: `${info.color}15` }]}>
      <ThemedText style={[styles.gradeText, { color: info.color }]}>{info.label}</ThemedText>
    </View>
  );
}

function ScreeningCard({ screening, isExpanded, onToggle, theme, isDark }: {
  screening: Screening;
  isExpanded: boolean;
  onToggle: () => void;
  theme: any;
  isDark: boolean;
}) {
  const catInfo = CATEGORY_LABELS[screening.category] || CATEGORY_LABELS.cardiovascular;
  const gradeInfo = USPSTF_GRADES[screening.uspstfGrade];
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <Pressable testID={`screening-card-${screening.id}`} onPress={onToggle} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.cardTop}>
        <View style={[styles.catDot, { backgroundColor: catInfo.color }]} />
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>{screening.name}</ThemedText>
          <View style={styles.cardMeta}>
            <ThemedText style={[styles.catLabel, { color: catInfo.color }]}>{catInfo.label}</ThemedText>
            <GradeBadge grade={screening.uspstfGrade} />
            {screening.sex !== "all" ? (
              <View style={[styles.sexBadge, { backgroundColor: screening.sex === "female" ? "#ec489920" : "#3b82f620" }]}>
                <ThemedText style={[styles.sexText, { color: screening.sex === "female" ? "#ec4899" : "#3b82f6" }]}>
                  {screening.sex === "female" ? "Women" : "Men"}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
      </View>

      {isExpanded ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.expandedSection}>
          <ThemedText style={[styles.description, { color: theme.text }]}>{screening.description}</ThemedText>

          <View style={styles.detailGrid}>
            <View style={styles.detailRow}>
              <Feather name="calendar" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Ages:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {screening.ageRange.min}{screening.ageRange.max ? `-${screening.ageRange.max}` : "+"}
              </ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Feather name="repeat" size={13} color={theme.textSecondary} />
              <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>Frequency:</ThemedText>
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>{screening.frequency}</ThemedText>
            </View>
            {screening.cptCode ? (
              <View style={styles.detailRow}>
                <Feather name="hash" size={13} color={theme.textSecondary} />
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>CPT:</ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>{screening.cptCode}</ThemedText>
              </View>
            ) : null}
            {screening.icdCode ? (
              <View style={styles.detailRow}>
                <Feather name="tag" size={13} color={theme.textSecondary} />
                <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>ICD-10:</ThemedText>
                <ThemedText style={[styles.detailValue, { color: theme.text }]}>{screening.icdCode}</ThemedText>
              </View>
            ) : null}
          </View>

          {gradeInfo ? (
            <View style={[styles.gradeExplainer, { backgroundColor: `${gradeInfo.color}08`, borderColor: `${gradeInfo.color}20` }]}>
              <ThemedText style={[styles.gradeExplainerTitle, { color: gradeInfo.color }]}>
                USPSTF Grade {gradeInfo.label}
              </ThemedText>
              <ThemedText style={[styles.gradeExplainerText, { color: theme.textSecondary }]}>
                {gradeInfo.description}
              </ThemedText>
            </View>
          ) : null}

          {screening.notes ? (
            <View style={[styles.notesBox, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}15` }]}>
              <Feather name="info" size={13} color={theme.primary} />
              <ThemedText style={[styles.notesText, { color: theme.text }]}>{screening.notes}</ThemedText>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function VaccinationCard({ vaccination, isExpanded, onToggle, theme, isDark }: {
  vaccination: Vaccination;
  isExpanded: boolean;
  onToggle: () => void;
  theme: any;
  isDark: boolean;
}) {
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <Pressable testID={`vaccination-card-${vaccination.id}`} onPress={onToggle} style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.cardTop}>
        <View style={[styles.catDot, { backgroundColor: "#0066cc" }]} />
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>{vaccination.name}</ThemedText>
          <ThemedText style={[styles.catLabel, { color: "#0066cc" }]}>
            {vaccination.ageGroups.length} age group{vaccination.ageGroups.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>
        <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
      </View>

      {isExpanded ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.expandedSection}>
          <ThemedText style={[styles.description, { color: theme.text }]}>{vaccination.description}</ThemedText>
          {vaccination.ageGroups.map((ag, i) => (
            <View key={i} style={[styles.doseRow, { borderColor: cardBorder }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.doseAge, { color: theme.text }]}>{ag.label}</ThemedText>
                <ThemedText style={[styles.doseDet, { color: theme.textSecondary }]}>{ag.doses}</ThemedText>
              </View>
            </View>
          ))}
          {vaccination.cvxCodes.length > 0 ? (
            <View style={[styles.cvxSection, { borderColor: cardBorder }]}>
              <View style={styles.cvxHeader}>
                <Feather name="hash" size={12} color="#0066cc" />
                <ThemedText style={[styles.cvxTitle, { color: theme.text }]}>CVX Codes (State Registry Match)</ThemedText>
              </View>
              {vaccination.cvxCodes.map((cvx, i) => (
                <View key={i} style={styles.cvxRow}>
                  <View style={[styles.cvxBadge, { backgroundColor: "#0066cc15" }]}>
                    <ThemedText style={[styles.cvxCode, { color: "#0066cc" }]}>CVX {cvx.code}</ThemedText>
                  </View>
                  <ThemedText style={[styles.cvxDesc, { color: theme.textSecondary }]}>{cvx.description}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          {vaccination.notes ? (
            <View style={[styles.notesBox, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}15` }]}>
              <Feather name="info" size={13} color={theme.primary} />
              <ThemedText style={[styles.notesText, { color: theme.text }]}>{vaccination.notes}</ThemedText>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

export default function PreventiveCareScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<ViewMode>("age");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, []);

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const ageGroupContent = useMemo(() => {
    if (selectedAgeGroup === null) return null;
    const group = AGE_GROUPS[selectedAgeGroup];
    if (!group) return null;

    const groupScreenings = group.screenings
      .map(id => SCREENINGS.find(s => s.id === id))
      .filter(Boolean) as Screening[];

    const groupVaccinations = group.vaccinations
      .map(id => VACCINATIONS.find(v => v.id === id))
      .filter(Boolean) as Vaccination[];

    return { group, screenings: groupScreenings, vaccinations: groupVaccinations };
  }, [selectedAgeGroup]);

  const screeningsByCategory = useMemo(() => {
    const grouped: Record<string, Screening[]> = {};
    for (const s of SCREENINGS) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    return Object.entries(grouped).map(([cat, items]) => ({
      title: CATEGORY_LABELS[cat]?.label || cat,
      color: CATEGORY_LABELS[cat]?.color || "#6b7280",
      data: items,
    }));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.disclaimer, { color: "#f59e0b", backgroundColor: "#f59e0b10" }]}>
          Reference guide only. Discuss screening decisions with your provider.
        </ThemedText>

        <View style={styles.modeRow}>
          {([
            { key: "age" as ViewMode, label: "By Age", icon: "users" as const },
            { key: "screenings" as ViewMode, label: "Screenings", icon: "search" as const },
            { key: "vaccinations" as ViewMode, label: "Vaccines", icon: "shield" as const },
          ]).map(m => (
            <Pressable
              key={m.key}
              testID={`mode-${m.key}`}
              onPress={() => { setViewMode(m.key); setSelectedAgeGroup(null); setExpandedItems(new Set()); try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} }}
              style={[styles.modeBtn, {
                backgroundColor: viewMode === m.key ? theme.primary : cardBg,
                borderColor: viewMode === m.key ? theme.primary : cardBorder,
              }]}
            >
              <Feather name={m.icon} size={14} color={viewMode === m.key ? "#fff" : theme.text} />
              <ThemedText style={[styles.modeBtnText, { color: viewMode === m.key ? "#fff" : theme.text }]}>{m.label}</ThemedText>
            </Pressable>
          ))}
        </View>

        {viewMode === "age" && selectedAgeGroup === null ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Age Groups</ThemedText>
            <ThemedText style={[styles.sectionSub, { color: theme.textSecondary }]}>
              Tap an age group to see recommended screenings and vaccinations
            </ThemedText>
            {AGE_GROUPS.map((group, idx) => {
              const screeningCount = group.screenings.length;
              const vacCount = group.vaccinations.length;
              return (
                <Animated.View key={idx} entering={FadeInDown.duration(300).delay(idx * 40)}>
                  <Pressable
                    testID={`age-group-${idx}`}
                    onPress={() => { setSelectedAgeGroup(idx); setExpandedItems(new Set()); }}
                    style={[styles.ageGroupCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  >
                    <View style={[styles.ageIcon, { backgroundColor: `${theme.primary}12` }]}>
                      <Feather name="users" size={18} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.ageLabel, { color: theme.text }]}>{group.label}</ThemedText>
                      <View style={styles.ageCounts}>
                        <View style={styles.ageCountItem}>
                          <Feather name="search" size={11} color="#8b5cf6" />
                          <ThemedText style={[styles.ageCountText, { color: theme.textSecondary }]}>
                            {screeningCount} screening{screeningCount !== 1 ? "s" : ""}
                          </ThemedText>
                        </View>
                        <View style={styles.ageCountItem}>
                          <Feather name="shield" size={11} color="#0066cc" />
                          <ThemedText style={[styles.ageCountText, { color: theme.textSecondary }]}>
                            {vacCount} vaccine{vacCount !== 1 ? "s" : ""}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}

        {viewMode === "age" && ageGroupContent ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable testID="button-back-age-groups" onPress={() => setSelectedAgeGroup(null)} style={styles.backRow}>
              <Feather name="arrow-left" size={16} color={theme.primary} />
              <ThemedText style={[styles.backText, { color: theme.primary }]}>All Age Groups</ThemedText>
            </Pressable>

            <View style={[styles.ageHeader, { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}20` }]}>
              <View style={[styles.ageHeaderIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="users" size={22} color={theme.primary} />
              </View>
              <View>
                <ThemedText style={[styles.ageHeaderLabel, { color: theme.text }]}>{ageGroupContent.group.label}</ThemedText>
                <ThemedText style={[styles.ageHeaderSub, { color: theme.textSecondary }]}>
                  {ageGroupContent.screenings.length} screenings, {ageGroupContent.vaccinations.length} vaccinations
                </ThemedText>
              </View>
            </View>

            {ageGroupContent.screenings.length > 0 ? (
              <>
                <ThemedText style={[styles.subSectionTitle, { color: theme.text }]}>Recommended Screenings</ThemedText>
                {ageGroupContent.screenings.map(s => (
                  <ScreeningCard
                    key={s.id}
                    screening={s}
                    isExpanded={expandedItems.has(s.id)}
                    onToggle={() => toggleExpand(s.id)}
                    theme={theme}
                    isDark={isDark}
                  />
                ))}
              </>
            ) : null}

            {ageGroupContent.vaccinations.length > 0 ? (
              <>
                <ThemedText style={[styles.subSectionTitle, { color: theme.text, marginTop: Spacing.md }]}>Recommended Vaccinations</ThemedText>
                {ageGroupContent.vaccinations.map(v => (
                  <VaccinationCard
                    key={v.id}
                    vaccination={v}
                    isExpanded={expandedItems.has(v.id)}
                    onToggle={() => toggleExpand(v.id)}
                    theme={theme}
                    isDark={isDark}
                  />
                ))}
              </>
            ) : null}
          </Animated.View>
        ) : null}

        {viewMode === "screenings" ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>All Preventive Screenings</ThemedText>
            <ThemedText style={[styles.sectionSub, { color: theme.textSecondary }]}>
              USPSTF-graded screening recommendations
            </ThemedText>

            <View style={styles.gradeKey}>
              {Object.entries(USPSTF_GRADES).map(([grade, info]) => (
                <View key={grade} style={[styles.gradeKeyItem, { backgroundColor: `${info.color}10`, borderColor: `${info.color}25` }]}>
                  <ThemedText style={[styles.gradeKeyLetter, { color: info.color }]}>{grade}</ThemedText>
                  <ThemedText style={[styles.gradeKeyDesc, { color: theme.textSecondary }]}>
                    {grade === "A" ? "Strongly recommend" : grade === "B" ? "Recommend" : grade === "C" ? "Selective" : grade === "D" ? "Discourage" : "Insufficient evidence"}
                  </ThemedText>
                </View>
              ))}
            </View>

            {screeningsByCategory.map(cat => (
              <View key={cat.title}>
                <View style={[styles.catHeader, { borderColor: cat.color }]}>
                  <View style={[styles.catHeaderDot, { backgroundColor: cat.color }]} />
                  <ThemedText style={[styles.catHeaderText, { color: theme.text }]}>{cat.title}</ThemedText>
                  <ThemedText style={[styles.catCount, { color: theme.textSecondary }]}>{cat.data.length}</ThemedText>
                </View>
                {cat.data.map(s => (
                  <ScreeningCard
                    key={s.id}
                    screening={s}
                    isExpanded={expandedItems.has(s.id)}
                    onToggle={() => toggleExpand(s.id)}
                    theme={theme}
                    isDark={isDark}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        ) : null}

        {viewMode === "vaccinations" ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Vaccination Schedule</ThemedText>
            <ThemedText style={[styles.sectionSub, { color: theme.textSecondary }]}>
              CDC/ACIP recommended immunization schedule for all ages. Check your state immunization registry for records.
            </ThemedText>

            <View style={[styles.registryCard, { backgroundColor: `${"#0066cc"}08`, borderColor: `${"#0066cc"}20` }]}>
              <Feather name="globe" size={16} color="#0066cc" />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.registryTitle, { color: theme.text }]}>State Immunization Registries (IIS)</ThemedText>
                <ThemedText style={[styles.registryText, { color: theme.textSecondary }]}>
                  Each vaccine below includes CDC CVX codes used by all 64 state and territorial immunization information systems (IIS). Share these codes with your provider to match and verify your vaccination history in the state registry.
                </ThemedText>
              </View>
            </View>

            {VACCINATIONS.map(v => (
              <VaccinationCard
                key={v.id}
                vaccination={v}
                isExpanded={expandedItems.has(v.id)}
                onToggle={() => toggleExpand(v.id)}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </Animated.View>
        ) : null}

        <View style={[styles.footer, { borderColor: cardBorder }]}>
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            Based on USPSTF, CDC/ACIP, AHA, ACS, and specialty society guidelines. Updated 2024-2025. Individual screening decisions should consider personal risk factors, family history, and provider assessment.
          </ThemedText>
          <ThemedText style={[styles.footerText, { color: theme.textSecondary, marginTop: 4 }]}>
            State immunization registries: Contact your state health department or visit cdc.gov/vaccines for your state's IIS portal.
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  disclaimer: { fontSize: 12, fontWeight: "500", textAlign: "center", paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, overflow: "hidden", marginBottom: Spacing.sm },
  modeRow: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.md },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1 },
  modeBtnText: { fontSize: 13, fontWeight: "600" },
  sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 2 },
  sectionSub: { fontSize: 13, marginBottom: Spacing.md, lineHeight: 18 },
  ageGroupCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs, gap: Spacing.sm },
  ageIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  ageLabel: { fontSize: 16, fontWeight: "600" },
  ageCounts: { flexDirection: "row", gap: Spacing.md, marginTop: 2 },
  ageCountItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  ageCountText: { fontSize: 12 },
  backRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: Spacing.sm },
  backText: { fontSize: 14, fontWeight: "500" },
  ageHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  ageHeaderIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  ageHeaderLabel: { fontSize: 18, fontWeight: "700" },
  ageHeaderSub: { fontSize: 13, marginTop: 1 },
  subSectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.xs },
  cardTop: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  catDot: { width: 4, height: 36, borderRadius: 2 },
  cardTitle: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  catLabel: { fontSize: 11, fontWeight: "500" },
  gradeBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  gradeText: { fontSize: 10, fontWeight: "700" },
  sexBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  sexText: { fontSize: 10, fontWeight: "600" },
  expandedSection: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(128,128,128,0.2)" },
  description: { fontSize: 14, lineHeight: 21, marginBottom: Spacing.sm },
  detailGrid: { gap: 4, marginBottom: Spacing.sm },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  detailLabel: { fontSize: 12, fontWeight: "500", width: 70 },
  detailValue: { fontSize: 12, flex: 1, lineHeight: 17 },
  gradeExplainer: { padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.xs },
  gradeExplainerTitle: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  gradeExplainerText: { fontSize: 12, lineHeight: 17 },
  notesBox: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  notesText: { fontSize: 12, lineHeight: 17, flex: 1 },
  doseRow: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  doseAge: { fontSize: 13, fontWeight: "600" },
  doseDet: { fontSize: 12, marginTop: 1 },
  gradeKey: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.md },
  gradeKeyItem: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  gradeKeyLetter: { fontSize: 12, fontWeight: "700" },
  gradeKeyDesc: { fontSize: 10 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.sm, paddingBottom: Spacing.xs, borderBottomWidth: 2 },
  catHeaderDot: { width: 8, height: 8, borderRadius: 4 },
  catHeaderText: { fontSize: 16, fontWeight: "600", flex: 1 },
  catCount: { fontSize: 12 },
  registryCard: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  registryTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  registryText: { fontSize: 12, lineHeight: 17 },
  cvxSection: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  cvxHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: Spacing.xs },
  cvxTitle: { fontSize: 12, fontWeight: "600" },
  cvxRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, paddingVertical: 3, flexWrap: "wrap" },
  cvxBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  cvxCode: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  cvxDesc: { fontSize: 11, flex: 1 },
  footer: { marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  footerText: { fontSize: 11, lineHeight: 16, textAlign: "center" },
});
