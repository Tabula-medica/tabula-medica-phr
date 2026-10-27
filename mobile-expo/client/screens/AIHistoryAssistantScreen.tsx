import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, FadeInUp } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useNavigation } from "@react-navigation/native";
import { useAuthContext } from "@/context/AuthContext";
import { useAIConsent } from "@/context/AIConsentContext";
import { AIConsentModal } from "@/components/AIConsentModal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface HistoryPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
  icon: string;
}

interface ChatResponse {
  message: string;
  conversationId: string;
  referencedRecords?: { id: number; title: string; type: string; date: string }[];
  disclaimer?: string;
}

interface TimelineEntry {
  id: string;
  title: string;
  context: string;
  messageCount: number;
  topicTags: string[];
  summary: string | null;
  fingerprint: string | null;
  hasDuplicates: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InsightEntry {
  id: string;
  type: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  confidence: number | null;
  isArchived: boolean;
  createdAt: string;
}

interface DuplicateGroup {
  fingerprint: string;
  conversations: { id: string; title: string | null; messageCount: number | null; createdAt: string }[];
}

function createFetchApi(userId: string | undefined) {
  return async function fetchApi(path: string, options?: RequestInit) {
    const url = new URL(path, getApiUrl());
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (userId) {
      headers["x-user-id"] = userId;
    }
    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  };
}

type ViewMode = "chat" | "timeline" | "insights";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  timeline: { label: "Timeline", color: "#5B8DEF" },
  conditions: { label: "Conditions", color: "#E85D75" },
  medications: { label: "Medications", color: "#6BCB77" },
  labs: { label: "Lab Results", color: "#FFB347" },
  summary: { label: "Summaries", color: "#9B59B6" },
  preparation: { label: "Visit Prep", color: "#1ABC9C" },
  trends: { label: "Trends", color: "#E67E22" },
  vitals: { label: "Vitals", color: "#3498DB" },
  procedures: { label: "Procedures", color: "#E74C3C" },
  allergies: { label: "Allergies", color: "#F39C12" },
  immunizations: { label: "Immunizations", color: "#2ECC71" },
  general: { label: "General", color: "#95A5A6" },
};

const INSIGHT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  observation: "eye",
  recommendation: "star",
  trend: "trending-up",
  alert: "alert-triangle",
};

