import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import VoiceFAB from "@/components/VoiceFAB";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface SOAPSection {
  title: string;
  content: string;
  aiConfidence: number;
  sourceSnippets: string[];
}

interface ExtractedEntity {
  type: string;
  value: string;
  context: string;
  confidence: number;
}

interface CodeSuggestion {
  codeType: string;
  code: string;
  description: string;
  confidence: number;
  reasoning: string;
  clinicalEvidence: string;
}

interface SOAPNoteResult {
  subjective: SOAPSection;
  objective: SOAPSection;
  assessment: SOAPSection;
  plan: SOAPSection;
  entities: ExtractedEntity[];
  codeSuggestions: CodeSuggestion[];
  qualityScore: number;
  warnings: string[];
  disclaimer: string;
}

type ViewMode = "input" | "result";
type ResultTab = "soap" | "entities" | "codes";

const ENTITY_COLORS: Record<string, string> = {
  diagnosis: "#EF4444",
  medication: "#8B5CF6",
  procedure: "#F97316",
  symptom: "#3B82F6",
  vital_sign: "#10B981",
  allergy: "#EC4899",
  lab_result: "#06B6D4",
};

const ENTITY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  diagnosis: "activity",
  medication: "package",
  procedure: "scissors",
  symptom: "thermometer",
  vital_sign: "heart",
  allergy: "alert-circle",
  lab_result: "droplet",
};

const SAMPLE_NOTES: Array<{ label: string; icon: keyof typeof Feather.glyphMap; text: string }> = [
  {
    label: "Office Visit",
    icon: "briefcase",
    text: "Patient is a 58-year-old male presenting with chest pain that started 2 days ago. Pain is substernal, rated 6/10, worsens with exertion and improves with rest. He has a history of hypertension and type 2 diabetes. Current medications include metformin 1000mg BID and lisinopril 20mg daily. No known drug allergies. Vitals: BP 148/92, HR 88, RR 18, Temp 98.6F, SpO2 98%. Physical exam: lungs clear bilaterally, heart S1 S2 regular rhythm with no murmurs. ECG shows normal sinus rhythm. Assessment: Chest pain likely due to stable angina given risk factors. Plan: Order stress test, start aspirin 81mg daily, refer to cardiology, continue current medications, follow up in 2 weeks.",
  },
  {
    label: "Follow-up",
    icon: "rotate-cw",
    text: "42-year-old female follow-up for poorly controlled asthma. She reports increased wheezing and shortness of breath over the past month, using rescue inhaler 4-5 times per week. Currently on fluticasone 250mcg BID but admits to inconsistent use. Allergic to penicillin (rash). Peak flow 75% of predicted. Lungs with diffuse expiratory wheezing bilaterally. Assessment: Moderate persistent asthma, uncontrolled. Plan: Step up therapy to fluticasone/salmeterol 250/50, add montelukast 10mg daily, review inhaler technique, provide asthma action plan, schedule pulmonary function tests, follow up in 4 weeks.",
  },
  {
    label: "Urgent Care",
    icon: "zap",
    text: "28-year-old male presents to urgent care with right ankle injury after stepping off a curb awkwardly 3 hours ago. Reports immediate pain and swelling, unable to bear weight. Denies numbness or tingling. No prior ankle injuries. No medications, NKDA. Vitals: BP 128/78, HR 76, RR 16, Temp 98.4F, SpO2 99%. Exam: moderate swelling over lateral malleolus, point tenderness over anterior talofibular ligament, positive anterior drawer test, no bony crepitus. Ottawa ankle rules positive for X-ray. X-ray: no fracture identified. Assessment: Grade II lateral ankle sprain. Plan: RICE protocol, air stirrup ankle brace, ibuprofen 600mg TID with food for 7 days, crutches as needed, follow up with primary care in 5-7 days if not improving, return if worsening pain or inability to bear weight after 72 hours.",
  },
  {
    label: "Telehealth",
    icon: "video",
    text: "35-year-old female telehealth visit for migraine management. Reports 3-4 migraines per month lasting 8-12 hours each, with photophobia, nausea, and unilateral throbbing pain rated 7/10. Current abortive therapy with sumatriptan 50mg provides partial relief. No aura symptoms. Family history of migraines in mother. Currently taking oral contraceptives. Allergic to codeine (nausea). Patient appears in no acute distress via video. Assessment: Chronic migraine without aura, inadequately controlled, requiring prophylactic therapy. Plan: Start propranolol 40mg daily for migraine prophylaxis, continue sumatriptan as rescue, headache diary for tracking, lifestyle modifications discussed including sleep hygiene and trigger avoidance, telehealth follow-up in 6 weeks to assess prophylaxis efficacy.",
  },
];

