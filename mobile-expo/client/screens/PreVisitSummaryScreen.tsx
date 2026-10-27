import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface RosQuestion {
  question: string;
  category: string;
}

interface RosSystem {
  system: string;
  relatedConditions: string[];
  questions: RosQuestion[];
}

interface MedReview {
  medication: string;
  questions: string[];
}

interface PreVisitData {
  problemList: string[];
  medications: string[];
  allergies: string[];
  surgeries: string[];
  familyHistory: string[];
  upcomingAppointments: { title: string; date: string; provider: string; type: string }[];
  recentVitals: { title: string; value: string; date: string }[];
  recentLabs: { title: string; value: string; date: string }[];
  aiReviewOfSystems: {
    reviewOfSystems: RosSystem[];
    medicationReview: MedReview[];
    generalQuestions: string[];
    suggestedTopics: string[];
    visitPreparationTips: string[];
    summaryText: string;
  } | null;
  generatedAt: string;
}

function CategoryIcon({ name, color }: { name: string; color: string }) {
  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    symptom: "activity",
    medication: "thermometer",
    lifestyle: "sun",
    screening: "search",
  };
  return <Feather name={iconMap[name] || "help-circle"} size={14} color={color} />;
}

export default function PreVisitSummaryScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PreVisitData | null>(null);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/visit-summary/pre-visit", {});
      return result as unknown as PreVisitData;
    },
    onSuccess: (result) => {
      setData(result);
      const allSystems = result.aiReviewOfSystems?.reviewOfSystems?.map(s => s.system) || [];
      setExpandedSystems(new Set(allSystems));
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const toggleSystem = useCallback((system: string) => {
    setExpandedSystems(prev => {
      const next = new Set(prev);
      if (next.has(system)) next.delete(system); else next.add(system);
      return next;
    });
  }, []);

  const toggleQuestion = useCallback((key: string) => {
    setCheckedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, []);

  const handleShare = useCallback(async () => {
    if (!data?.aiReviewOfSystems) return;
    const ros = data.aiReviewOfSystems;
    let text = "PRE-VISIT SUMMARY\n\n";
    text += `Generated: ${new Date(data.generatedAt).toLocaleDateString()}\n\n`;
    text += `Problem List: ${data.problemList.join(", ") || "None"}\n`;
    text += `Medications: ${data.medications.join(", ") || "None"}\n`;
    text += `Allergies: ${data.allergies.join(", ") || "NKDA"}\n\n`;
    text += "REVIEW OF SYSTEMS:\n";
    for (const sys of ros.reviewOfSystems) {
      text += `\n${sys.system} (${sys.relatedConditions.join(", ")}):\n`;
      for (const q of sys.questions) {
        const checked = checkedQuestions.has(`${sys.system}-${q.question}`);
        text += `  ${checked ? "[x]" : "[ ]"} ${q.question}\n`;
      }
    }
    if (ros.suggestedTopics.length > 0) {
      text += "\nSUGGESTED TOPICS:\n";
      ros.suggestedTopics.forEach(t => { text += `  - ${t}\n`; });
    }
    text += "\nThis is NOT medical advice. For informational purposes only.";
    try {
      await Share.share({ message: text, title: "Pre-Visit Summary" });
    } catch {}
  }, [data, checkedQuestions]);

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  if (!data) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <View style={[styles.heroIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="clipboard" size={40} color={theme.primary} />
            </View>
            <ThemedText style={[styles.heroTitle, { color: theme.text }]}>Pre-Visit Summary</ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Generate an AI-powered review of symptoms based on your problem list to help you prepare for your next appointment.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={[styles.infoCard, { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}20` }]}>
            <Feather name="info" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              This tool analyzes your health records to generate personalized questions organized by body system. It helps you think through symptoms to discuss with your provider.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Pressable
              testID="button-generate-previsit"
              style={[styles.generateBtn, { backgroundColor: theme.primary }]}
              onPress={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="zap" size={20} color="#fff" />
              )}
              <ThemedText style={styles.generateBtnText}>
                {generateMutation.isPending ? "Analyzing your records..." : "Generate Pre-Visit Summary"}
              </ThemedText>
            </Pressable>
          </Animated.View>

          {generateMutation.isError ? (
            <ThemedText style={[styles.errorText, { color: theme.error }]}>
              Failed to generate summary. Please try again.
            </ThemedText>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  const ros = data.aiReviewOfSystems;

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.disclaimer, { color: theme.warning || "#f59e0b", backgroundColor: `${"#f59e0b"}10` }]}>
          For personal reference only. This is NOT medical advice.
        </ThemedText>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.cardHeader}>
            <Feather name="list" size={18} color={theme.primary} />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Problem List</ThemedText>
          </View>
          {data.problemList.length > 0 ? data.problemList.map((p, i) => (
            <View key={i} style={styles.listItem}>
              <View style={[styles.dot, { backgroundColor: theme.primary }]} />
              <ThemedText style={[styles.listItemText, { color: theme.text }]}>{p}</ThemedText>
            </View>
          )) : (
            <ThemedText style={[styles.emptyNote, { color: theme.textSecondary }]}>No conditions recorded</ThemedText>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.cardHeader}>
            <Feather name="thermometer" size={18} color="#8b5cf6" />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Current Medications</ThemedText>
            <ThemedText style={[styles.badge, { backgroundColor: `${"#8b5cf6"}15`, color: "#8b5cf6" }]}>{data.medications.length}</ThemedText>
          </View>
          {data.medications.length > 0 ? data.medications.map((m, i) => (
            <View key={i} style={styles.listItem}>
              <View style={[styles.dot, { backgroundColor: "#8b5cf6" }]} />
              <ThemedText style={[styles.listItemText, { color: theme.text }]}>{m}</ThemedText>
            </View>
          )) : (
            <ThemedText style={[styles.emptyNote, { color: theme.textSecondary }]}>No medications recorded</ThemedText>
          )}
        </View>

        <View style={styles.rowCards}>
          <View style={[styles.halfCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Feather name="alert-triangle" size={16} color={theme.error} />
            <ThemedText style={[styles.halfCardTitle, { color: theme.text }]}>Allergies</ThemedText>
            {data.allergies.length > 0 ? data.allergies.map((a, i) => (
              <ThemedText key={i} style={[styles.halfCardItem, { color: theme.error }]}>{a}</ThemedText>
            )) : (
              <ThemedText style={[styles.halfCardItem, { color: theme.textSecondary }]}>NKDA</ThemedText>
            )}
          </View>
          <View style={[styles.halfCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Feather name="scissors" size={16} color="#0ea5e9" />
            <ThemedText style={[styles.halfCardTitle, { color: theme.text }]}>Surgeries</ThemedText>
            {data.surgeries.length > 0 ? data.surgeries.slice(0, 5).map((s, i) => (
              <ThemedText key={i} style={[styles.halfCardItem, { color: theme.textSecondary }]}>{s}</ThemedText>
            )) : (
              <ThemedText style={[styles.halfCardItem, { color: theme.textSecondary }]}>None</ThemedText>
            )}
          </View>
        </View>

        {ros ? (
          <>
            <View style={[styles.sectionHeader, { borderColor: theme.border }]}>
              <Feather name="check-square" size={18} color={theme.primary} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Review of Systems</ThemedText>
            </View>
            <ThemedText style={[styles.sectionHint, { color: theme.textSecondary }]}>
              Tap each question to mark symptoms you want to discuss
            </ThemedText>

            {ros.reviewOfSystems.map((sys, sysIdx) => (
              <Animated.View key={sys.system} entering={FadeInDown.duration(300).delay(sysIdx * 50)}>
                <Pressable
                  onPress={() => toggleSystem(sys.system)}
                  style={[styles.systemHeader, { backgroundColor: cardBg, borderColor: cardBorder }]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.systemName, { color: theme.text }]}>{sys.system}</ThemedText>
                    <ThemedText style={[styles.systemConditions, { color: theme.textSecondary }]}>
                      {sys.relatedConditions.join(", ")}
                    </ThemedText>
                  </View>
                  <Feather name={expandedSystems.has(sys.system) ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
                </Pressable>
                {expandedSystems.has(sys.system) ? (
                  <View style={[styles.questionsContainer, { borderColor: cardBorder }]}>
                    {sys.questions.map((q, qIdx) => {
                      const key = `${sys.system}-${q.question}`;
                      const isChecked = checkedQuestions.has(key);
                      return (
                        <Pressable
                          key={qIdx}
                          testID={`ros-question-${sysIdx}-${qIdx}`}
                          onPress={() => toggleQuestion(key)}
                          style={[styles.questionRow, { backgroundColor: isChecked ? `${theme.primary}08` : "transparent" }]}
                        >
                          <View style={[styles.checkbox, { borderColor: isChecked ? theme.primary : theme.border, backgroundColor: isChecked ? theme.primary : "transparent" }]}>
                            {isChecked ? <Feather name="check" size={12} color="#fff" /> : null}
                          </View>
                          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                            <ThemedText style={[styles.questionText, { color: theme.text }]}>{q.question}</ThemedText>
                          </View>
                          <CategoryIcon name={q.category} color={theme.textSecondary} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </Animated.View>
            ))}

            {ros.medicationReview.length > 0 ? (
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, marginTop: Spacing.md }]}>
                <View style={styles.cardHeader}>
                  <Feather name="thermometer" size={18} color="#8b5cf6" />
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Medication Review Questions</ThemedText>
                </View>
                {ros.medicationReview.map((mr, i) => (
                  <View key={i} style={{ marginBottom: Spacing.sm }}>
                    <ThemedText style={[styles.medName, { color: theme.text }]}>{mr.medication}</ThemedText>
                    {mr.questions.map((q, j) => (
                      <ThemedText key={j} style={[styles.medQuestion, { color: theme.textSecondary }]}>{q}</ThemedText>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {ros.suggestedTopics.length > 0 ? (
              <View style={[styles.card, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}15`, marginTop: Spacing.md }]}>
                <View style={styles.cardHeader}>
                  <Feather name="message-square" size={18} color={theme.primary} />
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Suggested Topics to Discuss</ThemedText>
                </View>
                {ros.suggestedTopics.map((t, i) => (
                  <View key={i} style={styles.listItem}>
                    <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                    <ThemedText style={[styles.listItemText, { color: theme.text }]}>{t}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {ros.visitPreparationTips.length > 0 ? (
              <View style={[styles.card, { backgroundColor: `${"#22c55e"}06`, borderColor: `${"#22c55e"}15`, marginTop: Spacing.md }]}>
                <View style={styles.cardHeader}>
                  <Feather name="check-circle" size={18} color="#22c55e" />
                  <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Visit Preparation Tips</ThemedText>
                </View>
                {ros.visitPreparationTips.map((tip, i) => (
                  <View key={i} style={styles.listItem}>
                    <Feather name="check" size={14} color="#22c55e" />
                    <ThemedText style={[styles.listItemText, { color: theme.text, marginLeft: Spacing.xs }]}>{tip}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={[styles.emptyNote, { color: theme.textSecondary }]}>
              AI review of systems is unavailable. Your problem list and medications are shown above for reference.
            </ThemedText>
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable
            testID="button-share-previsit"
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={handleShare}
          >
            <Feather name="share" size={16} color="#fff" />
            <ThemedText style={styles.actionBtnText}>Share Summary</ThemedText>
          </Pressable>
          <Pressable
            testID="button-regenerate-previsit"
            style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
            onPress={() => { setData(null); setCheckedQuestions(new Set()); }}
          >
            <Feather name="refresh-cw" size={16} color={theme.text} />
            <ThemedText style={[styles.actionBtnText, { color: theme.text }]}>Regenerate</ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
          Generated {new Date(data.generatedAt).toLocaleString()}
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flexGrow: 1, paddingHorizontal: Spacing.lg, justifyContent: "center" },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  heroSection: { alignItems: "center", marginBottom: Spacing.xl },
  heroIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  heroTitle: { fontSize: 24, fontWeight: "700", marginBottom: Spacing.xs },
  heroSubtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  infoCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm, marginBottom: Spacing.lg, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  generateBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  errorText: { fontSize: 13, textAlign: "center", marginTop: Spacing.sm },
  disclaimer: { fontSize: 12, fontWeight: "500", textAlign: "center", paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, overflow: "hidden", marginBottom: Spacing.md },
  card: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  badge: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  listItemText: { fontSize: 14, flex: 1, lineHeight: 20 },
  emptyNote: { fontSize: 13, fontStyle: "italic" },
  rowCards: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  halfCard: { flex: 1, borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md },
  halfCardTitle: { fontSize: 14, fontWeight: "600", marginTop: Spacing.xs, marginBottom: Spacing.xs },
  halfCardItem: { fontSize: 13, lineHeight: 18 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, marginBottom: Spacing.xs, marginTop: Spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionHint: { fontSize: 12, marginBottom: Spacing.sm },
  systemHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: 2, marginTop: Spacing.xs },
  systemName: { fontSize: 15, fontWeight: "600" },
  systemConditions: { fontSize: 12, marginTop: 1 },
  questionsContainer: { borderLeftWidth: 2, marginLeft: Spacing.md, paddingLeft: Spacing.sm, marginBottom: Spacing.xs },
  questionRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: BorderRadius.sm },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  questionText: { fontSize: 14, lineHeight: 20 },
  medName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  medQuestion: { fontSize: 13, lineHeight: 18, paddingLeft: Spacing.sm },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  timestamp: { fontSize: 11, textAlign: "center", marginTop: Spacing.sm },
});
