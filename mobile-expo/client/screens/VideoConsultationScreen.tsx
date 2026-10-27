import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
  Linking,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";

import { ThemedText } from "@/components/ThemedText";
import { PermissionExplainer } from "@/components/PermissionExplainer";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getUserId } from "@/lib/api";

type CallPhase = "precall" | "waiting" | "incall" | "postcall";

interface MedicalTerm {
  term: string;
  definition: string;
  category: string;
  startIndex: number;
  endIndex: number;
}

interface AIGeneratedNotes {
  soapNotes: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  keyTopics: string[];
  actionItems: string[];
  followUpRecommendations: string;
  generatedAt: string;
  disclaimer: string;
}

interface TranscriptEntry {
  id: string;
  speaker: "provider" | "patient";
  text: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  visitId: string;
  senderId: string;
  senderRole: string;
  message: string;
  messageType: string;
  isRead: boolean;
  createdAt: string;
}

interface SharedDocument {
  id: string;
  visitId: string;
  sharedBy: string;
  sharedByRole: string;
  documentType: string;
  title: string;
  description: string | null;
  resourceUrl: string | null;
  createdAt: string;
}

interface RecordingState {
  id: string;
  visitId: string;
  patientConsentGiven: boolean;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
}

interface TelehealthVisit {
  id: string;
  patientId: string;
  title: string;
  reason: string | null;
  visitType: string;
  status: string;
  scheduledAt: string;
  duration: number;
  chiefComplaint: string | null;
  providerName: string | null;
  providerSpecialty: string | null;
  rating: number | null;
  feedback: string | null;
  aiSummary: string | null;
  soapNotes: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  } | null;
  followUpInstructions: string | null;
  transcription: string | null;
  medicalTerms: MedicalTerm[] | null;
  aiGeneratedNotes: AIGeneratedNotes | null;
  transcriptionStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  condition: "#EF4444",
  medication: "#3B82F6",
  procedure: "#8B5CF6",
  lab: "#F59E0B",
  vital: "#10B981",
  anatomy: "#EC4899",
  symptom: "#F97316",
};

const SIMULATED_TRANSCRIPT: Array<{ speaker: "provider" | "patient"; text: string; delayMs: number }> = [
  { speaker: "provider", text: "Good morning. How have you been feeling since our last visit?", delayMs: 8000 },
  { speaker: "patient", text: "I've been having some persistent headaches, mostly in the afternoon. My blood pressure readings at home have been a bit high too.", delayMs: 16000 },
  { speaker: "provider", text: "Can you tell me more about the headaches? How would you rate the pain, and have you noticed any nausea or dizziness?", delayMs: 24000 },
  { speaker: "patient", text: "The pain is about a 6 out of 10. No nausea, but I do feel some dizziness when I stand up quickly. I've been taking ibuprofen which helps temporarily.", delayMs: 32000 },
  { speaker: "provider", text: "That dizziness could be orthostatic hypotension. Let's review your current medications. You're on lisinopril 10mg and metformin 500mg, correct?", delayMs: 40000 },
  { speaker: "patient", text: "Yes, and I also take atorvastatin for cholesterol. My last A1C was 7.2 which my doctor said could be better.", delayMs: 48000 },
  { speaker: "provider", text: "I see. Your A1C of 7.2 shows room for improvement. Let me check your recent lab results. Your creatinine and hemoglobin levels look normal. I'd recommend we adjust your metformin dosage and schedule a follow-up in four weeks.", delayMs: 56000 },
  { speaker: "patient", text: "That sounds good. Should I continue monitoring my blood pressure at home?", delayMs: 64000 },
  { speaker: "provider", text: "Absolutely. Please take readings twice daily - morning and evening. Keep a log and we'll review at your next appointment. Also, let's get an ECG to rule out any cardiac issues related to the dizziness.", delayMs: 72000 },
];

function formatVisitType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TranscriptionWithHighlights({
  text,
  medicalTerms,
  theme,
  onTermPress,
}: {
  text: string;
  medicalTerms: MedicalTerm[];
  theme: any;
  onTermPress?: (term: MedicalTerm) => void;
}) {
  if (!medicalTerms || medicalTerms.length === 0) {
    return (
      <ThemedText style={[styles.transcriptFullText, { color: theme.text }]}>
        {text}
      </ThemedText>
    );
  }

  const sorted = [...medicalTerms].sort((a, b) => a.startIndex - b.startIndex);
  const segments: React.ReactNode[] = [];
  let lastIdx = 0;

  sorted.forEach((term, i) => {
    if (term.startIndex > lastIdx) {
      segments.push(
        <ThemedText key={`t-${i}`} style={[styles.transcriptFullText, { color: theme.text }]}>
          {text.substring(lastIdx, term.startIndex)}
        </ThemedText>
      );
    }
    const color = CATEGORY_COLORS[term.category] || theme.primary;
    segments.push(
      <Pressable
        key={`m-${i}`}
        onPress={() => onTermPress?.(term)}
        style={[styles.highlightedTerm, { backgroundColor: color + "20", borderColor: color + "40" }]}
        accessibilityRole="button"
        accessibilityLabel={`Medical term: ${term.term}, ${term.category}`}
      >
        <ThemedText style={[styles.highlightedTermText, { color }]}>
          {text.substring(term.startIndex, term.endIndex)}
        </ThemedText>
      </Pressable>
    );
    lastIdx = term.endIndex;
  });

  if (lastIdx < text.length) {
    segments.push(
      <ThemedText key="end" style={[styles.transcriptFullText, { color: theme.text }]}>
        {text.substring(lastIdx)}
      </ThemedText>
    );
  }

  return <ThemedText style={styles.transcriptWrap}>{segments}</ThemedText>;
}