export default function AISOAPNoteScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme: colors, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("input");
  const [resultTab, setResultTab] = useState<ResultTab>("soap");
  const [freeText, setFreeText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SOAPNoteResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["subjective", "objective", "assessment", "plan"]));
  const [expandedCodes, setExpandedCodes] = useState<Set<number>>(new Set());
  const [refiningSection, setRefiningSection] = useState<string | null>(null);
  const [refineText, setRefineText] = useState("");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  // Voice fill highlight: briefly highlights the clinical note input when a voice fill is applied
  const [freeTextHighlighted, setFreeTextHighlighted] = useState(false);
  const freeTextHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { checkFeature, promptProps } = useFeatureGate();

  // Voice autofill: append dictated clinical text to the free-text input
  const handleVoiceFill = useCallback((field: string, value: string) => {
    if (
      field === "freeText" ||
      field === "clinicalNote" ||
      field === "note" ||
      field === "soapNote"
    ) {
      setFreeText((prev) => (prev ? `${prev}\n${value}` : value));
      // Briefly highlight the text area to confirm the voice fill was applied (1.5 s)
      if (freeTextHighlightTimerRef.current) clearTimeout(freeTextHighlightTimerRef.current);
      setFreeTextHighlighted(true);
      freeTextHighlightTimerRef.current = setTimeout(() => setFreeTextHighlighted(false), 1500);
    }
  }, []);

  const handleCopy = useCallback(async (text: string, sectionKey: string) => {
    await Clipboard.setStringAsync(text);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 1500);
  }, []);

  const formatFullSOAPNote = useCallback(() => {
    if (!result) return "";
    return [
      `SUBJECTIVE:\n${result.subjective.content}`,
      `OBJECTIVE:\n${result.objective.content}`,
      `ASSESSMENT:\n${result.assessment.content}`,
      `PLAN:\n${result.plan.content}`,
    ].join("\n\n");
  }, [result]);

  const handleProcess = useCallback(async () => {
    if (!freeText.trim() || freeText.trim().length < 10) {
      setError("Please enter at least 10 characters of clinical note text.");
      return;
    }
    if (!checkFeature("ai_soap_note")) return;
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/soap-note/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeText: freeText.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: SOAPNoteResult = await res.json();
      setResult(data);
      setViewMode("result");
      setResultTab("soap");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (err: any) {
      setError(err.message || "Failed to process note");
    } finally {
      setProcessing(false);
    }
  }, [freeText, checkFeature]);

  const handleRefineSection = useCallback(async (section: string) => {
    if (!refineText.trim() || !result) return;
    if (!checkFeature("ai_soap_note")) return;
    setRefiningSection(section);
    try {
      const sectionData = result[section as keyof SOAPNoteResult] as SOAPSection;
      const fullContext = [result.subjective, result.objective, result.assessment, result.plan]
        .map(s => `${s.title}: ${s.content}`).join("\n\n");
      const res = await fetch(`${getApiUrl()}/api/soap-note/refine-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          currentContent: sectionData.content,
          editInstructions: refineText.trim(),
          fullNoteContext: fullContext,
        }),
      });
      if (!res.ok) throw new Error("Failed to refine section");
      const data = await res.json();
      setResult(prev => prev ? { ...prev, [section]: data.section } : null);
      setRefineText("");
      setRefiningSection(null);
    } catch {
      setError("Failed to refine section");
      setRefiningSection(null);
    }
  }, [refineText, result, checkFeature]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCode = (idx: number) => {
    setExpandedCodes(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return colors.success;
    if (confidence >= 60) return colors.warning;
    return colors.error;
  };

  const renderInput = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card style={styles.inputCard}>
        <View style={styles.inputHeader}>
          <Feather name="edit-3" size={20} color={colors.primary} />
          <ThemedText style={[styles.inputTitle, { color: colors.text }]}>Clinical Note Input</ThemedText>
        </View>
        <ThemedText style={[styles.inputSubtitle, { color: colors.textSecondary }]}>
          Type or paste your clinical notes. The AI will organize them into SOAP format, extract entities, and suggest codes.
        </ThemedText>
        <TextInput
          testID="input-clinical-note"
          style={[styles.textArea, {
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            borderColor: freeTextHighlighted ? colors.primary : colors.border,
            borderWidth: freeTextHighlighted ? 2 : 1,
          }]}
          multiline
          numberOfLines={12}
          placeholder="Enter clinical note text here...&#10;&#10;Example: Patient is a 58-year-old male presenting with chest pain..."
          placeholderTextColor={colors.textSecondary}
          value={freeText}
          onChangeText={setFreeText}
          textAlignVertical="top"
        />
        <View style={styles.charCount}>
          <ThemedText style={[styles.charCountText, { color: colors.textSecondary }]}>
            {freeText.length} characters
          </ThemedText>
        </View>
      </Card>

      <Card style={styles.samplesCard}>
        <ThemedText style={[styles.samplesTitle, { color: colors.textSecondary }]}>Templates</ThemedText>
        <View style={styles.samplesRow}>
          {SAMPLE_NOTES.map((sample, i) => (
            <Pressable
              key={i}
              testID={`button-sample-${i}`}
              style={[styles.templateCard, { backgroundColor: colors.backgroundSecondary, borderColor: freeText === sample.text ? colors.primary : colors.border }]}
              onPress={() => setFreeText(sample.text)}
            >
              <View style={[styles.templateIconWrap, { backgroundColor: colors.primary + "12" }]}>
                <Feather name={sample.icon} size={18} color={colors.primary} />
              </View>
              <ThemedText style={[styles.sampleLabel, { color: colors.text }]}>{sample.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {error ? (
        <Animated.View entering={FadeInDown.duration(200)}>
          <Card style={{ ...styles.errorCard, borderLeftColor: colors.error }}>
            <Feather name="alert-triangle" size={16} color={colors.error} />
            <ThemedText style={[styles.errorText, { color: colors.error }]}>{error}</ThemedText>
          </Card>
        </Animated.View>
      ) : null}

      <Pressable
        testID="button-process-note"
        style={[styles.processButton, {
          backgroundColor: processing ? colors.primary + "80" : colors.primary,
          opacity: freeText.trim().length < 10 ? 0.5 : 1,
        }]}
        onPress={handleProcess}
        disabled={processing || freeText.trim().length < 10}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="cpu" size={20} color="#FFFFFF" />
        )}
        <ThemedText style={styles.processButtonText}>
          {processing ? "Processing Note..." : "Process with AI"}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderSOAPSection = (key: string, section: SOAPSection) => {
    const isExpanded = expandedSections.has(key);
    const sectionColors: Record<string, string> = {
      subjective: "#3B82F6",
      objective: "#10B981",
      assessment: "#F59E0B",
      plan: "#8B5CF6",
    };
    const sectionIcons: Record<string, keyof typeof Feather.glyphMap> = {
      subjective: "user",
      objective: "eye",
      assessment: "clipboard",
      plan: "check-square",
    };
    const color = sectionColors[key] || colors.primary;

    return (
      <Animated.View key={key} entering={FadeInDown.duration(300).delay(["subjective", "objective", "assessment", "plan"].indexOf(key) * 80)}>
        <Card style={styles.soapCard}>
          <Pressable
            testID={`button-toggle-${key}`}
            style={styles.soapHeader}
            onPress={() => toggleSection(key)}
          >
            <View style={styles.soapHeaderLeft}>
              <View style={[styles.soapIcon, { backgroundColor: color + "18" }]}>
                <Feather name={sectionIcons[key] || "file"} size={16} color={color} />
              </View>
              <ThemedText style={[styles.soapTitle, { color: colors.text }]}>{section.title}</ThemedText>
            </View>
            <View style={styles.soapHeaderRight}>
              <Pressable
                testID={`button-copy-${key}`}
                style={[styles.copySectionBtn, { backgroundColor: copiedSection === key ? colors.success + "18" : colors.backgroundSecondary }]}
                onPress={(e) => { e.stopPropagation(); handleCopy(section.content, key); }}
              >
                <Feather name={copiedSection === key ? "check" : "clipboard"} size={14} color={copiedSection === key ? colors.success : colors.textSecondary} />
                {copiedSection === key ? (
                  <ThemedText style={[styles.copiedText, { color: colors.success }]}>Copied!</ThemedText>
                ) : null}
              </Pressable>
              <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(section.aiConfidence) + "18" }]}>
                <ThemedText style={[styles.confidenceText, { color: getConfidenceColor(section.aiConfidence) }]}>
                  {section.aiConfidence}%
                </ThemedText>
              </View>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
            </View>
          </Pressable>

          {isExpanded ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <View style={[styles.soapContent, { borderTopColor: colors.border }]}>
                <ThemedText style={[styles.soapText, { color: colors.text }]}>{section.content}</ThemedText>

                {section.sourceSnippets?.length > 0 ? (
                  <View style={styles.sourcesContainer}>
                    <ThemedText style={[styles.sourcesLabel, { color: colors.textSecondary }]}>Source references:</ThemedText>
                    {section.sourceSnippets.map((snippet, i) => (
                      <View key={i} style={[styles.sourceSnippet, { backgroundColor: color + "08", borderLeftColor: color + "40" }]}>
                        <ThemedText style={[styles.sourceText, { color: colors.textSecondary }]}>"{snippet}"</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.refineContainer}>
                  {refiningSection === key ? (
                    <View style={styles.refineInputRow}>
                      <TextInput
                        testID={`input-refine-${key}`}
                        style={[styles.refineInput, { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        placeholder="Describe changes..."
                        placeholderTextColor={colors.textSecondary}
                        value={refineText}
                        onChangeText={setRefineText}
                      />
                      <Pressable
                        testID={`button-submit-refine-${key}`}
                        style={[styles.refineSubmit, { backgroundColor: color }]}
                        onPress={() => handleRefineSection(key)}
                      >
                        <Feather name="check" size={16} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        style={[styles.refineCancelBtn, { backgroundColor: colors.backgroundTertiary }]}
                        onPress={() => { setRefiningSection(null); setRefineText(""); }}
                      >
                        <Feather name="x" size={16} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      testID={`button-refine-${key}`}
                      style={[styles.refineButton, { borderColor: color + "40" }]}
                      onPress={() => setRefiningSection(key)}
                    >
                      <Feather name="edit-2" size={14} color={color} />
                      <ThemedText style={[styles.refineButtonText, { color }]}>Refine with AI</ThemedText>
                    </Pressable>
                  )}
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderSOAPTab = () => {
    if (!result) return null;
    const qualityColor = result.qualityScore >= 80 ? colors.success : result.qualityScore >= 50 ? colors.warning : colors.error;
    const ringSize = 56;
    const ringStroke = 5;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringProgress = (result.qualityScore / 100) * ringCircumference;

    return (
      <View>
        <Pressable
          testID="button-copy-all"
          style={[styles.copyAllBtn, { backgroundColor: copiedSection === "all" ? colors.success + "15" : colors.primary + "12", borderColor: copiedSection === "all" ? colors.success + "30" : colors.primary + "30" }]}
          onPress={() => handleCopy(formatFullSOAPNote(), "all")}
        >
          <Feather name={copiedSection === "all" ? "check" : "copy"} size={16} color={copiedSection === "all" ? colors.success : colors.primary} />
          <ThemedText style={[styles.copyAllText, { color: copiedSection === "all" ? colors.success : colors.primary }]}>
            {copiedSection === "all" ? "Copied!" : "Copy All Sections"}
          </ThemedText>
        </Pressable>

        {result.qualityScore > 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Card style={styles.qualityCard}>
              <View style={styles.qualityRow}>
                <View style={styles.qualityRingContainer}>
                  <View style={[styles.qualityRingBg, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: qualityColor + "20", borderWidth: ringStroke }]} />
                  <View style={[styles.qualityRingFill, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: ringStroke, borderColor: qualityColor, borderTopColor: "transparent", borderRightColor: "transparent", transform: [{ rotate: `${(result.qualityScore / 100) * 360 - 45}deg` }] }]} />
                  <View style={styles.qualityRingLabel}>
                    <ThemedText style={[styles.qualityRingValue, { color: qualityColor }]}>{result.qualityScore}</ThemedText>
                  </View>
                </View>
                <View style={styles.qualityInfoCol}>
                  <ThemedText style={[styles.qualityLabel, { color: colors.text }]}>Documentation Quality</ThemedText>
                  <View style={[styles.qualityBar, { backgroundColor: colors.backgroundTertiary }]}>
                    <Animated.View entering={FadeIn.duration(600)} style={[styles.qualityFill, { width: `${result.qualityScore}%`, backgroundColor: qualityColor }]} />
                  </View>
                  <ThemedText style={[styles.qualityDescription, { color: qualityColor }]}>
                    {result.qualityScore >= 80 ? "Excellent" : result.qualityScore >= 50 ? "Needs Improvement" : "Incomplete"}
                  </ThemedText>
                </View>
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {result.warnings?.length > 0 ? (
          <Card style={{ ...styles.warningsCard, borderLeftColor: colors.warning }}>
            {result.warnings.map((w, i) => (
              <View key={i} style={styles.warningRow}>
                <Feather name="alert-triangle" size={14} color={colors.warning} />
                <ThemedText style={[styles.warningText, { color: colors.warning }]}>{w}</ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        {renderSOAPSection("subjective", result.subjective)}
        {renderSOAPSection("objective", result.objective)}
        {renderSOAPSection("assessment", result.assessment)}
        {renderSOAPSection("plan", result.plan)}
      </View>
    );
  };

  const renderEntitiesTab = () => {
    if (!result?.entities?.length) {
      return (
        <Card style={styles.emptyCard}>
          <Feather name="search" size={32} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>No entities extracted</ThemedText>
        </Card>
      );
    }

    const grouped: Record<string, ExtractedEntity[]> = {};
    result.entities.forEach(e => {
      if (!grouped[e.type]) grouped[e.type] = [];
      grouped[e.type].push(e);
    });

    return (
      <View>
        <Card style={styles.entitySummaryCard}>
          <ThemedText style={[styles.entitySummaryTitle, { color: colors.text }]}>
            {result.entities.length} entities found
          </ThemedText>
          <View style={styles.entityTypeBadges}>
            {Object.entries(grouped).map(([type, items]) => (
              <View key={type} style={[styles.entityTypeBadge, { backgroundColor: (ENTITY_COLORS[type] || colors.primary) + "15" }]}>
                <Feather name={ENTITY_ICONS[type] || "tag"} size={12} color={ENTITY_COLORS[type] || colors.primary} />
                <ThemedText style={[styles.entityTypeBadgeText, { color: ENTITY_COLORS[type] || colors.primary }]}>
                  {type.replace("_", " ")} ({items.length})
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        {Object.entries(grouped).map(([type, items]) => (
          <Animated.View key={type} entering={FadeInDown.duration(300)}>
            <Card style={styles.entityGroupCard}>
              <View style={styles.entityGroupHeader}>
                <Feather name={ENTITY_ICONS[type] || "tag"} size={16} color={ENTITY_COLORS[type] || colors.primary} />
                <ThemedText style={[styles.entityGroupTitle, { color: colors.text }]}>
                  {type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
                </ThemedText>
              </View>
              {items.map((entity, i) => (
                <View key={i} style={[styles.entityItem, { borderBottomColor: colors.border }, i === items.length - 1 ? { borderBottomWidth: 0 } : null]}>
                  <View style={styles.entityValueRow}>
                    <View style={[styles.entityDot, { backgroundColor: ENTITY_COLORS[type] || colors.primary }]} />
                    <ThemedText style={[styles.entityValue, { color: colors.text }]}>{entity.value}</ThemedText>
                    <View style={[styles.entityConfBadge, { backgroundColor: getConfidenceColor(entity.confidence) + "15" }]}>
                      <ThemedText style={[styles.entityConfText, { color: getConfidenceColor(entity.confidence) }]}>
                        {entity.confidence}%
                      </ThemedText>
                    </View>
                  </View>
                  {entity.context ? (
                    <ThemedText style={[styles.entityContext, { color: colors.textSecondary }]} numberOfLines={2}>
                      "{entity.context}"
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </Card>
          </Animated.View>
        ))}
      </View>
    );
  };

  const renderCodesTab = () => {
    if (!result?.codeSuggestions?.length) {
      return (
        <Card style={styles.emptyCard}>
          <Feather name="hash" size={32} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>No code suggestions</ThemedText>
        </Card>
      );
    }

    const icdCodes = result.codeSuggestions.filter(c => c.codeType === "icd10");
    const cptCodes = result.codeSuggestions.filter(c => c.codeType === "cpt");

    const renderCodeGroup = (title: string, icon: keyof typeof Feather.glyphMap, codes: CodeSuggestion[], color: string) => {
      if (!codes.length) return null;
      return (
        <Card style={styles.codeGroupCard}>
          <View style={styles.codeGroupHeader}>
            <View style={[styles.codeGroupIcon, { backgroundColor: color + "15" }]}>
              <Feather name={icon} size={16} color={color} />
            </View>
            <ThemedText style={[styles.codeGroupTitle, { color: colors.text }]}>{title}</ThemedText>
            <View style={[styles.codeGroupCount, { backgroundColor: color + "15" }]}>
              <ThemedText style={[styles.codeGroupCountText, { color }]}>{codes.length}</ThemedText>
            </View>
          </View>
          {codes.map((code, i) => {
            const isExpanded = expandedCodes.has(result.codeSuggestions.indexOf(code));
            const globalIdx = result.codeSuggestions.indexOf(code);
            return (
              <Pressable
                key={i}
                testID={`button-code-${code.code}`}
                style={[styles.codeItem, { borderBottomColor: colors.border }, i === codes.length - 1 ? { borderBottomWidth: 0 } : null]}
                onPress={() => toggleCode(globalIdx)}
              >
                <View style={styles.codeMainRow}>
                  <View style={[styles.codeBadge, { backgroundColor: color + "15" }]}>
                    <ThemedText style={[styles.codeValue, { color }]}>{code.code}</ThemedText>
                  </View>
                  <View style={styles.codeDescCol}>
                    <ThemedText style={[styles.codeDesc, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 1}>
                      {code.description}
                    </ThemedText>
                  </View>
                  <View style={[styles.codeConfBadge, { backgroundColor: getConfidenceColor(code.confidence) + "15" }]}>
                    <ThemedText style={[styles.codeConfText, { color: getConfidenceColor(code.confidence) }]}>
                      {code.confidence}%
                    </ThemedText>
                  </View>
                </View>
                {isExpanded ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.codeDetails}>
                    <View style={styles.codeDetailRow}>
                      <ThemedText style={[styles.codeDetailLabel, { color: colors.textSecondary }]}>Reasoning:</ThemedText>
                      <ThemedText style={[styles.codeDetailText, { color: colors.text }]}>{code.reasoning}</ThemedText>
                    </View>
                    <View style={styles.codeDetailRow}>
                      <ThemedText style={[styles.codeDetailLabel, { color: colors.textSecondary }]}>Evidence:</ThemedText>
                      <ThemedText style={[styles.codeDetailText, { color: colors.text }]}>{code.clinicalEvidence}</ThemedText>
                    </View>
                  </Animated.View>
                ) : null}
              </Pressable>
            );
          })}
        </Card>
      );
    };

    return (
      <View>
        {renderCodeGroup("ICD-10 Diagnosis Codes", "bookmark", icdCodes, "#EF4444")}
        {renderCodeGroup("CPT Procedure Codes", "hash", cptCodes, "#3B82F6")}
      </View>
    );
  };

  const renderResult = () => {
    if (!result) return null;

    const tabs: Array<{ key: ResultTab; label: string; icon: keyof typeof Feather.glyphMap; count?: number }> = [
      { key: "soap", label: "SOAP", icon: "file-text" },
      { key: "entities", label: "Entities", icon: "tag", count: result.entities?.length || 0 },
      { key: "codes", label: "Codes", icon: "hash", count: result.codeSuggestions?.length || 0 },
    ];

    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={styles.resultHeader}>
          <Pressable
            testID="button-back-to-input"
            style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setViewMode("input")}
          >
            <Feather name="arrow-left" size={18} color={colors.text} />
            <ThemedText style={[styles.backText, { color: colors.text }]}>Edit Note</ThemedText>
          </Pressable>
          <Pressable
            testID="button-new-note"
            style={[styles.newButton, { backgroundColor: colors.primary + "12" }]}
            onPress={() => { setViewMode("input"); setResult(null); setFreeText(""); }}
          >
            <Feather name="plus" size={18} color={colors.primary} />
            <ThemedText style={[styles.newText, { color: colors.primary }]}>New</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.tabBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          {tabs.map(tab => (
            <Pressable
              key={tab.key}
              testID={`button-tab-${tab.key}`}
              style={[
                styles.tab,
                resultTab === tab.key ? { backgroundColor: colors.primary + "15", borderColor: colors.primary } : { borderColor: "transparent" },
              ]}
              onPress={() => setResultTab(tab.key)}
            >
              <Feather name={tab.icon} size={16} color={resultTab === tab.key ? colors.primary : colors.textSecondary} />
              <ThemedText style={[styles.tabLabel, { color: resultTab === tab.key ? colors.primary : colors.textSecondary }]}>
                {tab.label}
              </ThemedText>
              {tab.count != null && tab.count > 0 ? (
                <View style={[styles.tabCount, { backgroundColor: resultTab === tab.key ? colors.primary : colors.textSecondary + "30" }]}>
                  <ThemedText style={[styles.tabCountText, { color: resultTab === tab.key ? "#FFFFFF" : colors.textSecondary }]}>
                    {tab.count}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        {resultTab === "soap" ? renderSOAPTab() : null}
        {resultTab === "entities" ? renderEntitiesTab() : null}
        {resultTab === "codes" ? renderCodesTab() : null}

        <Card style={{ ...styles.disclaimerCard, borderLeftColor: colors.warning }}>
          <Feather name="info" size={14} color={colors.warning} />
          <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            {result.disclaimer}
          </ThemedText>
        </Card>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn} style={styles.pageHeader}>
            <View style={[styles.pageIconContainer, { backgroundColor: colors.primary + "12" }]}>
              <Feather name="file-text" size={24} color={colors.primary} />
            </View>
            <View style={styles.pageHeaderText}>
              <ThemedText style={[styles.pageTitle, { color: colors.text }]}>AI SOAP Note Creator</ThemedText>
              <ThemedText style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
                Input clinical notes and let AI organize into SOAP format
              </ThemedText>
            </View>
          </Animated.View>

          {viewMode === "input" ? renderInput() : renderResult()}
        </ScrollView>
      </KeyboardAvoidingView>
      <UpgradePrompt {...promptProps} />
      <VoiceFAB onFillField={handleVoiceFill} testID="voice-fab-soap-note" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md },
  pageHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg, gap: Spacing.md },
  pageIconContainer: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: "center", justifyContent: "center" },
  pageHeaderText: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 14, marginTop: 2 },
  inputCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  inputHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  inputTitle: { fontSize: 17, fontWeight: "600" },
  inputSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  textArea: {
    minHeight: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: 15,
    lineHeight: 22,
  },
  charCount: { alignItems: "flex-end", marginTop: Spacing.xs },
  charCountText: { fontSize: 12 },
  samplesCard: { padding: Spacing.md, marginBottom: Spacing.md },
  samplesTitle: { fontSize: 13, fontWeight: "500", marginBottom: Spacing.sm },
  samplesRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  templateCard: { alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, width: "47%" as any, flexGrow: 1 },
  templateIconWrap: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  sampleLabel: { fontSize: 13, fontWeight: "500" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 3 },
  errorText: { fontSize: 13, flex: 1 },
  processButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  processButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  backButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md },
  backText: { fontSize: 14, fontWeight: "500" },
  newButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md },
  newText: { fontSize: 14, fontWeight: "500" },
  tabBar: { flexDirection: "row", borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.md, borderWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  tabCountText: { fontSize: 11, fontWeight: "700" },
  copyAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  copyAllText: { fontSize: 14, fontWeight: "600" },
  copySectionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  copiedText: { fontSize: 11, fontWeight: "600" },
  qualityCard: { padding: Spacing.md, marginBottom: Spacing.md },
  qualityRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
  qualityRingContainer: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  qualityRingBg: { position: "absolute" },
  qualityRingFill: { position: "absolute" },
  qualityRingLabel: { position: "absolute", alignItems: "center", justifyContent: "center" },
  qualityRingValue: { fontSize: 16, fontWeight: "700" },
  qualityInfoCol: { flex: 1, gap: Spacing.xs },
  qualityLabel: { fontSize: 15, fontWeight: "600" },
  qualityDescription: { fontSize: 12, fontWeight: "500" },
  qualityBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  qualityFill: { height: "100%", borderRadius: 3 },
  warningsCard: { padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 3, gap: Spacing.xs },
  warningRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm },
  warningText: { fontSize: 13, flex: 1 },
  soapCard: { marginBottom: Spacing.sm, overflow: "hidden" },
  soapHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md },
  soapHeaderLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  soapIcon: { width: 32, height: 32, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  soapTitle: { fontSize: 16, fontWeight: "600" },
  soapHeaderRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  confidenceText: { fontSize: 12, fontWeight: "600" },
  soapContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 1 },
  soapText: { fontSize: 14, lineHeight: 22, marginTop: Spacing.md },
  sourcesContainer: { marginTop: Spacing.md },
  sourcesLabel: { fontSize: 12, fontWeight: "500", marginBottom: Spacing.xs },
  sourceSnippet: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm, borderLeftWidth: 2, marginBottom: 4 },
  sourceText: { fontSize: 12, fontStyle: "italic" },
  refineContainer: { marginTop: Spacing.md },
  refineInputRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  refineInput: { flex: 1, height: 38, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.sm, fontSize: 14 },
  refineSubmit: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  refineCancelBtn: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  refineButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.md, borderWidth: 1, alignSelf: "flex-start" },
  refineButtonText: { fontSize: 13, fontWeight: "500" },
  emptyCard: { padding: Spacing.xl, alignItems: "center", gap: Spacing.sm },
  emptyText: { fontSize: 14 },
  entitySummaryCard: { padding: Spacing.md, marginBottom: Spacing.md },
  entitySummaryTitle: { fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm },
  entityTypeBadges: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  entityTypeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.md },
  entityTypeBadgeText: { fontSize: 12, fontWeight: "500", textTransform: "capitalize" },
  entityGroupCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  entityGroupHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  entityGroupTitle: { fontSize: 15, fontWeight: "600", textTransform: "capitalize" },
  entityItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  entityValueRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  entityDot: { width: 8, height: 8, borderRadius: 4 },
  entityValue: { fontSize: 14, fontWeight: "500", flex: 1 },
  entityConfBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  entityConfText: { fontSize: 11, fontWeight: "600" },
  entityContext: { fontSize: 12, marginTop: 4, marginLeft: 20, fontStyle: "italic" },
  codeGroupCard: { padding: Spacing.md, marginBottom: Spacing.md },
  codeGroupHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  codeGroupIcon: { width: 32, height: 32, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  codeGroupTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  codeGroupCount: { minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  codeGroupCountText: { fontSize: 12, fontWeight: "700" },
  codeItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  codeMainRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm },
  codeValue: { fontSize: 13, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  codeDescCol: { flex: 1 },
  codeDesc: { fontSize: 13 },
  codeConfBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  codeConfText: { fontSize: 11, fontWeight: "600" },
  codeDetails: { marginTop: Spacing.sm, paddingLeft: Spacing.sm, gap: Spacing.xs },
  codeDetailRow: { gap: 2 },
  codeDetailLabel: { fontSize: 12, fontWeight: "600" },
  codeDetailText: { fontSize: 13, lineHeight: 18 },
  disclaimerCard: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, padding: Spacing.md, marginTop: Spacing.md, borderLeftWidth: 3 },
  disclaimerText: { fontSize: 12, flex: 1, lineHeight: 17 },
});
