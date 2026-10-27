import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Switch,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type Sex = "male" | "female";
type Race = "white" | "african_american" | "other";
type RiskCategory = "low" | "borderline" | "intermediate" | "high";

interface ASCVDInputs {
  age: number;
  sex: Sex;
  race: Race;
  totalCholesterol: number;
  hdlCholesterol: number;
  systolicBP: number;
  onBPMeds: boolean;
  diabetic: boolean;
  smoker: boolean;
}

interface PreventiveGuideline {
  id: string;
  category: string;
  title: string;
  recommendation: string;
  source: string;
  grade: string;
  applicableRiskLevel: string[];
  interventionType: "lifestyle" | "medication" | "screening" | "monitoring";
}

interface ASCVDResult {
  tenYearRisk: number;
  lifetimeRisk: number;
  riskCategory: RiskCategory;
  optimalRisk: number;
  riskReduction: number;
  inputs: ASCVDInputs;
  guidelines: PreventiveGuideline[];
  calculatedAt: string;
}

interface ExtractedData {
  inputs: Partial<ASCVDInputs>;
  sources: Record<string, { value: any; date: string; source: string }>;
  confidence: number;
  missingFields: string[];
}

const RISK_COLORS: Record<RiskCategory, string> = {
  low: "#10B981",
  borderline: "#F59E0B",
  intermediate: "#F97316",
  high: "#EF4444",
};

const RISK_LABELS: Record<RiskCategory, string> = {
  low: "Low Risk",
  borderline: "Borderline",
  intermediate: "Intermediate",
  high: "High Risk",
};

const INTERVENTION_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  lifestyle: "heart",
  medication: "package",
  screening: "search",
  monitoring: "activity",
};

