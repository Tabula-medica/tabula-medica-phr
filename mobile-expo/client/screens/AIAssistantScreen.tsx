import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  Switch,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Shadows, GlassEffects } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { useAuthContext } from "@/context/AuthContext";
import { useAIConsent } from "@/context/AIConsentContext";
import { AIConsentModal } from "@/components/AIConsentModal";
import { AiSuggestConfirm } from "@/components/AiSuggestConfirm";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  escalated?: boolean;
}

interface SuggestedAction {
  type: string;
  title: string;
  data?: any;
}

interface Insight {
  type: string;
  message: string;
  priority: "high" | "medium" | "low";
}

interface InsightsResponse {
  greeting: string;
  insights: Insight[];
  recommendations: string[];
}

interface QuickRepliesResponse {
  replies: string[];
}

interface ChatResponse {
  message: string;
  conversationId: string;
  suggestedActions?: SuggestedAction[];
  escalated?: boolean;
  escalationMessageId?: string;
}

interface ContextFilter {
  recordIds?: string[];
  types?: string[];
  dateFrom?: string;
  dateTo?: string;
}

interface ContextCategory {
  type: string;
  label: string;
  count: number;
  items: { id: string; title: string; date: string; summary?: string | null }[];
}

interface ContextOptionsResponse {
  categories: ContextCategory[];
  appointments: { id: string; title: string; date: string; provider?: string }[];
  totalRecords: number;
}

function createApiRequest(userId: string | undefined) {
  return async function localApiRequest(path: string, options?: RequestInit) {
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
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
  };
}

const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  condition: "heart",
  medication: "package",
  vital: "activity",
  lab: "droplet",
  labs: "droplet",
  allergy: "alert-triangle",
  immunization: "shield",
  procedure: "scissors",
  encounter: "calendar",
  imaging: "image",
  note: "file-text",
};

const DATE_PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last year", days: 365 },
];

interface QuickFilterPreset {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  getFilter: () => ContextFilter;
}

const QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    label: "Recent Labs",
    icon: "droplet",
    getFilter: () => {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return { types: ["lab", "labs"], dateFrom: from.toISOString() };
    },
  },
  {
    label: "All Medications",
    icon: "package",
    getFilter: () => ({ types: ["medication"] }),
  },
  {
    label: "Active Conditions",
    icon: "heart",
    getFilter: () => ({ types: ["condition"] }),
  },
  {
    label: "Last 7 Days",
    icon: "clock",
    getFilter: () => {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      return { dateFrom: from.toISOString() };
    },
  },
];

