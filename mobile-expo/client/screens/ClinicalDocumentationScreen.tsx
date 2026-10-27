import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { ClinicalNoteSummary } from "@/components/ClinicalNoteSummary";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface ClinicalNote {
  id: string;
  patientId: string;
  noteType: string;
  status: string;
  title: string;
  chiefComplaint?: string;
  assessment?: string;
  plan?: string;
  icdCodes?: Array<{ code: string; description: string }>;
  cptCodes?: Array<{ code: string; description: string }>;
  createdAt: string;
  signedAt?: string;
}

interface AudioTranscript {
  id: string;
  audioFileName: string;
  transcriptionStatus: string;
  keyPointsSummary?: string[];
  createdAt: string;
}

interface PriorAuthRequest {
  id: string;
  requestType: string;
  serviceDescription: string;
  status: string;
  clinicalJustification?: string;
  insurerName?: string;
  createdAt: string;
}

type TabType = "notes" | "transcripts" | "priorAuth";

export default function ClinicalDocumentationScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const { theme: colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("notes");
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);
  const [transcriptDescription, setTranscriptDescription] = useState("");
  const [priorAuthType, setPriorAuthType] = useState("procedure");
  const [serviceDescription, setServiceDescription] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [qualityReports, setQualityReports] = useState<Record<string, any>>({});
  const [assessingNotes, setAssessingNotes] = useState<Set<string>>(new Set());

  const { data: notes, isLoading: notesLoading, refetch: refetchNotes } = useQuery<ClinicalNote[]>({
    queryKey: ["/api/clinical-documentation/notes"],
  });

  const { data: transcripts, isLoading: transcriptsLoading, refetch: refetchTranscripts } = useQuery<AudioTranscript[]>({
    queryKey: ["/api/clinical-documentation/transcripts"],
  });

  const { data: priorAuthRequests, isLoading: priorAuthLoading, refetch: refetchPriorAuth } = useQuery<PriorAuthRequest[]>({
    queryKey: ["/api/clinical-documentation/prior-auth"],
  });

  const createTranscriptMutation = useMutation({
    mutationFn: async (data: { audioDescription: string }) => {
      const response = await fetch("/api/clinical-documentation/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create transcript");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/transcripts"] });
      setShowTranscriptModal(false);
      setTranscriptDescription("");
    },
  });

  const generateNoteMutation = useMutation({
    mutationFn: async (data: { noteType: string; patientContext?: any }) => {
      const response = await fetch("/api/clinical-documentation/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to generate note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes"] });
    },
  });

  const createPriorAuthMutation = useMutation({
    mutationFn: async (data: { requestType: string; serviceDescription: string; patientContext?: any }) => {
      const response = await fetch("/api/clinical-documentation/prior-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create prior auth request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/prior-auth"] });
      setShowPriorAuthModal(false);
      setServiceDescription("");
    },
  });

  const suggestCodesMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/clinical-documentation/notes/${noteId}/suggest-codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to suggest codes");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes"] });
    },
  });

  const signNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/clinical-documentation/notes/${noteId}/sign`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to sign note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-documentation/notes"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchNotes(), refetchTranscripts(), refetchPriorAuth()]);
    setRefreshing(false);
  }, [refetchNotes, refetchTranscripts, refetchPriorAuth]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return colors.warning;
      case "signed":
      case "completed":
      case "approved":
        return colors.success;
      case "pending":
      case "processing":
      case "submitted":
      case "under_review":
        return colors.primary;
      case "denied":
      case "failed":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const handleAssessQuality = useCallback(async (noteId: string, note: ClinicalNote) => {
    setAssessingNotes(prev => new Set(prev).add(noteId));
    try {
      const response = await fetch(`${getApiUrl()}/api/clinical-documentation/assess-quality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteContent: {
            chiefComplaint: note.chiefComplaint || "",
            historyOfPresentIllness: "",
            reviewOfSystems: {},
            physicalExamination: {},
            assessment: note.assessment || "",
            plan: note.plan || "",
          },
        }),
      });
      if (response.ok) {
        const report = await response.json();
        setQualityReports(prev => ({ ...prev, [noteId]: report }));
      }
    } catch (err) {
      console.error("Quality assessment error:", err);
    } finally {
      setAssessingNotes(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  }, []);

  const renderQualityBadge = (score: number) => {
    const badgeColor = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.error;
    const label = score >= 80 ? "High Quality" : score >= 60 ? "Needs Review" : "Incomplete";
    return (
      <View style={[styles.qualityBadge, { backgroundColor: badgeColor + "15", borderColor: badgeColor + "40" }]}>
        <Feather name="award" size={12} color={badgeColor} />
        <ThemedText style={[styles.qualityBadgeText, { color: badgeColor }]}>
          {score}% - {label}
        </ThemedText>
      </View>
    );
  };

  const renderTab = (tab: TabType, label: string, icon: keyof typeof Feather.glyphMap) => (
    <Pressable
      key={tab}
      style={[
        styles.tab,
        { borderBottomColor: activeTab === tab ? colors.primary : "transparent" },
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Feather
        name={icon}
        size={18}
        color={activeTab === tab ? colors.primary : colors.textSecondary}
      />
      <ThemedText
        style={[
          styles.tabText,
          { color: activeTab === tab ? colors.primary : colors.textSecondary },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  const renderNoteCard = (note: ClinicalNote, index: number) => (
    <Animated.View key={note.id} entering={FadeInDown.delay(index * 50)}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Feather name="file-text" size={18} color={colors.primary} />
            <ThemedText style={styles.cardTitle}>{note.title}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(note.status) + "20" }]}>
            <ThemedText style={[styles.statusText, { color: getStatusColor(note.status) }]}>
              {note.status}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardContent}>
          <ThemedText style={[styles.noteType, { color: colors.textSecondary }]}>
            {note.noteType.toUpperCase()} Note
          </ThemedText>
          
          {note.chiefComplaint ? (
            <ThemedText style={[styles.excerpt, { color: colors.text }]} numberOfLines={2}>
              CC: {note.chiefComplaint}
            </ThemedText>
          ) : null}

          {(note.icdCodes && note.icdCodes.length > 0) ? (
            <View style={styles.codesRow}>
              <Feather name="tag" size={14} color={colors.success} />
              <ThemedText style={[styles.codesText, { color: colors.success }]}>
                {note.icdCodes.length} ICD-10 codes
              </ThemedText>
            </View>
          ) : null}

          {(note.cptCodes && note.cptCodes.length > 0) ? (
            <View style={styles.codesRow}>
              <Feather name="hash" size={14} color={colors.primary} />
              <ThemedText style={[styles.codesText, { color: colors.primary }]}>
                {note.cptCodes.length} CPT codes
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          {note.status === "draft" ? (
            <>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.info + "15" }]}
                onPress={() => navigation.navigate("AIDocumentReview", { noteId: note.id })}
                testID={`review-draft-${note.id}`}
              >
                <Feather name="file-text" size={14} color={colors.info} />
                <ThemedText style={[styles.actionText, { color: colors.info }]}>
                  Review
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.success + "15" }]}
                onPress={async () => {
                  await suggestCodesMutation.mutateAsync(note.id);
                  signNoteMutation.mutate(note.id);
                }}
                disabled={suggestCodesMutation.isPending || signNoteMutation.isPending}
                testID={`auto-complete-${note.id}`}
              >
                {suggestCodesMutation.isPending || signNoteMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <Feather name="zap" size={14} color={colors.success} />
                    <ThemedText style={[styles.actionText, { color: colors.success }]}>
                      Auto-Complete
                    </ThemedText>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.primary + "20" }]}
                onPress={() => suggestCodesMutation.mutate(note.id)}
                disabled={suggestCodesMutation.isPending}
              >
                {suggestCodesMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather name="cpu" size={14} color={colors.primary} />
                    <ThemedText style={[styles.actionText, { color: colors.primary }]}>
                      Suggest Codes
                    </ThemedText>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionButton, { backgroundColor: colors.success + "20" }]}
                onPress={() => signNoteMutation.mutate(note.id)}
              >
                <Feather name="check-circle" size={14} color={colors.success} />
                <ThemedText style={[styles.actionText, { color: colors.success }]}>
                  Sign
                </ThemedText>
              </Pressable>
            </>
          ) : null}
          <Pressable
            style={[styles.actionButton, { backgroundColor: `${colors.info}20` }]}
            onPress={() => {
              setExpandedNotes(prev => {
                const next = new Set(prev);
                if (next.has(note.id)) {
                  next.delete(note.id);
                } else {
                  next.add(note.id);
                }
                return next;
              });
            }}
          >
            <Feather name={expandedNotes.has(note.id) ? "chevron-up" : "zap"} size={14} color={colors.info} />
            <ThemedText style={[styles.actionText, { color: colors.info }]}>
              {expandedNotes.has(note.id) ? "Hide Summary" : "AI Summary"}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: `${colors.warning}15` }]}
            onPress={() => handleAssessQuality(note.id, note)}
            disabled={assessingNotes.has(note.id)}
            testID={`quality-assess-${note.id}`}
          >
            {assessingNotes.has(note.id) ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <>
                <Feather name="award" size={14} color={colors.warning} />
                <ThemedText style={[styles.actionText, { color: colors.warning }]}>
                  Quality
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>

        {qualityReports[note.id] ? (
          <View style={[styles.qualityReportContainer, { borderTopColor: colors.border }]}>
            {renderQualityBadge(qualityReports[note.id].overallScore)}
            {(qualityReports[note.id].completenessIndicators || []).length > 0 ? (
              <View style={styles.qualitySection}>
                <ThemedText style={[styles.qualitySectionTitle, { color: colors.text }]}>
                  Completeness
                </ThemedText>
                {qualityReports[note.id].completenessIndicators.slice(0, 4).map((indicator: any, idx: number) => (
                  <View key={idx} style={styles.qualityRow}>
                    <Feather
                      name={indicator.status === "complete" ? "check-circle" : indicator.status === "partial" ? "alert-circle" : "x-circle"}
                      size={12}
                      color={indicator.status === "complete" ? colors.success : indicator.status === "partial" ? colors.warning : colors.error}
                    />
                    <ThemedText style={[styles.qualityRowText, { color: colors.textSecondary }]}>
                      {indicator.section}: {indicator.status}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            {(qualityReports[note.id].improvementSuggestions || []).length > 0 ? (
              <View style={styles.qualitySection}>
                <ThemedText style={[styles.qualitySectionTitle, { color: colors.text }]}>
                  Suggestions
                </ThemedText>
                {qualityReports[note.id].improvementSuggestions.slice(0, 3).map((suggestion: string, idx: number) => (
                  <View key={idx} style={styles.qualityRow}>
                    <Feather name="arrow-right" size={10} color={colors.info} />
                    <ThemedText style={[styles.qualityRowText, { color: colors.textSecondary }]} numberOfLines={2}>
                      {suggestion}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {expandedNotes.has(note.id) ? (
          <ClinicalNoteSummary note={note} theme={colors} />
        ) : null}

        <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
          {new Date(note.createdAt).toLocaleDateString()}
        </ThemedText>
      </Card>
    </Animated.View>
  );

  const renderTranscriptCard = (transcript: AudioTranscript, index: number) => (
    <Animated.View key={transcript.id} entering={FadeInDown.delay(index * 50)}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Feather name="mic" size={18} color={colors.primary} />
            <ThemedText style={styles.cardTitle}>{transcript.audioFileName}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transcript.transcriptionStatus) + "20" }]}>
            <ThemedText style={[styles.statusText, { color: getStatusColor(transcript.transcriptionStatus) }]}>
              {transcript.transcriptionStatus}
            </ThemedText>
          </View>
        </View>

        {transcript.keyPointsSummary && transcript.keyPointsSummary.length > 0 ? (
          <View style={styles.keyPoints}>
            <ThemedText style={[styles.keyPointsLabel, { color: colors.textSecondary }]}>
              Key Points:
            </ThemedText>
            {transcript.keyPointsSummary.slice(0, 3).map((point, i) => (
              <View key={i} style={styles.keyPointRow}>
                <Feather name="check" size={12} color={colors.success} />
                <ThemedText style={[styles.keyPointText, { color: colors.text }]} numberOfLines={1}>
                  {point}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
          {new Date(transcript.createdAt).toLocaleDateString()}
        </ThemedText>
      </Card>
    </Animated.View>
  );

  const renderPriorAuthCard = (request: PriorAuthRequest, index: number) => (
    <Animated.View key={request.id} entering={FadeInDown.delay(index * 50)}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Feather name="shield" size={18} color={colors.primary} />
            <ThemedText style={styles.cardTitle}>{request.requestType}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + "20" }]}>
            <ThemedText style={[styles.statusText, { color: getStatusColor(request.status) }]}>
              {request.status}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardContent}>
          <ThemedText style={[styles.excerpt, { color: colors.text }]} numberOfLines={2}>
            {request.serviceDescription}
          </ThemedText>
          
          {request.insurerName ? (
            <View style={styles.insurerRow}>
              <Feather name="briefcase" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.insurerText, { color: colors.textSecondary }]}>
                {request.insurerName}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {request.clinicalJustification ? (
          <View style={[styles.justificationBox, { backgroundColor: colors.primary + "10" }]}>
            <ThemedText style={[styles.justificationLabel, { color: colors.primary }]}>
              AI-Generated Justification
            </ThemedText>
            <ThemedText style={[styles.justificationText, { color: colors.text }]} numberOfLines={3}>
              {request.clinicalJustification}
            </ThemedText>
          </View>
        ) : null}

        <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
          {new Date(request.createdAt).toLocaleDateString()}
        </ThemedText>
      </Card>
    </Animated.View>
  );

  const isLoading = notesLoading || transcriptsLoading || priorAuthLoading;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn}>
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: colors.text }]}>
              Clinical Documentation
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              AI-powered clinical notes, transcription & prior auth
            </ThemedText>
          </View>

          <Pressable
            testID="button-ai-soap-note"
            style={[styles.soapNoteButton, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}
            onPress={() => navigation.navigate("AISOAPNote")}
          >
            <View style={[styles.soapNoteIcon, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="cpu" size={18} color={colors.primary} />
            </View>
            <View style={styles.soapNoteTextCol}>
              <ThemedText style={[styles.soapNoteTitle, { color: colors.primary }]}>AI SOAP Note Creator</ThemedText>
              <ThemedText style={[styles.soapNoteDesc, { color: colors.textSecondary }]}>
                Input notes, auto-categorize into SOAP, extract entities & codes
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </Pressable>

          <Pressable
            testID="button-automated-data-entry"
            style={[styles.soapNoteButton, { backgroundColor: colors.success + "12", borderColor: colors.success + "30" }]}
            onPress={() => navigation.navigate("AutomatedDataEntry")}
          >
            <View style={[styles.soapNoteIcon, { backgroundColor: colors.success + "20" }]}>
              <Feather name="zap" size={18} color={colors.success} />
            </View>
            <View style={styles.soapNoteTextCol}>
              <ThemedText style={[styles.soapNoteTitle, { color: colors.success }]}>Automated Data Entry</ThemedText>
              <ThemedText style={[styles.soapNoteDesc, { color: colors.textSecondary }]}>
                AI pre-fills documents from clinical events & triggers
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={colors.success} />
          </Pressable>

          <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
            {renderTab("notes", "Notes", "file-text")}
            {renderTab("transcripts", "Transcripts", "mic")}
            {renderTab("priorAuth", "Prior Auth", "shield")}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <View style={styles.content}>
              {activeTab === "notes" && (
                <>
                  <View style={styles.quickActions}>
                    <ThemedText style={[styles.quickActionsLabel, { color: colors.textSecondary }]}>
                      Quick Generate:
                    </ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
                      {[
                        { type: "soap", label: "SOAP", icon: "file-text" as const },
                        { type: "progress", label: "Progress", icon: "trending-up" as const },
                        { type: "consultation", label: "Consult", icon: "users" as const },
                        { type: "follow_up", label: "Follow-Up", icon: "repeat" as const },
                      ].map((item) => (
                        <Pressable
                          key={item.type}
                          style={[styles.quickActionButton, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}
                          onPress={() => {
                            generateNoteMutation.mutate({ noteType: item.type });
                          }}
                          disabled={generateNoteMutation.isPending}
                          testID={`quick-generate-${item.type}`}
                        >
                          <Feather name={item.icon} size={14} color={colors.primary} />
                          <ThemedText style={[styles.quickActionText, { color: colors.primary }]}>
                            {item.label}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                  {notes && notes.length > 0 ? (
                    notes.map((note, index) => renderNoteCard(note, index))
                  ) : (
                    <Card style={styles.emptyCard}>
                      <Feather name="file-text" size={40} color={colors.textSecondary} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No clinical notes yet
                      </ThemedText>
                    </Card>
                  )}
                </>
              )}

              {activeTab === "transcripts" && (
                <>
                  <Pressable
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowTranscriptModal(true)}
                  >
                    <Feather name="mic" size={18} color="#fff" />
                    <ThemedText style={styles.addButtonText}>New Transcription</ThemedText>
                  </Pressable>
                  {transcripts && transcripts.length > 0 ? (
                    transcripts.map((transcript, index) => renderTranscriptCard(transcript, index))
                  ) : (
                    <Card style={styles.emptyCard}>
                      <Feather name="mic-off" size={40} color={colors.textSecondary} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No transcripts yet
                      </ThemedText>
                    </Card>
                  )}
                </>
              )}

              {activeTab === "priorAuth" && (
                <>
                  <Pressable
                    style={[styles.addButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowPriorAuthModal(true)}
                  >
                    <Feather name="shield" size={18} color="#fff" />
                    <ThemedText style={styles.addButtonText}>New Prior Auth Request</ThemedText>
                  </Pressable>
                  {priorAuthRequests && priorAuthRequests.length > 0 ? (
                    priorAuthRequests.map((request, index) => renderPriorAuthCard(request, index))
                  ) : (
                    <Card style={styles.emptyCard}>
                      <Feather name="shield-off" size={40} color={colors.textSecondary} />
                      <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No prior auth requests yet
                      </ThemedText>
                    </Card>
                  )}
                </>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Transcript Modal */}
      <Modal
        visible={showTranscriptModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTranscriptModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundRootDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                New Transcription
              </ThemedText>
              <Pressable onPress={() => setShowTranscriptModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Describe the conversation or paste transcript:
            </ThemedText>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.backgroundRootDefault + "90", color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., Patient visit for chronic back pain follow-up..."
              placeholderTextColor={colors.textSecondary}
              value={transcriptDescription}
              onChangeText={setTranscriptDescription}
              multiline
              numberOfLines={6}
            />

            <Pressable
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => createTranscriptMutation.mutate({ audioDescription: transcriptDescription })}
              disabled={createTranscriptMutation.isPending || !transcriptDescription.trim()}
            >
              {createTranscriptMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.modalButtonText}>Process with AI</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Prior Auth Modal */}
      <Modal
        visible={showPriorAuthModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPriorAuthModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundRootDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                Prior Authorization Request
              </ThemedText>
              <Pressable onPress={() => setShowPriorAuthModal(false)}>
                <Feather name="x" size={24} color={colors.text} />
              </Pressable>
            </View>
            
            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Request Type:
            </ThemedText>
            <View style={styles.optionsRow}>
              {["procedure", "medication", "imaging", "specialist_referral"].map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.optionButton,
                    { 
                      backgroundColor: priorAuthType === type ? colors.primary : colors.backgroundRootDefault + "90",
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setPriorAuthType(type)}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      { color: priorAuthType === type ? "#fff" : colors.text },
                    ]}
                  >
                    {type.replace("_", " ")}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Service Description:
            </ThemedText>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.backgroundRootDefault + "90", color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., MRI of lumbar spine for evaluation of chronic back pain..."
              placeholderTextColor={colors.textSecondary}
              value={serviceDescription}
              onChangeText={setServiceDescription}
              multiline
              numberOfLines={4}
            />

            <Pressable
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => createPriorAuthMutation.mutate({ 
                requestType: priorAuthType, 
                serviceDescription,
              })}
              disabled={createPriorAuthMutation.isPending || !serviceDescription.trim()}
            >
              {createPriorAuthMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.modalButtonText}>Generate Justification</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    gap: Spacing.xs,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    gap: Spacing.md,
  },
  loader: {
    paddingVertical: Spacing["2xl"],
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  card: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardContent: {
    gap: Spacing.xs,
  },
  noteType: {
    fontSize: 11,
    fontWeight: "600",
  },
  excerpt: {
    fontSize: 14,
    lineHeight: 20,
  },
  codesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  codesText: {
    fontSize: 12,
    fontWeight: "500",
  },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  timestamp: {
    fontSize: 11,
    marginTop: Spacing.xs,
  },
  keyPoints: {
    gap: Spacing.xs,
  },
  keyPointsLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  keyPointRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  keyPointText: {
    fontSize: 13,
    flex: 1,
  },
  insurerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  insurerText: {
    fontSize: 12,
  },
  justificationBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  justificationLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  justificationText: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: Spacing.lg,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  modalButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  quickActions: {
    marginBottom: Spacing.md,
  },
  quickActionsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickActionsScroll: {
    gap: Spacing.sm,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 6,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  soapNoteButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  soapNoteIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  soapNoteTextCol: {
    flex: 1,
  },
  soapNoteTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  soapNoteDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  qualityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  qualityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  qualityReportContainer: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  qualitySection: {
    marginTop: Spacing.xs,
  },
  qualitySectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 2,
  },
  qualityRowText: {
    fontSize: 11,
    flex: 1,
  },
});
