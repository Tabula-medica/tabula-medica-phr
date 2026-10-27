import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

type EncounterStatus = "idle" | "recording" | "transcribing" | "summarizing" | "completed" | "error";

interface EncounterSummary {
  reasonForVisit: string;
  keyFindings: string[];
  diagnosesDiscussed: string[];
  medicationsDiscussed: { name: string; action: string }[];
  followUpActions: string[];
  providerInstructions: string[];
  vitalSigns: Record<string, string>;
}

interface Encounter {
  id: string;
  title: string;
  visitDate: string;
  provider: string | null;
  facility: string | null;
  transcript: string | null;
  summary: EncounterSummary | null;
  summaryText: string | null;
  status: string;
  confidence: number | null;
  duration: number | null;
}

export default function AmbientEncounterScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<EncounterStatus>("idle");
  const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [facility, setFacility] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<EncounterSummary | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const { checkFeature, promptProps } = useFeatureGate();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { data: encounters = [], isLoading: loadingEncounters } = useQuery<Encounter[]>({
    queryKey: ["/api/encounters"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/encounters", {
        title: title || `Visit on ${new Date().toLocaleDateString()}`,
        provider: provider || undefined,
        facility: facility || undefined,
      });
      return res.json();
    },
    onSuccess: (data: Encounter) => {
      setCurrentEncounterId(data.id);
      startAudioRecording();
    },
    onError: () => {
      setStatus("error");
      setErrorMessage("Failed to create encounter session.");
    },
  });

  const transcribeMutation = useMutation({
    mutationFn: async ({ encounterId, audioBlob }: { encounterId: string; audioBlob: Blob }) => {
      const base64 = await blobToBase64(audioBlob);
      const res = await apiRequest("POST", `/api/encounters/${encounterId}/transcribe`, {
        audio: base64,
        format: "webm",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setTranscript(data.transcript);
      setStatus("summarizing");
      if (currentEncounterId) {
        summarizeMutation.mutate(currentEncounterId);
      }
    },
    onError: () => {
      setStatus("error");
      setErrorMessage("Failed to transcribe audio. Please try again.");
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: async (encounterId: string) => {
      const res = await apiRequest("POST", `/api/encounters/${encounterId}/summarize`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setSummary(data.summary);
      setSummaryText(data.summaryText);
      setConfidence(data.confidence);
      setStatus("completed");
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
    },
    onError: () => {
      setStatus("error");
      setErrorMessage("Failed to generate summary. The transcript was saved.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (encounterId: string) => {
      await apiRequest("DELETE", `/api/encounters/${encounterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      if (selectedEncounter) setSelectedEncounter(null);
    },
  });

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setStatus("recording");
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      setStatus("error");
      setErrorMessage("Microphone access is required for encounter recording. Please allow microphone access and try again.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(audioBlob);
      };
      recorder.stop();
    });

    setStatus("transcribing");
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (currentEncounterId) {
      transcribeMutation.mutate({ encounterId: currentEncounterId, audioBlob: blob });
    }
  }, [currentEncounterId]);

  const handleStartEncounter = () => {
    if (!checkFeature("ambient_encounter")) return;
    setStatus("idle");
    setTranscript(null);
    setSummary(null);
    setSummaryText(null);
    setConfidence(null);
    setErrorMessage(null);
    setSelectedEncounter(null);
    createMutation.mutate();
  };

  const handleReset = () => {
    setStatus("idle");
    setCurrentEncounterId(null);
    setRecordingDuration(0);
    setTranscript(null);
    setSummary(null);
    setSummaryText(null);
    setConfidence(null);
    setErrorMessage(null);
    setTitle("");
    setProvider("");
    setFacility("");
    setSelectedEncounter(null);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const renderSetupForm = () => (
    <Animated.View entering={FadeInDown.springify()}>
      <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="mic" size={24} color={theme.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              Record Visit
            </ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              AI will transcribe and summarize your encounter
            </ThemedText>
          </View>
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Visit Title (optional)
          </ThemedText>
          <TextInput
            testID="input-encounter-title"
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="e.g. Annual checkup"
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Provider (optional)
          </ThemedText>
          <TextInput
            testID="input-encounter-provider"
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="Dr. Smith"
            placeholderTextColor={theme.textSecondary}
            value={provider}
            onChangeText={setProvider}
          />
        </View>

        <View style={styles.formGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Facility (optional)
          </ThemedText>
          <TextInput
            testID="input-encounter-facility"
            style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="City Hospital"
            placeholderTextColor={theme.textSecondary}
            value={facility}
            onChangeText={setFacility}
          />
        </View>

        <Pressable
          testID="button-start-recording"
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={handleStartEncounter}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="mic" size={18} color="#FFFFFF" />
              <ThemedText style={styles.primaryButtonText}>Start Recording</ThemedText>
            </>
          )}
        </Pressable>
      </Card>
    </Animated.View>
  );

  const renderRecording = () => (
    <Animated.View entering={FadeIn.springify()}>
      <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.recordingContainer}>
          <Animated.View
            entering={FadeIn}
            style={[styles.recordingPulse, { backgroundColor: "#EF444420" }]}
          >
            <View style={[styles.recordingDot, { backgroundColor: "#EF4444" }]} />
          </Animated.View>

          <ThemedText style={[styles.recordingLabel, { color: "#EF4444" }]}>
            Recording in Progress
          </ThemedText>

          <ThemedText style={[styles.timerText, { color: theme.text }]}>
            {formatDuration(recordingDuration)}
          </ThemedText>

          <ThemedText style={[styles.recordingHint, { color: theme.textSecondary }]}>
            Place your device nearby during your visit. The AI will listen and create a summary.
          </ThemedText>

          <Pressable
            testID="button-stop-recording"
            style={[styles.stopButton, { backgroundColor: "#EF4444" }]}
            onPress={stopRecording}
          >
            <Feather name="square" size={18} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Stop Recording</ThemedText>
          </Pressable>
        </View>
      </Card>
    </Animated.View>
  );

  const renderProcessing = () => (
    <Animated.View entering={FadeIn.springify()}>
      <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.processingTitle, { color: theme.text }]}>
            {status === "transcribing" ? "Transcribing Audio..." : "Generating Summary..."}
          </ThemedText>
          <ThemedText style={[styles.processingHint, { color: theme.textSecondary }]}>
            {status === "transcribing"
              ? "Converting speech to text using AI"
              : "Analyzing transcript and extracting key information"}
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );

  const renderSummarySection = (
    icon: keyof typeof Feather.glyphMap,
    title: string,
    items: string[] | undefined,
    color: string
  ) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.summarySection}>
        <View style={styles.summarySectionHeader}>
          <View style={[styles.summaryIconBg, { backgroundColor: color + "15" }]}>
            <Feather name={icon} size={14} color={color} />
          </View>
          <ThemedText style={[styles.summarySectionTitle, { color: theme.text }]}>
            {title}
          </ThemedText>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.summaryItem}>
            <View style={[styles.bulletDot, { backgroundColor: color }]} />
            <ThemedText style={[styles.summaryItemText, { color: theme.textSecondary }]}>
              {item}
            </ThemedText>
          </View>
        ))}
      </View>
    );
  };

  const renderCompleted = () => (
    <Animated.View entering={FadeInDown.springify()}>
      <View style={[styles.disclaimerBanner, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
        <Feather name="alert-triangle" size={14} color="#F59E0B" />
        <ThemedText style={[styles.disclaimerText, { color: "#D97706" }]}>
          This AI-generated summary is for personal reference only. It is not a clinical document and does not constitute medical advice. Always verify with your healthcare provider.
        </ThemedText>
      </View>

      {confidence !== null ? (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View style={[styles.confidenceBadge, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="check-circle" size={14} color={confidence > 0.7 ? "#10B981" : "#F59E0B"} />
            <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
              AI Confidence: {Math.round(confidence * 100)}%
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      {summaryText ? (
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.summaryOverviewTitle, { color: theme.text }]}>
              Visit Summary
            </ThemedText>
            <ThemedText style={[styles.summaryOverviewText, { color: theme.textSecondary }]}>
              {summaryText}
            </ThemedText>
          </Card>
        </Animated.View>
      ) : null}

      {summary ? (
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
            {summary.reasonForVisit ? (
              <View style={styles.summarySection}>
                <View style={styles.summarySectionHeader}>
                  <View style={[styles.summaryIconBg, { backgroundColor: "#3B82F615" }]}>
                    <Feather name="clipboard" size={14} color="#3B82F6" />
                  </View>
                  <ThemedText style={[styles.summarySectionTitle, { color: theme.text }]}>
                    Reason for Visit
                  </ThemedText>
                </View>
                <ThemedText style={[styles.summaryItemText, { color: theme.textSecondary, marginLeft: Spacing.lg + Spacing.sm }]}>
                  {summary.reasonForVisit}
                </ThemedText>
              </View>
            ) : null}

            {renderSummarySection("search", "Key Findings", summary.keyFindings, "#6366F1")}
            {renderSummarySection("file-text", "Diagnoses Discussed", summary.diagnosesDiscussed, "#EF4444")}

            {summary.medicationsDiscussed && summary.medicationsDiscussed.length > 0 ? (
              <View style={styles.summarySection}>
                <View style={styles.summarySectionHeader}>
                  <View style={[styles.summaryIconBg, { backgroundColor: "#10B98115" }]}>
                    <Feather name="package" size={14} color="#10B981" />
                  </View>
                  <ThemedText style={[styles.summarySectionTitle, { color: theme.text }]}>
                    Medications Discussed
                  </ThemedText>
                </View>
                {summary.medicationsDiscussed.map((med, i) => (
                  <View key={i} style={styles.summaryItem}>
                    <View style={[styles.bulletDot, { backgroundColor: "#10B981" }]} />
                    <ThemedText style={[styles.summaryItemText, { color: theme.textSecondary }]}>
                      {med.name} - {med.action}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {renderSummarySection("calendar", "Follow-up Actions", summary.followUpActions, "#F59E0B")}
            {renderSummarySection("info", "Provider Instructions", summary.providerInstructions, "#8B5CF6")}
          </Card>
        </Animated.View>
      ) : null}

      {transcript ? (
        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Pressable onPress={() => setShowTranscript(!showTranscript)}>
            <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.transcriptHeader}>
                <ThemedText style={[styles.transcriptTitle, { color: theme.text }]}>
                  Full Transcript
                </ThemedText>
                <Feather name={showTranscript ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
              </View>
              {showTranscript ? (
                <ThemedText style={[styles.transcriptText, { color: theme.textSecondary }]}>
                  {transcript}
                </ThemedText>
              ) : null}
            </Card>
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(300).springify()}>
        <Pressable
          testID="button-new-encounter"
          style={[styles.primaryButton, { backgroundColor: theme.primary, marginTop: Spacing.md }]}
          onPress={handleReset}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <ThemedText style={styles.primaryButtonText}>New Encounter</ThemedText>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  const [showTranscript, setShowTranscript] = useState(false);

  const renderError = () => (
    <Animated.View entering={FadeIn.springify()}>
      <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.errorContainer} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <View style={[styles.iconCircle, { backgroundColor: "#EF444415" }]}>
            <Feather name="alert-circle" size={24} color="#EF4444" />
          </View>
          <ThemedText style={[styles.errorText, { color: theme.text }]}>
            {errorMessage || "Something went wrong"}
          </ThemedText>
          <Pressable
            testID="button-try-again"
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleReset}
          >
            <Feather name="refresh-cw" size={18} color="#FFFFFF" />
            <ThemedText style={styles.primaryButtonText}>Try Again</ThemedText>
          </Pressable>
        </View>
      </Card>
    </Animated.View>
  );

  const renderEncounterDetail = (enc: Encounter) => (
    <Animated.View entering={FadeInDown.springify()}>
      <Pressable
        style={styles.backLink}
        onPress={() => setSelectedEncounter(null)}
      >
        <Feather name="arrow-left" size={16} color={theme.primary} />
        <ThemedText style={[styles.backLinkText, { color: theme.primary }]}>
          Back to encounters
        </ThemedText>
      </Pressable>

      <View style={[styles.disclaimerBanner, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" }]}>
        <Feather name="alert-triangle" size={14} color="#F59E0B" />
        <ThemedText style={[styles.disclaimerText, { color: "#D97706" }]}>
          This AI-generated summary is for personal reference only. It is not a clinical document and does not constitute medical advice.
        </ThemedText>
      </View>

      <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={[styles.detailTitle, { color: theme.text }]}>
          {enc.title}
        </ThemedText>
        <View style={styles.detailMeta}>
          <Feather name="calendar" size={12} color={theme.textSecondary} />
          <ThemedText style={[styles.detailMetaText, { color: theme.textSecondary }]}>
            {formatDate(enc.visitDate)}
          </ThemedText>
          {enc.provider ? (
            <>
              <Feather name="user" size={12} color={theme.textSecondary} style={{ marginLeft: Spacing.sm }} />
              <ThemedText style={[styles.detailMetaText, { color: theme.textSecondary }]}>
                {enc.provider}
              </ThemedText>
            </>
          ) : null}
        </View>
      </Card>

      {enc.summaryText ? (
        <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.summaryOverviewTitle, { color: theme.text }]}>
            Visit Summary
          </ThemedText>
          <ThemedText style={[styles.summaryOverviewText, { color: theme.textSecondary }]}>
            {enc.summaryText}
          </ThemedText>
        </Card>
      ) : null}

      {enc.summary ? (
        <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          {(enc.summary as EncounterSummary).reasonForVisit ? (
            <View style={styles.summarySection}>
              <View style={styles.summarySectionHeader}>
                <View style={[styles.summaryIconBg, { backgroundColor: "#3B82F615" }]}>
                  <Feather name="clipboard" size={14} color="#3B82F6" />
                </View>
                <ThemedText style={[styles.summarySectionTitle, { color: theme.text }]}>
                  Reason for Visit
                </ThemedText>
              </View>
              <ThemedText style={[styles.summaryItemText, { color: theme.textSecondary, marginLeft: Spacing.lg + Spacing.sm }]}>
                {(enc.summary as EncounterSummary).reasonForVisit}
              </ThemedText>
            </View>
          ) : null}
          {renderSummarySection("search", "Key Findings", (enc.summary as EncounterSummary).keyFindings, "#6366F1")}
          {renderSummarySection("file-text", "Diagnoses", (enc.summary as EncounterSummary).diagnosesDiscussed, "#EF4444")}
          {renderSummarySection("calendar", "Follow-up", (enc.summary as EncounterSummary).followUpActions, "#F59E0B")}
          {renderSummarySection("info", "Instructions", (enc.summary as EncounterSummary).providerInstructions, "#8B5CF6")}
        </Card>
      ) : null}

      {enc.transcript ? (
        <Card style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.transcriptTitle, { color: theme.text }]}>
            Transcript
          </ThemedText>
          <ThemedText style={[styles.transcriptText, { color: theme.textSecondary }]}>
            {enc.transcript}
          </ThemedText>
        </Card>
      ) : null}

      <Pressable
        testID="button-delete-encounter"
        style={[styles.deleteButton, { borderColor: "#EF444440" }]}
        onPress={() => deleteMutation.mutate(enc.id)}
      >
        <Feather name="trash-2" size={16} color="#EF4444" />
        <ThemedText style={[styles.deleteButtonText, { color: "#EF4444" }]}>
          Delete Encounter
        </ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderPastEncounters = () => {
    if (loadingEncounters) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      );
    }

    if (encounters.length === 0) return null;

    return (
      <Animated.View entering={FadeInDown.delay(400).springify()}>
        <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          PAST ENCOUNTERS
        </ThemedText>
        {encounters.map((enc) => (
          <Pressable
            key={enc.id}
            testID={`encounter-${enc.id}`}
            style={[styles.encounterRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            onPress={() => setSelectedEncounter(enc)}
          >
            <View style={[styles.statusDot, {
              backgroundColor: enc.status === "completed" ? "#10B981" : enc.status === "transcribed" ? "#F59E0B" : "#6366F1"
            }]} />
            <View style={styles.encounterInfo}>
              <ThemedText style={[styles.encounterTitle, { color: theme.text }]} numberOfLines={1}>
                {enc.title}
              </ThemedText>
              <ThemedText style={[styles.encounterDate, { color: theme.textSecondary }]}>
                {formatDate(enc.visitDate)}
                {enc.provider ? ` \u2022 ${enc.provider}` : ""}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, {
              backgroundColor: enc.status === "completed" ? "#10B98115" : "#F59E0B15"
            }]}>
              <ThemedText style={[styles.statusText, {
                color: enc.status === "completed" ? "#10B981" : "#F59E0B"
              }]}>
                {enc.status === "completed" ? "Summarized" : enc.status === "transcribed" ? "Transcribed" : "Recording"}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <UpgradePrompt {...promptProps} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {selectedEncounter ? (
          renderEncounterDetail(selectedEncounter)
        ) : (
          <>
            {status === "idle" ? renderSetupForm() : null}
            {status === "recording" ? renderRecording() : null}
            {status === "transcribing" || status === "summarizing" ? renderProcessing() : null}
            {status === "completed" ? renderCompleted() : null}
            {status === "error" ? renderError() : null}

            {status === "idle" || status === "completed" ? renderPastEncounters() : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    borderWidth: 1,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  recordingPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  recordingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  recordingLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  timerText: {
    fontSize: 36,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    marginBottom: Spacing.md,
  },
  recordingHint: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    lineHeight: 18,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  processingContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  processingHint: {
    fontSize: 13,
    textAlign: "center",
  },
  disclaimerBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  summaryOverviewTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  summaryOverviewText: {
    fontSize: 14,
    lineHeight: 21,
  },
  summarySection: {
    marginTop: Spacing.md,
  },
  summarySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  summaryIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  summarySectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginLeft: Spacing.lg + Spacing.sm,
    marginBottom: Spacing.xs,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  summaryItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  transcriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  transcriptTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  transcriptText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  encounterRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  encounterInfo: {
    flex: 1,
  },
  encounterTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  encounterDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  detailMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailMetaText: {
    fontSize: 12,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
