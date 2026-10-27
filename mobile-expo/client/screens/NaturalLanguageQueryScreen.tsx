import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type ThemeColors = typeof Colors.light;

interface QueryResult {
  summary: string;
  records: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    summary: string;
  }>;
  count: number;
  queryType: string;
  parsedIntent: {
    action: string;
    entities: string[];
    filters: any;
  };
}

interface QueryHistoryItem {
  id: string;
  query: string;
  resultSummary: string;
  resultCount: number;
  queryType: string;
  createdAt: string;
  feedback: string | null;
}

interface SuggestionChipProps {
  text: string;
  onPress: () => void;
  colors: ThemeColors;
}

function SuggestionChip({ text, onPress, colors }: SuggestionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.suggestionChip,
        { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <ThemedText type="caption" style={{ color: colors.primary }}>
        {text}
      </ThemedText>
    </Pressable>
  );
}

interface RecordCardProps {
  record: QueryResult["records"][0];
  colors: ThemeColors;
  onPress: () => void;
}

function RecordCard({ record, colors, onPress }: RecordCardProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case "lab":
        return colors.success;
      case "medication":
        return colors.recordMedication;
      case "visit":
        return colors.primary;
      case "imaging":
        return colors.recordImaging;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordCard,
        { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.recordHeader}>
        <View style={[styles.typeBadge, { backgroundColor: `${getTypeColor(record.type)}15` }]}>
          <ThemedText type="caption" style={{ color: getTypeColor(record.type) }}>
            {record.type.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText type="caption" style={{ color: colors.textSecondary }}>
          {new Date(record.date).toLocaleDateString()}
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
        {record.title}
      </ThemedText>
      <ThemedText
        type="caption"
        numberOfLines={2}
        style={{ color: colors.textSecondary, marginTop: 4 }}
      >
        {record.summary}
      </ThemedText>
    </Pressable>
  );
}

