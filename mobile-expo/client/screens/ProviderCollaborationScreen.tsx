import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  RefreshControl,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface CaseSummary {
  id: string;
  specialtyType: string;
  chiefComplaint: string;
  status: string;
  aiSummary: string | null;
  aiKeyFindings: string[] | null;
  aiRecommendations: string[] | null;
  createdAt: string;
}

interface ResearchRecommendation {
  id: string;
  queryContext: string;
  recommendations: Array<{
    title: string;
    authors: string[];
    journal: string;
    year: number;
    abstract: string;
    relevanceScore: number;
    relevanceReason: string;
    keyFindings: string[];
  }>;
  searchTerms: string[];
  createdAt: string;
}

interface ProviderCommunication {
  id: string;
  communicationType: string;
  subject: string | null;
  draftContent: string | null;
  status: string;
  createdAt: string;
}

interface AiCaseReview {
  id: string;
  providerId: string;
  title: string;
  specialty: string | null;
  anonymizedData: object;
  aiAnalysis: object | null;
  clinicalTrialMatches: object | null;
  secondOpinion: object | null;
  status: string;
  requestType: string;
  createdAt: string;
  updatedAt: string;
}

interface ProviderMessageThread {
  id: string;
  subject: string;
  type: string;
  priority: string;
  status: string;
  participants: string[];
  messageCount: number;
  lastMessageAt: string;
  aiSummary: object | null;
  createdAt: string;
}

interface ProviderMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  messageType: string;
  readBy: string[];
  createdAt: string;
}

interface CaseSummaryResult {
  caseSummary: {
    id: string;
    aiSummary: string;
    keyFindings: string[];
    recommendations: string[];
    historyOfPresentIllness: string;
    clinicalAssessment: string;
    suggestedQuestions: string[];
  };
}

interface ResearchResult {
  recommendations: Array<{
    title: string;
    authors: string[];
    journal: string;
    year: number;
    abstract: string;
    relevanceScore: number;
    relevanceReason: string;
    keyFindings: string[];
    clinicalImplications: string[];
  }>;
  searchTerms: string[];
  evidenceLevel: string;
}

interface CommunicationResult {
  communication: {
    id: string;
    draftContent: string;
    subject: string;
    keyPoints: string[];
    suggestedEdits: string[];
  };
}

type TabType = "case-summaries" | "research" | "communications" | "ai-reviews" | "threads";

const SPECIALTY_TYPES = [
  "Cardiology",
  "Endocrinology",
  "Gastroenterology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Pulmonology",
  "Rheumatology",
  "Orthopedics",
  "Dermatology",
];

const COMMUNICATION_TYPES = [
  { value: "referral", label: "Referral Letter" },
  { value: "consultation_response", label: "Consultation Response" },
  { value: "care_coordination", label: "Care Coordination" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "follow_up", label: "Follow-up Note" },
  { value: "curbside_consult", label: "Curbside Consult" },
];