function NumberInput({
  label,
  value,
  onChangeText,
  unit,
  placeholder,
  source,
  colors,
  isDark,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  unit?: string;
  placeholder: string;
  source?: { value: any; date: string; source: string };
  colors: any;
  isDark: boolean;
  testID: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabelRow}>
        <ThemedText style={[styles.inputLabel, { color: colors.text }]}>{label}</ThemedText>
        {unit ? (
          <ThemedText style={[styles.inputUnit, { color: colors.textSecondary }]}>{unit}</ThemedText>
        ) : null}
      </View>
      <TextInput
        testID={testID}
        style={[
          styles.textInput,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            color: colors.text,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        returnKeyType="done"
      />
      {source ? (
        <View style={styles.sourceTag}>
          <Feather name="database" size={10} color={colors.primary} />
          <ThemedText style={[styles.sourceText, { color: colors.primary }]}>
            {source.source}{source.date ? ` (${source.date})` : ""}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  colors,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
}) {
  return (
    <View style={styles.toggleRow}>
      <ThemedText style={[styles.inputLabel, { color: colors.text, flex: 1 }]}>{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#767577", true: colors.primary + "60" }}
        thumbColor={value ? colors.primary : "#f4f3f4"}
      />
    </View>
  );
}

function SegmentedControl({
  options,
  selected,
  onSelect,
  colors,
  isDark,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (v: string) => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }]}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[
            styles.segmentedOption,
            selected === opt.value && {
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => onSelect(opt.value)}
        >
          <ThemedText
            style={[
              styles.segmentedLabel,
              { color: selected === opt.value ? "#FFFFFF" : colors.textSecondary },
            ]}
          >
            {opt.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export default function ASCVDCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme: colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<"calculator" | "guidelines">("calculator");
  const [expandedGuideline, setExpandedGuideline] = useState<string | null>(null);

  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [race, setRace] = useState<Race>("other");
  const [totalCholesterol, setTotalCholesterol] = useState("");
  const [hdlCholesterol, setHdlCholesterol] = useState("");
  const [systolicBP, setSystolicBP] = useState("");
  const [onBPMeds, setOnBPMeds] = useState(false);
  const [diabetic, setDiabetic] = useState(false);
  const [smoker, setSmoker] = useState(false);
  const [result, setResult] = useState<ASCVDResult | null>(null);
  const [extractedSources, setExtractedSources] = useState<Record<string, any>>({});
  const scrollRef = useRef<ScrollView>(null);

  const { data: autoExtracted, isLoading: extracting, refetch: refetchExtract } = useQuery<ExtractedData>({
    queryKey: ["/api/ascvd/auto-extract"],
    enabled: false,
  });

  const { data: allGuidelines } = useQuery<{ guidelines: PreventiveGuideline[] }>({
    queryKey: ["/api/ascvd/guidelines"],
  });

  const calculateMutation = useMutation({
    mutationFn: async (inputs: ASCVDInputs) => {
      const res = await apiRequest("POST", "/api/ascvd/calculate", inputs);
      return res.json() as Promise<ASCVDResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 400, animated: true });
      }, 300);
    },
  });

  const handleAutoFill = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const { data } = await refetchExtract();
    if (data) {
      const inp = data.inputs;
      if (inp.age) setAge(String(inp.age));
      if (inp.sex) setSex(inp.sex);
      if (inp.race) setRace(inp.race);
      if (inp.totalCholesterol) setTotalCholesterol(String(inp.totalCholesterol));
      if (inp.hdlCholesterol) setHdlCholesterol(String(inp.hdlCholesterol));
      if (inp.systolicBP) setSystolicBP(String(inp.systolicBP));
      if (inp.onBPMeds !== undefined) setOnBPMeds(inp.onBPMeds);
      if (inp.diabetic !== undefined) setDiabetic(inp.diabetic);
      if (inp.smoker !== undefined) setSmoker(inp.smoker);
      setExtractedSources(data.sources);
    }
  }, [refetchExtract]);

  const handleCalculate = useCallback(() => {
    const ageNum = parseInt(age);
    const tcNum = parseFloat(totalCholesterol);
    const hdlNum = parseFloat(hdlCholesterol);
    const sbpNum = parseFloat(systolicBP);

    if (isNaN(ageNum) || isNaN(tcNum) || isNaN(hdlNum) || isNaN(sbpNum)) {
      return;
    }

    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    calculateMutation.mutate({
      age: ageNum,
      sex,
      race,
      totalCholesterol: tcNum,
      hdlCholesterol: hdlNum,
      systolicBP: sbpNum,
      onBPMeds,
      diabetic,
      smoker,
    });
  }, [age, sex, race, totalCholesterol, hdlCholesterol, systolicBP, onBPMeds, diabetic, smoker]);

  const isFormValid =
    age && totalCholesterol && hdlCholesterol && systolicBP &&
    !isNaN(parseInt(age)) && !isNaN(parseFloat(totalCholesterol)) &&
    !isNaN(parseFloat(hdlCholesterol)) && !isNaN(parseFloat(systolicBP));

  const guidelines = activeTab === "guidelines"
    ? (allGuidelines?.guidelines || [])
    : (result?.guidelines || []);

  const groupedGuidelines = guidelines.reduce((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  }, {} as Record<string, PreventiveGuideline[]>);

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.container, { backgroundColor: colors.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeIn.duration(400)}>
        <View style={styles.tabBar}>
          {(["calculator", "guidelines"] as const).map((tab) => (
            <Pressable
              key={tab}
              testID={`tab-${tab}`}
              style={[
                styles.tab,
                activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Feather
                name={tab === "calculator" ? "bar-chart-2" : "book-open"}
                size={16}
                color={activeTab === tab ? colors.primary : colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? colors.primary : colors.textSecondary },
                ]}
              >
                {tab === "calculator" ? "ASCVD Calculator" : "Preventive Guidelines"}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {activeTab === "calculator" ? (
        <>
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View style={[styles.card, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name="heart" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
                    10-Year ASCVD Risk
                  </ThemedText>
                  <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                    Pooled Cohort Equations (2013 ACC/AHA)
                  </ThemedText>
                </View>
              </View>

              <Pressable
                testID="button-auto-fill"
                style={[styles.autoFillButton, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
                onPress={handleAutoFill}
                disabled={extracting}
              >
                {extracting ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="cpu" size={16} color={colors.primary} />
                )}
                <ThemedText style={[styles.autoFillText, { color: colors.primary }]}>
                  {extracting ? "Extracting from records..." : "Auto-fill from Health Records"}
                </ThemedText>
              </Pressable>

              {autoExtracted && autoExtracted.missingFields.length > 0 ? (
                <View style={[styles.missingBanner, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}>
                  <Feather name="alert-triangle" size={14} color="#F59E0B" />
                  <ThemedText style={[styles.missingText, { color: "#F59E0B" }]}>
                    Missing: {autoExtracted.missingFields.join(", ")}. Please fill manually.
                  </ThemedText>
                </View>
              ) : null}

              {autoExtracted && autoExtracted.confidence > 0 ? (
                <View style={[styles.confidenceBadge, { backgroundColor: colors.primary + "10" }]}>
                  <Feather name="check-circle" size={12} color={colors.primary} />
                  <ThemedText style={[styles.confidenceText, { color: colors.primary }]}>
                    {autoExtracted.confidence}% data auto-extracted from records
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.inputSection}>
                <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>DEMOGRAPHICS</ThemedText>
                <NumberInput
                  label="Age"
                  value={age}
                  onChangeText={setAge}
                  unit="years (40-79)"
                  placeholder="e.g. 55"
                  source={extractedSources.age}
                  colors={colors}
                  isDark={isDark}
                  testID="input-age"
                />
                <ThemedText style={[styles.inputLabel, { color: colors.text, marginBottom: Spacing.xs }]}>Sex at Birth</ThemedText>
                <SegmentedControl
                  options={[
                    { label: "Male", value: "male" },
                    { label: "Female", value: "female" },
                  ]}
                  selected={sex}
                  onSelect={(v) => setSex(v as Sex)}
                  colors={colors}
                  isDark={isDark}
                />
                <ThemedText style={[styles.inputLabel, { color: colors.text, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>Race/Ethnicity</ThemedText>
                <SegmentedControl
                  options={[
                    { label: "White", value: "white" },
                    { label: "African American", value: "african_american" },
                    { label: "Other", value: "other" },
                  ]}
                  selected={race}
                  onSelect={(v) => setRace(v as Race)}
                  colors={colors}
                  isDark={isDark}
                />
              </View>

              <View style={styles.inputSection}>
                <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>LIPID PANEL</ThemedText>
                <NumberInput
                  label="Total Cholesterol"
                  value={totalCholesterol}
                  onChangeText={setTotalCholesterol}
                  unit="mg/dL"
                  placeholder="e.g. 200"
                  source={extractedSources.totalCholesterol}
                  colors={colors}
                  isDark={isDark}
                  testID="input-total-cholesterol"
                />
                <NumberInput
                  label="HDL Cholesterol"
                  value={hdlCholesterol}
                  onChangeText={setHdlCholesterol}
                  unit="mg/dL"
                  placeholder="e.g. 50"
                  source={extractedSources.hdlCholesterol}
                  colors={colors}
                  isDark={isDark}
                  testID="input-hdl"
                />
              </View>

              <View style={styles.inputSection}>
                <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>BLOOD PRESSURE</ThemedText>
                <NumberInput
                  label="Systolic Blood Pressure"
                  value={systolicBP}
                  onChangeText={setSystolicBP}
                  unit="mmHg"
                  placeholder="e.g. 130"
                  source={extractedSources.systolicBP}
                  colors={colors}
                  isDark={isDark}
                  testID="input-sbp"
                />
                <ToggleRow label="On Blood Pressure Medication" value={onBPMeds} onValueChange={setOnBPMeds} colors={colors} />
              </View>

              <View style={styles.inputSection}>
                <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>RISK FACTORS</ThemedText>
                <ToggleRow label="Diabetes" value={diabetic} onValueChange={setDiabetic} colors={colors} />
                <ToggleRow label="Current Smoker" value={smoker} onValueChange={setSmoker} colors={colors} />
              </View>

              <Pressable
                testID="button-calculate"
                style={[
                  styles.calculateButton,
                  { opacity: isFormValid ? 1 : 0.5 },
                ]}
                onPress={handleCalculate}
                disabled={!isFormValid || calculateMutation.isPending}
              >
                <LinearGradient
                  colors={["#EF4444", "#DC2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.calculateGradient}
                >
                  {calculateMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Feather name="bar-chart-2" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.calculateText}>Calculate ASCVD Risk</ThemedText>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>

          {result ? (
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <View style={[styles.resultCard, { backgroundColor: colors.backgroundDefault, borderColor: RISK_COLORS[result.riskCategory] + "40" }]}>
                <View style={styles.resultHeader}>
                  <ThemedText style={[styles.resultTitle, { color: colors.text }]}>Your ASCVD Risk Score</ThemedText>
                  <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[result.riskCategory] + "20" }]}>
                    <ThemedText style={[styles.riskBadgeText, { color: RISK_COLORS[result.riskCategory] }]}>
                      {RISK_LABELS[result.riskCategory]}
                    </ThemedText>
                  </View>
                </View>

                {result.tenYearRisk >= 0 ? (
                  <View style={styles.riskScoreRow}>
                    <View style={styles.riskScoreItem}>
                      <ThemedText style={[styles.riskScoreValue, { color: RISK_COLORS[result.riskCategory] }]}>
                        {result.tenYearRisk}%
                      </ThemedText>
                      <ThemedText style={[styles.riskScoreLabel, { color: colors.textSecondary }]}>
                        10-Year Risk
                      </ThemedText>
                    </View>
                    <View style={[styles.riskDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.riskScoreItem}>
                      <ThemedText style={[styles.riskScoreValue, { color: colors.text }]}>
                        {result.lifetimeRisk}%
                      </ThemedText>
                      <ThemedText style={[styles.riskScoreLabel, { color: colors.textSecondary }]}>
                        Lifetime Risk
                      </ThemedText>
                    </View>
                    <View style={[styles.riskDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.riskScoreItem}>
                      <ThemedText style={[styles.riskScoreValue, { color: "#10B981" }]}>
                        {result.optimalRisk}%
                      </ThemedText>
                      <ThemedText style={[styles.riskScoreLabel, { color: colors.textSecondary }]}>
                        Optimal Risk
                      </ThemedText>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.ageWarning, { backgroundColor: "#F59E0B15" }]}>
                    <Feather name="info" size={16} color="#F59E0B" />
                    <ThemedText style={[styles.ageWarningText, { color: "#F59E0B" }]}>
                      The Pooled Cohort Equations are validated for ages 40-79. Consider lifetime risk assessment and individual risk factor management.
                    </ThemedText>
                  </View>
                )}

                {result.riskReduction > 0 ? (
                  <View style={[styles.reductionBanner, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}>
                    <Feather name="trending-down" size={16} color="#10B981" />
                    <ThemedText style={[styles.reductionText, { color: "#10B981" }]}>
                      Potential risk reduction of {result.riskReduction}% with optimal risk factor control
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.riskBarContainer}>
                  <View style={[styles.riskBarBg, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}>
                    <View
                      style={[
                        styles.riskBarFill,
                        {
                          width: `${Math.min(100, (result.tenYearRisk >= 0 ? result.tenYearRisk : 0) * 2.5)}%`,
                          backgroundColor: RISK_COLORS[result.riskCategory],
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.riskBarLabels}>
                    <ThemedText style={[styles.riskBarLabel, { color: colors.textSecondary }]}>0%</ThemedText>
                    <ThemedText style={[styles.riskBarLabel, { color: "#F59E0B" }]}>5%</ThemedText>
                    <ThemedText style={[styles.riskBarLabel, { color: "#F97316" }]}>7.5%</ThemedText>
                    <ThemedText style={[styles.riskBarLabel, { color: "#EF4444" }]}>20%</ThemedText>
                    <ThemedText style={[styles.riskBarLabel, { color: colors.textSecondary }]}>40%</ThemedText>
                  </View>
                </View>
              </View>

              {result.guidelines.length > 0 ? (
                <View style={{ marginTop: Spacing.lg }}>
                  <ThemedText style={[styles.guidelinesTitle, { color: colors.text }]}>
                    Personalized Preventive Guidelines
                  </ThemedText>
                  <ThemedText style={[styles.guidelinesSubtitle, { color: colors.textSecondary }]}>
                    Based on your {RISK_LABELS[result.riskCategory].toLowerCase()} risk profile
                  </ThemedText>
                  {renderGuidelines(result.guidelines, groupedGuidelines, expandedGuideline, setExpandedGuideline, colors, isDark)}
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </>
      ) : (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.guidelinesIntro, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
            <View style={[styles.cardIcon, { backgroundColor: "#6366F115" }]}>
              <Feather name="book-open" size={20} color="#6366F1" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
              ACC/AHA Preventive Guidelines
            </ThemedText>
            <ThemedText style={[styles.guidelinesIntroText, { color: colors.textSecondary }]}>
              Latest evidence-based recommendations for primary ASCVD prevention from ACC/AHA, USPSTF, and ADA guidelines.
            </ThemedText>
          </View>

          {renderGuidelines(allGuidelines?.guidelines || [], groupedGuidelines, expandedGuideline, setExpandedGuideline, colors, isDark)}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(120).springify()} style={[styles.sourcesCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.border }]}>
        <View style={styles.sourcesHeader}>
          <Feather name="book-open" size={16} color={colors.primary} />
          <ThemedText style={[styles.sourcesTitle, { color: colors.text }]}>
            Sources & Medical Citations
          </ThemedText>
        </View>
        <ThemedText style={[styles.sourcesIntro, { color: colors.textSecondary }]}>
          The 10-year and lifetime ASCVD risk estimates on this screen are calculated with the Pooled Cohort Equations (PCE). The risk-category cutoffs, statin/blood-pressure/lifestyle recommendations, and screening guidance below are taken directly from peer-reviewed clinical practice guidelines published by the American College of Cardiology, the American Heart Association, the U.S. Preventive Services Task Force, and the American Diabetes Association.
        </ThemedText>

        {ASCVD_CITATIONS.map((c) => (
          <Pressable
            key={c.url}
            testID={`citation-${c.id}`}
            onPress={() => {
              try { Haptics.selectionAsync(); } catch {}
              Linking.openURL(c.url).catch(() => {});
            }}
            style={({ pressed }) => [
              styles.citationCard,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.citationHeader}>
              <ThemedText style={[styles.citationLabel, { color: colors.primary }]}>
                {c.label}
              </ThemedText>
              <Feather name="external-link" size={13} color={colors.primary} />
            </View>
            <ThemedText style={[styles.citationCitation, { color: colors.text }]}>
              {c.citation}
            </ThemedText>
            <ThemedText style={[styles.citationUse, { color: colors.textSecondary }]}>
              Used for: {c.usedFor}
            </ThemedText>
          </Pressable>
        ))}

        <View style={[styles.sourcesFooter, { borderTopColor: colors.border }]}>
          <ThemedText style={[styles.sourcesFooterText, { color: colors.textSecondary }]}>
            Per-recommendation sources and evidence grades (USPSTF A/B/C, ACC/AHA Class & Level of Evidence) are shown on each guideline card above. Tap any card to expand the full recommendation and source attribution.
          </ThemedText>
        </View>
      </Animated.View>

      <View style={[styles.disclaimer, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", borderColor: colors.border }]}>
        <Feather name="alert-circle" size={14} color={colors.textSecondary} />
        <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          This calculator is for informational and educational purposes only and is not a substitute for the medical judgment of a licensed clinician. Estimates may differ from your actual risk and should always be reviewed with your healthcare provider before any clinical decision (e.g., starting a statin, antihypertensive, or aspirin). Risk equations are based on the 2013 ACC/AHA Pooled Cohort Equations and have known limitations in non-white, non-Black, and younger populations.
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const ASCVD_CITATIONS: {
  id: string;
  label: string;
  citation: string;
  usedFor: string;
  url: string;
}[] = [
  {
    id: "goff-2013",
    label: "2013 ACC/AHA Cardiovascular Risk Guideline",
    citation:
      "Goff DC Jr, Lloyd-Jones DM, Bennett G, et al. 2013 ACC/AHA Guideline on the Assessment of Cardiovascular Risk: A Report of the American College of Cardiology/American Heart Association Task Force on Practice Guidelines. Circulation. 2014;129(25 Suppl 2):S49–S73.",
    usedFor:
      "The Pooled Cohort Equations (PCE) used to calculate the 10-year and lifetime ASCVD risk percentages on this screen.",
    url: "https://www.ahajournals.org/doi/10.1161/01.cir.0000437741.48606.98",
  },
  {
    id: "grundy-2018",
    label: "2018 AHA/ACC Multisociety Cholesterol Guideline",
    citation:
      "Grundy SM, Stone NJ, Bailey AL, et al. 2018 AHA/ACC/AACVPR/AAPA/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the Management of Blood Cholesterol. Circulation. 2019;139(25):e1082–e1143.",
    usedFor:
      "Risk-category cutoffs (low / borderline / intermediate / high), statin therapy thresholds, and risk-enhancer language.",
    url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000625",
  },
  {
    id: "arnett-2019",
    label: "2019 ACC/AHA Primary Prevention Guideline",
    citation:
      "Arnett DK, Blumenthal RS, Albert MA, et al. 2019 ACC/AHA Guideline on the Primary Prevention of Cardiovascular Disease. Circulation. 2019;140(11):e596–e646.",
    usedFor:
      "Lifestyle and pharmacologic recommendations for primary ASCVD prevention (diet, physical activity, BMI, tobacco cessation, aspirin in selected adults).",
    url: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000678",
  },
  {
    id: "whelton-2017",
    label: "2017 ACC/AHA High Blood Pressure Guideline",
    citation:
      "Whelton PK, Carey RM, Aronow WS, et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the Prevention, Detection, Evaluation, and Management of High Blood Pressure in Adults. Hypertension. 2018;71(6):e13–e115.",
    usedFor:
      "Blood-pressure thresholds and treatment recommendations referenced by this calculator.",
    url: "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065",
  },
  {
    id: "uspstf-statin-2022",
    label: "USPSTF — Statin Use for Primary Prevention (2022)",
    citation:
      "US Preventive Services Task Force. Statin Use for the Primary Prevention of Cardiovascular Disease in Adults: US Preventive Services Task Force Recommendation Statement. JAMA. 2022;328(8):746–753.",
    usedFor:
      "Eligibility criteria for statin recommendations in adults aged 40–75 years with one or more CVD risk factors and an estimated 10-year risk ≥10%.",
    url: "https://jamanetwork.com/journals/jama/fullarticle/2795521",
  },
  {
    id: "ada-2024",
    label: "ADA Standards of Care in Diabetes (2024)",
    citation:
      "American Diabetes Association Professional Practice Committee. 10. Cardiovascular Disease and Risk Management: Standards of Care in Diabetes—2024. Diabetes Care. 2024;47(Suppl 1):S179–S218.",
    usedFor:
      "Cardiovascular risk-management recommendations specific to adults with diabetes mellitus.",
    url: "https://diabetesjournals.org/care/issue/47/Supplement_1",
  },
];

function renderGuidelines(
  _allItems: PreventiveGuideline[],
  groupedGuidelines: Record<string, PreventiveGuideline[]>,
  expandedGuideline: string | null,
  setExpandedGuideline: (id: string | null) => void,
  colors: any,
  isDark: boolean,
) {
  return (
    <View>
      {Object.entries(groupedGuidelines).map(([category, items], catIdx) => (
        <Animated.View key={category} entering={FadeInDown.delay(150 + catIdx * 80).springify()}>
          <ThemedText style={[styles.categoryHeader, { color: colors.textSecondary }]}>
            {category.toUpperCase()}
          </ThemedText>
          {items.map((g) => {
            const isExpanded = expandedGuideline === g.id;
            const iconName = INTERVENTION_ICONS[g.interventionType] || "info";
            return (
              <Pressable
                key={g.id}
                testID={`guideline-${g.id}`}
                style={[
                  styles.guidelineCard,
                  {
                    backgroundColor: colors.backgroundDefault,
                    borderColor: isExpanded ? colors.primary + "40" : colors.border,
                  },
                ]}
                onPress={() => {
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                  setExpandedGuideline(isExpanded ? null : g.id);
                }}
              >
                <View style={styles.guidelineRow}>
                  <View style={[styles.guidelineIcon, { backgroundColor: colors.primary + "12" }]}>
                    <Feather name={iconName} size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.guidelineTitle, { color: colors.text }]}>{g.title}</ThemedText>
                    <View style={styles.gradeBadgeRow}>
                      <View style={[styles.gradeBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }]}>
                        <ThemedText style={[styles.gradeText, { color: colors.textSecondary }]}>{g.grade}</ThemedText>
                      </View>
                    </View>
                  </View>
                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
                </View>
                {isExpanded ? (
                  <View style={[styles.guidelineExpanded, { borderTopColor: colors.border }]}>
                    <ThemedText style={[styles.guidelineRec, { color: colors.text }]}>{g.recommendation}</ThemedText>
                    <View style={styles.sourceRow}>
                      <Feather name="bookmark" size={12} color={colors.textSecondary} />
                      <ThemedText style={[styles.guidelineSource, { color: colors.textSecondary }]}>{g.source}</ThemedText>
                    </View>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", marginBottom: Spacing.lg },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardSubtitle: { fontSize: 12, marginTop: 2 },
  autoFillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  autoFillText: { fontSize: 14, fontWeight: "600" },
  missingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  missingText: { fontSize: 12, flex: 1 },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
    marginBottom: Spacing.md,
  },
  confidenceText: { fontSize: 11, fontWeight: "600" },
  inputSection: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  inputGroup: { marginBottom: Spacing.md },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  inputLabel: { fontSize: 14, fontWeight: "600" },
  inputUnit: { fontSize: 12 },
  textInput: {
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  sourceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  sourceText: { fontSize: 10, fontWeight: "500" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  segmentedLabel: { fontSize: 13, fontWeight: "600" },
  calculateButton: { marginTop: Spacing.sm, borderRadius: BorderRadius.md, overflow: "hidden" },
  calculateGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  calculateText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  resultCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  resultTitle: { fontSize: 17, fontWeight: "700" },
  riskBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  riskBadgeText: { fontSize: 12, fontWeight: "700" },
  riskScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  riskScoreItem: { flex: 1, alignItems: "center" },
  riskScoreValue: { fontSize: 28, fontWeight: "800" },
  riskScoreLabel: { fontSize: 11, marginTop: 2 },
  riskDivider: { width: 1, height: 40 },
  ageWarning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  ageWarningText: { fontSize: 13, flex: 1 },
  reductionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  reductionText: { fontSize: 13, flex: 1, fontWeight: "500" },
  riskBarContainer: { marginTop: Spacing.sm },
  riskBarBg: { height: 10, borderRadius: 5, overflow: "hidden" },
  riskBarFill: { height: "100%", borderRadius: 5 },
  riskBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  riskBarLabel: { fontSize: 10 },
  guidelinesTitle: { fontSize: 17, fontWeight: "700" },
  guidelinesSubtitle: { fontSize: 13, marginTop: 2, marginBottom: Spacing.md },
  guidelinesIntro: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  guidelinesIntroText: { fontSize: 13, textAlign: "center", marginTop: Spacing.sm, lineHeight: 20 },
  categoryHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  guidelineCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  guidelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  guidelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  guidelineTitle: { fontSize: 14, fontWeight: "600" },
  gradeBadgeRow: { flexDirection: "row", marginTop: 4 },
  gradeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  gradeText: { fontSize: 10, fontWeight: "600" },
  guidelineExpanded: {
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  guidelineRec: { fontSize: 13, lineHeight: 20 },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
  },
  guidelineSource: { fontSize: 11, fontStyle: "italic", flex: 1 },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  disclaimerText: { fontSize: 11, flex: 1, lineHeight: 16 },
  sourcesCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  sourcesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sourcesTitle: { fontSize: 16, fontWeight: "700" },
  sourcesIntro: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  citationCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  citationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  citationLabel: { fontSize: 12, fontWeight: "700", flex: 1, paddingRight: Spacing.sm },
  citationCitation: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  citationUse: { fontSize: 11, lineHeight: 15, fontStyle: "italic" },
  sourcesFooter: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  sourcesFooterText: { fontSize: 11, lineHeight: 16 },
});
