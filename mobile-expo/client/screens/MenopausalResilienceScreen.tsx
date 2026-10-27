import React, { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SkeletonBox } from "@/components/LoadingState";
import { Spacing, BorderRadius } from "@/constants/theme";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useAccessibility } from "@/context/AccessibilityContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabType = "hormones" | "resilience" | "provider" | "questions";

const TABS: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
  { key: "hormones", label: "Hormones", icon: "activity", color: "#EC4899" },
  { key: "resilience", label: "Score", icon: "bar-chart-2", color: "#8B5CF6" },
  { key: "provider", label: "Share", icon: "share-2", color: "#3B82F6" },
  { key: "questions", label: "Ask", icon: "help-circle", color: "#10B981" },
];

function ResilienceSkeleton({ cardBg, detailBg, reducedMotion }: { cardBg: string; detailBg: string; reducedMotion: boolean }) {
  const skeletonProps = reducedMotion ? { style: { opacity: 0.5 } as any } : {};
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading resilience data" accessibilityLiveRegion="polite">
      <View style={[styles.heroCard, { backgroundColor: detailBg }]}>
        <SkeletonBox width={64} height={64} borderRadius={32} {...skeletonProps} />
        <View style={{ marginTop: Spacing.md, width: "100%", alignItems: "center" }}>
          <SkeletonBox width="60%" height={20} borderRadius={BorderRadius.xs} {...skeletonProps} />
          <View style={{ height: Spacing.sm }} />
          <SkeletonBox width="85%" height={14} borderRadius={BorderRadius.xs} {...skeletonProps} />
          <View style={{ height: 4 }} />
          <SkeletonBox width="70%" height={14} borderRadius={BorderRadius.xs} {...skeletonProps} />
        </View>
      </View>

      <SkeletonBox width="45%" height={18} borderRadius={BorderRadius.xs} style={{ marginBottom: Spacing.xs }} {...skeletonProps} />
      <SkeletonBox width="80%" height={13} borderRadius={BorderRadius.xs} style={{ marginBottom: Spacing.md }} {...skeletonProps} />

      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.hormoneCard, { backgroundColor: cardBg }]}>
          <View style={styles.hormoneHeader}>
            <SkeletonBox width={44} height={44} borderRadius={22} {...skeletonProps} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <SkeletonBox width="55%" height={15} borderRadius={BorderRadius.xs} {...skeletonProps} />
              <View style={{ height: 6 }} />
              <SkeletonBox width="90%" height={13} borderRadius={BorderRadius.xs} {...skeletonProps} />
            </View>
            <SkeletonBox width={18} height={18} borderRadius={4} {...skeletonProps} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MenopausalResilienceScreen() {
  const { theme: colors, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { settings } = useAccessibility();
  const isHighContrast = settings.highContrast;
  const reducedMotion = settings.reducedMotion;
  const [activeTab, setActiveTab] = useState<TabType>("hormones");
  const [expandedHormone, setExpandedHormone] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/womens-health/menopausal-resilience"],
  });

  const animateLayout = () => {
    if (!reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  };

  const toggleHormone = (id: string) => {
    animateLayout();
    setExpandedHormone(expandedHormone === id ? null : id);
  };
  const toggleDomain = (id: string) => {
    animateLayout();
    setExpandedDomain(expandedDomain === id ? null : id);
  };
  const toggleReport = () => {
    animateLayout();
    setExpandedReport(!expandedReport);
  };

  const cardBg = colors.backgroundDefault;
  const detailBg = colors.backgroundSecondary;
  const borderColor = isHighContrast
    ? (isDark ? colors.border : colors.border)
    : colors.border;
  const cardBorder = isHighContrast ? 1 : 0;

  const entryAnim = reducedMotion ? undefined : FadeInDown.delay(100);
  const entryAnimDelayed = (delay: number) => reducedMotion ? undefined : FadeInDown.delay(delay);

  const handleShareReport = async () => {
    try {
      const reportSections = data?.providerReport?.reportSections || [];
      const questions = data?.providerReport?.providerQuestions || [];
      await Share.share({
        title: "Menopausal Resilience Report",
        message: `Menopausal Resilience Report from Tabula Medica\n\nReport Contents:\n${reportSections.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}\n\nQuestions for Provider:\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}\n\nGenerated by Tabula Medica - tabulamedica.health`,
      });
    } catch (e) {}
  };

  const renderHormonesTab = () => {
    if (!data?.hormoneTracking) return null;
    const { hormoneTracking } = data;
    return (
      <View accessibilityRole="list" accessibilityLabel="Hormone tracking panel">
        <Animated.View entering={entryAnim} style={[styles.heroCard, { backgroundColor: isDark ? colors.backgroundSecondary : "#FDF2F8" }]}>
          <View style={[styles.heroIconContainer, { backgroundColor: "#EC489920" }]} accessibilityElementsHidden>
            <Feather name="activity" size={32} color="#EC4899" />
          </View>
          <ThemedText style={[styles.heroTitle, { color: colors.text }]} accessibilityRole="header">{hormoneTracking.title}</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {hormoneTracking.description}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={entryAnimDelayed(200)}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">Hormone Panel</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Track these markers through perimenopause, menopause, and beyond
          </ThemedText>
        </Animated.View>

        <View style={[styles.disclaimerInline, { borderColor: colors.warning + "40", backgroundColor: isDark ? colors.backgroundSecondary : "#FFFBEB" }]}
          accessibilityRole="text" accessibilityLabel="Medical disclaimer: Ranges and targets are general guidelines">
          <Feather name="alert-triangle" size={14} color={colors.warning} accessibilityElementsHidden />
          <ThemedText style={[styles.disclaimerInlineText, { color: colors.textSecondary }]}>
            Ranges and targets are general guidelines. All HRT and treatment decisions should be individualized with your provider based on your specific history, symptoms, and lab results.
          </ThemedText>
        </View>

        {hormoneTracking.hormones?.map((hormone: any, index: number) => {
          const isExpanded = expandedHormone === hormone.name;
          return (
            <Animated.View key={hormone.name} entering={entryAnimDelayed(300 + index * 60)} accessibilityRole={"text" as any}>
              <View style={[styles.hormoneCard, { backgroundColor: cardBg, borderColor, borderWidth: cardBorder }]}>
                <Pressable
                  testID={`hormone-card-${index}`}
                  onPress={() => toggleHormone(hormone.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${hormone.name}. ${hormone.role}`}
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityHint={isExpanded ? "Double tap to collapse" : "Double tap to expand details"}
                  style={styles.accordionHeader}
                >
                  <View style={styles.hormoneHeader}>
                    <View style={[styles.hormoneIcon, { backgroundColor: hormone.color + "20" }]} accessibilityElementsHidden>
                      <Feather name={hormone.icon as any} size={22} color={hormone.color} />
                    </View>
                    <View style={styles.hormoneHeaderText}>
                      <ThemedText style={[styles.hormoneName, { color: colors.text }]}>{hormone.name}</ThemedText>
                      <ThemedText style={[styles.hormoneRole, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                        {hormone.role}
                      </ThemedText>
                    </View>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} accessibilityElementsHidden />
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={[styles.hormoneDetails, { borderTopColor: borderColor }]} accessibilityLabel={`${hormone.name} detailed ranges`}>
                    <View style={[styles.rangeBox, { backgroundColor: detailBg }]}>
                      <ThemedText style={[styles.rangeLabel, { color: hormone.color }]}>PREMENOPAUSAL RANGE</ThemedText>
                      <ThemedText style={[styles.rangeValue, { color: colors.text }]}>{hormone.premenopausalRange}</ThemedText>
                    </View>
                    <View style={[styles.rangeBox, { backgroundColor: detailBg }]}>
                      <ThemedText style={[styles.rangeLabel, { color: colors.warning }]}>PERIMENOPAUSE RANGE</ThemedText>
                      <ThemedText style={[styles.rangeValue, { color: colors.text }]}>{hormone.perimenopauseRange}</ThemedText>
                    </View>
                    <View style={[styles.rangeBox, { backgroundColor: detailBg }]}>
                      <ThemedText style={[styles.rangeLabel, { color: colors.error }]}>POST-MENOPAUSE RANGE</ThemedText>
                      <ThemedText style={[styles.rangeValue, { color: colors.text }]}>{hormone.postmenopauseRange}</ThemedText>
                    </View>
                    <View style={[styles.rangeBox, { backgroundColor: isDark ? colors.backgroundSecondary : "#f0fdf4", borderWidth: 1, borderColor: colors.success + "30" }]}>
                      <ThemedText style={[styles.rangeLabel, { color: colors.success }]}>HRT TARGET</ThemedText>
                      <ThemedText style={[styles.rangeValue, { color: colors.text }]}>{hormone.hrtTarget}</ThemedText>
                    </View>
                    <View style={[styles.guidanceBox, { backgroundColor: isDark ? colors.backgroundSecondary : "#EFF6FF", borderColor: colors.info + "30" }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 6 }}>
                        <Feather name="info" size={14} color={colors.info} accessibilityElementsHidden />
                        <ThemedText style={{ fontSize: 12, fontWeight: "700", color: colors.info, textTransform: "uppercase", letterSpacing: 0.5 }}>Testing Guidance</ThemedText>
                      </View>
                      <ThemedText style={[styles.guidanceText, { color: colors.text }]}>{hormone.testingGuidance}</ThemedText>
                    </View>
                    <View style={styles.loincRow} accessibilityLabel={`Clinical code: ${hormone.clinicalCode}`}>
                      <Feather name="hash" size={12} color={colors.textSecondary} accessibilityElementsHidden />
                      <ThemedText style={[styles.loincCode, { color: colors.textSecondary }]}>{hormone.clinicalCode}</ThemedText>
                    </View>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderResilienceTab = () => {
    if (!data?.resilienceScore) return null;
    const { resilienceScore } = data;
    return (
      <View accessibilityRole="list" accessibilityLabel="Resilience score domains">
        <Animated.View entering={entryAnim} style={[styles.heroCard, { backgroundColor: isDark ? colors.backgroundSecondary : "#F5F3FF" }]}>
          <View style={[styles.heroIconContainer, { backgroundColor: "#8B5CF620" }]} accessibilityElementsHidden>
            <Feather name="bar-chart-2" size={32} color="#8B5CF6" />
          </View>
          <ThemedText style={[styles.heroTitle, { color: colors.text }]} accessibilityRole="header">{resilienceScore.title}</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {resilienceScore.description}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={entryAnimDelayed(150)}>
          <View style={[styles.methodBox, { backgroundColor: cardBg, borderColor, borderWidth: cardBorder }]}>
            <Feather name="info" size={16} color="#8B5CF6" accessibilityElementsHidden />
            <ThemedText style={[styles.methodText, { color: colors.textSecondary }]}>
              {resilienceScore.scoringMethod}
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={entryAnimDelayed(200)}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">Resilience Domains</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Each domain contributes to your overall score
          </ThemedText>
        </Animated.View>

        <View style={[styles.disclaimerInline, { borderColor: colors.warning + "40", backgroundColor: isDark ? colors.backgroundSecondary : "#FFFBEB" }]}
          accessibilityRole="text" accessibilityLabel="Scoring tiers are for educational reference">
          <Feather name="alert-triangle" size={14} color={colors.warning} accessibilityElementsHidden />
          <ThemedText style={[styles.disclaimerInlineText, { color: colors.textSecondary }]}>
            Scoring tiers are for educational reference. Discuss your individual results and interventions with your healthcare provider.
          </ThemedText>
        </View>

        {resilienceScore.domains?.map((domain: any, index: number) => {
          const isExpanded = expandedDomain === domain.name;
          return (
            <Animated.View key={domain.name} entering={entryAnimDelayed(300 + index * 80)} accessibilityRole={"text" as any}>
              <View style={[styles.domainCard, { backgroundColor: cardBg, borderColor, borderWidth: cardBorder }]}>
                <Pressable
                  testID={`domain-card-${index}`}
                  onPress={() => toggleDomain(domain.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${domain.name}. Weight ${domain.weight} percent`}
                  accessibilityState={{ expanded: isExpanded }}
                  accessibilityHint={isExpanded ? "Double tap to collapse" : "Double tap to expand details"}
                  style={styles.accordionHeader}
                >
                  <View style={styles.domainHeader}>
                    <View style={[styles.domainIcon, { backgroundColor: domain.color + "20" }]} accessibilityElementsHidden>
                      <Feather name={domain.icon as any} size={22} color={domain.color} />
                    </View>
                    <View style={styles.domainHeaderText}>
                      <ThemedText style={[styles.domainName, { color: colors.text }]}>{domain.name}</ThemedText>
                      <ThemedText style={[styles.domainWeight, { color: domain.color }]}>Weight: {domain.weight}%</ThemedText>
                    </View>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} accessibilityElementsHidden />
                  </View>
                  <ThemedText style={[styles.domainDescription, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                    {domain.description}
                  </ThemedText>
                </Pressable>

                {isExpanded ? (
                  <View style={[styles.domainDetails, { borderTopColor: borderColor }]} accessibilityLabel={`${domain.name} scoring details`}>
                    <ThemedText style={[styles.domainSectionLabel, { color: colors.text }]} accessibilityRole="header">Scoring Tiers</ThemedText>
                    {domain.scoring?.map((tier: any, ti: number) => (
                      <View key={ti} style={[styles.tierRow, { backgroundColor: detailBg }]}
                        accessibilityLabel={`${tier.label}: ${tier.range}. Score ${tier.score}`}>
                        <View style={[styles.tierDot, { backgroundColor: tier.color }]} accessibilityElementsHidden />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={[styles.tierLabel, { color: tier.color }]}>{tier.label} ({tier.score})</ThemedText>
                          <ThemedText style={[styles.tierRange, { color: colors.textSecondary }]}>{tier.range}</ThemedText>
                        </View>
                      </View>
                    ))}

                    <ThemedText style={[styles.domainSectionLabel, { color: colors.text, marginTop: Spacing.md }]} accessibilityRole="header">Interventions</ThemedText>
                    {domain.interventions?.map((intervention: string, ii: number) => (
                      <View key={ii} style={styles.interventionRow} accessibilityRole="text">
                        <Feather name="check-circle" size={14} color={colors.success} accessibilityElementsHidden />
                        <ThemedText style={[styles.interventionText, { color: colors.text }]}>{intervention}</ThemedText>
                      </View>
                    ))}

                    <View style={[styles.testFreqBox, { backgroundColor: isDark ? colors.backgroundSecondary : "#f0fdf4" }]}>
                      <Feather name="clock" size={14} color={colors.success} accessibilityElementsHidden />
                      <ThemedText style={[styles.testFreqText, { color: colors.text }]}>{domain.testFrequency}</ThemedText>
                    </View>

                    <View style={styles.loincRow} accessibilityLabel={`Clinical code: ${domain.clinicalCode}`}>
                      <Feather name="hash" size={12} color={colors.textSecondary} accessibilityElementsHidden />
                      <ThemedText style={[styles.loincCode, { color: colors.textSecondary }]}>{domain.clinicalCode}</ThemedText>
                    </View>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderProviderTab = () => {
    if (!data?.providerReport) return null;
    const { providerReport } = data;
    return (
      <View accessibilityLabel="Provider report section">
        <Animated.View entering={entryAnim} style={[styles.heroCard, { backgroundColor: isDark ? colors.backgroundSecondary : "#EFF6FF" }]}>
          <View style={[styles.heroIconContainer, { backgroundColor: colors.info + "20" }]} accessibilityElementsHidden>
            <Feather name="file-text" size={32} color={colors.info} />
          </View>
          <ThemedText style={[styles.heroTitle, { color: colors.text }]} accessibilityRole="header">{providerReport.title}</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {providerReport.description}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={entryAnimDelayed(200)}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">Report Contents</ThemedText>
        </Animated.View>

        <Animated.View entering={entryAnimDelayed(250)}>
          <View style={[styles.reportContentsCard, { backgroundColor: cardBg, borderColor, borderWidth: cardBorder }]}>
            <Pressable
              testID="report-contents-accordion"
              onPress={toggleReport}
              accessibilityRole="button"
              accessibilityLabel={`Report contents. ${providerReport.reportSections?.length || 0} sections`}
              accessibilityState={{ expanded: expandedReport }}
              accessibilityHint={expandedReport ? "Double tap to collapse" : "Double tap to expand report sections"}
              style={styles.accordionHeader}
            >
              <View style={styles.reportAccordionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
                  <View style={[styles.reportNumber, { backgroundColor: colors.info + "20" }]}>
                    <Feather name="list" size={16} color={colors.info} />
                  </View>
                  <ThemedText style={[styles.reportAccordionTitle, { color: colors.text }]}>
                    {providerReport.reportSections?.length || 0} Report Sections
                  </ThemedText>
                </View>
                <Feather name={expandedReport ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} accessibilityElementsHidden />
              </View>
            </Pressable>

            {expandedReport ? (
              <View style={{ marginTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor, paddingTop: Spacing.md }}>
                {providerReport.reportSections?.map((section: string, index: number) => (
                  <View key={index} style={styles.reportRow} accessibilityRole="text">
                    <View style={[styles.reportNumber, { backgroundColor: colors.info + "20" }]}>
                      <ThemedText style={[styles.reportNumberText, { color: colors.info }]}>{index + 1}</ThemedText>
                    </View>
                    <ThemedText style={[styles.reportText, { color: colors.text }]}>{section}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Pressable
          testID="button-share-report"
          style={[styles.shareButton, { backgroundColor: colors.info }]}
          onPress={handleShareReport}
          accessibilityRole="button"
          accessibilityLabel="Share resilience report with your provider"
        >
          <Feather name="share-2" size={18} color="#FFFFFF" accessibilityElementsHidden />
          <ThemedText style={styles.shareButtonText}>Share Resilience Report with Provider</ThemedText>
        </Pressable>
      </View>
    );
  };

  const renderQuestionsTab = () => {
    if (!data?.providerReport) return null;
    const { providerReport } = data;
    return (
      <View accessibilityRole="list" accessibilityLabel="Questions for your provider">
        <Animated.View entering={entryAnim} style={[styles.heroCard, { backgroundColor: isDark ? colors.backgroundSecondary : "#F0FDF4" }]}>
          <View style={[styles.heroIconContainer, { backgroundColor: colors.success + "20" }]} accessibilityElementsHidden>
            <Feather name="help-circle" size={32} color={colors.success} />
          </View>
          <ThemedText style={[styles.heroTitle, { color: colors.text }]} accessibilityRole="header">Questions for Your Provider</ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Evidence-based questions to bring to your next appointment for personalized counseling and remediation
          </ThemedText>
        </Animated.View>

        <Animated.View entering={entryAnimDelayed(200)}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">Recommended Discussion Points</ThemedText>
          <ThemedText style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            These questions are generated based on common resilience score gaps
          </ThemedText>
        </Animated.View>

        {providerReport.providerQuestions?.map((question: string, index: number) => (
          <Animated.View key={index} entering={entryAnimDelayed(300 + index * 60)} accessibilityRole={"text" as any}>
            <View style={[styles.questionCard, { backgroundColor: cardBg, borderColor, borderWidth: cardBorder }]}>
              <View style={[styles.questionNumber, { backgroundColor: colors.success + "20" }]} accessibilityElementsHidden>
                <ThemedText style={[styles.questionNumberText, { color: colors.success }]}>{index + 1}</ThemedText>
              </View>
              <ThemedText style={[styles.questionText, { color: colors.text }]}>{question}</ThemedText>
            </View>
          </Animated.View>
        ))}

        <Animated.View entering={entryAnimDelayed(700)}>
          <View style={[styles.disclaimerCard, { borderColor: colors.warning + "40", backgroundColor: isDark ? colors.backgroundSecondary : "#FFFBEB" }]}
            accessibilityRole="text" accessibilityLabel="Medical disclaimer">
            <Feather name="alert-triangle" size={16} color={colors.warning} accessibilityElementsHidden />
            <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
              This information is for educational purposes only and does not constitute medical advice. All hormone optimization, HRT decisions, and supplement changes should be made in consultation with your healthcare provider based on your individual history and lab results.
            </ThemedText>
          </View>
        </Animated.View>
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "hormones": return renderHormonesTab();
      case "resilience": return renderResilienceTab();
      case "provider": return renderProviderTab();
      case "questions": return renderQuestionsTab();
      default: return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing["2xl"] }]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.headerSection} accessibilityRole="header">
          <View style={[styles.headerIconContainer, { backgroundColor: "#8B5CF620" }]} accessibilityElementsHidden>
            <Feather name="sun" size={28} color="#8B5CF6" />
          </View>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Menopausal Resilience</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Hormone tracking, resilience scoring, and provider counseling
          </ThemedText>
        </View>

        <View style={styles.tabContainer} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                testID={`tab-${tab.key}`}
                style={[
                  styles.tab,
                  isActive
                    ? { backgroundColor: tab.color + "20" }
                    : { backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundSecondary },
                  isHighContrast && isActive ? { borderWidth: 2, borderColor: tab.color } : null,
                ]}
                onPress={() => { setActiveTab(tab.key); setExpandedHormone(null); setExpandedDomain(null); setExpandedReport(false); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label} tab`}
              >
                <Feather name={tab.icon} size={15} color={isActive ? tab.color : colors.textSecondary} accessibilityElementsHidden />
                <ThemedText style={[styles.tabText, { color: isActive ? tab.color : colors.textSecondary }]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <ResilienceSkeleton cardBg={cardBg} detailBg={detailBg} reducedMotion={reducedMotion} />
        ) : (
          renderContent()
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  headerSection: { alignItems: "center", marginBottom: Spacing.md },
  headerIconContainer: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", marginTop: Spacing.sm },
  headerSubtitle: { fontSize: 14, textAlign: "center", marginTop: Spacing.xs },
  tabContainer: { flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.lg },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    borderRadius: BorderRadius.md,
  },
  tabText: { fontSize: 12, fontWeight: "600" },
  accordionHeader: {
    minHeight: 44,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  heroIconContainer: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  heroTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: Spacing.xs },
  heroSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  hormoneCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  hormoneHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  hormoneIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  hormoneHeaderText: { flex: 1 },
  hormoneName: { fontSize: 15, fontWeight: "600" },
  hormoneRole: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  hormoneDetails: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  rangeBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  rangeLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  rangeValue: { fontSize: 14, lineHeight: 20 },
  guidanceBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  guidanceText: { fontSize: 13, lineHeight: 18 },
  loincRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  loincCode: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  methodBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  methodText: { flex: 1, fontSize: 13, lineHeight: 18 },
  domainCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  domainHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  domainIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  domainHeaderText: { flex: 1 },
  domainName: { fontSize: 15, fontWeight: "600" },
  domainWeight: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  domainDescription: { fontSize: 13, lineHeight: 18, marginTop: Spacing.sm },
  domainDetails: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  domainSectionLabel: { fontSize: 14, fontWeight: "600", marginBottom: Spacing.sm },
  tierRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm, marginBottom: 4 },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierLabel: { fontSize: 13, fontWeight: "600" },
  tierRange: { fontSize: 12, marginTop: 2 },
  interventionRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginBottom: Spacing.xs },
  interventionText: { flex: 1, fontSize: 13, lineHeight: 18 },
  testFreqBox: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  testFreqText: { flex: 1, fontSize: 13, lineHeight: 18 },
  reportContentsCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  reportAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportAccordionTitle: { fontSize: 15, fontWeight: "600" },
  reportRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  reportNumber: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  reportNumberText: { fontSize: 12, fontWeight: "700" },
  reportText: { flex: 1, fontSize: 14, lineHeight: 20 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    minHeight: 48,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  shareButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  questionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    minHeight: 44,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }),
  },
  questionNumber: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 2 },
  questionNumberText: { fontSize: 14, fontWeight: "700" },
  questionText: { flex: 1, fontSize: 14, lineHeight: 22 },
  disclaimerInline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  disclaimerInlineText: { flex: 1, fontSize: 12, lineHeight: 17 },
  disclaimerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