export default function AIHistoryAssistantScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();
  const { user } = useAuthContext();
  const { hasConsented, promptConsent, grantConsent, isPrompting } = useAIConsent();
  const fetchApi = useMemo(() => createFetchApi(user?.id), [user?.id]);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);

  const { data: prompts } = useQuery<HistoryPrompt[]>({
    queryKey: ["/api/ai-history/prompts"],
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<TimelineEntry[]>({
    queryKey: ["/api/ai-history/timeline"],
    enabled: viewMode === "timeline",
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<InsightEntry[]>({
    queryKey: ["/api/ai-history/insights"],
    enabled: viewMode === "insights",
  });

  const { data: duplicates } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/ai-history/duplicates"],
    enabled: showDuplicatesModal,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return fetchApi("/api/ai-history/chat", {
        method: "POST",
        body: JSON.stringify({ message, conversationId }),
      }) as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.conversationId);
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: async (convId: string) => {
      return fetchApi(`/api/ai-history/conversations/${convId}/summarize`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-history/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-history/insights"] });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (fingerprint: string) => {
      return fetchApi("/api/ai-history/merge-duplicates", {
        method: "POST",
        body: JSON.stringify({ fingerprint }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-history/timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-history/duplicates"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (convId: string) => {
      return fetchApi(`/api/ai-history/conversations/${convId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-history/timeline"] });
    },
  });

  const archiveInsightMutation = useMutation({
    mutationFn: async (insightId: string) => {
      return fetchApi(`/api/ai-history/insights/${insightId}/archive`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-history/insights"] });
    },
  });

  const loadConversationMutation = useMutation({
    mutationFn: async (convId: string) => {
      return fetchApi(`/api/ai-history/conversations/${convId}/messages`) as Promise<Message[]>;
    },
    onSuccess: (data, convId) => {
      setMessages(data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })));
      setConversationId(convId);
      setViewMode("chat");
    },
  });

  const handleSend = useCallback(() => {
    if (!inputText.trim() || chatMutation.isPending) return;
    if (!hasConsented) {
      promptConsent();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputText.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(inputText.trim());
    setInputText("");
  }, [inputText, chatMutation, hasConsented, promptConsent]);

  const handlePromptPress = useCallback((prompt: HistoryPrompt) => {
    if (!hasConsented) {
      promptConsent();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt.prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate(prompt.prompt);
  }, [chatMutation, hasConsented, promptConsent]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setViewMode("chat");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleOpenConversation = useCallback((convId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadConversationMutation.mutate(convId);
  }, [loadConversationMutation]);

  const handleSummarize = useCallback((convId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    summarizeMutation.mutate(convId);
  }, [summarizeMutation]);

  const handleDelete = useCallback((convId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteMutation.mutate(convId);
  }, [deleteMutation]);

  const handleMerge = useCallback((fingerprint: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mergeMutation.mutate(fingerprint);
  }, [mergeMutation]);

  const duplicateCount = useMemo(() => {
    return (duplicates || []).length;
  }, [duplicates]);

  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isUser = item.role === "user";
      return (
        <Animated.View
          entering={FadeInDown.delay(index * 50).springify()}
          style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          ]}
        >
          {!isUser ? (
            <View
              style={[styles.avatarContainer, { backgroundColor: theme.primary + "20" }]}
            >
              <Feather name="book-open" size={14} color={theme.primary} />
            </View>
          ) : null}
          <View
            style={[
              styles.messageBubble,
              isUser
                ? { backgroundColor: theme.primary, ...Shadows.small }
                : {
                    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.9)",
                    ...Shadows.glass,
                  },
            ]}
          >
            <ThemedText
              style={[styles.messageText, { color: isUser ? "#FFFFFF" : theme.text }]}
            >
              {item.content}
            </ThemedText>
          </View>
        </Animated.View>
      );
    },
    [theme, isDark]
  );

  const renderTabBar = useCallback(() => {
    const tabs: { key: ViewMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
      { key: "chat", label: "Chat", icon: "message-circle" },
      { key: "timeline", label: "History", icon: "clock" },
      { key: "insights", label: "Insights", icon: "zap" },
    ];

    return (
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.9)",
            borderBottomColor: theme.border,
            paddingTop: headerHeight,
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={[
                styles.tab,
                viewMode === tab.key
                  ? { borderBottomColor: theme.primary, borderBottomWidth: 2 }
                  : null,
              ]}
              onPress={() => {
                setViewMode(tab.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather
                name={tab.icon}
                size={18}
                color={viewMode === tab.key ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: viewMode === tab.key ? theme.primary : theme.textSecondary },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        {viewMode === "chat" && messages.length > 0 ? (
          <Pressable
            testID="button-new-chat"
            style={[styles.newChatButton, { backgroundColor: theme.primary + "15" }]}
            onPress={handleNewChat}
          >
            <Feather name="plus" size={16} color={theme.primary} />
            <ThemedText style={[styles.newChatText, { color: theme.primary }]}>
              New Chat
            </ThemedText>
          </Pressable>
        ) : null}
        {viewMode === "timeline" ? (
          <View style={styles.timelineActions}>
            <Pressable
              testID="button-find-duplicates"
              style={[styles.actionChip, { backgroundColor: "#E85D75" + "15" }]}
              onPress={() => {
                setShowDuplicatesModal(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
            >
              <Feather name="layers" size={14} color="#E85D75" />
              <ThemedText style={[styles.actionChipText, { color: "#E85D75" }]}>
                Merge Duplicates
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }, [viewMode, theme, isDark, headerHeight, messages.length, handleNewChat]);

  const renderPromptCard = useCallback(
    (prompt: HistoryPrompt, index: number) => {
      const meta = CATEGORY_META[prompt.category] || { label: prompt.category, color: theme.primary };
      return (
        <Animated.View
          key={prompt.id}
          entering={FadeInDown.delay(100 + index * 60).springify()}
        >
          <Pressable
            testID={`prompt-card-${prompt.id}`}
            style={({ pressed }) => [
              styles.promptCard,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)",
                borderLeftColor: meta.color,
                opacity: pressed ? 0.7 : 1,
                ...Shadows.glass,
              },
            ]}
            onPress={() => handlePromptPress(prompt)}
          >
            <View style={[styles.promptIconWrap, { backgroundColor: meta.color + "20" }]}>
              <Feather name={prompt.icon as any} size={18} color={meta.color} />
            </View>
            <View style={styles.promptTextWrap}>
              <ThemedText style={[styles.promptTitle, { color: theme.text }]}>
                {prompt.title}
              </ThemedText>
              <ThemedText
                style={[styles.promptSubtitle, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {prompt.prompt}
              </ThemedText>
            </View>
            <Feather name="arrow-right" size={16} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      );
    },
    [theme, isDark, handlePromptPress]
  );

  const renderEmptyState = useCallback(() => {
    const grouped = new Map<string, HistoryPrompt[]>();
    (prompts || []).forEach((p) => {
      const arr = grouped.get(p.category) || [];
      arr.push(p);
      grouped.set(p.category, arr);
    });

    return (
      <View style={styles.emptyStateContainer}>
        <LinearGradient
          colors={[theme.primary + "15", theme.primary + "05"]}
          style={styles.greetingContainer}
        >
          <View style={[styles.avatarLarge, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="book-open" size={32} color={theme.primary} />
          </View>
          <ThemedText style={[styles.greeting, { color: theme.text }]}>
            Health History Assistant
          </ThemedText>
          <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]}>
            Explore and understand your complete medical history
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 11,
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: 8,
              paddingHorizontal: 16,
            }}
          >
            AI-assisted health history information only. Not medical advice.
          </ThemedText>
        </LinearGradient>

        {[...grouped.entries()].map(([category, items]) => {
          const meta = CATEGORY_META[category] || { label: category, color: theme.primary };
          return (
            <View key={category} style={styles.promptSection}>
              <ThemedText style={[styles.sectionTitle, { color: meta.color }]}>
                {meta.label}
              </ThemedText>
              {items.map((p, i) => renderPromptCard(p, i))}
            </View>
          );
        })}
      </View>
    );
  }, [prompts, theme, isDark, renderPromptCard]);

  const renderTimelineEntry = useCallback(
    ({ item, index }: { item: TimelineEntry; index: number }) => {
      const tags = item.topicTags || [];
      const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
      });
      const timeStr = new Date(item.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit"
      });

      return (
        <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
          <Pressable
            testID={`timeline-entry-${item.id}`}
            style={({ pressed }) => [
              styles.timelineCard,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)",
                opacity: pressed ? 0.8 : 1,
                ...Shadows.glass,
              },
            ]}
            onPress={() => handleOpenConversation(item.id)}
          >
            <View style={styles.timelineHeader}>
              <View style={styles.timelineTitleRow}>
                <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                <ThemedText style={[styles.timelineTitle, { color: theme.text }]} numberOfLines={1}>
                  {item.title}
                </ThemedText>
              </View>
              <View style={styles.timelineActions}>
                <Pressable
                  testID={`button-summarize-${item.id}`}
                  style={[styles.iconButton, { backgroundColor: "#9B59B6" + "15" }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleSummarize(item.id);
                  }}
                  disabled={summarizeMutation.isPending}
                >
                  {summarizeMutation.isPending && summarizeMutation.variables === item.id ? (
                    <ActivityIndicator size={12} color="#9B59B6" />
                  ) : (
                    <Feather name="file-text" size={14} color="#9B59B6" />
                  )}
                </Pressable>
                <Pressable
                  testID={`button-delete-${item.id}`}
                  style={[styles.iconButton, { backgroundColor: "#E85D75" + "15" }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
                  <Feather name="trash-2" size={14} color="#E85D75" />
                </Pressable>
              </View>
            </View>

            <View style={styles.timelineMeta}>
              <Feather name="calendar" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.timelineDate, { color: theme.textSecondary }]}>
                {dateStr} at {timeStr}
              </ThemedText>
              <View style={styles.metaDivider} />
              <Feather name="message-circle" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.timelineDate, { color: theme.textSecondary }]}>
                {item.messageCount} msgs
              </ThemedText>
            </View>

            {item.summary ? (
              <View style={[styles.summaryBox, { backgroundColor: "#9B59B6" + "10" }]}>
                <Feather name="align-left" size={12} color="#9B59B6" />
                <ThemedText style={[styles.summaryText, { color: theme.text }]} numberOfLines={3}>
                  {item.summary}
                </ThemedText>
              </View>
            ) : null}

            {tags.length > 0 ? (
              <View style={styles.tagRow}>
                {tags.slice(0, 4).map((tag) => {
                  const meta = CATEGORY_META[tag] || CATEGORY_META.general;
                  return (
                    <View key={tag} style={[styles.tag, { backgroundColor: meta.color + "15" }]}>
                      <ThemedText style={[styles.tagText, { color: meta.color }]}>
                        {meta.label}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {item.hasDuplicates ? (
              <View style={[styles.duplicateBadge, { backgroundColor: "#E85D75" + "15" }]}>
                <Feather name="copy" size={12} color="#E85D75" />
                <ThemedText style={[styles.duplicateText, { color: "#E85D75" }]}>
                  Duplicate detected
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      );
    },
    [theme, isDark, handleOpenConversation, handleSummarize, handleDelete, summarizeMutation]
  );

  const renderInsightCard = useCallback(
    ({ item, index }: { item: InsightEntry; index: number }) => {
      const iconName = INSIGHT_ICONS[item.type] || "info";
      const meta = CATEGORY_META[item.category || "general"] || CATEGORY_META.general;
      const dateStr = new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric"
      });

      return (
        <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
          <View
            style={[
              styles.insightCard,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.95)",
                borderLeftColor: meta.color,
                ...Shadows.glass,
              },
            ]}
          >
            <View style={styles.insightHeader}>
              <View style={[styles.insightIconWrap, { backgroundColor: meta.color + "20" }]}>
                <Feather name={iconName} size={16} color={meta.color} />
              </View>
              <View style={styles.insightTitleWrap}>
                <ThemedText style={[styles.insightTitle, { color: theme.text }]}>
                  {item.title}
                </ThemedText>
                <ThemedText style={[styles.insightDate, { color: theme.textSecondary }]}>
                  {dateStr}
                </ThemedText>
              </View>
              <Pressable
                testID={`button-archive-insight-${item.id}`}
                style={[styles.iconButton, { backgroundColor: theme.primary + "10" }]}
                onPress={() => archiveInsightMutation.mutate(item.id)}
              >
                <Feather name="archive" size={14} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ThemedText style={[styles.insightContent, { color: theme.text }]}>
              {item.content}
            </ThemedText>
            {item.confidence !== null ? (
              <View style={styles.confidenceRow}>
                <View style={[styles.confidenceBar, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: `${(item.confidence ?? 0) * 100}%`, backgroundColor: meta.color },
                    ]}
                  />
                </View>
                <ThemedText style={[styles.confidenceLabel, { color: theme.textSecondary }]}>
                  {Math.round((item.confidence ?? 0) * 100)}% confidence
                </ThemedText>
              </View>
            ) : null}
            {(item.tags || []).length > 0 ? (
              <View style={styles.tagRow}>
                {(item.tags || []).map((tag) => (
                  <View key={tag} style={[styles.tag, { backgroundColor: theme.primary + "10" }]}>
                    <ThemedText style={[styles.tagText, { color: theme.primary }]}>
                      {tag}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>
      );
    },
    [theme, isDark, archiveInsightMutation]
  );

  const renderDuplicatesModal = useCallback(() => {
    return (
      <Modal
        visible={showDuplicatesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDuplicatesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Duplicate Conversations
              </ThemedText>
              <Pressable
                testID="button-close-duplicates"
                onPress={() => setShowDuplicatesModal(false)}
              >
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {!duplicates || duplicates.length === 0 ? (
                <View style={styles.emptyDuplicates}>
                  <Feather name="check-circle" size={48} color="#6BCB77" />
                  <ThemedText style={[styles.emptyDuplicatesText, { color: theme.text }]}>
                    No Duplicates Found
                  </ThemedText>
                  <ThemedText style={[styles.emptyDuplicatesSub, { color: theme.textSecondary }]}>
                    All your conversations are unique
                  </ThemedText>
                </View>
              ) : null}

              {(duplicates || []).map((group, idx) => (
                <Animated.View
                  key={group.fingerprint}
                  entering={FadeInDown.delay(idx * 80).springify()}
                  style={[
                    styles.duplicateGroup,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <View style={styles.duplicateGroupHeader}>
                    <View style={styles.duplicateGroupInfo}>
                      <Feather name="layers" size={16} color="#E85D75" />
                      <ThemedText style={[styles.duplicateGroupTitle, { color: theme.text }]}>
                        {group.conversations.length} similar conversations
                      </ThemedText>
                    </View>
                    <Pressable
                      testID={`button-merge-${group.fingerprint}`}
                      style={[styles.mergeButton, { backgroundColor: theme.primary }]}
                      onPress={() => handleMerge(group.fingerprint)}
                      disabled={mergeMutation.isPending}
                    >
                      {mergeMutation.isPending ? (
                        <ActivityIndicator size={14} color="#FFFFFF" />
                      ) : (
                        <>
                          <Feather name="git-merge" size={14} color="#FFFFFF" />
                          <ThemedText style={styles.mergeButtonText}>Merge</ThemedText>
                        </>
                      )}
                    </Pressable>
                  </View>
                  {group.conversations.map((conv) => (
                    <View key={conv.id} style={styles.duplicateItem}>
                      <ThemedText
                        style={[styles.duplicateItemTitle, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {conv.title || "Untitled"}
                      </ThemedText>
                      <ThemedText style={[styles.duplicateItemMeta, { color: theme.textSecondary }]}>
                        {conv.messageCount || 0} msgs - {new Date(conv.createdAt).toLocaleDateString()}
                      </ThemedText>
                    </View>
                  ))}
                </Animated.View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }, [showDuplicatesModal, duplicates, theme, isDark, insets, handleMerge, mergeMutation]);

  const ListHeader = useCallback(() => {
    if (messages.length === 0) return null;
    return (
      <View style={styles.chatHeaderContainer}>
        <View style={[styles.avatarSmall, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="book-open" size={18} color={theme.primary} />
        </View>
        <ThemedText style={[styles.chatHeaderText, { color: theme.textSecondary }]}>
          Health History Assistant
        </ThemedText>
      </View>
    );
  }, [messages.length, theme]);

  const renderChatView = () => (
    <>
      <FlatList
        ref={flatListRef}
        inverted={messages.length > 0}
        data={messages.toReversed()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: Spacing.md, paddingBottom: Spacing.md },
        ]}
        ListFooterComponent={ListHeader}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.95)",
            paddingBottom: insets.bottom + Spacing.md,
            borderTopColor: theme.border,
          },
        ]}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            testID="input-history-message"
            style={[
              styles.textInput,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                color: theme.text,
              },
            ]}
            placeholder="Ask about your health history..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <Pressable
            testID="button-send-history"
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  inputText.trim() && !chatMutation.isPending
                    ? theme.primary
                    : theme.primary + "50",
              },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || chatMutation.isPending}
          >
            {chatMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>
    </>
  );

  const renderTimelineView = () => (
    <FlatList
      data={timeline || []}
      renderItem={renderTimelineEntry}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        timelineLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading conversation history...
            </ThemedText>
          </View>
        ) : (
          <View style={styles.emptyTimeline}>
            <Feather name="clock" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTimelineTitle, { color: theme.text }]}>
              No Conversations Yet
            </ThemedText>
            <ThemedText style={[styles.emptyTimelineSub, { color: theme.textSecondary }]}>
              Start a chat to build your conversation history
            </ThemedText>
          </View>
        )
      }
    />
  );

  const renderInsightsView = () => (
    <FlatList
      data={insights || []}
      renderItem={renderInsightCard}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingTop: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        insightsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading insights...
            </ThemedText>
          </View>
        ) : (
          <View style={styles.emptyTimeline}>
            <Feather name="zap" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTimelineTitle, { color: theme.text }]}>
              No Insights Yet
            </ThemedText>
            <ThemedText style={[styles.emptyTimelineSub, { color: theme.textSecondary }]}>
              Summarize a conversation to generate AI insights
            </ThemedText>
          </View>
        )
      }
    />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {renderTabBar()}
      {viewMode === "chat" ? renderChatView() : null}
      {viewMode === "timeline" ? renderTimelineView() : null}
      {viewMode === "insights" ? renderInsightsView() : null}
      {renderDuplicatesModal()}

      <AIConsentModal
        isVisible={isPrompting}
        onAccept={grantConsent}
        onDecline={() => navigation.goBack()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  newChatText: {
    fontSize: 12,
    fontWeight: "600",
  },
  timelineActions: {
    flexDirection: "row",
    justifyContent: "center",
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: { flexGrow: 1, paddingHorizontal: Spacing.lg },
  emptyStateContainer: { flex: 1, paddingTop: Spacing.lg },
  greetingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: { fontSize: 24, fontWeight: "600", marginBottom: Spacing.xs },
  subtitleText: { fontSize: 15, textAlign: "center", paddingHorizontal: Spacing.lg },
  promptSection: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: Spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    gap: Spacing.md,
  },
  promptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  promptTextWrap: { flex: 1 },
  promptTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  promptSubtitle: { fontSize: 13, lineHeight: 18 },
  chatHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  chatHeaderText: { fontSize: 14, fontWeight: "500" },
  messageContainer: { flexDirection: "row", marginBottom: Spacing.md, maxWidth: "85%" },
  userMessageContainer: { alignSelf: "flex-end" },
  assistantMessageContainer: { alignSelf: "flex-start" },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 4,
  },
  messageBubble: { padding: Spacing.md, borderRadius: BorderRadius.md },
  messageText: { fontSize: 15, lineHeight: 22 },
  inputContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.sm },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.sm,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  timelineMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.xs,
    paddingLeft: 20,
  },
  timelineDate: {
    fontSize: 12,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#999",
    marginHorizontal: 4,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    marginLeft: 20,
    gap: Spacing.xs,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingLeft: 20,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  duplicateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    marginLeft: 20,
    alignSelf: "flex-start",
    gap: 4,
  },
  duplicateText: {
    fontSize: 11,
    fontWeight: "600",
  },
  insightCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  insightIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  insightTitleWrap: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  insightDate: {
    fontSize: 11,
  },
  insightContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 2,
  },
  confidenceLabel: {
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyTimeline: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyTimelineTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyTimelineSub: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "80%",
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalScroll: {
    flex: 1,
  },
  emptyDuplicates: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyDuplicatesText: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyDuplicatesSub: {
    fontSize: 14,
  },
  duplicateGroup: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  duplicateGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  duplicateGroupInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  duplicateGroupTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  mergeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  mergeButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  duplicateItem: {
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: "#E85D75" + "30",
    marginBottom: 4,
  },
  duplicateItemTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  duplicateItemMeta: {
    fontSize: 11,
  },
});
