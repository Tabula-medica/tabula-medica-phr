import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Diagnosis {
  name: string;
  status: string;
  notes: string;
}

interface MedChange {
  medication: string;
  action: string;
  details: string;
}

interface TestResult {
  test: string;
  result: string;
  notes: string;
}

interface TodoItem {
  task: string;
  category: string;
  priority: string;
  dueDescription: string;
}

interface PostVisitData {
  visitSummary: {
    date: string;
    provider: string;
    reasonForVisit: string;
    keyDiscussions: string[];
    diagnoses: Diagnosis[];
    medicationChanges: MedChange[];
    testResults: TestResult[];
    proceduresPerformed: string[];
    summaryParagraph: string;
  };
  todoList: TodoItem[];
  questionsForNextVisit: string[];
  warningSignsToWatch: string[];
  lifestyleRecommendations: string[];
  transcript: string;
  confidence: number;
  generatedAt: string;
}

type RecordingState = "idle" | "recording" | "stopped";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  follow_up: "calendar",
  lab_test: "activity",
  medication: "thermometer",
  referral: "users",
  imaging: "image",
  lifestyle: "sun",
  other: "file-text",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export default function PostVisitSummaryScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<PostVisitData | null>(null);
  const [completedTodos, setCompletedTodos] = useState<Set<number>>(new Set());

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcript, setTranscript] = useState("");

  const [visitReason, setVisitReason] = useState("");
  const [providerName, setProviderName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [inputMode, setInputMode] = useState<"record" | "notes">("record");

  const startRecording = useCallback(async () => {
    if (Platform.OS !== "web") {
      setInputMode("notes");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecordingState("recording");
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    } catch {
      setInputMode("notes");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && recordingState === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRecordingState("stopped");

      await new Promise(resolve => setTimeout(resolve, 500));
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          setTranscript(base64);
        };
        reader.readAsDataURL(blob);
      }
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    }
  }, [recordingState]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        visitReason,
        providerName,
        visitDate: new Date().toISOString(),
      };
      if (inputMode === "record" && transcript) {
        body.audioBase64 = transcript;
      } else {
        body.notes = manualNotes;
      }
      const result = await apiRequest("POST", "/api/visit-summary/post-visit", body);
      return result as unknown as PostVisitData;
    },
    onSuccess: (result) => {
      setData(result);
      setCompletedTodos(new Set());
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    },
  });

  const toggleTodo = useCallback((index: number) => {
    setCompletedTodos(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, []);

  const handleShare = useCallback(async () => {
    if (!data) return;
    const v = data.visitSummary;
    let text = "POST-VISIT SUMMARY\n\n";
    text += `Date: ${new Date(v.date).toLocaleDateString()}\n`;
    text += `Provider: ${v.provider}\n`;
    text += `Reason: ${v.reasonForVisit}\n\n`;
    text += `Summary: ${v.summaryParagraph}\n\n`;
    if (v.diagnoses.length > 0) {
      text += "DIAGNOSES:\n";
      v.diagnoses.forEach(d => { text += `  - ${d.name} (${d.status})${d.notes ? `: ${d.notes}` : ""}\n`; });
    }
    if (v.medicationChanges.length > 0) {
      text += "\nMEDICATION CHANGES:\n";
      v.medicationChanges.forEach(m => { text += `  - ${m.medication}: ${m.action}${m.details ? ` - ${m.details}` : ""}\n`; });
    }
    if (data.todoList.length > 0) {
      text += "\nTO-DO LIST:\n";
      data.todoList.forEach((t, i) => { text += `  ${completedTodos.has(i) ? "[x]" : "[ ]"} ${t.task} (${t.dueDescription})\n`; });
    }
    if (data.warningSignsToWatch.length > 0) {
      text += "\nWARNING SIGNS:\n";
      data.warningSignsToWatch.forEach(w => { text += `  - ${w}\n`; });
    }
    text += "\nThis is NOT medical advice. For personal reference only.";
    try {
      await Share.share({ message: text, title: "Post-Visit Summary" });
    } catch {}
  }, [data, completedTodos]);

  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)";
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const canGenerate = (inputMode === "record" && transcript) || (inputMode === "notes" && manualNotes.trim().length > 10);

  if (!data) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <View style={[styles.heroIcon, { backgroundColor: `${"#8b5cf6"}15` }]}>
              <Feather name="file-text" size={40} color="#8b5cf6" />
            </View>
            <ThemedText style={[styles.heroTitle, { color: theme.text }]}>Post-Visit Summary</ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Record your visit or enter notes to generate an AI-powered summary with action items.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(50)}>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Provider Name</ThemedText>
              <TextInput
                testID="input-provider-name"
                style={[styles.inputField, { backgroundColor: cardBg, borderColor: cardBorder, color: theme.text }]}
                value={providerName}
                onChangeText={setProviderName}
                placeholder="Dr. Smith"
                placeholderTextColor={`${theme.textSecondary}60`}
              />
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Reason for Visit</ThemedText>
              <TextInput
                testID="input-visit-reason"
                style={[styles.inputField, { backgroundColor: cardBg, borderColor: cardBorder, color: theme.text }]}
                value={visitReason}
                onChangeText={setVisitReason}
                placeholder="Follow-up, annual checkup, etc."
                placeholderTextColor={`${theme.textSecondary}60`}
              />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <View style={styles.modeToggle}>
              <Pressable
                testID="button-mode-record"
                style={[styles.modeBtn, inputMode === "record" ? { backgroundColor: theme.primary } : { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }]}
                onPress={() => setInputMode("record")}
              >
                <Feather name="mic" size={16} color={inputMode === "record" ? "#fff" : theme.text} />
                <ThemedText style={[styles.modeBtnText, { color: inputMode === "record" ? "#fff" : theme.text }]}>Record Visit</ThemedText>
              </Pressable>
              <Pressable
                testID="button-mode-notes"
                style={[styles.modeBtn, inputMode === "notes" ? { backgroundColor: theme.primary } : { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1 }]}
                onPress={() => setInputMode("notes")}
              >
                <Feather name="edit-3" size={16} color={inputMode === "notes" ? "#fff" : theme.text} />
                <ThemedText style={[styles.modeBtnText, { color: inputMode === "notes" ? "#fff" : theme.text }]}>Enter Notes</ThemedText>
              </Pressable>
            </View>
          </Animated.View>

          {inputMode === "record" ? (
            <Animated.View entering={FadeIn.duration(300)} style={[styles.recordingCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {Platform.OS !== "web" ? (
                <View style={{ alignItems: "center", padding: Spacing.lg }}>
                  <Feather name="smartphone" size={32} color={theme.textSecondary} />
                  <ThemedText style={[styles.recordingHint, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
                    Ambient recording works best in Expo Go. Switch to "Enter Notes" to type your visit details.
                  </ThemedText>
                </View>
              ) : (
                <>
                  <View style={styles.recordingControls}>
                    {recordingState === "idle" ? (
                      <Pressable testID="button-start-recording" onPress={startRecording} style={[styles.recordBtn, { backgroundColor: "#ef4444" }]} accessibilityRole="button" accessibilityLabel="Start recording">
                        <Feather name="mic" size={28} color="#fff" />
                      </Pressable>
                    ) : recordingState === "recording" ? (
                      <Pressable testID="button-stop-recording" onPress={stopRecording} style={[styles.recordBtn, { backgroundColor: "#ef4444" }]} accessibilityRole="button" accessibilityLabel="Stop recording">
                        <Feather name="square" size={24} color="#fff" />
                      </Pressable>
                    ) : (
                      <View style={[styles.recordBtn, { backgroundColor: "#22c55e" }]}>
                        <Feather name="check" size={28} color="#fff" />
                      </View>
                    )}
                  </View>
                  {recordingState === "recording" ? (
                    <View style={{ alignItems: "center" }}>
                      <ThemedText style={[styles.recordingTime, { color: "#ef4444" }]}>{formatTime(recordingTime)}</ThemedText>
                      <ThemedText style={[styles.recordingHint, { color: theme.textSecondary }]}>Recording... Tap to stop</ThemedText>
                      <View style={[styles.pulseIndicator, { backgroundColor: "#ef4444" }]} />
                    </View>
                  ) : recordingState === "stopped" ? (
                    <View style={{ alignItems: "center" }}>
                      <ThemedText style={[styles.recordingTime, { color: "#22c55e" }]}>{formatTime(recordingTime)}</ThemedText>
                      <ThemedText style={[styles.recordingHint, { color: theme.textSecondary }]}>Recording complete</ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={[styles.recordingHint, { color: theme.textSecondary }]}>
                      Tap to start recording your visit. Place your device where it can hear the conversation.
                    </ThemedText>
                  )}
                </>
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)}>
              <View style={styles.inputGroup}>
                <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Visit Notes</ThemedText>
                <TextInput
                  testID="input-visit-notes"
                  style={[styles.notesInput, { backgroundColor: cardBg, borderColor: cardBorder, color: theme.text }]}
                  value={manualNotes}
                  onChangeText={setManualNotes}
                  placeholder="Describe what happened during your visit. Include any diagnoses discussed, medication changes, follow-up instructions, and action items..."
                  placeholderTextColor={`${theme.textSecondary}60`}
                  multiline
                  textAlignVertical="top"
                />
                <ThemedText style={[styles.charCount, { color: theme.textSecondary }]}>{manualNotes.length} characters</ThemedText>
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Pressable
              testID="button-generate-postvisit"
              style={[styles.generateBtn, { backgroundColor: canGenerate ? "#8b5cf6" : `${theme.textSecondary}30` }]}
              onPress={() => generateMutation.mutate()}
              disabled={!canGenerate || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="zap" size={20} color="#fff" />
              )}
              <ThemedText style={styles.generateBtnText}>
                {generateMutation.isPending ? "Generating summary..." : "Generate Post-Visit Summary"}
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

  const v = data.visitSummary;

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.disclaimer, { color: "#f59e0b", backgroundColor: "#f59e0b10" }]}>
          For personal reference only. This is NOT medical advice.
        </ThemedText>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.cardHeader}>
            <Feather name="file-text" size={18} color="#8b5cf6" />
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Visit Summary</ThemedText>
          </View>
          <View style={styles.summaryMeta}>
            <View style={styles.metaRow}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{new Date(v.date).toLocaleDateString()}</ThemedText>
            </View>
            <View style={styles.metaRow}>
              <Feather name="user" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{v.provider}</ThemedText>
            </View>
            <View style={styles.metaRow}>
              <Feather name="flag" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>{v.reasonForVisit}</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.summaryParagraph, { color: theme.text }]}>{v.summaryParagraph}</ThemedText>
        </View>

        {v.diagnoses.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(50)}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeader}>
                <Feather name="clipboard" size={18} color={theme.primary} />
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Diagnoses</ThemedText>
              </View>
              {v.diagnoses.map((d, i) => (
                <View key={i} style={[styles.diagnosisRow, { borderColor: cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.diagnosisName, { color: theme.text }]}>{d.name}</ThemedText>
                    {d.notes ? <ThemedText style={[styles.diagnosisNotes, { color: theme.textSecondary }]}>{d.notes}</ThemedText> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: d.status === "new" ? `${"#ef4444"}15` : `${theme.primary}15` }]}>
                    <ThemedText style={[styles.statusText, { color: d.status === "new" ? "#ef4444" : theme.primary }]}>
                      {d.status}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {v.medicationChanges.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(100)}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.cardHeader}>
                <Feather name="thermometer" size={18} color="#8b5cf6" />
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Medication Changes</ThemedText>
              </View>
              {v.medicationChanges.map((m, i) => (
                <View key={i} style={[styles.medChangeRow, { borderColor: cardBorder }]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.medChangeName, { color: theme.text }]}>{m.medication}</ThemedText>
                    {m.details ? <ThemedText style={[styles.medChangeDetails, { color: theme.textSecondary }]}>{m.details}</ThemedText> : null}
                  </View>
                  <View style={[styles.actionBadge, {
                    backgroundColor: m.action === "started" ? "#22c55e15" : m.action === "stopped" ? "#ef444415" : `${theme.primary}15`
                  }]}>
                    <ThemedText style={[styles.actionText, {
                      color: m.action === "started" ? "#22c55e" : m.action === "stopped" ? "#ef4444" : theme.primary
                    }]}>
                      {m.action}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {data.todoList.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(150)}>
            <View style={[styles.sectionHeader, { borderColor: theme.border }]}>
              <Feather name="check-square" size={18} color="#8b5cf6" />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>To-Do List</ThemedText>
              <View style={[styles.todoBadge, { backgroundColor: `${"#8b5cf6"}15` }]}>
                <ThemedText style={[styles.todoBadgeText, { color: "#8b5cf6" }]}>
                  {completedTodos.size}/{data.todoList.length}
                </ThemedText>
              </View>
            </View>
            {data.todoList.map((todo, i) => {
              const isComplete = completedTodos.has(i);
              const priorityColor = PRIORITY_COLORS[todo.priority] || theme.textSecondary;
              return (
                <Pressable
                  key={i}
                  testID={`todo-item-${i}`}
                  onPress={() => toggleTodo(i)}
                  style={[styles.todoRow, {
                    backgroundColor: isComplete ? `${"#22c55e"}06` : cardBg,
                    borderColor: isComplete ? `${"#22c55e"}20` : cardBorder,
                  }]}
                >
                  <View style={[styles.todoCheckbox, {
                    borderColor: isComplete ? "#22c55e" : theme.border,
                    backgroundColor: isComplete ? "#22c55e" : "transparent",
                  }]}>
                    {isComplete ? <Feather name="check" size={14} color="#fff" /> : null}
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText style={[styles.todoTask, { color: theme.text, textDecorationLine: isComplete ? "line-through" : "none" }]}>
                      {todo.task}
                    </ThemedText>
                    <View style={styles.todoMeta}>
                      <Feather name={CATEGORY_ICONS[todo.category] || "file-text"} size={12} color={theme.textSecondary} />
                      <ThemedText style={[styles.todoMetaText, { color: theme.textSecondary }]}>{todo.dueDescription}</ThemedText>
                    </View>
                  </View>
                  <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {data.warningSignsToWatch.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(200)}>
            <View style={[styles.card, { backgroundColor: "#ef444406", borderColor: "#ef444420" }]}>
              <View style={styles.cardHeader}>
                <Feather name="alert-triangle" size={18} color="#ef4444" />
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Warning Signs to Watch</ThemedText>
              </View>
              {data.warningSignsToWatch.map((w, i) => (
                <View key={i} style={styles.warningItem}>
                  <Feather name="alert-circle" size={14} color="#ef4444" />
                  <ThemedText style={[styles.warningText, { color: theme.text }]}>{w}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {data.lifestyleRecommendations.length > 0 ? (
          <View style={[styles.card, { backgroundColor: `${"#22c55e"}06`, borderColor: `${"#22c55e"}15` }]}>
            <View style={styles.cardHeader}>
              <Feather name="heart" size={18} color="#22c55e" />
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Lifestyle Recommendations</ThemedText>
            </View>
            {data.lifestyleRecommendations.map((r, i) => (
              <View key={i} style={styles.listItem}>
                <Feather name="check" size={14} color="#22c55e" />
                <ThemedText style={[styles.listItemText, { color: theme.text }]}>{r}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {data.questionsForNextVisit.length > 0 ? (
          <View style={[styles.card, { backgroundColor: `${theme.primary}06`, borderColor: `${theme.primary}15` }]}>
            <View style={styles.cardHeader}>
              <Feather name="help-circle" size={18} color={theme.primary} />
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Questions for Next Visit</ThemedText>
            </View>
            {data.questionsForNextVisit.map((q, i) => (
              <View key={i} style={styles.listItem}>
                <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                <ThemedText style={[styles.listItemText, { color: theme.text }]}>{q}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {data.confidence > 0 ? (
          <View style={[styles.confidenceBar, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={[styles.confidenceLabel, { color: theme.textSecondary }]}>AI Confidence</ThemedText>
            <View style={[styles.confidenceTrack, { backgroundColor: `${theme.textSecondary}20` }]}>
              <View style={[styles.confidenceFill, { width: `${Math.round(data.confidence * 100)}%`, backgroundColor: data.confidence >= 0.7 ? "#22c55e" : data.confidence >= 0.4 ? "#f59e0b" : "#ef4444" }]} />
            </View>
            <ThemedText style={[styles.confidenceValue, { color: theme.textSecondary }]}>{Math.round(data.confidence * 100)}%</ThemedText>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            testID="button-share-postvisit"
            style={[styles.generateBtn, { backgroundColor: "#8b5cf6", flex: 1 }]}
            onPress={handleShare}
          >
            <Feather name="share" size={16} color="#fff" />
            <ThemedText style={styles.generateBtnText}>Share Summary</ThemedText>
          </Pressable>
          <Pressable
            testID="button-new-postvisit"
            style={[styles.generateBtn, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: 1, flex: 1 }]}
            onPress={() => { setData(null); setTranscript(""); setManualNotes(""); setRecordingState("idle"); setRecordingTime(0); setCompletedTodos(new Set()); }}
          >
            <Feather name="plus" size={16} color={theme.text} />
            <ThemedText style={[styles.generateBtnText, { color: theme.text }]}>New Summary</ThemedText>
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
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  heroSection: { alignItems: "center", marginBottom: Spacing.lg },
  heroIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  heroTitle: { fontSize: 24, fontWeight: "700", marginBottom: Spacing.xs },
  heroSubtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  inputGroup: { marginBottom: Spacing.sm },
  inputLabel: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  inputField: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15 },
  notesInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: 15, minHeight: 160, lineHeight: 22 },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 2 },
  modeToggle: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  modeBtnText: { fontSize: 14, fontWeight: "600" },
  recordingCard: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.md },
  recordingControls: { alignItems: "center", marginBottom: Spacing.md },
  recordBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  recordingTime: { fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  recordingHint: { fontSize: 13, textAlign: "center", marginTop: Spacing.xs },
  pulseIndicator: { width: 8, height: 8, borderRadius: 4, marginTop: Spacing.sm, opacity: 0.7 },
  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  generateBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  errorText: { fontSize: 13, textAlign: "center", marginTop: Spacing.xs },
  disclaimer: { fontSize: 12, fontWeight: "500", textAlign: "center", paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, overflow: "hidden", marginBottom: Spacing.md },
  card: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  summaryMeta: { marginBottom: Spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 3 },
  metaText: { fontSize: 13 },
  summaryParagraph: { fontSize: 15, lineHeight: 23 },
  diagnosisRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  diagnosisName: { fontSize: 14, fontWeight: "600" },
  diagnosisNotes: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  medChangeRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  medChangeName: { fontSize: 14, fontWeight: "600" },
  medChangeDetails: { fontSize: 12, marginTop: 1 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden" },
  actionText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, marginBottom: Spacing.sm, marginTop: Spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  todoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  todoBadgeText: { fontSize: 12, fontWeight: "600" },
  todoRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs },
  todoCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  todoTask: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  todoMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  todoMetaText: { fontSize: 11 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  warningItem: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginBottom: Spacing.xs },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20 },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  listItemText: { fontSize: 14, flex: 1, lineHeight: 20 },
  confidenceBar: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm, marginTop: Spacing.sm },
  confidenceLabel: { fontSize: 12, fontWeight: "500" },
  confidenceTrack: { flex: 1, height: 6, borderRadius: 3 },
  confidenceFill: { height: 6, borderRadius: 3 },
  confidenceValue: { fontSize: 12, fontWeight: "600", width: 36, textAlign: "right" },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  timestamp: { fontSize: 11, textAlign: "center", marginTop: Spacing.sm },
});