export default function VideoConsultationScreen({
  route,
  navigation,
}: {
  route: { params: { visitId: string } };
  navigation: any;
}) {
  const { visitId } = route.params;
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<CallPhase>("precall");
  const [consentChecked, setConsentChecked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [visitNotes, setVisitNotes] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [manualTranscriptInput, setManualTranscriptInput] = useState("");
  const [selectedTerm, setSelectedTerm] = useState<MedicalTerm | null>(null);
  const [activeNoteTab, setActiveNoteTab] = useState<"transcript" | "ai-notes" | "actions">("transcript");
  const [showChat, setShowChat] = useState(false);
  const [showSharedDocs, setShowSharedDocs] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<FlatList>(null);
  const simulatedIndexRef = useRef(0);

  const [permission, requestPermission] = useCameraPermissions();

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (phase === "waiting") {
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [phase]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const {
    data: visit,
    isLoading,
    refetch,
  } = useQuery<TelehealthVisit>({
    queryKey: [`/api/telehealth/visits/${visitId}`],
  });

  useEffect(() => {
    if (phase === "incall") {
      timerRef.current = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "incall") return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    SIMULATED_TRANSCRIPT.forEach((entry, idx) => {
      const t = setTimeout(() => {
        if (simulatedIndexRef.current <= idx) {
          simulatedIndexRef.current = idx + 1;
          setTranscriptEntries((prev) => [
            ...prev,
            {
              id: `sim-${idx}`,
              speaker: entry.speaker,
              text: entry.text,
              timestamp: entry.delayMs / 1000,
            },
          ]);
        }
      }, entry.delayMs);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [phase]);

  const consentMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/consent`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const url = new URL(`/api/telehealth/visits/${visitId}/status`, getApiUrl());
      return apiRequest("PATCH", url.toString(), { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
    },
  });

  const documentMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/document`, getApiUrl());
      return apiRequest("POST", url.toString(), { visitNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
    },
  });

  const transcriptionMutation = useMutation({
    mutationFn: async (transcription: string) => {
      const url = new URL(`/api/telehealth/visits/${visitId}/transcription`, getApiUrl());
      return apiRequest("POST", url.toString(), { transcription });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
      refetch();
    },
  });

  const applyNotesMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/apply-ai-notes`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
      refetch();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const aiSummaryMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/ai-summary`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
      refetch();
    },
  });

  const rateMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/rate`, getApiUrl());
      return apiRequest("POST", url.toString(), { rating, feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}`] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const chatMessagesQuery = useQuery<ChatMessage[]>({
    queryKey: [`/api/telehealth/visits/${visitId}/chat`],
    enabled: phase === "incall",
    refetchInterval: phase === "incall" ? 3000 : false,
  });

  const sharedDocsQuery = useQuery<SharedDocument[]>({
    queryKey: [`/api/telehealth/visits/${visitId}/shared-documents`],
    enabled: phase === "incall",
    refetchInterval: phase === "incall" ? 5000 : false,
  });

  const recordingQuery = useQuery<RecordingState | null>({
    queryKey: [`/api/telehealth/visits/${visitId}/recording`],
    enabled: phase === "incall" || phase === "precall",
  });

  const sendChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const url = new URL(`/api/telehealth/visits/${visitId}/chat`, getApiUrl());
      return apiRequest("POST", url.toString(), { message, senderRole: "patient", messageType: "text" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}/chat`] });
    },
  });

  const shareDocMutation = useMutation({
    mutationFn: async (doc: { title: string; documentType: string; description?: string }) => {
      const url = new URL(`/api/telehealth/visits/${visitId}/shared-documents`, getApiUrl());
      return apiRequest("POST", url.toString(), { ...doc, sharedByRole: "patient" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}/shared-documents`] });
    },
  });

  const recordingConsentMutation = useMutation({
    mutationFn: async (consentGiven: boolean) => {
      const url = new URL(`/api/telehealth/visits/${visitId}/recording/consent`, getApiUrl());
      return apiRequest("POST", url.toString(), { consentGiven });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}/recording`] });
    },
  });

  const startRecordingMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/recording/start`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      setIsRecording(true);
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}/recording`] });
    },
  });

  const stopRecordingMutation = useMutation({
    mutationFn: async () => {
      const url = new URL(`/api/telehealth/visits/${visitId}/recording/stop`, getApiUrl());
      return apiRequest("POST", url.toString(), {});
    },
    onSuccess: () => {
      setIsRecording(false);
      queryClient.invalidateQueries({ queryKey: [`/api/telehealth/visits/${visitId}/recording`] });
    },
  });

  const buildFullTranscription = useCallback(() => {
    return transcriptEntries
      .map(
        (e) =>
          `[${e.speaker === "provider" ? "Provider" : "Patient"}] ${e.text}`
      )
      .join("\n\n");
  }, [transcriptEntries]);

  const handleJoinCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await consentMutation.mutateAsync();
    await statusMutation.mutateAsync("waiting_room");
    setPhase("waiting");
    setTimeout(() => {
      statusMutation.mutate("in_progress");
      setPhase("incall");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 4000);
  }, [consentMutation, statusMutation]);

  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (isRecording) {
      try { await stopRecordingMutation.mutateAsync(); } catch (_e) {}
    }
    await statusMutation.mutateAsync("documenting");

    const fullTranscription = buildFullTranscription();
    if (fullTranscription.trim()) {
      await transcriptionMutation.mutateAsync(fullTranscription);
    }

    if (visitNotes.trim()) {
      await documentMutation.mutateAsync();
    }
    await statusMutation.mutateAsync("completed");
    await refetch();
    setPhase("postcall");
  }, [statusMutation, documentMutation, visitNotes, refetch, buildFullTranscription, transcriptionMutation, isRecording, stopRecordingMutation]);

  const handleToggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => !prev);
  }, []);

  const handleToggleCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCameraOn((prev) => !prev);
  }, []);

  const handleToggleNotes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowNotes((prev) => !prev);
    if (!showNotes) {
      setShowTranscript(false);
      setShowChat(false);
      setShowSharedDocs(false);
    }
  }, [showNotes]);

  const handleToggleTranscript = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTranscript((prev) => !prev);
    if (!showTranscript) {
      setShowNotes(false);
      setShowChat(false);
      setShowSharedDocs(false);
    }
  }, [showTranscript]);

  const handleAddManualEntry = useCallback(() => {
    if (!manualTranscriptInput.trim()) return;
    const entry: TranscriptEntry = {
      id: `manual-${Date.now()}`,
      speaker: "patient",
      text: manualTranscriptInput.trim(),
      timestamp: callSeconds,
    };
    setTranscriptEntries((prev) => [...prev, entry]);
    setManualTranscriptInput("");
  }, [manualTranscriptInput, callSeconds]);

  const handleGenerateSummary = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    aiSummaryMutation.mutate();
  }, [aiSummaryMutation]);

  const handleApplyAINotes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    applyNotesMutation.mutate();
  }, [applyNotesMutation]);

  const handleSubmitRating = useCallback(() => {
    if (rating === 0) return;
    rateMutation.mutate();
  }, [rating, rateMutation]);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    sendChatMutation.mutate(chatInput.trim());
    setChatInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [chatInput, sendChatMutation]);

  const handleToggleChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowChat((prev) => !prev);
    if (!showChat) {
      setShowTranscript(false);
      setShowNotes(false);
      setShowSharedDocs(false);
    }
  }, [showChat]);

  const handleToggleSharedDocs = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSharedDocs((prev) => !prev);
    if (!showSharedDocs) {
      setShowTranscript(false);
      setShowNotes(false);
      setShowChat(false);
    }
  }, [showSharedDocs]);

  const handleRecordingConsent = useCallback(async (consent: boolean) => {
    setRecordingConsent(consent);
    await recordingConsentMutation.mutateAsync(consent);
    if (consent) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [recordingConsentMutation]);

  const handleToggleRecording = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRecording) {
      await stopRecordingMutation.mutateAsync();
    } else {
      await startRecordingMutation.mutateAsync();
    }
  }, [isRecording, startRecordingMutation, stopRecordingMutation]);

  const handleShareDocument = useCallback((docType: string, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    shareDocMutation.mutate({ title, documentType: docType, description: `Shared during telehealth visit` });
  }, [shareDocMutation]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText style={[styles.errorText, { color: theme.text }]}>
          Visit not found
        </ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={handleDone}
          testID="button-back"
          accessibilityRole="button"
          accessibilityLabel="Go Back"
        >
          <ThemedText style={[styles.backButtonText, { color: theme.buttonText }]}>
            Go Back
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  if (phase === "precall") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView
          contentContainerStyle={[
            styles.precallContent,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <Animated.View entering={FadeInDown.delay(100)}>
            <Pressable
              style={styles.closeButton}
              onPress={handleDone}
              testID="button-close-precall"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.precallHeader}>
            <View style={[styles.videoIcon, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="video" size={32} color={theme.primary} />
            </View>
            <ThemedText style={[styles.precallTitle, { color: theme.text }]}>
              Video Consultation
            </ThemedText>
            <ThemedText style={[styles.precallSubtitle, { color: theme.textSecondary }]}>
              Review your visit details before joining
            </ThemedText>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(300)}
            style={[styles.visitCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}
          >
            <View style={styles.visitCardRow}>
              <Feather name="user" size={18} color={theme.primary} />
              <View style={styles.visitCardInfo}>
                <ThemedText style={[styles.visitLabel, { color: theme.textSecondary }]}>
                  Provider
                </ThemedText>
                <ThemedText style={[styles.visitValue, { color: theme.text }]}>
                  {visit.providerName ? visit.providerName : "Assigned Provider"}
                </ThemedText>
              </View>
            </View>
            {visit.providerSpecialty ? (
              <View style={styles.visitCardRow}>
                <Feather name="briefcase" size={18} color={theme.primary} />
                <View style={styles.visitCardInfo}>
                  <ThemedText style={[styles.visitLabel, { color: theme.textSecondary }]}>
                    Specialty
                  </ThemedText>
                  <ThemedText style={[styles.visitValue, { color: theme.text }]}>
                    {visit.providerSpecialty}
                  </ThemedText>
                </View>
              </View>
            ) : null}
            <View style={styles.visitCardRow}>
              <Feather name="clipboard" size={18} color={theme.primary} />
              <View style={styles.visitCardInfo}>
                <ThemedText style={[styles.visitLabel, { color: theme.textSecondary }]}>
                  Visit Type
                </ThemedText>
                <ThemedText style={[styles.visitValue, { color: theme.text }]}>
                  {formatVisitType(visit.visitType)}
                </ThemedText>
              </View>
            </View>
            {visit.reason ? (
              <View style={styles.visitCardRow}>
                <Feather name="file-text" size={18} color={theme.primary} />
                <View style={styles.visitCardInfo}>
                  <ThemedText style={[styles.visitLabel, { color: theme.textSecondary }]}>
                    Reason
                  </ThemedText>
                  <ThemedText style={[styles.visitValue, { color: theme.text }]}>
                    {visit.reason}
                  </ThemedText>
                </View>
              </View>
            ) : null}
            <View style={styles.visitCardRow}>
              <Feather name="calendar" size={18} color={theme.primary} />
              <View style={styles.visitCardInfo}>
                <ThemedText style={[styles.visitLabel, { color: theme.textSecondary }]}>
                  Scheduled
                </ThemedText>
                <ThemedText style={[styles.visitValue, { color: theme.text }]}>
                  {formatDateTime(visit.scheduledAt)}
                </ThemedText>
              </View>
            </View>
            <View style={styles.visitCardRow}>
              <Feather name="clock" size={18} color={theme.primary} />
              <View style={styles.visitCardInfo}>
                <ThemedText style={[styles.visitLabel, { color: theme.textSecondary }]}>
                  Duration
                </ThemedText>
                <ThemedText style={[styles.visitValue, { color: theme.text }]}>
                  {visit.duration} minutes
                </ThemedText>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(350)}
            style={[styles.aiBadge, { backgroundColor: theme.primary + "10", borderColor: theme.primary + "30" }]}
          >
            <Feather name="cpu" size={16} color={theme.primary} />
            <ThemedText style={[styles.aiBadgeText, { color: theme.primary }]}>
              AI Transcription Active
            </ThemedText>
            <ThemedText style={[styles.aiBadgeSubtext, { color: theme.textSecondary }]}>
              Conversation will be transcribed and analyzed with key medical terms highlighted
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)}>
            <Pressable
              style={styles.consentRow}
              onPress={() => setConsentChecked((prev) => !prev)}
              testID="button-consent"
              accessibilityRole="checkbox"
              accessibilityLabel="Consent to telehealth consultation with AI transcription"
              accessibilityState={{ checked: consentChecked }}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.border },
                  consentChecked ? { backgroundColor: theme.primary, borderColor: theme.primary } : null,
                ]}
              >
                {consentChecked ? (
                  <Feather name="check" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              <ThemedText style={[styles.consentText, { color: theme.text }]}>
                I consent to this telehealth consultation, including AI-powered transcription and medical term analysis. All notes are for documentation assistance and will be reviewed by the provider.
              </ThemedText>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(450)}>
            <View style={[styles.recordingConsentCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}>
              <View style={styles.recordingConsentHeader}>
                <Feather name="disc" size={18} color={theme.warning} />
                <ThemedText style={[styles.recordingConsentTitle, { color: theme.text }]}>
                  Session Recording
                </ThemedText>
              </View>
              <ThemedText style={[styles.recordingConsentDesc, { color: theme.textSecondary }]}>
                Allow this session to be recorded for your medical records. Recordings are encrypted with AES-256-GCM and stored securely.
              </ThemedText>
              <Pressable
                style={styles.recordingConsentRow}
                onPress={() => handleRecordingConsent(!recordingConsent)}
                testID="button-recording-consent"
                accessibilityRole="checkbox"
                accessibilityLabel="Consent to session recording"
                accessibilityState={{ checked: recordingConsent }}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: theme.border },
                    recordingConsent ? { backgroundColor: theme.warning, borderColor: theme.warning } : null,
                  ]}
                >
                  {recordingConsent ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
                <ThemedText style={[styles.recordingConsentText, { color: theme.text }]}>
                  I consent to session recording
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500)}>
            <Pressable
              style={[
                styles.joinButton,
                { backgroundColor: theme.primary },
                !consentChecked ? { opacity: 0.5 } : null,
              ]}
              onPress={handleJoinCall}
              disabled={!consentChecked || consentMutation.isPending}
              testID="button-join-call"
              accessibilityRole="button"
              accessibilityLabel="Join Call"
              accessibilityState={{ disabled: !consentChecked || consentMutation.isPending }}
            >
              {consentMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.buttonText} />
              ) : (
                <>
                  <Feather name="video" size={20} color={theme.buttonText} />
                  <ThemedText style={[styles.joinButtonText, { color: theme.buttonText }]}>
                    Join Call
                  </ThemedText>
                </>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  if (phase === "waiting") {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#0A0F1A" : "#0D1B2A" }]}>
        <View
          style={[
            styles.waitingContent,
            { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["3xl"] },
          ]}
        >
          <Animated.View entering={FadeIn.delay(200)} style={styles.waitingCenter}>
            <Animated.View style={[styles.waitingPulse, pulseStyle]}>
              <View style={[styles.waitingCircle, { backgroundColor: theme.primary + "30" }]}>
                <Feather name="video" size={48} color={theme.primary} />
              </View>
            </Animated.View>
            <ThemedText style={[styles.waitingTitle, { color: "#FFFFFF" }]}>
              Waiting for provider...
            </ThemedText>
            <ThemedText style={[styles.waitingSubtitle, { color: "rgba(255,255,255,0.6)" }]}>
              {visit.providerName ? visit.providerName : "Your provider"} will join shortly
            </ThemedText>
            <View style={[styles.waitingInfoCard, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
              <ThemedText style={[styles.waitingInfoText, { color: "rgba(255,255,255,0.8)" }]}>
                {visit.title}
              </ThemedText>
            </View>
          </Animated.View>
          <Pressable
            style={[styles.cancelWaitButton, { borderColor: "rgba(255,255,255,0.3)" }]}
            onPress={handleDone}
            testID="button-cancel-wait"
            accessibilityRole="button"
            accessibilityLabel="Leave Waiting Room"
          >
            <ThemedText style={[styles.cancelWaitText, { color: "rgba(255,255,255,0.8)" }]}>
              Leave Waiting Room
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "postcall") {
    const medicalTerms = (visit.medicalTerms as MedicalTerm[]) || [];
    const aiNotes = visit.aiGeneratedNotes as AIGeneratedNotes | null;
    const transcription = visit.transcription || buildFullTranscription();

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView
          contentContainerStyle={[
            styles.postcallContent,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <Animated.View entering={FadeInDown.delay(100)} style={styles.postcallHeader}>
            <View style={[styles.completedIcon, { backgroundColor: theme.success + "15" }]}>
              <Feather name="check-circle" size={40} color={theme.success} />
            </View>
            <ThemedText style={[styles.postcallTitle, { color: theme.text }]}>
              Visit Complete
            </ThemedText>
            <ThemedText style={[styles.postcallSubtitle, { color: theme.textSecondary }]}>
              Duration: {formatTimer(callSeconds)}
            </ThemedText>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(150)}
            style={[styles.summaryCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}
          >
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Visit Summary
            </ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Provider
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {visit.providerName ? visit.providerName : "Provider"}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Type
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {formatVisitType(visit.visitType)}
              </ThemedText>
            </View>
            {visit.reason ? (
              <View style={styles.summaryRow}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Reason
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                  {visit.reason}
                </ThemedText>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(200)}
            style={[styles.summaryCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}
          >
            <View style={styles.tabBar}>
              <Pressable
                style={[
                  styles.tab,
                  activeNoteTab === "transcript" ? { backgroundColor: theme.primary + "15", borderColor: theme.primary } : { borderColor: "transparent" },
                ]}
                onPress={() => setActiveNoteTab("transcript")}
                testID="tab-transcript"
                accessibilityRole="tab"
                accessibilityLabel="Transcript"
                accessibilityState={{ selected: activeNoteTab === "transcript" }}
              >
                <Feather name="file-text" size={14} color={activeNoteTab === "transcript" ? theme.primary : theme.textSecondary} />
                <ThemedText style={[styles.tabText, { color: activeNoteTab === "transcript" ? theme.primary : theme.textSecondary }]}>
                  Transcript
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeNoteTab === "ai-notes" ? { backgroundColor: theme.primary + "15", borderColor: theme.primary } : { borderColor: "transparent" },
                ]}
                onPress={() => setActiveNoteTab("ai-notes")}
                testID="tab-ai-notes"
                accessibilityRole="tab"
                accessibilityLabel="AI Notes"
                accessibilityState={{ selected: activeNoteTab === "ai-notes" }}
              >
                <Feather name="cpu" size={14} color={activeNoteTab === "ai-notes" ? theme.primary : theme.textSecondary} />
                <ThemedText style={[styles.tabText, { color: activeNoteTab === "ai-notes" ? theme.primary : theme.textSecondary }]}>
                  AI Notes
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeNoteTab === "actions" ? { backgroundColor: theme.primary + "15", borderColor: theme.primary } : { borderColor: "transparent" },
                ]}
                onPress={() => setActiveNoteTab("actions")}
                testID="tab-actions"
                accessibilityRole="tab"
                accessibilityLabel="Actions"
                accessibilityState={{ selected: activeNoteTab === "actions" }}
              >
                <Feather name="check-square" size={14} color={activeNoteTab === "actions" ? theme.primary : theme.textSecondary} />
                <ThemedText style={[styles.tabText, { color: activeNoteTab === "actions" ? theme.primary : theme.textSecondary }]}>
                  Actions
                </ThemedText>
              </Pressable>
            </View>

            {activeNoteTab === "transcript" ? (
              <View>
                {transcription ? (
                  <>
                    {medicalTerms.length > 0 ? (
                      <View style={styles.termLegend}>
                        {Object.entries(CATEGORY_COLORS).map(([cat, col]) => {
                          const hasCat = medicalTerms.some((t) => t.category === cat);
                          return hasCat ? (
                            <View key={cat} style={styles.legendItem}>
                              <View style={[styles.legendDot, { backgroundColor: col }]} />
                              <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
                                {cat}
                              </ThemedText>
                            </View>
                          ) : null;
                        })}
                      </View>
                    ) : null}
                    <TranscriptionWithHighlights
                      text={transcription}
                      medicalTerms={medicalTerms}
                      theme={theme}
                      onTermPress={(term) => setSelectedTerm(term)}
                    />
                    {selectedTerm ? (
                      <View style={[styles.termTooltip, { backgroundColor: theme.backgroundSecondary, borderColor: CATEGORY_COLORS[selectedTerm.category] + "50" }]}>
                        <View style={styles.termTooltipHeader}>
                          <View style={[styles.termCategoryBadge, { backgroundColor: CATEGORY_COLORS[selectedTerm.category] + "20" }]}>
                            <ThemedText style={[styles.termCategoryText, { color: CATEGORY_COLORS[selectedTerm.category] }]}>
                              {selectedTerm.category}
                            </ThemedText>
                          </View>
                          <Pressable onPress={() => setSelectedTerm(null)} accessibilityRole="button" accessibilityLabel="Dismiss term definition">
                            <Feather name="x" size={16} color={theme.textSecondary} />
                          </Pressable>
                        </View>
                        <ThemedText style={[styles.termName, { color: theme.text }]}>
                          {selectedTerm.term}
                        </ThemedText>
                        <ThemedText style={[styles.termDefinition, { color: theme.textSecondary }]}>
                          {selectedTerm.definition}
                        </ThemedText>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No transcription recorded for this visit.
                  </ThemedText>
                )}
              </View>
            ) : null}

            {activeNoteTab === "ai-notes" ? (
              <View>
                {aiNotes ? (
                  <>
                    {aiNotes.soapNotes.subjective ? (
                      <View style={styles.soapSection}>
                        <View style={styles.soapHeader}>
                          <View style={[styles.soapBadge, { backgroundColor: "#3B82F620" }]}>
                            <ThemedText style={[styles.soapBadgeText, { color: "#3B82F6" }]}>S</ThemedText>
                          </View>
                          <ThemedText style={[styles.soapTitle, { color: theme.text }]}>Subjective</ThemedText>
                        </View>
                        <ThemedText style={[styles.soapText, { color: theme.text }]}>
                          {aiNotes.soapNotes.subjective}
                        </ThemedText>
                      </View>
                    ) : null}
                    {aiNotes.soapNotes.objective ? (
                      <View style={styles.soapSection}>
                        <View style={styles.soapHeader}>
                          <View style={[styles.soapBadge, { backgroundColor: "#10B98120" }]}>
                            <ThemedText style={[styles.soapBadgeText, { color: "#10B981" }]}>O</ThemedText>
                          </View>
                          <ThemedText style={[styles.soapTitle, { color: theme.text }]}>Objective</ThemedText>
                        </View>
                        <ThemedText style={[styles.soapText, { color: theme.text }]}>
                          {aiNotes.soapNotes.objective}
                        </ThemedText>
                      </View>
                    ) : null}
                    {aiNotes.soapNotes.assessment ? (
                      <View style={styles.soapSection}>
                        <View style={styles.soapHeader}>
                          <View style={[styles.soapBadge, { backgroundColor: "#F59E0B20" }]}>
                            <ThemedText style={[styles.soapBadgeText, { color: "#F59E0B" }]}>A</ThemedText>
                          </View>
                          <ThemedText style={[styles.soapTitle, { color: theme.text }]}>Assessment</ThemedText>
                        </View>
                        <ThemedText style={[styles.soapText, { color: theme.text }]}>
                          {aiNotes.soapNotes.assessment}
                        </ThemedText>
                      </View>
                    ) : null}
                    {aiNotes.soapNotes.plan ? (
                      <View style={styles.soapSection}>
                        <View style={styles.soapHeader}>
                          <View style={[styles.soapBadge, { backgroundColor: "#8B5CF620" }]}>
                            <ThemedText style={[styles.soapBadgeText, { color: "#8B5CF6" }]}>P</ThemedText>
                          </View>
                          <ThemedText style={[styles.soapTitle, { color: theme.text }]}>Plan</ThemedText>
                        </View>
                        <ThemedText style={[styles.soapText, { color: theme.text }]}>
                          {aiNotes.soapNotes.plan}
                        </ThemedText>
                      </View>
                    ) : null}

                    <Pressable
                      style={[styles.applyNotesButton, { backgroundColor: theme.primary }]}
                      onPress={handleApplyAINotes}
                      disabled={applyNotesMutation.isPending}
                      testID="button-apply-ai-notes"
                      accessibilityRole="button"
                      accessibilityLabel={applyNotesMutation.isSuccess ? "Notes Applied" : "Apply AI notes to session"}
                      accessibilityState={{ disabled: applyNotesMutation.isPending }}
                    >
                      {applyNotesMutation.isPending ? (
                        <ActivityIndicator size="small" color={theme.buttonText} />
                      ) : (
                        <>
                          <Feather name="check" size={16} color={theme.buttonText} />
                          <ThemedText style={[styles.applyNotesText, { color: theme.buttonText }]}>
                            {applyNotesMutation.isSuccess ? "Notes Applied" : "Apply to Session Notes"}
                          </ThemedText>
                        </>
                      )}
                    </Pressable>

                    <View style={[styles.disclaimerBox, { backgroundColor: theme.warning + "10", borderColor: theme.warning + "30" }]}>
                      <Feather name="alert-triangle" size={14} color={theme.warning} />
                      <ThemedText style={[styles.disclaimerText, { color: theme.textSecondary }]}>
                        {aiNotes.disclaimer}
                      </ThemedText>
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyAINotes}>
                    <Feather name="cpu" size={32} color={theme.textSecondary} />
                    <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                      {transcriptionMutation.isPending
                        ? "Analyzing transcription..."
                        : "AI notes will be generated from the transcription."}
                    </ThemedText>
                    {transcriptionMutation.isPending ? (
                      <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.md }} />
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {activeNoteTab === "actions" ? (
              <View>
                {aiNotes ? (
                  <>
                    {aiNotes.keyTopics.length > 0 ? (
                      <View style={styles.topicsSection}>
                        <ThemedText style={[styles.subsectionTitle, { color: theme.text }]}>
                          Key Topics Discussed
                        </ThemedText>
                        <View style={styles.topicsWrap}>
                          {aiNotes.keyTopics.map((topic, i) => (
                            <View key={i} style={[styles.topicChip, { backgroundColor: theme.primary + "12" }]}>
                              <ThemedText style={[styles.topicChipText, { color: theme.primary }]}>
                                {topic}
                              </ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {aiNotes.actionItems.length > 0 ? (
                      <View style={styles.actionsSection}>
                        <ThemedText style={[styles.subsectionTitle, { color: theme.text }]}>
                          Action Items
                        </ThemedText>
                        {aiNotes.actionItems.map((item, i) => (
                          <View key={i} style={styles.actionItem}>
                            <Feather name="check-circle" size={16} color={theme.success} />
                            <ThemedText style={[styles.actionItemText, { color: theme.text }]}>
                              {item}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {aiNotes.followUpRecommendations ? (
                      <View style={styles.followUpSection}>
                        <ThemedText style={[styles.subsectionTitle, { color: theme.text }]}>
                          Follow-up Recommendations
                        </ThemedText>
                        <ThemedText style={[styles.followUpText, { color: theme.text }]}>
                          {aiNotes.followUpRecommendations}
                        </ThemedText>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.emptyAINotes}>
                    <Feather name="check-square" size={32} color={theme.textSecondary} />
                    <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                      Action items will appear after AI analysis is complete.
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(250)}
            style={[styles.summaryCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}
          >
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              AI Visit Summary
            </ThemedText>
            {visit.aiSummary ? (
              <ThemedText style={[styles.notesText, { color: theme.text }]}>
                {visit.aiSummary}
              </ThemedText>
            ) : (
              <Pressable
                style={[styles.generateButton, { backgroundColor: theme.primary + "12" }]}
                onPress={handleGenerateSummary}
                disabled={aiSummaryMutation.isPending}
                testID="button-generate-summary"
                accessibilityRole="button"
                accessibilityLabel="Generate AI Summary"
                accessibilityState={{ disabled: aiSummaryMutation.isPending }}
              >
                {aiSummaryMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <Feather name="cpu" size={18} color={theme.primary} />
                    <ThemedText style={[styles.generateButtonText, { color: theme.primary }]}>
                      Generate AI Summary
                    </ThemedText>
                  </>
                )}
              </Pressable>
            )}
          </Animated.View>

          {medicalTerms.length > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(300)}
              style={[styles.summaryCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}
            >
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                Medical Terms Identified ({medicalTerms.length})
              </ThemedText>
              {medicalTerms.slice(0, 10).map((term, i) => (
                <View key={i} style={[styles.termListItem, { borderBottomColor: theme.border }]}>
                  <View style={styles.termListHeader}>
                    <ThemedText style={[styles.termListName, { color: theme.text }]}>
                      {term.term}
                    </ThemedText>
                    <View style={[styles.termCategoryBadge, { backgroundColor: (CATEGORY_COLORS[term.category] || theme.primary) + "20" }]}>
                      <ThemedText style={[styles.termCategoryText, { color: CATEGORY_COLORS[term.category] || theme.primary }]}>
                        {term.category}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.termListDefinition, { color: theme.textSecondary }]}>
                    {term.definition}
                  </ThemedText>
                </View>
              ))}
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.delay(350)}
            style={[styles.summaryCard, { backgroundColor: theme.backgroundRootDefault, borderColor: theme.border }]}
          >
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Rate Your Visit
            </ThemedText>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => {
                    setRating(star);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  testID={`button-star-${star}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  accessibilityState={{ selected: star <= rating }}
                >
                  <Feather
                    name="star"
                    size={32}
                    color={star <= rating ? theme.warning : theme.border}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[
                styles.feedbackInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Share your feedback (optional)"
              placeholderTextColor={theme.textSecondary}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={3}
              testID="input-feedback"
              accessibilityLabel="Share your feedback"
            />
            {rating > 0 ? (
              <Pressable
                style={[styles.submitRatingButton, { backgroundColor: theme.primary }]}
                onPress={handleSubmitRating}
                disabled={rateMutation.isPending}
                testID="button-submit-rating"
                accessibilityRole="button"
                accessibilityLabel="Submit Rating"
                accessibilityState={{ disabled: rateMutation.isPending }}
              >
                {rateMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.buttonText} />
                ) : (
                  <ThemedText style={[styles.submitRatingText, { color: theme.buttonText }]}>
                    Submit Rating
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
            {rateMutation.isSuccess ? (
              <ThemedText style={[styles.ratingSuccess, { color: theme.success }]}>
                Thank you for your feedback!
              </ThemedText>
            ) : null}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)}>
            <Pressable
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
              onPress={handleDone}
              testID="button-done"
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <ThemedText style={[styles.doneButtonText, { color: theme.buttonText }]}>
                Done
              </ThemedText>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  const isWeb = Platform.OS !== "ios" && Platform.OS !== "android";
  if (isWeb) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? "#0A0F1A" : "#0D1B2A" }]}>
        <View
          style={[
            styles.webFallback,
            { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["3xl"] },
          ]}
        >
          <Feather name="smartphone" size={48} color="rgba(255,255,255,0.7)" />
          <ThemedText style={[styles.webFallbackTitle, { color: "#FFFFFF" }]}>
            Camera Not Available
          </ThemedText>
          <ThemedText style={[styles.webFallbackText, { color: "rgba(255,255,255,0.6)" }]}>
            Run in Expo Go on your device to use the camera for video consultations.
          </ThemedText>
          <Pressable
            style={[styles.cancelWaitButton, { borderColor: "rgba(255,255,255,0.3)" }]}
            onPress={handleDone}
            testID="button-back-web"
            accessibilityRole="button"
            accessibilityLabel="Go Back"
          >
            <ThemedText style={[styles.cancelWaitText, { color: "rgba(255,255,255,0.8)" }]}>
              Go Back
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    const isDeniedPermanently = permission.status === "denied" && !permission.canAskAgain;
    return (
      <PermissionExplainer
        type="camera"
        onAllow={() => { requestPermission(); }}
        onDeny={handleDone}
        denied={isDeniedPermanently}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      <View style={styles.providerArea}>
        <View style={[styles.providerPlaceholder, { backgroundColor: isDark ? "#1A1A2E" : "#1B2838" }]}>
          <View style={[styles.providerAvatar, { backgroundColor: theme.primary + "25" }]}>
            <Feather name="user" size={40} color={theme.primary} />
          </View>
          <ThemedText style={[styles.providerNameCall, { color: "#FFFFFF" }]}>
            {visit.providerName ? visit.providerName : "Provider"}
          </ThemedText>
          {visit.providerSpecialty ? (
            <ThemedText style={[styles.providerSpecialtyCall, { color: "rgba(255,255,255,0.6)" }]}>
              {visit.providerSpecialty}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={[styles.selfCameraContainer, { top: insets.top + Spacing.md }]}>
        {isCameraOn ? (
          <CameraView style={styles.camera} facing="front" />
        ) : (
          <View style={[styles.cameraOff, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="camera-off" size={24} color={theme.textSecondary} />
          </View>
        )}
      </View>

      <Animated.View
        entering={FadeInUp}
        style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}
      >
        <View style={styles.timerContainer}>
          <View style={styles.liveIndicator} />
          <ThemedText style={styles.timerText}>
            {formatTimer(callSeconds)}
          </ThemedText>
        </View>
        <View style={styles.topBarRight}>
          {transcriptEntries.length > 0 ? (
            <View style={[styles.transcriptBadge, { backgroundColor: "rgba(16,185,129,0.8)" }]}>
              <Feather name="mic" size={10} color="#FFFFFF" />
              <ThemedText style={styles.transcriptBadgeText}>
                Transcribing
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.visitInfoBadge, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
            <ThemedText style={styles.visitInfoText} numberOfLines={1}>
              {formatVisitType(visit.visitType)}
            </ThemedText>
          </View>
        </View>
      </Animated.View>

      {showTranscript ? (
        <Animated.View
          entering={FadeInDown}
          style={[styles.transcriptPanel, { backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.85)", bottom: 100 + insets.bottom }]}
        >
          <View style={styles.notesPanelHeader}>
            <View style={styles.transcriptTitleRow}>
              <Feather name="mic" size={16} color="#10B981" />
              <ThemedText style={[styles.notesPanelTitle, { color: "#FFFFFF" }]}>
                Live Transcript
              </ThemedText>
            </View>
            <Pressable onPress={handleToggleTranscript} testID="button-close-transcript" accessibilityRole="button" accessibilityLabel="Close transcript">
              <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptScrollContent}>
            {transcriptEntries.length > 0 ? (
              transcriptEntries.map((entry) => (
                <View key={entry.id} style={styles.transcriptEntry}>
                  <View style={styles.transcriptSpeakerRow}>
                    <View
                      style={[
                        styles.speakerBadge,
                        {
                          backgroundColor:
                            entry.speaker === "provider"
                              ? "#3B82F620"
                              : "#10B98120",
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.speakerText,
                          {
                            color:
                              entry.speaker === "provider"
                                ? "#3B82F6"
                                : "#10B981",
                          },
                        ]}
                      >
                        {entry.speaker === "provider" ? "Provider" : "Patient"}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.transcriptTimestamp}>
                      {formatTimer(entry.timestamp)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.transcriptText}>
                    {entry.text}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={styles.transcriptEmpty}>
                Transcript will appear as the conversation progresses...
              </ThemedText>
            )}
          </ScrollView>
          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Add note..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={manualTranscriptInput}
              onChangeText={setManualTranscriptInput}
              onSubmitEditing={handleAddManualEntry}
              returnKeyType="send"
              testID="input-manual-transcript"
              accessibilityLabel="Add note to transcript"
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={handleAddManualEntry}
              testID="button-send-transcript"
              accessibilityRole="button"
              accessibilityLabel="Send transcript note"
            >
              <Feather name="send" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {showNotes ? (
        <Animated.View
          entering={FadeInDown}
          style={[styles.notesPanel, { backgroundColor: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.8)", bottom: 100 + insets.bottom }]}
        >
          <View style={styles.notesPanelHeader}>
            <ThemedText style={[styles.notesPanelTitle, { color: "#FFFFFF" }]}>
              Visit Notes
            </ThemedText>
            <Pressable onPress={handleToggleNotes} testID="button-close-notes" accessibilityRole="button" accessibilityLabel="Close notes">
              <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <TextInput
            style={[styles.notesInput, { color: "#FFFFFF", borderColor: "rgba(255,255,255,0.2)" }]}
            placeholder="Type notes during the call..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={visitNotes}
            onChangeText={setVisitNotes}
            multiline
            numberOfLines={4}
            testID="input-visit-notes"
            accessibilityLabel="Visit notes"
          />
        </Animated.View>
      ) : null}

      {showChat ? (
        <Animated.View
          entering={FadeInDown}
          style={[styles.chatPanel, { backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.85)", bottom: 100 + insets.bottom }]}
        >
          <View style={styles.notesPanelHeader}>
            <View style={styles.transcriptTitleRow}>
              <Feather name="lock" size={14} color="#10B981" />
              <ThemedText style={[styles.notesPanelTitle, { color: "#FFFFFF" }]}>
                Encrypted Chat
              </ThemedText>
              <View style={[styles.e2eBadge, { backgroundColor: "#10B98120" }]}>
                <ThemedText style={styles.e2eBadgeText}>E2E</ThemedText>
              </View>
            </View>
            <Pressable onPress={handleToggleChat} testID="button-close-chat" accessibilityRole="button" accessibilityLabel="Close chat">
              <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <ScrollView
            ref={chatScrollRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatScrollContent}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {chatMessagesQuery.data && chatMessagesQuery.data.length > 0 ? (
              chatMessagesQuery.data.map((msg) => (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    msg.senderRole === "patient"
                      ? { alignSelf: "flex-end", backgroundColor: theme.primary }
                      : { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)" },
                  ]}
                >
                  {msg.senderRole !== "patient" ? (
                    <ThemedText style={styles.chatSenderLabel}>Provider</ThemedText>
                  ) : null}
                  <ThemedText style={[styles.chatBubbleText, { color: "#FFFFFF" }]}>
                    {msg.message}
                  </ThemedText>
                  <ThemedText style={styles.chatTimestamp}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={styles.chatEmpty}>
                Send an encrypted message to your provider...
              </ThemedText>
            )}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendChat}
              returnKeyType="send"
              testID="input-chat-message"
              accessibilityLabel="Type a message"
            />
            <Pressable
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={handleSendChat}
              disabled={sendChatMutation.isPending}
              testID="button-send-chat"
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: sendChatMutation.isPending }}
            >
              {sendChatMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={14} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {showSharedDocs ? (
        <Animated.View
          entering={FadeInDown}
          style={[styles.sharedDocsPanel, { backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.85)", bottom: 100 + insets.bottom }]}
        >
          <View style={styles.notesPanelHeader}>
            <View style={styles.transcriptTitleRow}>
              <Feather name="monitor" size={16} color="#8B5CF6" />
              <ThemedText style={[styles.notesPanelTitle, { color: "#FFFFFF" }]}>
                Shared Documents
              </ThemedText>
            </View>
            <Pressable onPress={handleToggleSharedDocs} testID="button-close-shared-docs" accessibilityRole="button" accessibilityLabel="Close shared documents">
              <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <ScrollView style={styles.sharedDocsScroll} contentContainerStyle={styles.sharedDocsScrollContent}>
            {sharedDocsQuery.data && sharedDocsQuery.data.length > 0 ? (
              sharedDocsQuery.data.map((doc) => (
                <View key={doc.id} style={styles.sharedDocItem}>
                  <View style={styles.sharedDocIcon}>
                    <Feather
                      name={doc.documentType === "image" ? "image" : doc.documentType === "lab_result" ? "activity" : "file"}
                      size={18}
                      color="#8B5CF6"
                    />
                  </View>
                  <View style={styles.sharedDocInfo}>
                    <ThemedText style={styles.sharedDocTitle}>{doc.title}</ThemedText>
                    <ThemedText style={styles.sharedDocMeta}>
                      {doc.sharedByRole === "provider" ? "From provider" : "Shared by you"} - {new Date(doc.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText style={styles.chatEmpty}>
                No documents shared yet during this visit.
              </ThemedText>
            )}
          </ScrollView>
          <View style={styles.shareActionsRow}>
            <Pressable
              style={[styles.shareActionButton, { backgroundColor: "rgba(139,92,246,0.2)" }]}
              onPress={() => handleShareDocument("image", "Medical Image")}
              testID="button-share-image"
              accessibilityRole="button"
              accessibilityLabel="Share image"
            >
              <Feather name="image" size={16} color="#8B5CF6" />
              <ThemedText style={styles.shareActionText}>Image</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.shareActionButton, { backgroundColor: "rgba(139,92,246,0.2)" }]}
              onPress={() => handleShareDocument("document", "Medical Document")}
              testID="button-share-document"
              accessibilityRole="button"
              accessibilityLabel="Share document"
            >
              <Feather name="file-text" size={16} color="#8B5CF6" />
              <ThemedText style={styles.shareActionText}>Document</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.shareActionButton, { backgroundColor: "rgba(139,92,246,0.2)" }]}
              onPress={() => handleShareDocument("lab_result", "Lab Result")}
              testID="button-share-lab"
              accessibilityRole="button"
              accessibilityLabel="Share lab result"
            >
              <Feather name="activity" size={16} color="#8B5CF6" />
              <ThemedText style={styles.shareActionText}>Lab</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {isRecording ? (
        <Animated.View
          entering={FadeIn}
          style={[styles.recordingIndicator, { top: insets.top + Spacing.sm + 36 }]}
        >
          <View style={styles.recordingDot} />
          <ThemedText style={styles.recordingText}>REC</ThemedText>
          <Feather name="lock" size={10} color="#FFFFFF" />
        </Animated.View>
      ) : null}

      <View style={[styles.controlsBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.controlsRow}>
          <Pressable
            style={[
              styles.controlButton,
              { backgroundColor: isMuted ? theme.error : "rgba(255,255,255,0.2)" },
            ]}
            onPress={handleToggleMute}
            testID="button-mute"
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
            accessibilityState={{ selected: isMuted }}
          >
            <Feather name={isMuted ? "mic-off" : "mic"} size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              { backgroundColor: !isCameraOn ? theme.error : "rgba(255,255,255,0.2)" },
            ]}
            onPress={handleToggleCamera}
            testID="button-camera"
            accessibilityRole="button"
            accessibilityLabel={isCameraOn ? "Turn off camera" : "Turn on camera"}
            accessibilityState={{ selected: !isCameraOn }}
          >
            <Feather name={isCameraOn ? "video" : "video-off"} size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
            testID="button-end-call"
            accessibilityRole="button"
            accessibilityLabel="End call"
          >
            <Feather name="phone-off" size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              { backgroundColor: showChat ? "#10B981" : "rgba(255,255,255,0.2)" },
            ]}
            onPress={handleToggleChat}
            testID="button-chat"
            accessibilityRole="button"
            accessibilityLabel={showChat ? "Hide chat" : "Show chat"}
            accessibilityState={{ selected: showChat }}
          >
            <Feather name="message-circle" size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[
              styles.controlButton,
              { backgroundColor: showSharedDocs ? "#8B5CF6" : "rgba(255,255,255,0.2)" },
            ]}
            onPress={handleToggleSharedDocs}
            testID="button-screen-share"
            accessibilityRole="button"
            accessibilityLabel={showSharedDocs ? "Hide shared documents" : "Show shared documents"}
            accessibilityState={{ selected: showSharedDocs }}
          >
            <Feather name="monitor" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.controlsRowSecondary}>
          <Pressable
            style={[
              styles.controlButtonSmall,
              { backgroundColor: showTranscript ? "#10B981" : "rgba(255,255,255,0.15)" },
            ]}
            onPress={handleToggleTranscript}
            testID="button-transcript"
            accessibilityRole="button"
            accessibilityLabel={showTranscript ? "Hide transcript" : "Show transcript"}
            accessibilityState={{ selected: showTranscript }}
          >
            <Feather name="file-text" size={16} color="#FFFFFF" />
          </Pressable>

          <Pressable
            style={[
              styles.controlButtonSmall,
              { backgroundColor: showNotes ? theme.primary : "rgba(255,255,255,0.15)" },
            ]}
            onPress={handleToggleNotes}
            testID="button-notes"
            accessibilityRole="button"
            accessibilityLabel={showNotes ? "Hide notes" : "Show notes"}
            accessibilityState={{ selected: showNotes }}
          >
            <Feather name="edit-3" size={16} color="#FFFFFF" />
          </Pressable>

          {recordingConsent ? (
            <Pressable
              style={[
                styles.controlButtonSmall,
                { backgroundColor: isRecording ? "#EF4444" : "rgba(255,255,255,0.15)" },
              ]}
              onPress={handleToggleRecording}
              disabled={startRecordingMutation.isPending || stopRecordingMutation.isPending}
              testID="button-recording"
              accessibilityRole="button"
              accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
              accessibilityState={{ selected: isRecording }}
            >
              <Feather name="disc" size={16} color={isRecording ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  backButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backButtonTextAlt: {
    fontSize: 16,
    fontWeight: "600",
  },
  closeButton: {
    alignSelf: "flex-start",
    marginBottom: Spacing.lg,
    padding: Spacing.sm,
  },
  precallContent: {
    paddingHorizontal: Spacing.xl,
  },
  precallHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  videoIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  precallTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  precallSubtitle: {
    fontSize: 15,
    textAlign: "center",
  },
  visitCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  visitCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  visitCardInfo: {
    flex: 1,
  },
  visitLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  visitValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  aiBadge: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  aiBadgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  aiBadgeSubtext: {
    fontSize: 12,
    lineHeight: 18,
    width: "100%",
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  joinButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  joinButtonText: {
    fontSize: 17,
    fontWeight: "700",
  },
  waitingContent: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  waitingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  waitingPulse: {
    marginBottom: Spacing["2xl"],
  },
  waitingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  waitingTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  waitingSubtitle: {
    fontSize: 15,
    marginBottom: Spacing["2xl"],
  },
  waitingInfoCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  waitingInfoText: {
    fontSize: 14,
    fontWeight: "500",
  },
  cancelWaitButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  cancelWaitText: {
    fontSize: 15,
    fontWeight: "600",
  },
  providerArea: {
    flex: 1,
  },
  providerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  providerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  providerNameCall: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  providerSpecialtyCall: {
    fontSize: 14,
  },
  selfCameraContainer: {
    position: "absolute",
    right: Spacing.md,
    width: 110,
    height: 150,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  camera: {
    flex: 1,
  },
  cameraOff: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  transcriptBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  transcriptBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  visitInfoBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    maxWidth: 120,
  },
  visitInfoText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
  },
  transcriptPanel: {
    position: "absolute",
    left: Spacing.sm,
    right: Spacing.sm,
    maxHeight: 280,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  transcriptScroll: {
    maxHeight: 160,
  },
  transcriptScrollContent: {
    paddingBottom: Spacing.sm,
  },
  transcriptEntry: {
    marginBottom: Spacing.md,
  },
  transcriptSpeakerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  speakerBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  speakerText: {
    fontSize: 10,
    fontWeight: "700",
  },
  transcriptTimestamp: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
  },
  transcriptText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 19,
  },
  transcriptEmpty: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
  manualInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: Spacing.sm,
  },
  manualInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  transcriptTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  notesPanel: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  notesPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  notesPanelTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  endCallButton: {
    backgroundColor: "#EF4444",
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  postcallContent: {
    paddingHorizontal: Spacing.xl,
  },
  postcallHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  completedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  postcallTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  postcallSubtitle: {
    fontSize: 15,
  },
  summaryCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  subsectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
  },
  tabBar: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  transcriptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  transcriptFullText: {
    fontSize: 14,
    lineHeight: 22,
  },
  highlightedTerm: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  highlightedTermText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 22,
  },
  termLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  termTooltip: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  termTooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  termCategoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  termCategoryText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  termName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  termDefinition: {
    fontSize: 13,
    lineHeight: 19,
  },
  soapSection: {
    marginBottom: Spacing.lg,
  },
  soapHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  soapBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  soapBadgeText: {
    fontSize: 14,
    fontWeight: "800",
  },
  soapTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  soapText: {
    fontSize: 13,
    lineHeight: 20,
    paddingLeft: 36,
  },
  applyNotesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  applyNotesText: {
    fontSize: 14,
    fontWeight: "600",
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyAINotes: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  topicsSection: {
    marginBottom: Spacing.lg,
  },
  topicsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  topicChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionsSection: {
    marginBottom: Spacing.lg,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  followUpSection: {
    marginBottom: Spacing.md,
  },
  followUpText: {
    fontSize: 13,
    lineHeight: 20,
  },
  termListItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  termListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  termListName: {
    fontSize: 14,
    fontWeight: "600",
  },
  termListDefinition: {
    fontSize: 12,
    lineHeight: 17,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    gap: Spacing.sm,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: Spacing.md,
  },
  submitRatingButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  submitRatingText: {
    fontSize: 15,
    fontWeight: "600",
  },
  ratingSuccess: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: Spacing.md,
  },
  doneButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  doneButtonText: {
    fontSize: 17,
    fontWeight: "700",
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  permissionButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  webFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
    gap: Spacing.lg,
  },
  webFallbackTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  webFallbackText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  recordingConsentCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  recordingConsentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recordingConsentTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  recordingConsentDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  recordingConsentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  recordingConsentText: {
    fontSize: 14,
    fontWeight: "500",
  },
  chatPanel: {
    position: "absolute",
    left: Spacing.sm,
    right: Spacing.sm,
    maxHeight: 320,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  chatScroll: {
    maxHeight: 200,
  },
  chatScrollContent: {
    paddingBottom: Spacing.sm,
  },
  chatBubble: {
    maxWidth: "75%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  chatSenderLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 2,
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatTimestamp: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  chatEmpty: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: Spacing.sm,
  },
  chatInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    height: 36,
  },
  e2eBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.xs,
  },
  e2eBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#10B981",
  },
  sharedDocsPanel: {
    position: "absolute",
    left: Spacing.sm,
    right: Spacing.sm,
    maxHeight: 320,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  sharedDocsScroll: {
    maxHeight: 180,
  },
  sharedDocsScrollContent: {
    paddingBottom: Spacing.sm,
  },
  sharedDocItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sharedDocIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(139,92,246,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  sharedDocInfo: {
    flex: 1,
  },
  sharedDocTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  sharedDocMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  shareActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: Spacing.md,
  },
  shareActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  shareActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  recordingIndicator: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.85)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  recordingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  controlsRowSecondary: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  controlButtonSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