export default function ProviderCollaborationScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { checkFeature, promptProps } = useFeatureGate();
  
  const [activeTab, setActiveTab] = useState<TabType>("case-summaries");
  const [showCaseSummaryModal, setShowCaseSummaryModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const [specialtyType, setSpecialtyType] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<"routine" | "urgent" | "emergent">("routine");
  const [specificQuestions, setSpecificQuestions] = useState("");
  
  const [researchQuery, setResearchQuery] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  
  const [communicationType, setCommunicationType] = useState("");
  const [communicationSubject, setCommunicationSubject] = useState("");
  const [toProvider, setToProvider] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  
  const [showAiReviewModal, setShowAiReviewModal] = useState(false);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AiCaseReview | null>(null);
  const [selectedThread, setSelectedThread] = useState<ProviderMessageThread | null>(null);
  
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewSpecialty, setReviewSpecialty] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [reviewChiefComplaint, setReviewChiefComplaint] = useState("");
  const [clinicalHistory, setClinicalHistory] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  
  const [threadSubject, setThreadSubject] = useState("");
  const [threadType, setThreadType] = useState("discussion");
  const [threadPriority, setThreadPriority] = useState("normal");
  const [newMessage, setNewMessage] = useState("");

  const { data: caseSummaries = [], isLoading: loadingCaseSummaries } = useQuery<CaseSummary[]>({
    queryKey: ["/api/provider-collaboration/case-summaries"],
    enabled: activeTab === "case-summaries",
  });

  const { data: researchRecommendations = [], isLoading: loadingResearch } = useQuery<ResearchRecommendation[]>({
    queryKey: ["/api/provider-collaboration/research"],
    enabled: activeTab === "research",
  });

  const { data: communications = [], isLoading: loadingCommunications } = useQuery<ProviderCommunication[]>({
    queryKey: ["/api/provider-collaboration/communications"],
    enabled: activeTab === "communications",
  });

  const { data: aiReviews = [], isLoading: loadingAiReviews } = useQuery<AiCaseReview[]>({
    queryKey: ["/api/case-reviews"],
    enabled: activeTab === "ai-reviews",
  });

  const { data: messageThreads = [], isLoading: loadingThreads } = useQuery<ProviderMessageThread[]>({
    queryKey: ["/api/provider-threads"],
    enabled: activeTab === "threads",
  });

  const { data: threadMessages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery<ProviderMessage[]>({
    queryKey: ["/api/provider-threads", selectedThread?.id, "messages"],
    queryFn: async () => {
      if (!selectedThread) return [];
      const response = await axiosInstance.get(`/api/provider-threads/${selectedThread.id}/messages`);
      return response.data;
    },
    enabled: !!selectedThread,
  });

  const createAiReviewMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/api/case-reviews", {
        title: reviewTitle,
        specialty: reviewSpecialty,
        anonymizedData: {
          demographics: { ageRange: patientAge, gender: patientGender },
          chiefComplaint: reviewChiefComplaint,
          clinicalHistory,
          currentMedications: currentMedications.split("\n").filter(m => m.trim()).map(m => ({ name: m.trim(), dosage: "", frequency: "" })),
          allergies: [],
          labResults: [],
          imagingResults: [],
          vitalSigns: [],
        },
        requestType: "full_analysis",
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-reviews"] });
      setShowAiReviewModal(false);
      resetAiReviewForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const analyzeReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await axiosInstance.post(`/api/case-reviews/${reviewId}/analyze`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-reviews"] });
      setSelectedReview(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const matchTrialsMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await axiosInstance.post(`/api/case-reviews/${reviewId}/trials`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-reviews"] });
      setSelectedReview(data);
    },
  });

  const secondOpinionMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const response = await axiosInstance.post(`/api/case-reviews/${reviewId}/second-opinion`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/case-reviews"] });
      setSelectedReview(data);
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/api/provider-threads", {
        subject: threadSubject,
        type: threadType,
        priority: threadPriority,
        participants: [],
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-threads"] });
      setShowThreadModal(false);
      setSelectedThread(data);
      resetThreadForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThread || !newMessage.trim()) return;
      const response = await axiosInstance.post(`/api/provider-threads/${selectedThread.id}/messages`, {
        content: newMessage,
        messageType: "message",
      });
      return response.data;
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
    },
  });

  const summarizeThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const response = await axiosInstance.post(`/api/provider-threads/${threadId}/summarize`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-threads"] });
      setSelectedThread(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetAiReviewForm = () => {
    setReviewTitle("");
    setReviewSpecialty("");
    setPatientAge("");
    setPatientGender("");
    setReviewChiefComplaint("");
    setClinicalHistory("");
    setCurrentMedications("");
  };

  const resetThreadForm = () => {
    setThreadSubject("");
    setThreadType("discussion");
    setThreadPriority("normal");
  };

  const generateCaseSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post<CaseSummaryResult>("/api/provider-collaboration/case-summaries/generate", {
        specialtyType,
        chiefComplaint,
        urgencyLevel,
        specificQuestions: specificQuestions ? specificQuestions.split("\n").filter(q => q.trim()) : [],
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/case-summaries"] });
      setShowCaseSummaryModal(false);
      setCurrentResult(data.caseSummary);
      setShowResultModal(true);
      resetCaseSummaryForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const suggestResearchMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post<ResearchResult>("/api/provider-collaboration/research/suggest", {
        queryContext: researchQuery,
        focusAreas: focusAreas ? focusAreas.split(",").map(a => a.trim()) : [],
        maxResults: 5,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/research"] });
      setShowResearchModal(false);
      setCurrentResult({ type: "research", ...data });
      setShowResultModal(true);
      setResearchQuery("");
      setFocusAreas("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const draftCommunicationMutation = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post<CommunicationResult>("/api/provider-collaboration/communications/draft", {
        communicationType,
        subject: communicationSubject,
        toProvider,
        keyPoints: keyPoints ? keyPoints.split("\n").filter(p => p.trim()) : [],
        tone: "professional",
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration/communications"] });
      setShowCommunicationModal(false);
      setCurrentResult({ type: "communication", ...data.communication });
      setShowResultModal(true);
      resetCommunicationForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetCaseSummaryForm = () => {
    setSpecialtyType("");
    setChiefComplaint("");
    setUrgencyLevel("routine");
    setSpecificQuestions("");
  };

  const resetCommunicationForm = () => {
    setCommunicationType("");
    setCommunicationSubject("");
    setToProvider("");
    setKeyPoints("");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/provider-collaboration"] });
    setRefreshing(false);
  }, [queryClient]);

  const getTabIcon = (tab: TabType): any => {
    switch (tab) {
      case "case-summaries": return "file-text";
      case "research": return "book-open";
      case "communications": return "mail";
      case "ai-reviews": return "cpu";
      case "threads": return "message-circle";
      default: return "file";
    }
  };

  const getTabLabel = (tab: TabType): string => {
    switch (tab) {
      case "case-summaries": return "Cases";
      case "research": return "Research";
      case "communications": return "Drafts";
      case "ai-reviews": return "AI Reviews";
      case "threads": return "Threads";
      default: return tab;
    }
  };

  const renderTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={[styles.tabsContainer, { backgroundColor: colors.backgroundRootDefault }]}
      contentContainerStyle={styles.tabsContent}
    >
      {(["case-summaries", "research", "communications", "ai-reviews", "threads"] as TabType[]).map((tab) => (
        <Pressable
          key={tab}
          style={[
            styles.tab,
            activeTab === tab && { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => {
            setActiveTab(tab);
            setSelectedReview(null);
            setSelectedThread(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          accessibilityRole="tab"
          accessibilityLabel={getTabLabel(tab)}
          accessibilityState={{ selected: activeTab === tab }}
        >
          <Feather
            name={getTabIcon(tab)}
            size={18}
            color={activeTab === tab ? colors.primary : colors.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === tab ? colors.primary : colors.textSecondary },
            ]}
          >
            {getTabLabel(tab)}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderCaseSummaries = () => (
    <View style={styles.section}>
      <Pressable
        style={[styles.generateButton, { backgroundColor: colors.primary }]}
        onPress={() => { if (!checkFeature("cds")) return; setShowCaseSummaryModal(true); }}
        accessibilityRole="button"
        accessibilityLabel="Generate Case Summary"
      >
        <Feather name="plus" size={20} color="#fff" />
        <ThemedText style={styles.generateButtonText}>Generate Case Summary</ThemedText>
      </Pressable>

      {loadingCaseSummaries ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : caseSummaries.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="file-text" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Case Summaries</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Generate AI-powered case summaries for specialist consultations
          </ThemedText>
        </View>
      ) : (
        caseSummaries.map((summary, index) => (
          <Animated.View
            key={summary.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: colors.primary }]}>
                  {summary.specialtyType}
                </ThemedText>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: summary.status === "draft" ? colors.warning + "20" : colors.success + "20" }
              ]}>
                <ThemedText style={[
                  styles.statusBadgeText,
                  { color: summary.status === "draft" ? colors.warning : colors.success }
                ]}>
                  {summary.status}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
              {summary.chiefComplaint}
            </ThemedText>
            {summary.aiSummary ? (
              <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={3}>
                {summary.aiSummary}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
              {new Date(summary.createdAt).toLocaleDateString()}
            </ThemedText>
          </Animated.View>
        ))
      )}
    </View>
  );

  const renderResearch = () => (
    <View style={styles.section}>
      <Pressable
        style={[styles.generateButton, { backgroundColor: colors.primary }]}
        onPress={() => { if (!checkFeature("cds")) return; setShowResearchModal(true); }}
        accessibilityRole="button"
        accessibilityLabel="Find Research Papers"
      >
        <Feather name="search" size={20} color="#fff" />
        <ThemedText style={styles.generateButtonText}>Find Research Papers</ThemedText>
      </Pressable>

      {loadingResearch ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : researchRecommendations.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="book-open" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Research Yet</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Find relevant medical research papers for your clinical questions
          </ThemedText>
        </View>
      ) : (
        researchRecommendations.map((rec, index) => (
          <Animated.View
            key={rec.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
              {rec.queryContext}
            </ThemedText>
            <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]}>
              {rec.recommendations?.length || 0} papers found
            </ThemedText>
            <View style={styles.tagsContainer}>
              {rec.searchTerms?.slice(0, 3).map((term, i) => (
                <View key={i} style={[styles.tag, { backgroundColor: colors.primaryDark + "20" }]}>
                  <ThemedText style={[styles.tagText, { color: colors.primaryDark }]}>{term}</ThemedText>
                </View>
              ))}
            </View>
            <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
              {new Date(rec.createdAt).toLocaleDateString()}
            </ThemedText>
          </Animated.View>
        ))
      )}
    </View>
  );

  const renderCommunications = () => (
    <View style={styles.section}>
      <Pressable
        style={[styles.generateButton, { backgroundColor: colors.primary }]}
        onPress={() => { if (!checkFeature("cds")) return; setShowCommunicationModal(true); }}
        accessibilityRole="button"
        accessibilityLabel="Draft Communication"
      >
        <Feather name="edit-3" size={20} color="#fff" />
        <ThemedText style={styles.generateButtonText}>Draft Communication</ThemedText>
      </Pressable>

      {loadingCommunications ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : communications.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="mail" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Communications</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Draft professional provider-to-provider communications
          </ThemedText>
        </View>
      ) : (
        communications.map((comm, index) => (
          <Animated.View
            key={comm.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: colors.primaryDark + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: colors.primaryDark }]}>
                  {comm.communicationType.replace(/_/g, " ")}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
              {comm.subject || "Untitled Communication"}
            </ThemedText>
            {comm.draftContent ? (
              <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={3}>
                {comm.draftContent}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
              {new Date(comm.createdAt).toLocaleDateString()}
            </ThemedText>
          </Animated.View>
        ))
      )}
    </View>
  );

  const renderAiReviewDetail = () => {
    if (!selectedReview) return null;
    const analysis = selectedReview.aiAnalysis as any;
    const trials = selectedReview.clinicalTrialMatches as any[] | null;
    const opinion = selectedReview.secondOpinion as any;
    
    return (
      <View style={styles.section}>
        <Pressable 
          style={[styles.backButton, { backgroundColor: colors.backgroundRootDefault }]}
          onPress={() => setSelectedReview(null)}
          accessibilityRole="button"
          accessibilityLabel="Back to Reviews"
        >
          <Feather name="arrow-left" size={20} color={colors.primary} />
          <ThemedText style={[styles.backText, { color: colors.primary }]}>Back to Reviews</ThemedText>
        </Pressable>
        
        <View style={[styles.detailCard, { backgroundColor: colors.backgroundRootDefault }]}>
          <ThemedText style={[styles.detailTitle, { color: colors.text }]}>{selectedReview.title}</ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: selectedReview.status === "completed" ? colors.success + "20" : colors.warning + "20" }]}>
            <ThemedText style={[styles.statusBadgeText, { color: selectedReview.status === "completed" ? colors.success : colors.warning }]}>
              {selectedReview.status}
            </ThemedText>
          </View>
        </View>
        
        {selectedReview.status === "pending" ? (
          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => analyzeReviewMutation.mutate(selectedReview.id)}
            disabled={analyzeReviewMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Analyze with AI"
            accessibilityState={{ disabled: analyzeReviewMutation.isPending }}
          >
            {analyzeReviewMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="zap" size={18} color="#fff" />
                <ThemedText style={styles.actionButtonText}>Analyze with AI</ThemedText>
              </>
            )}
          </Pressable>
        ) : null}
        
        {analysis ? (
          <>
            <View style={[styles.analysisSection, { backgroundColor: colors.backgroundRootDefault }]}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Summary</ThemedText>
              <ThemedText style={[styles.analysisText, { color: colors.textSecondary }]}>{analysis.summary}</ThemedText>
            </View>
            
            {analysis.potentialDiagnoses?.length > 0 ? (
              <View style={[styles.analysisSection, { backgroundColor: colors.backgroundRootDefault }]}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Potential Diagnoses</ThemedText>
                {analysis.potentialDiagnoses.map((dx: any, idx: number) => (
                  <View key={idx} style={[styles.diagnosisItem, { borderLeftColor: colors.primary }]}>
                    <View style={styles.diagnosisHeader}>
                      <ThemedText style={[styles.diagnosisName, { color: colors.text }]}>{dx.diagnosis}</ThemedText>
                      {dx.icdCode ? (
                        <View style={[styles.icdBadge, { backgroundColor: colors.primaryDark + "20" }]}>
                          <ThemedText style={[styles.icdText, { color: colors.primaryDark }]}>{dx.icdCode}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.confidenceBar}>
                      <View style={[styles.confidenceFill, { width: `${dx.confidence}%`, backgroundColor: colors.primary }]} />
                    </View>
                    <ThemedText style={[styles.diagnosisReasoning, { color: colors.textSecondary }]}>{dx.reasoning}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            
            {analysis.treatmentOptions?.length > 0 ? (
              <View style={[styles.analysisSection, { backgroundColor: colors.backgroundRootDefault }]}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Treatment Options</ThemedText>
                {analysis.treatmentOptions.map((tx: any, idx: number) => (
                  <View key={idx} style={[styles.treatmentItem, { backgroundColor: colors.backgroundRoot }]}>
                    <View style={styles.treatmentHeader}>
                      <ThemedText style={[styles.treatmentName, { color: colors.text }]}>{tx.treatment}</ThemedText>
                      <View style={[styles.priorityBadge, { backgroundColor: tx.priority === "first_line" ? colors.success + "20" : colors.warning + "20" }]}>
                        <ThemedText style={[styles.priorityText, { color: tx.priority === "first_line" ? colors.success : colors.warning }]}>
                          {tx.priority.replace(/_/g, " ")}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={[styles.evidenceBadge, { backgroundColor: colors.info + "20" }]}>
                      <ThemedText style={[styles.evidenceText, { color: colors.info }]}>Evidence: {tx.evidenceLevel}</ThemedText>
                    </View>
                    <ThemedText style={[styles.treatmentRationale, { color: colors.textSecondary }]}>{tx.rationale}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryAction, { borderColor: colors.primary }]}
                onPress={() => matchTrialsMutation.mutate(selectedReview.id)}
                disabled={matchTrialsMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Match clinical trials"
                accessibilityState={{ disabled: matchTrialsMutation.isPending }}
              >
                {matchTrialsMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather name="search" size={16} color={colors.primary} />
                    <ThemedText style={[styles.secondaryActionText, { color: colors.primary }]}>Match Trials</ThemedText>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.secondaryAction, { borderColor: colors.primary }]}
                onPress={() => secondOpinionMutation.mutate(selectedReview.id)}
                disabled={secondOpinionMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Get second opinion"
                accessibilityState={{ disabled: secondOpinionMutation.isPending }}
              >
                {secondOpinionMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather name="users" size={16} color={colors.primary} />
                    <ThemedText style={[styles.secondaryActionText, { color: colors.primary }]}>Second Opinion</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          </>
        ) : null}
        
        {trials && trials.length > 0 ? (
          <View style={[styles.analysisSection, { backgroundColor: colors.backgroundRootDefault }]}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Clinical Trial Matches</ThemedText>
            {trials.map((trial: any, idx: number) => (
              <View key={idx} style={[styles.trialItem, { backgroundColor: colors.backgroundRoot }]}>
                <ThemedText style={[styles.trialTitle, { color: colors.text }]}>{trial.title}</ThemedText>
                <View style={styles.trialMeta}>
                  <View style={[styles.phaseBadge, { backgroundColor: colors.info + "20" }]}>
                    <ThemedText style={[styles.phaseText, { color: colors.info }]}>{trial.phase}</ThemedText>
                  </View>
                  <ThemedText style={[styles.matchScore, { color: colors.success }]}>{trial.eligibilityMatch}% match</ThemedText>
                </View>
                <ThemedText style={[styles.trialReason, { color: colors.textSecondary }]}>{trial.matchReason}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        
        {opinion ? (
          <View style={[styles.analysisSection, { backgroundColor: colors.backgroundRootDefault }]}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>AI Second Opinion</ThemedText>
            <ThemedText style={[styles.analysisText, { color: colors.textSecondary }]}>{opinion.opinion}</ThemedText>
            {opinion.alternativeConsiderations?.length > 0 ? (
              <View style={styles.alternativesSection}>
                <ThemedText style={[styles.alternativesTitle, { color: colors.text }]}>Alternative Considerations</ThemedText>
                {opinion.alternativeConsiderations.map((alt: string, idx: number) => (
                  <View key={idx} style={styles.alternativeItem}>
                    <Feather name="chevron-right" size={14} color={colors.primary} />
                    <ThemedText style={[styles.alternativeText, { color: colors.textSecondary }]}>{alt}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderAiReviews = () => {
    if (selectedReview) return renderAiReviewDetail();
    
    return (
      <View style={styles.section}>
        <Pressable
          style={[styles.generateButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowAiReviewModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Create AI Case Review"
        >
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.generateButtonText}>Create AI Case Review</ThemedText>
        </Pressable>

        {loadingAiReviews ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : aiReviews.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
            <Feather name="cpu" size={48} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No AI Case Reviews</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Upload anonymized patient data for AI-powered diagnosis suggestions, treatment options, and clinical trial matching
            </ThemedText>
          </View>
        ) : (
          aiReviews.map((review, index) => (
            <Animated.View
              key={review.id}
              entering={FadeInDown.delay(index * 50)}
            >
              <Pressable
                style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
                onPress={() => setSelectedReview(review)}
                accessibilityRole="button"
                accessibilityLabel={`View case review: ${review.title}, status ${review.status}`}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: colors.primaryDark + "20" }]}>
                    <ThemedText style={[styles.badgeText, { color: colors.primaryDark }]}>
                      {review.specialty || "General"}
                    </ThemedText>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: review.status === "completed" ? colors.success + "20" : review.status === "analyzing" ? colors.info + "20" : colors.warning + "20" }
                  ]}>
                    <ThemedText style={[
                      styles.statusBadgeText,
                      { color: review.status === "completed" ? colors.success : review.status === "analyzing" ? colors.info : colors.warning }
                    ]}>
                      {review.status}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{review.title}</ThemedText>
                <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </ThemedText>
                <View style={styles.cardArrow}>
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>
    );
  };

  const renderThreadDetail = () => {
    if (!selectedThread) return null;
    const summary = selectedThread.aiSummary as any;
    
    return (
      <View style={styles.section}>
        <Pressable 
          style={[styles.backButton, { backgroundColor: colors.backgroundRootDefault }]}
          onPress={() => setSelectedThread(null)}
          accessibilityRole="button"
          accessibilityLabel="Back to Threads"
        >
          <Feather name="arrow-left" size={20} color={colors.primary} />
          <ThemedText style={[styles.backText, { color: colors.primary }]}>Back to Threads</ThemedText>
        </Pressable>
        
        <View style={[styles.detailCard, { backgroundColor: colors.backgroundRootDefault }]}>
          <ThemedText style={[styles.detailTitle, { color: colors.text }]}>{selectedThread.subject}</ThemedText>
          <View style={styles.threadMeta}>
            <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
              <ThemedText style={[styles.badgeText, { color: colors.info }]}>{selectedThread.type}</ThemedText>
            </View>
            <ThemedText style={[styles.messageCount, { color: colors.textSecondary }]}>{selectedThread.messageCount} messages</ThemedText>
          </View>
        </View>
        
        <Pressable
          style={[styles.summarizeButton, { borderColor: colors.primary }]}
          onPress={() => summarizeThreadMutation.mutate(selectedThread.id)}
          disabled={summarizeThreadMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Generate AI Summary"
          accessibilityState={{ disabled: summarizeThreadMutation.isPending }}
        >
          {summarizeThreadMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Feather name="zap" size={16} color={colors.primary} />
              <ThemedText style={[styles.summarizeButtonText, { color: colors.primary }]}>Generate AI Summary</ThemedText>
            </>
          )}
        </Pressable>
        
        {summary ? (
          <View style={[styles.summarySection, { backgroundColor: colors.backgroundRootDefault }]}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>AI Summary</ThemedText>
            <ThemedText style={[styles.summaryText, { color: colors.textSecondary }]}>{summary.summary}</ThemedText>
            {summary.keyPoints?.length > 0 ? (
              <View style={styles.keyPointsSection}>
                <ThemedText style={[styles.keyPointsTitle, { color: colors.text }]}>Key Points</ThemedText>
                {summary.keyPoints.map((point: string, idx: number) => (
                  <View key={idx} style={styles.keyPointItem}>
                    <Feather name="check" size={14} color={colors.success} />
                    <ThemedText style={[styles.keyPointText, { color: colors.textSecondary }]}>{point}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            {summary.actionItems?.length > 0 ? (
              <View style={styles.actionItemsSection}>
                <ThemedText style={[styles.actionItemsTitle, { color: colors.text }]}>Action Items</ThemedText>
                {summary.actionItems.map((item: string, idx: number) => (
                  <View key={idx} style={styles.actionItem}>
                    <Feather name="circle" size={12} color={colors.warning} />
                    <ThemedText style={[styles.actionItemText, { color: colors.textSecondary }]}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        
        <View style={[styles.messagesSection, { backgroundColor: colors.backgroundRootDefault }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Messages</ThemedText>
          {loadingMessages ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : threadMessages.length === 0 ? (
            <ThemedText style={[styles.noMessages, { color: colors.textSecondary }]}>No messages yet</ThemedText>
          ) : (
            threadMessages.map((msg, idx) => (
              <View key={msg.id} style={[styles.messageItem, { borderBottomColor: colors.border }]}>
                <View style={styles.messageHeader}>
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="user" size={14} color={colors.primary} />
                  </View>
                  <ThemedText style={[styles.messageTime, { color: colors.textSecondary }]}>
                    {new Date(msg.createdAt).toLocaleString()}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.messageContent, { color: colors.text }]}>{msg.content}</ThemedText>
              </View>
            ))
          )}
        </View>
        
        <View style={[styles.composeSection, { backgroundColor: colors.backgroundRootDefault, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.messageInput, { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            accessibilityLabel="Type a message"
          />
          <Pressable
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={() => sendMessageMutation.mutate()}
            disabled={sendMessageMutation.isPending || !newMessage.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: sendMessageMutation.isPending || !newMessage.trim() }}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const renderThreads = () => {
    if (selectedThread) return renderThreadDetail();
    
    return (
      <View style={styles.section}>
        <Pressable
          style={[styles.generateButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowThreadModal(true)}
          accessibilityRole="button"
          accessibilityLabel="New Discussion Thread"
        >
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.generateButtonText}>New Discussion Thread</ThemedText>
        </Pressable>

        {loadingThreads ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : messageThreads.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
            <Feather name="message-circle" size={48} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Discussion Threads</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Start secure provider-to-provider discussions with AI-powered thread summarization
            </ThemedText>
          </View>
        ) : (
          messageThreads.map((thread, index) => (
            <Animated.View
              key={thread.id}
              entering={FadeInDown.delay(index * 50)}
            >
              <Pressable
                style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
                onPress={() => setSelectedThread(thread)}
                accessibilityRole="button"
                accessibilityLabel={`View thread: ${thread.subject}, ${thread.messageCount} messages`}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
                    <ThemedText style={[styles.badgeText, { color: colors.info }]}>{thread.type}</ThemedText>
                  </View>
                  <View style={[
                    styles.priorityIndicator,
                    { backgroundColor: thread.priority === "urgent" ? colors.error : thread.priority === "high" ? colors.warning : colors.textSecondary }
                  ]} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{thread.subject}</ThemedText>
                <View style={styles.threadFooter}>
                  <ThemedText style={[styles.messageCount, { color: colors.textSecondary }]}>
                    {thread.messageCount} {thread.messageCount === 1 ? "message" : "messages"}
                  </ThemedText>
                  {thread.aiSummary ? (
                    <View style={[styles.aiIndicator, { backgroundColor: colors.success + "20" }]}>
                      <Feather name="cpu" size={12} color={colors.success} />
                      <ThemedText style={[styles.aiIndicatorText, { color: colors.success }]}>Summarized</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
                  Last activity: {new Date(thread.lastMessageAt).toLocaleDateString()}
                </ThemedText>
                <View style={styles.cardArrow}>
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <UpgradePrompt {...promptProps} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View entering={FadeIn.delay(100)}>
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: colors.text }]}>Provider Collaboration</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              AI-powered tools for healthcare provider collaboration
            </ThemedText>
          </View>

          {renderTabs()}

          {activeTab === "case-summaries" && renderCaseSummaries()}
          {activeTab === "research" && renderResearch()}
          {activeTab === "communications" && renderCommunications()}
          {activeTab === "ai-reviews" && renderAiReviews()}
          {activeTab === "threads" && renderThreads()}
        </Animated.View>
      </ScrollView>

      <Modal visible={showCaseSummaryModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Generate Case Summary</ThemedText>
            <Pressable onPress={() => setShowCaseSummaryModal(false)} accessibilityRole="button" accessibilityLabel="Close modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <ThemedText style={[styles.label, { color: colors.text }]}>Specialty Type</ThemedText>
            <View style={styles.optionsGrid}>
              {SPECIALTY_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.optionButton,
                    { borderColor: colors.border },
                    specialtyType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setSpecialtyType(type)}
                  accessibilityRole="radio"
                  accessibilityLabel={type}
                  accessibilityState={{ selected: specialtyType === type }}
                >
                  <ThemedText style={[
                    styles.optionText,
                    { color: specialtyType === type ? "#fff" : colors.text },
                  ]}>
                    {type}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.label, { color: colors.text }]}>Chief Complaint</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Describe the primary reason for consultation..."
              placeholderTextColor={colors.textSecondary}
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
              multiline
              numberOfLines={3}
              accessibilityLabel="Chief Complaint"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Urgency Level</ThemedText>
            <View style={styles.urgencyContainer}>
              {(["routine", "urgent", "emergent"] as const).map((level) => (
                <Pressable
                  key={level}
                  style={[
                    styles.urgencyButton,
                    { borderColor: colors.border },
                    urgencyLevel === level && {
                      backgroundColor: level === "routine" ? colors.success : level === "urgent" ? colors.warning : colors.error,
                      borderColor: level === "routine" ? colors.success : level === "urgent" ? colors.warning : colors.error,
                    },
                  ]}
                  onPress={() => setUrgencyLevel(level)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${level.charAt(0).toUpperCase() + level.slice(1)} urgency`}
                  accessibilityState={{ selected: urgencyLevel === level }}
                >
                  <ThemedText style={[
                    styles.urgencyText,
                    { color: urgencyLevel === level ? "#fff" : colors.text },
                  ]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.label, { color: colors.text }]}>Specific Questions (Optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter each question on a new line..."
              placeholderTextColor={colors.textSecondary}
              value={specificQuestions}
              onChangeText={setSpecificQuestions}
              multiline
              numberOfLines={4}
              accessibilityLabel="Specific Questions"
            />

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => generateCaseSummaryMutation.mutate()}
              disabled={generateCaseSummaryMutation.isPending || !specialtyType || !chiefComplaint}
              accessibilityRole="button"
              accessibilityLabel="Generate with AI"
              accessibilityState={{ disabled: generateCaseSummaryMutation.isPending || !specialtyType || !chiefComplaint }}
            >
              {generateCaseSummaryMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="zap" size={20} color="#fff" />
                  <ThemedText style={styles.submitButtonText}>Generate with AI</ThemedText>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showResearchModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Find Research Papers</ThemedText>
            <Pressable onPress={() => setShowResearchModal(false)} accessibilityRole="button" accessibilityLabel="Close modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <ThemedText style={[styles.label, { color: colors.text }]}>Clinical Question</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Describe your clinical question..."
              placeholderTextColor={colors.textSecondary}
              value={researchQuery}
              onChangeText={setResearchQuery}
              multiline
              numberOfLines={4}
              accessibilityLabel="Clinical Question"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Focus Areas (Optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Comma-separated focus areas (e.g., treatment, diagnosis)"
              placeholderTextColor={colors.textSecondary}
              value={focusAreas}
              onChangeText={setFocusAreas}
              accessibilityLabel="Focus Areas"
            />

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => suggestResearchMutation.mutate()}
              disabled={suggestResearchMutation.isPending || !researchQuery}
              accessibilityRole="button"
              accessibilityLabel="Find Research"
              accessibilityState={{ disabled: suggestResearchMutation.isPending || !researchQuery }}
            >
              {suggestResearchMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="search" size={20} color="#fff" />
                  <ThemedText style={styles.submitButtonText}>Find Research</ThemedText>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showCommunicationModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Draft Communication</ThemedText>
            <Pressable onPress={() => setShowCommunicationModal(false)} accessibilityRole="button" accessibilityLabel="Close modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <ThemedText style={[styles.label, { color: colors.text }]}>Communication Type</ThemedText>
            <View style={styles.optionsGrid}>
              {COMMUNICATION_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.optionButton,
                    { borderColor: colors.border },
                    communicationType === type.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setCommunicationType(type.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={type.label}
                  accessibilityState={{ selected: communicationType === type.value }}
                >
                  <ThemedText style={[
                    styles.optionText,
                    { color: communicationType === type.value ? "#fff" : colors.text },
                  ]}>
                    {type.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.label, { color: colors.text }]}>Subject</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Communication subject..."
              placeholderTextColor={colors.textSecondary}
              value={communicationSubject}
              onChangeText={setCommunicationSubject}
              accessibilityLabel="Communication Subject"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>To Provider (Optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Recipient provider name..."
              placeholderTextColor={colors.textSecondary}
              value={toProvider}
              onChangeText={setToProvider}
              accessibilityLabel="To Provider"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Key Points</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter each key point on a new line..."
              placeholderTextColor={colors.textSecondary}
              value={keyPoints}
              onChangeText={setKeyPoints}
              multiline
              numberOfLines={4}
              accessibilityLabel="Key Points"
            />

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => draftCommunicationMutation.mutate()}
              disabled={draftCommunicationMutation.isPending || !communicationType}
              accessibilityRole="button"
              accessibilityLabel="Draft Communication"
              accessibilityState={{ disabled: draftCommunicationMutation.isPending || !communicationType }}
            >
              {draftCommunicationMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="edit-3" size={20} color="#fff" />
                  <ThemedText style={styles.submitButtonText}>Draft Communication</ThemedText>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showAiReviewModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Create AI Case Review</ThemedText>
            <Pressable onPress={() => setShowAiReviewModal(false)} accessibilityRole="button" accessibilityLabel="Close modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <ThemedText style={[styles.label, { color: colors.text }]}>Case Title</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter a descriptive title..."
              placeholderTextColor={colors.textSecondary}
              value={reviewTitle}
              onChangeText={setReviewTitle}
              accessibilityLabel="Case Title"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Specialty</ThemedText>
            <View style={styles.optionsGrid}>
              {SPECIALTY_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.optionButton,
                    { borderColor: colors.border },
                    reviewSpecialty === type && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setReviewSpecialty(type)}
                  accessibilityRole="radio"
                  accessibilityLabel={type}
                  accessibilityState={{ selected: reviewSpecialty === type }}
                >
                  <ThemedText style={[
                    styles.optionText,
                    { color: reviewSpecialty === type ? "#fff" : colors.text },
                  ]}>
                    {type}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.sectionHeader, { color: colors.text }]}>Anonymized Patient Data</ThemedText>
            
            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Age Range</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., 45-54"
                  placeholderTextColor={colors.textSecondary}
                  value={patientAge}
                  onChangeText={setPatientAge}
                  accessibilityLabel="Age Range"
                />
              </View>
              <View style={styles.halfInput}>
                <ThemedText style={[styles.label, { color: colors.text }]}>Gender</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., Male"
                  placeholderTextColor={colors.textSecondary}
                  value={patientGender}
                  onChangeText={setPatientGender}
                  accessibilityLabel="Gender"
                />
              </View>
            </View>

            <ThemedText style={[styles.label, { color: colors.text }]}>Chief Complaint</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Primary presenting complaint..."
              placeholderTextColor={colors.textSecondary}
              value={reviewChiefComplaint}
              onChangeText={setReviewChiefComplaint}
              accessibilityLabel="Chief Complaint"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Clinical History</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Relevant medical history, conditions, prior treatments..."
              placeholderTextColor={colors.textSecondary}
              value={clinicalHistory}
              onChangeText={setClinicalHistory}
              multiline
              numberOfLines={4}
              accessibilityLabel="Clinical History"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Current Medications</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="One medication per line..."
              placeholderTextColor={colors.textSecondary}
              value={currentMedications}
              onChangeText={setCurrentMedications}
              multiline
              numberOfLines={3}
              accessibilityLabel="Current Medications"
            />

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => createAiReviewMutation.mutate()}
              disabled={createAiReviewMutation.isPending || !reviewTitle || !reviewChiefComplaint}
              accessibilityRole="button"
              accessibilityLabel="Create Case Review"
              accessibilityState={{ disabled: createAiReviewMutation.isPending || !reviewTitle || !reviewChiefComplaint }}
            >
              {createAiReviewMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="upload" size={20} color="#fff" />
                  <ThemedText style={styles.submitButtonText}>Create Case Review</ThemedText>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showThreadModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>New Discussion Thread</ThemedText>
            <Pressable onPress={() => setShowThreadModal(false)} accessibilityRole="button" accessibilityLabel="Close modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            <ThemedText style={[styles.label, { color: colors.text }]}>Subject</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundRootDefault, color: colors.text, borderColor: colors.border }]}
              placeholder="Thread subject..."
              placeholderTextColor={colors.textSecondary}
              value={threadSubject}
              onChangeText={setThreadSubject}
              accessibilityLabel="Thread Subject"
            />

            <ThemedText style={[styles.label, { color: colors.text }]}>Type</ThemedText>
            <View style={styles.optionsRow}>
              {["discussion", "case_review", "consultation", "referral"].map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.optionButton,
                    { borderColor: colors.border },
                    threadType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setThreadType(type)}
                  accessibilityRole="radio"
                  accessibilityLabel={type.replace(/_/g, " ")}
                  accessibilityState={{ selected: threadType === type }}
                >
                  <ThemedText style={[
                    styles.optionText,
                    { color: threadType === type ? "#fff" : colors.text },
                  ]}>
                    {type.replace(/_/g, " ")}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.label, { color: colors.text }]}>Priority</ThemedText>
            <View style={styles.optionsRow}>
              {["low", "normal", "high", "urgent"].map((priority) => (
                <Pressable
                  key={priority}
                  style={[
                    styles.optionButton,
                    { borderColor: colors.border },
                    threadPriority === priority && { 
                      backgroundColor: priority === "urgent" ? colors.error : priority === "high" ? colors.warning : colors.primary, 
                      borderColor: priority === "urgent" ? colors.error : priority === "high" ? colors.warning : colors.primary 
                    },
                  ]}
                  onPress={() => setThreadPriority(priority)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${priority} priority`}
                  accessibilityState={{ selected: threadPriority === priority }}
                >
                  <ThemedText style={[
                    styles.optionText,
                    { color: threadPriority === priority ? "#fff" : colors.text },
                  ]}>
                    {priority}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={() => createThreadMutation.mutate()}
              disabled={createThreadMutation.isPending || !threadSubject}
              accessibilityRole="button"
              accessibilityLabel="Create Thread"
              accessibilityState={{ disabled: createThreadMutation.isPending || !threadSubject }}
            >
              {createThreadMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="message-circle" size={20} color="#fff" />
                  <ThemedText style={styles.submitButtonText}>Create Thread</ThemedText>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showResultModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              {currentResult?.type === "research" ? "Research Results" :
               currentResult?.type === "communication" ? "Draft Communication" : "Case Summary"}
            </ThemedText>
            <Pressable onPress={() => setShowResultModal(false)} accessibilityRole="button" accessibilityLabel="Close modal">
              <Feather name="x" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {currentResult?.type === "research" ? (
              <>
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Evidence Level</ThemedText>
                <ThemedText style={[styles.resultText, { color: colors.text }]}>{currentResult.evidenceLevel}</ThemedText>
                
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Search Terms</ThemedText>
                <View style={styles.tagsContainer}>
                  {currentResult.searchTerms?.map((term: string, i: number) => (
                    <View key={i} style={[styles.tag, { backgroundColor: colors.primary + "20" }]}>
                      <ThemedText style={[styles.tagText, { color: colors.primary }]}>{term}</ThemedText>
                    </View>
                  ))}
                </View>

                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Recommended Papers</ThemedText>
                {currentResult.recommendations?.map((paper: any, i: number) => (
                  <View key={i} style={[styles.paperCard, { backgroundColor: colors.backgroundRootDefault }]}>
                    <ThemedText style={[styles.paperTitle, { color: colors.text }]}>{paper.title}</ThemedText>
                    <ThemedText style={[styles.paperAuthors, { color: colors.textSecondary }]}>
                      {paper.authors?.join(", ")} - {paper.journal} ({paper.year})
                    </ThemedText>
                    <ThemedText style={[styles.paperAbstract, { color: colors.textSecondary }]} numberOfLines={3}>
                      {paper.abstract}
                    </ThemedText>
                  </View>
                ))}
              </>
            ) : currentResult?.type === "communication" ? (
              <>
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Subject</ThemedText>
                <ThemedText style={[styles.resultText, { color: colors.text }]}>{currentResult.subject}</ThemedText>
                
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Draft Content</ThemedText>
                <View style={[styles.draftBox, { backgroundColor: colors.backgroundRootDefault }]}>
                  <ThemedText style={[styles.draftText, { color: colors.text }]}>{currentResult.draftContent}</ThemedText>
                </View>
              </>
            ) : currentResult ? (
              <>
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>AI Summary</ThemedText>
                <ThemedText style={[styles.resultText, { color: colors.text }]}>{currentResult.aiSummary}</ThemedText>
                
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Clinical Assessment</ThemedText>
                <ThemedText style={[styles.resultText, { color: colors.text }]}>{currentResult.clinicalAssessment}</ThemedText>
                
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Key Findings</ThemedText>
                {currentResult.keyFindings?.map((finding: string, i: number) => (
                  <View key={i} style={styles.listItem}>
                    <Feather name="check-circle" size={16} color={colors.success} />
                    <ThemedText style={[styles.listItemText, { color: colors.text }]}>{finding}</ThemedText>
                  </View>
                ))}
                
                <ThemedText style={[styles.resultLabel, { color: colors.textSecondary }]}>Recommendations</ThemedText>
                {currentResult.recommendations?.map((rec: string, i: number) => (
                  <View key={i} style={styles.listItem}>
                    <Feather name="arrow-right" size={16} color={colors.primary} />
                    <ThemedText style={[styles.listItemText, { color: colors.text }]}>{rec}</ThemedText>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
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
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loader: {
    marginTop: Spacing.xl,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  timestamp: {
    fontSize: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    textAlignVertical: "top",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  urgencyContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  urgencyButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
  },
  resultText: {
    fontSize: 15,
    lineHeight: 22,
  },
  paperCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  paperTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  paperAuthors: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  paperAbstract: {
    fontSize: 13,
    lineHeight: 18,
  },
  draftBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  draftText: {
    fontSize: 14,
    lineHeight: 22,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  tabsContent: {
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  detailCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  analysisSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  analysisText: {
    fontSize: 14,
    lineHeight: 22,
  },
  diagnosisItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    marginBottom: Spacing.lg,
  },
  diagnosisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  diagnosisName: {
    fontSize: 16,
    fontWeight: "600",
  },
  icdBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  icdText: {
    fontSize: 11,
    fontWeight: "600",
  },
  confidenceBar: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    marginVertical: Spacing.sm,
    overflow: "hidden" as const,
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 2,
  },
  diagnosisReasoning: {
    fontSize: 13,
    lineHeight: 19,
  },
  treatmentItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  treatmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  treatmentName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase" as const,
  },
  evidenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start" as const,
    marginBottom: Spacing.sm,
  },
  evidenceText: {
    fontSize: 11,
    fontWeight: "500",
  },
  treatmentRationale: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  trialItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  trialTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  trialMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  phaseBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: "600",
  },
  matchScore: {
    fontSize: 13,
    fontWeight: "600",
  },
  trialReason: {
    fontSize: 13,
    lineHeight: 19,
  },
  alternativesSection: {
    marginTop: Spacing.md,
  },
  alternativesTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  alternativeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  alternativeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  cardArrow: {
    position: "absolute" as const,
    right: Spacing.md,
    top: "50%",
  },
  threadMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  messageCount: {
    fontSize: 13,
  },
  threadFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  aiIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  aiIndicatorText: {
    fontSize: 11,
    fontWeight: "500",
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summarizeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summarizeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  summarySection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  keyPointsSection: {
    marginTop: Spacing.md,
  },
  keyPointsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  keyPointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  actionItemsSection: {
    marginTop: Spacing.md,
  },
  actionItemsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  actionItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  messagesSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  noMessages: {
    fontSize: 14,
    fontStyle: "italic" as const,
  },
  messageItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  messageTime: {
    fontSize: 12,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 36,
  },
  composeSection: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderTopWidth: 1,
    gap: Spacing.sm,
    alignItems: "flex-end",
  },
  messageInput: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  rowInputs: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top" as const,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap" as const,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
});
