import React, { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius } from "@/constants/theme";
import Animated, { FadeInDown } from "react-native-reanimated";

type TabType = "menstrual" | "pregnancy" | "menopause" | "screenings";

const TABS: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { key: "menstrual", label: "Cycle", icon: "calendar", color: "#EC4899" },
  { key: "pregnancy", label: "Pregnancy", icon: "heart", color: "#F97316" },
  { key: "menopause", label: "Menopause", icon: "thermometer", color: "#8B5CF6" },
  { key: "screenings", label: "Screenings", icon: "shield", color: "#10B981" },
];

export default function WomensHealthScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabType>("menstrual");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const { data: menstrualData, isLoading: loadingMenstrual } = useQuery<any>({
    queryKey: ["/api/womens-health/menstrual-care"],
    enabled: activeTab === "menstrual",
  });

  const { data: pregnancyData, isLoading: loadingPregnancy } = useQuery<any>({
    queryKey: ["/api/womens-health/pregnancy-care"],
    enabled: activeTab === "pregnancy",
  });

  const { data: menopauseData, isLoading: loadingMenopause } = useQuery<any>({
    queryKey: ["/api/womens-health/menopause-care"],
    enabled: activeTab === "menopause",
  });

  const { data: screeningsData, isLoading: loadingScreenings } = useQuery<any>({
    queryKey: ["/api/womens-health/screenings"],
    enabled: activeTab === "screenings",
  });

  const isLoading =
    (activeTab === "menstrual" && loadingMenstrual) ||
    (activeTab === "pregnancy" && loadingPregnancy) ||
    (activeTab === "menopause" && loadingMenopause) ||
    (activeTab === "screenings" && loadingScreenings);

  const activeColor = TABS.find((t) => t.key === activeTab)?.color || "#EC4899";

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <View style={[styles.headerIconContainer, { backgroundColor: "#EC489920" }]}>
            <Feather name="heart" size={28} color="#EC4899" />
          </View>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Women's Health</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Comprehensive care across every stage of life
          </ThemedText>
        </View>

        <View style={styles.tabContainer}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={[
                styles.tab,
                activeTab === tab.key
                  ? { backgroundColor: tab.color + "20" }
                  : { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
              ]}
              onPress={() => { setActiveTab(tab.key); setExpandedSection(null); }}
            >
              <Feather name={tab.icon} size={15} color={activeTab === tab.key ? tab.color : colors.textSecondary} />
              <ThemedText style={[styles.tabText, { color: activeTab === tab.key ? tab.color : colors.textSecondary }]}>
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={activeColor} style={{ marginTop: 40 }} />
        ) : (
          <>
            {activeTab === "menstrual" ? renderMenstrualTab(menstrualData, expandedSection, toggleSection, colors, isDark, activeColor) : null}
            {activeTab === "pregnancy" ? renderPregnancyTab(pregnancyData, navigation, expandedSection, toggleSection, colors, isDark, activeColor) : null}
            {activeTab === "menopause" ? renderMenopauseTab(menopauseData, expandedSection, toggleSection, colors, isDark, activeColor) : null}
            {activeTab === "screenings" ? renderScreeningsTab(screeningsData, expandedSection, toggleSection, colors, isDark, activeColor) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function SectionCard({ title, icon, color, children, colors, isDark, testID }: any) {
  return (
    <Animated.View entering={FadeInDown.springify()}>
      <View style={[styles.sectionCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]} testID={testID}>
        <View style={styles.sectionCardHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: color + "15" }]}>
            <Feather name={icon} size={18} color={color} />
          </View>
          <ThemedText style={[styles.sectionCardTitle, { color: colors.text }]}>{title}</ThemedText>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

function ExpandableItem({ id, title, subtitle, expanded, onToggle, children, colors, color }: any) {
  return (
    <Pressable
      style={[styles.expandableItem, { backgroundColor: expanded ? color + "08" : "transparent", borderColor: colors.border }]}
      onPress={() => onToggle(id)}
      testID={`expandable-${id}`}
    >
      <View style={styles.expandableHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.expandableTitle, { color: colors.text }]}>{title}</ThemedText>
          {subtitle ? <ThemedText style={[styles.expandableSubtitle, { color: colors.textSecondary }]}>{subtitle}</ThemedText> : null}
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
      </View>
      {expanded ? <View style={[styles.expandableContent, { borderTopColor: colors.border }]}>{children}</View> : null}
    </Pressable>
  );
}

function BulletList({ items, colors, color }: { items: string[]; colors: any; color: string }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: color }]} />
          <ThemedText style={[styles.bulletText, { color: colors.text }]}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function renderMenstrualTab(data: any, expandedSection: string | null, toggleSection: (id: string) => void, colors: any, isDark: boolean, color: string) {
  if (!data?.guide) return null;
  const { cycleBasics, abnormalBleeding, conditions } = data.guide;

  return (
    <View style={styles.tabContent}>
      <SectionCard title="Your Menstrual Cycle" icon="repeat" color={color} colors={colors} isDark={isDark} testID="section-cycle-basics">
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          A typical cycle lasts 21-35 days. Understanding each phase helps you optimize wellness throughout the month.
        </ThemedText>
        {cycleBasics.phases.map((phase: any, idx: number) => (
          <ExpandableItem
            key={phase.name}
            id={`phase-${idx}`}
            title={phase.name}
            subtitle={phase.days}
            expanded={expandedSection === `phase-${idx}`}
            onToggle={toggleSection}
            colors={colors}
            color={color}
          >
            <ThemedText style={[styles.expandedDescription, { color: colors.text }]}>{phase.description}</ThemedText>
            <View style={[styles.hormoneTag, { backgroundColor: "#8B5CF615" }]}>
              <Feather name="zap" size={12} color="#8B5CF6" />
              <ThemedText style={[styles.hormoneText, { color: "#8B5CF6" }]}>{phase.hormones}</ThemedText>
            </View>

            <ThemedText style={[styles.subSectionLabel, { color: colors.textSecondary }]}>COMMON SYMPTOMS</ThemedText>
            <BulletList items={phase.symptoms} colors={colors} color={color} />

            <ThemedText style={[styles.subSectionLabel, { color: colors.textSecondary }]}>SELF-CARE TIPS</ThemedText>
            <BulletList items={phase.selfCare} colors={colors} color="#10B981" />
          </ExpandableItem>
        ))}
      </SectionCard>

      <SectionCard title="Common Conditions" icon="info" color={color} colors={colors} isDark={isDark} testID="section-conditions">
        {conditions.map((cond: any, idx: number) => (
          <ExpandableItem
            key={cond.name}
            id={`cond-${idx}`}
            title={cond.name}
            subtitle={cond.prevalence}
            expanded={expandedSection === `cond-${idx}`}
            onToggle={toggleSection}
            colors={colors}
            color={color}
          >
            <ThemedText style={[styles.expandedDescription, { color: colors.text }]}>{cond.description}</ThemedText>
            <ThemedText style={[styles.subSectionLabel, { color: colors.textSecondary }]}>MANAGEMENT</ThemedText>
            <BulletList items={cond.management} colors={colors} color={color} />
            <View style={styles.sourceRow}>
              <Feather name="bookmark" size={11} color={colors.textSecondary} />
              <ThemedText style={[styles.sourceText, { color: colors.textSecondary }]}>{cond.source}</ThemedText>
            </View>
          </ExpandableItem>
        ))}
      </SectionCard>

      <SectionCard title="When to See a Doctor" icon="alert-triangle" color="#EF4444" colors={colors} isDark={isDark} testID="section-red-flags">
        {abnormalBleeding.redFlags.map((flag: any, idx: number) => (
          <View key={idx} style={[styles.redFlagRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.redFlagSymptom, { color: colors.text }]}>{flag.symptom}</ThemedText>
            </View>
            <View style={[styles.urgencyBadge, {
              backgroundColor: flag.urgency.includes("urgent") ? "#EF444420" : flag.urgency.includes("same-day") ? "#F59E0B20" : "#3B82F620"
            }]}>
              <ThemedText style={[styles.urgencyText, {
                color: flag.urgency.includes("urgent") ? "#EF4444" : flag.urgency.includes("same-day") ? "#F59E0B" : "#3B82F6"
              }]}>{flag.urgency}</ThemedText>
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

function renderPregnancyTab(data: any, navigation: any, expandedSection: string | null, toggleSection: (id: string) => void, colors: any, isDark: boolean, color: string) {
  if (!data?.guide) return null;
  const { trimesters, laborSigns, postpartumRecovery } = data.guide;

  return (
    <View style={styles.tabContent}>
      <Pressable
        style={[styles.actionCard, { backgroundColor: color + "12", borderColor: color + "30" }]}
        onPress={() => navigation.navigate("PrenatalGuidelines")}
        testID="button-prenatal-guidelines"
      >
        <Feather name="book-open" size={20} color={color} />
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.actionTitle, { color: colors.text }]}>Prenatal Care Guidelines</ThemedText>
          <ThemedText style={[styles.actionSubtitle, { color: colors.textSecondary }]}>Full trimester-by-trimester recommendations</ThemedText>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textSecondary} />
      </Pressable>

      {trimesters.map((tri: any, tIdx: number) => (
        <SectionCard key={tri.name} title={tri.name} icon="calendar" color={color} colors={colors} isDark={isDark} testID={`section-trimester-${tIdx + 1}`}>
          <View style={[styles.weekBadge, { backgroundColor: color + "15" }]}>
            <ThemedText style={[styles.weekBadgeText, { color }]}>{tri.weeks}</ThemedText>
          </View>

          <ExpandableItem
            id={`tri-baby-${tIdx}`}
            title="Baby Development"
            expanded={expandedSection === `tri-baby-${tIdx}`}
            onToggle={toggleSection}
            colors={colors}
            color={color}
          >
            <BulletList items={tri.babyDevelopment} colors={colors} color={color} />
          </ExpandableItem>

          <ExpandableItem
            id={`tri-mother-${tIdx}`}
            title="Changes You May Notice"
            expanded={expandedSection === `tri-mother-${tIdx}`}
            onToggle={toggleSection}
            colors={colors}
            color={color}
          >
            <BulletList items={tri.motherChanges} colors={colors} color={color} />
          </ExpandableItem>

          <ExpandableItem
            id={`tri-appt-${tIdx}`}
            title="Key Appointments & Tests"
            expanded={expandedSection === `tri-appt-${tIdx}`}
            onToggle={toggleSection}
            colors={colors}
            color={color}
          >
            {tri.keyAppointments.map((appt: any, i: number) => (
              <View key={i} style={styles.appointmentRow}>
                <View style={[styles.appointmentWeek, { backgroundColor: color + "15" }]}>
                  <ThemedText style={[styles.appointmentWeekText, { color }]}>Wk {appt.week}</ThemedText>
                </View>
                <ThemedText style={[styles.appointmentText, { color: colors.text }]}>{appt.test}</ThemedText>
              </View>
            ))}
          </ExpandableItem>

          <ExpandableItem
            id={`tri-nutrition-${tIdx}`}
            title="Nutrition & Supplements"
            expanded={expandedSection === `tri-nutrition-${tIdx}`}
            onToggle={toggleSection}
            colors={colors}
            color="#10B981"
          >
            <BulletList items={tri.nutrition} colors={colors} color="#10B981" />
          </ExpandableItem>

          <ExpandableItem
            id={`tri-warning-${tIdx}`}
            title="Warning Signs - Seek Care"
            expanded={expandedSection === `tri-warning-${tIdx}`}
            onToggle={toggleSection}
            colors={colors}
            color="#EF4444"
          >
            <BulletList items={tri.warningSignsSeekCare} colors={colors} color="#EF4444" />
          </ExpandableItem>
        </SectionCard>
      ))}

      <SectionCard title="Signs of Labor" icon="clock" color={color} colors={colors} isDark={isDark} testID="section-labor-signs">
        <ThemedText style={[styles.subSectionLabel, { color: colors.textSecondary }]}>EARLY LABOR SIGNS</ThemedText>
        <BulletList items={laborSigns.earlyLabor} colors={colors} color={color} />
        <ThemedText style={[styles.subSectionLabel, { color: colors.textSecondary, marginTop: Spacing.md }]}>WHEN TO GO TO THE HOSPITAL</ThemedText>
        <BulletList items={laborSigns.whenToGoToHospital} colors={colors} color="#EF4444" />
      </SectionCard>

      <SectionCard title="Postpartum Recovery" icon="sun" color="#06B6D4" colors={colors} isDark={isDark} testID="section-postpartum">
        <ExpandableItem
          id="pp-physical"
          title="Physical Recovery Timeline"
          expanded={expandedSection === "pp-physical"}
          onToggle={toggleSection}
          colors={colors}
          color="#06B6D4"
        >
          {postpartumRecovery.physicalRecovery.map((item: any, i: number) => (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: "#06B6D4" }]} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.timelineLabel, { color: "#06B6D4" }]}>{item.timeline}</ThemedText>
                <ThemedText style={[styles.timelineText, { color: colors.text }]}>{item.care}</ThemedText>
              </View>
            </View>
          ))}
        </ExpandableItem>

        <ExpandableItem
          id="pp-mental"
          title="Mental Health"
          subtitle="Baby blues, PPD, PPA, psychosis"
          expanded={expandedSection === "pp-mental"}
          onToggle={toggleSection}
          colors={colors}
          color="#8B5CF6"
        >
          {Object.entries(postpartumRecovery.mentalHealth).map(([key, value]: [string, any]) => (
            <View key={key} style={[styles.mentalHealthItem, { borderColor: colors.border }]}>
              <ThemedText style={[styles.mentalHealthLabel, { color: colors.text }]}>
                {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
              </ThemedText>
              <ThemedText style={[styles.mentalHealthText, { color: colors.textSecondary }]}>{value}</ThemedText>
            </View>
          ))}
        </ExpandableItem>

        <ExpandableItem
          id="pp-bf"
          title="Breastfeeding Guidance"
          expanded={expandedSection === "pp-bf"}
          onToggle={toggleSection}
          colors={colors}
          color={color}
        >
          <BulletList items={postpartumRecovery.breastfeeding} colors={colors} color={color} />
        </ExpandableItem>
      </SectionCard>

      <View style={[styles.disclaimer, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", borderColor: colors.border }]}>
        <Feather name="alert-circle" size={14} color={colors.textSecondary} />
        <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          This information is for educational purposes only. Always follow your healthcare provider's specific recommendations for your pregnancy.
        </ThemedText>
      </View>
    </View>
  );
}

function renderMenopauseTab(data: any, expandedSection: string | null, toggleSection: (id: string) => void, colors: any, isDark: boolean, color: string) {
  if (!data?.guide) return null;
  const { stages, symptomTracker } = data.guide;

  return (
    <View style={styles.tabContent}>
      <View style={[styles.introCard, { backgroundColor: color + "10", borderColor: color + "30" }]}>
        <Feather name="info" size={16} color={color} />
        <ThemedText style={[styles.introText, { color: colors.text }]}>
          Menopause is a natural biological process. Understanding each stage helps you manage symptoms and protect long-term health.
        </ThemedText>
      </View>

      {stages.map((stage: any, sIdx: number) => (
        <SectionCard key={stage.name} title={stage.name} icon={sIdx === 0 ? "trending-down" : sIdx === 1 ? "minus-circle" : "shield"} color={color} colors={colors} isDark={isDark} testID={`section-stage-${sIdx}`}>
          <View style={styles.stageMetaRow}>
            <View style={[styles.stageMeta, { backgroundColor: color + "12" }]}>
              <Feather name="users" size={12} color={color} />
              <ThemedText style={[styles.stageMetaText, { color }]}>{stage.ageRange}</ThemedText>
            </View>
            <View style={[styles.stageMeta, { backgroundColor: color + "12" }]}>
              <Feather name="clock" size={12} color={color} />
              <ThemedText style={[styles.stageMetaText, { color }]}>{stage.duration}</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.stageDescription, { color: colors.textSecondary }]}>{stage.description}</ThemedText>

          <ExpandableItem
            id={`stage-changes-${sIdx}`}
            title="Key Changes"
            expanded={expandedSection === `stage-changes-${sIdx}`}
            onToggle={toggleSection}
            colors={colors}
            color={color}
          >
            <BulletList items={stage.keyChanges} colors={colors} color={color} />
          </ExpandableItem>

          {stage.management.map((mgmt: any, mIdx: number) => (
            <ExpandableItem
              key={mgmt.area}
              id={`mgmt-${sIdx}-${mIdx}`}
              title={mgmt.area}
              expanded={expandedSection === `mgmt-${sIdx}-${mIdx}`}
              onToggle={toggleSection}
              colors={colors}
              color={color}
            >
              <BulletList items={mgmt.options} colors={colors} color={color} />
            </ExpandableItem>
          ))}
        </SectionCard>
      ))}

      <SectionCard title="Symptom Categories" icon="list" color={color} colors={colors} isDark={isDark} testID="section-symptom-categories">
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Track these symptoms across perimenopause, menopause, and post-menopause to share with your healthcare provider.
        </ThemedText>
        {(() => {
          const grouped: Record<string, any[]> = {};
          symptomTracker.symptoms.forEach((s: any) => {
            const cat = s.category.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(s);
          });
          return Object.entries(grouped).map(([cat, symptoms]) => (
            <View key={cat} style={[styles.symptomCategoryBlock, { borderColor: colors.border }]}>
              <ThemedText style={[styles.symptomCategoryLabel, { color: colors.textSecondary }]}>{cat.toUpperCase()}</ThemedText>
              <View style={styles.symptomChips}>
                {symptoms.map((s: any) => (
                  <View key={s.id} style={[styles.symptomChip, { backgroundColor: color + "12" }]}>
                    <ThemedText style={[styles.symptomChipText, { color }]}>{s.label}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ));
        })()}
      </SectionCard>

      <View style={[styles.disclaimer, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", borderColor: colors.border }]}>
        <Feather name="alert-circle" size={14} color={colors.textSecondary} />
        <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          This information is for educational purposes. Discuss treatment options with your healthcare provider to determine the best approach for your individual needs.
        </ThemedText>
      </View>
    </View>
  );
}

function renderScreeningsTab(data: any, expandedSection: string | null, toggleSection: (id: string) => void, colors: any, isDark: boolean, color: string) {
  if (!data?.screenings) return null;

  return (
    <View style={styles.tabContent}>
      <View style={[styles.introCard, { backgroundColor: color + "10", borderColor: color + "30" }]}>
        <Feather name="shield" size={16} color={color} />
        <ThemedText style={[styles.introText, { color: colors.text }]}>
          Evidence-based screening schedules from USPSTF, ACOG, ATA, and WHO guidelines. Discuss with your provider which screenings are right for you.
        </ThemedText>
      </View>

      {data.screenings.map((screening: any, idx: number) => (
        <ExpandableItem
          key={idx}
          id={`screening-${idx}`}
          title={screening.name}
          subtitle={screening.guidelines}
          expanded={expandedSection === `screening-${idx}`}
          onToggle={toggleSection}
          colors={colors}
          color={color}
        >
          <ThemedText style={[styles.expandedDescription, { color: colors.text }]}>{screening.description}</ThemedText>
          <View style={styles.screeningMeta}>
            <View style={[styles.metaBadge, { backgroundColor: "#3B82F615" }]}>
              <Feather name="users" size={12} color="#3B82F6" />
              <ThemedText style={[styles.metaBadgeText, { color: "#3B82F6" }]}>Ages: {screening.ageRange}</ThemedText>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: "#8B5CF615" }]}>
              <Feather name="clock" size={12} color="#8B5CF6" />
              <ThemedText style={[styles.metaBadgeText, { color: "#8B5CF6" }]}>{screening.frequency}</ThemedText>
            </View>
          </View>
        </ExpandableItem>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md },
  headerSection: { alignItems: "center", marginBottom: Spacing.lg },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  headerSubtitle: { fontSize: 14 },
  tabContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  tabText: { fontSize: 11, fontWeight: "600" },
  tabContent: { gap: Spacing.md },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCardTitle: { fontSize: 17, fontWeight: "700", flex: 1 },
  sectionDescription: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  expandableItem: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  expandableHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  expandableTitle: { fontSize: 14, fontWeight: "600" },
  expandableSubtitle: { fontSize: 11, marginTop: 1 },
  expandableContent: {
    borderTopWidth: 1,
    padding: Spacing.sm + 2,
  },
  expandedDescription: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  hormoneTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  hormoneText: { fontSize: 11, fontWeight: "500" },
  subSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  bulletList: { gap: 4 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  bulletText: { fontSize: 13, lineHeight: 19, flex: 1 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  sourceText: { fontSize: 10, fontStyle: "italic", flex: 1 },
  redFlagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  redFlagSymptom: { fontSize: 13 },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  urgencyText: { fontSize: 10, fontWeight: "700" },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  actionTitle: { fontSize: 15, fontWeight: "600" },
  actionSubtitle: { fontSize: 12, marginTop: 1 },
  weekBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  weekBadgeText: { fontSize: 12, fontWeight: "700" },
  appointmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  appointmentWeek: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 50,
    alignItems: "center",
  },
  appointmentWeekText: { fontSize: 10, fontWeight: "700" },
  appointmentText: { fontSize: 13, flex: 1, lineHeight: 19 },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  timelineLabel: { fontSize: 12, fontWeight: "700" },
  timelineText: { fontSize: 13, lineHeight: 19 },
  mentalHealthItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mentalHealthLabel: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  mentalHealthText: { fontSize: 13, lineHeight: 19 },
  introCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  introText: { fontSize: 13, lineHeight: 20, flex: 1 },
  stageMetaRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  stageMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  stageMetaText: { fontSize: 11, fontWeight: "600" },
  stageDescription: { fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  symptomCategoryBlock: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  symptomCategoryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  symptomChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  symptomChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  symptomChipText: { fontSize: 12, fontWeight: "500" },
  screeningMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: Spacing.sm },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  metaBadgeText: { fontSize: 11, fontWeight: "500" },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  disclaimerText: { fontSize: 11, flex: 1, lineHeight: 16 },
});