function ContextPickerModal({
  visible,
  onClose,
  onApply,
  currentFilter,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (filter: ContextFilter | null) => void;
  currentFilter: ContextFilter | null;
}) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: contextOptions, isLoading } = useQuery<ContextOptionsResponse>({
    queryKey: ["/api/ai-assistant/context-options"],
    enabled: visible,
  });

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(currentFilter?.types || [])
  );
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    new Set(currentFilter?.recordIds || [])
  );
  const [datePresetIndex, setDatePresetIndex] = useState<number | null>(null);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const toggleType = useCallback((type: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setSelectedRecordIds(new Set());
  }, []);

  const toggleRecord = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSelectedTypes(new Set());
  }, []);

  const hasFilter = selectedTypes.size > 0 || selectedRecordIds.size > 0 || datePresetIndex !== null;

  const handleApply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!hasFilter) {
      onApply(null);
    } else {
      const filter: ContextFilter = {};
      if (selectedTypes.size > 0) filter.types = Array.from(selectedTypes);
      if (selectedRecordIds.size > 0) filter.recordIds = Array.from(selectedRecordIds);
      if (datePresetIndex !== null) {
        const days = DATE_PRESETS[datePresetIndex].days;
        const from = new Date();
        from.setDate(from.getDate() - days);
        filter.dateFrom = from.toISOString();
      }
      onApply(filter);
    }
    onClose();
  }, [hasFilter, selectedTypes, selectedRecordIds, datePresetIndex, onApply, onClose]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes(new Set());
    setSelectedRecordIds(new Set());
    setDatePresetIndex(null);
  }, []);

  const activeCount = selectedTypes.size + selectedRecordIds.size + (datePresetIndex !== null ? 1 : 0);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
              Focus Context
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12} testID="close-context-picker" accessibilityRole="button" accessibilityLabel="Close context picker">
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
            Select specific health data to focus the AI conversation
          </ThemedText>

          <Animated.View entering={FadeIn.duration(300)} style={styles.quickPresetsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPresetsScroll}>
              {QUICK_FILTER_PRESETS.map((preset, idx) => (
                <Pressable
                  key={idx}
                  testID={`quick-preset-${idx}`}
                  style={[
                    styles.quickPresetPill,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : theme.primary + "10",
                      borderColor: theme.primary + "30",
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onApply(preset.getFilter());
                    onClose();
                  }}
                >
                  <Feather name={preset.icon} size={13} color={theme.primary} />
                  <ThemedText style={[styles.quickPresetText, { color: theme.primary }]}>
                    {preset.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {isLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={[styles.sectionLabel, { color: theme.text }]}>
                Date Range
              </ThemedText>
              <View style={styles.datePresetsRow}>
                {DATE_PRESETS.map((preset, idx) => (
                  <Pressable
                    key={idx}
                    testID={`date-preset-${idx}`}
                    style={[
                      styles.datePresetChip,
                      {
                        backgroundColor: datePresetIndex === idx ? theme.primary : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
                        borderColor: datePresetIndex === idx ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDatePresetIndex(datePresetIndex === idx ? null : idx);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.datePresetText,
                        { color: datePresetIndex === idx ? "#FFFFFF" : theme.textSecondary },
                      ]}
                    >
                      {preset.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={[styles.sectionLabel, { color: theme.text, marginTop: Spacing.lg }]}>
                Data Categories
              </ThemedText>
              {contextOptions?.categories.map((cat) => {
                const isTypeSelected = selectedTypes.has(cat.type);
                const isExpanded = expandedType === cat.type;
                const iconName = TYPE_ICONS[cat.type] || "file";
                const selectedItemCount = cat.items.filter(i => selectedRecordIds.has(i.id)).length;

                return (
                  <View key={cat.type}>
                    <Pressable
                      testID={`category-${cat.type}`}
                      style={[
                        styles.categoryRow,
                        {
                          backgroundColor: isTypeSelected
                            ? theme.primary + "15"
                            : isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.02)",
                          borderColor: isTypeSelected ? theme.primary + "40" : theme.border,
                        },
                      ]}
                      onPress={() => toggleType(cat.type)}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: theme.primary + "15" }]}>
                        <Feather name={iconName} size={16} color={theme.primary} />
                      </View>
                      <View style={styles.categoryInfo}>
                        <ThemedText style={[styles.categoryName, { color: theme.text }]}>
                          {cat.label}
                        </ThemedText>
                        <ThemedText style={[styles.categoryCount, { color: theme.textSecondary }]}>
                          {cat.count} record{cat.count !== 1 ? "s" : ""}
                          {selectedItemCount > 0 ? ` (${selectedItemCount} selected)` : ""}
                        </ThemedText>
                      </View>
                      <View style={styles.categoryActions}>
                        {isTypeSelected ? (
                          <View style={[styles.checkBadge, { backgroundColor: theme.primary }]}>
                            <Feather name="check" size={12} color="#FFFFFF" />
                          </View>
                        ) : null}
                        {cat.items.length > 0 ? (
                          <Pressable
                            hitSlop={8}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setExpandedType(isExpanded ? null : cat.type);
                            }}
                            testID={`expand-${cat.type}`}
                          >
                            <Feather
                              name={isExpanded ? "chevron-up" : "chevron-down"}
                              size={18}
                              color={theme.textSecondary}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    </Pressable>

                    {isExpanded ? (
                      <View style={styles.itemsList}>
                        {cat.items.slice(0, 20).map((item) => {
                          const isSelected = selectedRecordIds.has(item.id);
                          return (
                            <Pressable
                              key={item.id}
                              testID={`record-${item.id}`}
                              style={[
                                styles.itemRow,
                                {
                                  backgroundColor: isSelected
                                    ? theme.primary + "10"
                                    : "transparent",
                                  borderColor: isSelected ? theme.primary + "30" : theme.border,
                                },
                              ]}
                              onPress={() => toggleRecord(item.id)}
                            >
                              <View style={[styles.itemCheck, { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primary : "transparent" }]}>
                                {isSelected ? <Feather name="check" size={10} color="#FFFFFF" /> : null}
                              </View>
                              <View style={styles.itemInfo}>
                                <ThemedText style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                                  {item.title}
                                </ThemedText>
                                <ThemedText style={[styles.itemDate, { color: theme.textSecondary }]}>
                                  {new Date(item.date).toLocaleDateString()}
                                  {item.summary ? ` - ${item.summary}` : ""}
                                </ThemedText>
                              </View>
                            </Pressable>
                          );
                        })}
                        {cat.items.length > 20 ? (
                          <ThemedText style={[styles.moreText, { color: theme.textSecondary }]}>
                            +{cat.items.length - 20} more
                          </ThemedText>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {contextOptions?.categories.length === 0 ? (
                <View style={styles.emptyContext}>
                  <Feather name="inbox" size={32} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyContextText, { color: theme.textSecondary }]}>
                    No health records available yet
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>
          )}

          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <Pressable
              style={[styles.clearButton, { borderColor: theme.border }]}
              onPress={handleClear}
              testID="clear-context"
            >
              <ThemedText style={[styles.clearButtonText, { color: theme.textSecondary }]}>
                Clear All
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              onPress={handleApply}
              testID="apply-context"
            >
              <ThemedText style={styles.applyButtonText}>
                {hasFilter ? `Apply (${activeCount})` : "Use Full Context"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ActiveContextBadge({
  filter,
  onPress,
  onClear,
}: {
  filter: ContextFilter;
  onPress: () => void;
  onClear: () => void;
}) {
  const { theme, isDark } = useTheme();

  const label = useMemo(() => {
    const TYPE_LABELS: Record<string, string> = {
      condition: "conditions",
      medication: "medications",
      vital: "vitals",
      lab: "labs",
      labs: "labs",
      allergy: "allergies",
      immunization: "immunizations",
      procedure: "procedures",
      encounter: "encounters",
      imaging: "imaging",
      note: "notes",
    };

    const parts: string[] = [];

    if (filter.types && filter.types.length > 0) {
      const uniqueLabels = [...new Set(filter.types.map(t => TYPE_LABELS[t] || t))];
      if (uniqueLabels.length === 1) {
        parts.push(`All ${uniqueLabels[0]}`);
      } else {
        parts.push(uniqueLabels.join(", "));
      }
    }

    if (filter.recordIds && filter.recordIds.length > 0) {
      parts.push(`${filter.recordIds.length} record${filter.recordIds.length > 1 ? "s" : ""}`);
    }

    if (filter.dateFrom) {
      const d = new Date(filter.dateFrom);
      const now = new Date();
      const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        parts.push("last 7 days");
      } else if (diffDays <= 30) {
        parts.push("last 30 days");
      } else if (diffDays <= 90) {
        parts.push("last 90 days");
      } else {
        parts.push("last year");
      }
    }

    return parts.join(", ");
  }, [filter]);

  return (
    <Pressable
      style={[
        styles.contextBadge,
        { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" },
      ]}
      onPress={onPress}
      testID="active-context-badge"
    >
      <Feather name="filter" size={12} color={theme.primary} />
      <ThemedText style={[styles.contextBadgeText, { color: theme.primary }]} numberOfLines={1}>
        Focused: {label}
      </ThemedText>
      <Pressable onPress={onClear} hitSlop={8} testID="clear-context-badge" accessibilityRole="button" accessibilityLabel="Clear context filter">
        <Feather name="x-circle" size={14} color={theme.primary} />
      </Pressable>
    </Pressable>
  );
}

export default function AIAssistantScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuthContext();
  const { hasConsented, promptConsent, grantConsent, isPrompting } = useAIConsent();
  const localApiRequest = useMemo(() => createApiRequest(user?.id), [user?.id]);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const [contextFilter, setContextFilter] = useState<ContextFilter | null>(null);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);

  const { data: insights, isLoading: insightsLoading } = useQuery<InsightsResponse>({
    queryKey: ["/api/ai-assistant/insights"],
  });

  const { data: quickRepliesData } = useQuery<QuickRepliesResponse>({
    queryKey: ["/api/ai-assistant/quick-replies"],
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      return localApiRequest("/api/ai-assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          conversationId,
          contextFilter: contextFilter || undefined,
        }),
      }) as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
        escalated: data.escalated,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.conversationId);
      if (data.suggestedActions) {
        setSuggestedActions(data.suggestedActions);
      }
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
    setInputText("");
    setSuggestedActions([]);
    chatMutation.mutate(inputText.trim());
  }, [inputText, chatMutation, hasConsented, promptConsent]);

  const handleQuickReply = useCallback((reply: string) => {
    setInputText(reply);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleActionPress = useCallback((action: SuggestedAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action.type === "set_reminder") {
      setInputText("Help me set a medication reminder");
    } else if (action.type === "schedule_appointment") {
      setInputText("I need to schedule an appointment");
    } else if (action.type === "view_education") {
      setInputText("Show me educational content");
    } else if (action.type === "log_medication") {
      setInputText("I took my medication");
    } else if (action.type === "view_records") {
      setInputText("Show me my health records");
    } else if (action.type === "contact_care_team") {
      (navigation as any).navigate("Main", {
        screen: "ProfileTab",
        params: { screen: "SecureMessaging" },
      });
    } else if (action.type === "view_messages") {
      (navigation as any).navigate("Main", {
        screen: "ProfileTab",
        params: { screen: "SecureMessaging" },
      });
    }
  }, [navigation]);


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
              style={[
                styles.avatarContainer,
                { backgroundColor: theme.primary + "20" },
              ]}
            >
              <Feather name="heart" size={16} color={theme.primary} />
            </View>
          ) : null}
          <View
            style={[
              styles.messageBubble,
              isUser
                ? {
                    backgroundColor: theme.primary,
                    ...Shadows.small,
                  }
                : {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(255,255,255,0.9)",
                    ...Shadows.glass,
                  },
            ]}
          >
            <ThemedText
              style={[
                styles.messageText,
                { color: isUser ? "#FFFFFF" : theme.text },
              ]}
            >
              {item.content}
            </ThemedText>
            {item.escalated ? (
              <View style={[styles.escalationBadge, { backgroundColor: theme.warning + "20" }]}>
                <Feather name="alert-circle" size={12} color={theme.warning} />
                <ThemedText style={[styles.escalationText, { color: theme.warning }]}>
                  Sent to care team
                </ThemedText>
              </View>
            ) : null}
          </View>
          {!isUser ? (
            <Pressable
              style={[styles.saveToNotesBtn, { borderColor: theme.border }]}
              onPress={() => setPendingSuggestion(item.content)}
              testID={`button-save-to-notes-${item.id}`}
              accessibilityLabel="Save AI response to notes"
            >
              <Feather name="save" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.saveToNotesBtnText, { color: theme.textSecondary }]}>
                Save to notes
              </ThemedText>
            </Pressable>
          ) : null}
        </Animated.View>
      );
    },
    [theme, isDark, setPendingSuggestion]
  );

  const renderInsightCard = useCallback(
    (insight: Insight, index: number) => {
      const priorityColors = {
        high: theme.error,
        medium: theme.warning,
        low: theme.success,
      };

      const priorityIcons: Record<string, keyof typeof Feather.glyphMap> = {
        appointment: "calendar",
        medication: "package",
        labs: "activity",
      };

      return (
        <Animated.View
          key={index}
          entering={FadeInDown.delay(index * 100).springify()}
          style={[
            styles.insightCard,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.95)",
              borderLeftColor: priorityColors[insight.priority],
            },
          ]}
        >
          <View
            style={[
              styles.insightIconContainer,
              { backgroundColor: priorityColors[insight.priority] + "20" },
            ]}
          >
            <Feather
              name={priorityIcons[insight.type] || "info"}
              size={16}
              color={priorityColors[insight.priority]}
            />
          </View>
          <ThemedText style={styles.insightText}>{insight.message}</ThemedText>
        </Animated.View>
      );
    },
    [theme, isDark]
  );

  const renderQuickReplies = useCallback(() => {
    const replies = quickRepliesData?.replies || [];
    if (replies.length === 0 || messages.length > 0) return null;

    return (
      <View style={styles.quickRepliesContainer}>
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Quick Actions
        </ThemedText>
        <View style={styles.quickRepliesGrid}>
          {replies.map((reply, index) => (
            <AnimatedPressable
              key={index}
              entering={FadeInDown.delay(index * 50).springify()}
              style={[
                styles.quickReplyButton,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(255,255,255,0.9)",
                  borderColor: theme.border,
                },
              ]}
              onPress={() => handleQuickReply(reply)}
            >
              <ThemedText
                style={[styles.quickReplyText, { color: theme.primary }]}
                numberOfLines={2}
              >
                {reply}
              </ThemedText>
            </AnimatedPressable>
          ))}
        </View>
      </View>
    );
  }, [quickRepliesData, messages.length, theme, isDark, handleQuickReply]);

  const renderSuggestedActions = useCallback(() => {
    if (suggestedActions.length === 0) return null;

    const actionIcons: Record<string, keyof typeof Feather.glyphMap> = {
      set_reminder: "bell",
      schedule_appointment: "calendar",
      view_education: "book-open",
      log_medication: "check-circle",
      view_records: "file-text",
    };

    return (
      <View style={styles.suggestedActionsContainer}>
        {suggestedActions.map((action, index) => (
          <Pressable
            key={index}
            style={[
              styles.suggestedActionButton,
              {
                backgroundColor: theme.primary + "15",
                borderColor: theme.primary + "30",
              },
            ]}
            onPress={() => handleActionPress(action)}
          >
            <Feather
              name={actionIcons[action.type] || "arrow-right"}
              size={14}
              color={theme.primary}
            />
            <ThemedText
              style={[styles.suggestedActionText, { color: theme.primary }]}
            >
              {action.title}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    );
  }, [suggestedActions, theme, handleActionPress]);

  const renderEmptyState = useCallback(() => {
    if (insightsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your health insights...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <LinearGradient
          colors={[theme.primary + "15", theme.primary + "05"]}
          style={styles.greetingContainer}
        >
          <View
            style={[
              styles.assistantAvatarLarge,
              { backgroundColor: theme.primary + "20" },
            ]}
          >
            <Feather name="heart" size={32} color={theme.primary} />
          </View>
          <ThemedText style={[styles.greeting, { color: theme.text }]}>
            {insights?.greeting || "Hello!"}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your AI Health Assistant is here to help
          </ThemedText>
          <ThemedText style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 }}>
            AI-assisted health information only. Not medical advice. Always consult your healthcare provider.
          </ThemedText>
        </LinearGradient>

        <Pressable
          style={[
            styles.contextPromptCard,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.9)",
              borderColor: theme.primary + "30",
            },
          ]}
          onPress={() => setShowContextPicker(true)}
          testID="open-context-picker-prompt"
        >
          <View style={[styles.contextPromptIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="sliders" size={18} color={theme.primary} />
          </View>
          <View style={styles.contextPromptText}>
            <ThemedText style={[styles.contextPromptTitle, { color: theme.text }]}>
              Focus your conversation
            </ThemedText>
            <ThemedText style={[styles.contextPromptDesc, { color: theme.textSecondary }]}>
              Select specific records, conditions, or time ranges for more targeted answers
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>

        {insights && insights.insights.length > 0 ? (
          <View style={styles.insightsSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Today&apos;s Highlights
            </ThemedText>
            {insights.insights.map((insight, index) =>
              renderInsightCard(insight, index)
            )}
          </View>
        ) : null}

        {insights && insights.recommendations.length > 0 ? (
          <View style={styles.recommendationsSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              Recommendations
            </ThemedText>
            {insights.recommendations.map((rec, index) => (
              <Animated.View
                key={index}
                entering={FadeInDown.delay((insights.insights.length + index) * 100).springify()}
                style={[
                  styles.recommendationCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(255,255,255,0.8)",
                  },
                ]}
              >
                <Feather name="chevron-right" size={16} color={theme.success} />
                <ThemedText style={styles.recommendationText}>{rec}</ThemedText>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {renderQuickReplies()}
      </View>
    );
  }, [
    insightsLoading,
    insights,
    theme,
    isDark,
    renderInsightCard,
    renderQuickReplies,
  ]);

  const ListHeader = useCallback(() => {
    if (messages.length === 0) return null;

    return (
      <View style={styles.chatHeaderContainer}>
        <View
          style={[
            styles.assistantAvatarSmall,
            { backgroundColor: theme.primary + "20" },
          ]}
        >
          <Feather name="heart" size={20} color={theme.primary} />
        </View>
        <ThemedText style={[styles.chatHeaderText, { color: theme.textSecondary }]}>
          AI Health Assistant
        </ThemedText>
      </View>
    );
  }, [messages.length, theme]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <FlatList
        ref={flatListRef}
        inverted={messages.length > 0}
        data={messages.toReversed()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: Spacing.md,
          },
        ]}
        ListFooterComponent={ListHeader}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={renderSuggestedActions}
        showsVerticalScrollIndicator={false}
      />

      <AiSuggestConfirm
        suggestion={pendingSuggestion}
        onUse={(text) => {
          Clipboard.setStringAsync(text).catch(() => {});
          setPendingSuggestion(null);
        }}
        onDismiss={() => setPendingSuggestion(null)}
        fieldLabel="Visit Notes"
        sourceRoute="/api/ai-assistant/chat"
      />

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isDark
              ? "rgba(0,0,0,0.8)"
              : "rgba(255,255,255,0.95)",
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

        {contextFilter ? (
          <ActiveContextBadge
            filter={contextFilter}
            onPress={() => setShowContextPicker(true)}
            onClear={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setContextFilter(null);
            }}
          />
        ) : null}

        <View style={styles.inputRow}>
          <View>
            <Pressable
              style={[
                styles.contextButton,
                {
                  backgroundColor: contextFilter
                    ? theme.primary + "20"
                    : isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowContextPicker(true);
              }}
              testID="open-context-picker"
            >
              <Feather
                name="sliders"
                size={18}
                color={contextFilter ? theme.primary : theme.textSecondary}
              />
            </Pressable>
            {contextFilter?.recordIds && contextFilter.recordIds.length > 0 ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.contextCountBadge, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={styles.contextCountBadgeText}>
                  {contextFilter.recordIds.length}
                </ThemedText>
              </Animated.View>
            ) : null}
          </View>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(0,0,0,0.05)",
                color: theme.text,
              },
            ]}
            placeholder="Ask about your health..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
            testID="chat-input"
          />
          <Pressable
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
            testID="send-button"
          >
            {chatMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="send" size={20} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>

      <ContextPickerModal
        visible={showContextPicker}
        onClose={() => setShowContextPicker(false)}
        onApply={setContextFilter}
        currentFilter={contextFilter}
      />

      <AIConsentModal
        isVisible={isPrompting}
        onAccept={grantConsent}
        onDecline={() => navigation.goBack()}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing["4xl"],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  emptyStateContainer: {
    flex: 1,
    paddingTop: Spacing.lg,
  },
  greetingContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  assistantAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  assistantAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  insightsSection: {
    marginBottom: Spacing.xl,
  },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    ...Shadows.glass,
  },
  insightIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
  },
  recommendationsSection: {
    marginBottom: Spacing.xl,
  },
  recommendationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
  },
  quickRepliesContainer: {
    marginBottom: Spacing.xl,
  },
  quickRepliesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  quickReplyButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxWidth: "48%",
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: "500",
  },
  chatHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  chatHeaderText: {
    fontSize: 14,
    fontWeight: "500",
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    maxWidth: "85%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
  },
  assistantMessageContainer: {
    alignSelf: "flex-start",
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
    marginTop: 4,
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  escalationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  escalationText: {
    fontSize: 12,
    fontWeight: "500",
  },
  saveToNotesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  saveToNotesBtnText: {
    fontSize: 11,
    fontWeight: "500",
  },
  suggestedActionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  suggestedActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  suggestedActionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  inputContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  contextButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  contextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    alignSelf: "flex-start",
  },
  contextBadgeText: {
    fontSize: 12,
    fontWeight: "500",
    maxWidth: 200,
  },
  contextPromptCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  contextPromptIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  contextPromptText: {
    flex: 1,
  },
  contextPromptTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  contextPromptDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "85%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 13,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  modalLoading: {
    paddingVertical: Spacing["4xl"],
    alignItems: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  datePresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  datePresetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  datePresetText: {
    fontSize: 13,
    fontWeight: "500",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "600",
  },
  categoryCount: {
    fontSize: 12,
    marginTop: 1,
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  itemsList: {
    paddingLeft: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: 4,
    gap: Spacing.sm,
  },
  itemCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  itemDate: {
    fontSize: 11,
    marginTop: 1,
  },
  moreText: {
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  quickPresetsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  quickPresetsScroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  quickPresetPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: "600",
  },
  contextCountBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  contextCountBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyContext: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyContextText: {
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  clearButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