export default function NaturalLanguageQueryScreen() {
  const { theme: colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const { data: historyData } = useQuery<{ queries: QueryHistoryItem[]; total: number }>({
    queryKey: ["/api/analytics/query-history"],
  });

  const queryMutation = useMutation({
    mutationFn: async (queryText: string) => {
      const response = await apiRequest("POST", "/api/analytics/query", { query: queryText });
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/query-history"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      return apiRequest("POST", `/api/analytics/query/${id}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/query-history"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const handleSubmit = useCallback(() => {
    if (query.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryMutation.mutate(query.trim());
    }
  }, [query, queryMutation]);

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = () => {
    setQuery("");
    setResult(null);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startRecording = useCallback(async () => {
    setVoiceError(null);
    if (Platform.OS === "web") {
      setVoiceError("Voice input is available in Expo Go on your device.");
      return;
    }
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setVoiceError("Microphone permission is required for voice queries.");
        return;
      }
      recorder.record();
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pulseScale.value = withRepeat(
        withTiming(1.15, { duration: 800 }),
        -1,
        true
      );
    } catch (err) {
      setVoiceError("Could not start recording. Please try again.");
    }
  }, [recorder, pulseScale]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
      await recorder.stop();
      setIsRecording(false);
      setIsTranscribing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const uri = recorder.uri;
      if (!uri) {
        setVoiceError("No audio recorded.");
        setIsTranscribing(false);
        return;
      }

      const formData = new FormData();
      const { File } = await import("expo-file-system");
      const file = new File(uri);
      formData.append("audio", file);

      const apiUrl = getApiUrl();
      const response = await fetch(new URL("/api/voice/transcribe", apiUrl).toString(), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        setVoiceError("Could not transcribe audio. Try typing your question instead.");
        setIsTranscribing(false);
        return;
      }

      const data = await response.json();
      const transcript = data.transcript || data.text || "";
      if (transcript.trim()) {
        setQuery(transcript.trim());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setVoiceError("Could not understand the recording. Please try again or type your question.");
      }
    } catch (err) {
      setVoiceError("Transcription failed. Try typing your question instead.");
    } finally {
      setIsTranscribing(false);
    }
  }, [isRecording, recorder, pulseScale]);

  const suggestions = [
    "When was my last tetanus shot?",
    "Show my recent lab results",
    "List all my medications",
    "What allergies do I have?",
    "Show abnormal lab values",
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: Spacing.xl + 80,
          paddingHorizontal: Spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="h2" style={{ marginBottom: Spacing.sm }}>
          Ask About Your Health
        </ThemedText>
        <ThemedText
          type="body"
          style={{ color: colors.textSecondary, marginBottom: Spacing.lg }}
        >
          Ask questions in plain language or use voice — get answers from your health records
        </ThemedText>

        {voiceError ? (
          <View style={[styles.voiceErrorBanner, { backgroundColor: "rgba(255,149,0,0.1)" }]}>
            <Feather name="alert-circle" size={16} color="#FF9500" />
            <ThemedText type="caption" style={{ color: "#FF9500", flex: 1, marginLeft: Spacing.xs }}>
              {voiceError}
            </ThemedText>
            <Pressable
              onPress={() => setVoiceError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss voice error"
            >
              <Feather name="x" size={16} color="#FF9500" />
            </Pressable>
          </View>
        ) : null}

        {!result ? (
          <>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              Try asking...
            </ThemedText>
            <View style={styles.suggestionsContainer}>
              {suggestions.map((suggestion, index) => (
                <SuggestionChip
                  key={index}
                  text={suggestion}
                  onPress={() => handleSuggestion(suggestion)}
                  colors={colors}
                />
              ))}
            </View>

            {historyData && historyData.queries.length > 0 ? (
              <>
                <ThemedText type="h4" style={{ marginTop: Spacing.xl, marginBottom: Spacing.sm }}>
                  Recent Queries
                </ThemedText>
                {historyData.queries.slice(0, 5).map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => handleSuggestion(item.query)}
                    style={({ pressed }) => [
                      styles.historyItem,
                      { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Feather name="clock" size={16} color={colors.textSecondary} />
                    <View style={styles.historyContent}>
                      <ThemedText type="body" numberOfLines={1}>
                        {item.query}
                      </ThemedText>
                      <ThemedText type="caption" style={{ color: colors.textSecondary }}>
                        {item.resultCount} result{item.resultCount !== 1 ? "s" : ""} • {new Date(item.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.resultHeader}>
              <ThemedText type="h4">Results</ThemedText>
              <Pressable onPress={handleClear}>
                <ThemedText type="body" style={{ color: colors.primary }}>
                  New Query
                </ThemedText>
              </Pressable>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.summaryHeader}>
                <Feather name="message-circle" size={20} color={colors.primary} />
                <ThemedText type="caption" style={{ color: colors.textSecondary, marginLeft: Spacing.sm }}>
                  AI Summary
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ marginTop: Spacing.sm }}>
                {result.summary}
              </ThemedText>
              <View style={styles.summaryMeta}>
                <ThemedText type="caption" style={{ color: colors.textSecondary }}>
                  {result.count} record{result.count !== 1 ? "s" : ""} found • {result.queryType}
                </ThemedText>
              </View>
            </View>

            {result.parsedIntent ? (
              <View style={[styles.intentCard, { backgroundColor: `${colors.primary}10` }]}>
                <ThemedText type="caption" style={{ color: colors.primary }}>
                  Understood: {result.parsedIntent.action}
                </ThemedText>
                {result.parsedIntent.entities.length > 0 ? (
                  <ThemedText type="caption" style={{ color: colors.textSecondary, marginTop: 2 }}>
                    Entities: {result.parsedIntent.entities.join(", ")}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}

            {result.records.length > 0 ? (
              <>
                <ThemedText type="h4" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                  Matching Records
                </ThemedText>
                {result.records.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    colors={colors}
                    onPress={() => navigation.navigate("RecordDetail", { record } as any)}
                  />
                ))}
              </>
            ) : (
              <View style={[styles.emptyState, { backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="search" size={32} color={colors.textSecondary} />
                <ThemedText
                  type="body"
                  style={{ color: colors.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}
                >
                  No matching records found. Try a different query.
                </ThemedText>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.inputContainer, { backgroundColor: colors.backgroundDefault, paddingBottom: insets.bottom + Spacing.sm }]}>
        {isRecording ? (
          <View style={styles.recordingBar}>
            <Animated.View style={[styles.recordingDot, pulseStyle]}>
              <View style={styles.recordingDotInner} />
            </Animated.View>
            <ThemedText type="body" style={{ flex: 1, color: colors.text }}>
              Listening...
            </ThemedText>
            <Pressable
              onPress={stopRecording}
              style={[styles.stopRecordingButton, { backgroundColor: colors.error }]}
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              testID="button-stop-recording"
            >
              <Feather name="square" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              onPress={startRecording}
              disabled={isTranscribing || queryMutation.isPending}
              style={({ pressed }) => [
                styles.micButton,
                {
                  backgroundColor: isTranscribing ? colors.backgroundSecondary : `${colors.primary}15`,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isTranscribing ? "Transcribing audio" : "Start voice recording"}
              accessibilityHint="Tap to ask a question using your voice"
              testID="button-voice-record"
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="mic" size={20} color={colors.primary} />
              )}
            </Pressable>
            <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Ask about your health records..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text }]}
                returnKeyType="search"
                onSubmitEditing={handleSubmit}
                editable={!queryMutation.isPending && !isTranscribing}
                accessibilityLabel="Health question input"
              />
              {query.length > 0 ? (
                <Pressable onPress={handleClear} style={styles.clearButton} accessibilityRole="button" accessibilityLabel="Clear search">
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={handleSubmit}
              disabled={!query.trim() || queryMutation.isPending}
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: query.trim() ? colors.primary : colors.backgroundSecondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Submit question"
              accessibilityState={{ disabled: !query.trim() || queryMutation.isPending }}
              testID="button-submit-query"
            >
              {queryMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather
                  name="send"
                  size={20}
                  color={query.trim() ? "#FFFFFF" : colors.textSecondary}
                />
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  suggestionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  historyContent: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryMeta: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  intentCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  recordCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  voiceErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  recordingBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  recordingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,59,48,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF3B30",
  },
  stopRecordingButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
});
