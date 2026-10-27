import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface MessagingThread {
  id: string;
  patientId: string;
  providerId: string | null;
  subject: string | null;
  category: string | null;
  priority: string;
  status: string;
  isAiTriaged: boolean;
  aiTriageSummary: string | null;
  lastMessageAt: string | null;
  messages?: SecureMessage[];
}

interface SecureMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderType: string;
  messageType: string;
  content: string;
  isRead: boolean;
  isAiGenerated: boolean;
  aiConfidenceScore: number | null;
  createdAt: string;
}

interface ProviderProfile {
  id: string;
  name: string;
  providerType: string;
  specialty: string | null;
  organization: string | null;
  isAiProvider: boolean;
  isAvailable: boolean;
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  general: { icon: "message-circle", color: "#6B7280", label: "General" },
  medication: { icon: "heart", color: "#8B5CF6", label: "Medication" },
  appointment: { icon: "calendar", color: "#0066CC", label: "Appointment" },
  lab_results: { icon: "file-text", color: "#10B981", label: "Lab Results" },
  symptoms: { icon: "activity", color: "#F97316", label: "Symptoms" },
  billing: { icon: "credit-card", color: "#6366F1", label: "Billing" },
  referral: { icon: "users", color: "#EC4899", label: "Referral" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  routine: { color: "#10B981", label: "Routine" },
  urgent: { color: "#F97316", label: "Urgent" },
  emergency: { color: "#EF4444", label: "Emergency" },
};

function ThreadCard({ thread, onPress, theme }: {
  thread: MessagingThread;
  onPress: () => void;
  theme: any;
}) {
  const categoryConfig = CATEGORY_CONFIG[thread.category || "general"] || CATEGORY_CONFIG.general;
  const priorityConfig = PRIORITY_CONFIG[thread.priority] || PRIORITY_CONFIG.routine;
  const hasUnread = thread.messages?.some(m => !m.isRead && m.senderType !== "patient");
  
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        style={[styles.threadCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={onPress}
        testID={`thread-card-${thread.id}`}
      >
        <View style={styles.threadHeader}>
          <View style={[styles.categoryIcon, { backgroundColor: categoryConfig.color + "20" }]}>
            <Feather name={categoryConfig.icon as any} size={20} color={categoryConfig.color} />
          </View>
          <View style={styles.threadInfo}>
            <View style={styles.threadTitleRow}>
              <ThemedText type="h4" style={{ color: theme.text, flex: 1 }} numberOfLines={1}>
                {thread.subject || "New Message"}
              </ThemedText>
              {hasUnread ? (
                <View style={styles.unreadDot} />
              ) : null}
            </View>
            <View style={styles.threadMeta}>
              <View style={[styles.badge, { backgroundColor: categoryConfig.color + "20" }]}>
                <ThemedText type="small" style={{ color: categoryConfig.color }}>
                  {categoryConfig.label}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: priorityConfig.color + "20" }]}>
                <ThemedText type="small" style={{ color: priorityConfig.color }}>
                  {priorityConfig.label}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>
        
        {thread.aiTriageSummary ? (
          <View style={[styles.aiTriageInfo, { backgroundColor: theme.primary + "10" }]}>
            <Feather name="cpu" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6, flex: 1 }}>
              AI: {thread.aiTriageSummary}
            </ThemedText>
          </View>
        ) : null}
        
        <View style={[styles.threadFooter, { borderTopColor: theme.border }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleDateString() : "No messages yet"}
          </ThemedText>
          <View style={[styles.statusBadge, {
            backgroundColor: thread.status === "open" ? "#10B98120" : 
                            thread.status === "resolved" ? "#6B728020" : "#F9731620"
          }]}>
            <ThemedText type="small" style={{
              color: thread.status === "open" ? "#10B981" : 
                     thread.status === "resolved" ? "#6B7280" : "#F97316"
            }}>
              {thread.status}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function MessageBubble({ message, theme, isCurrentUser }: {
  message: SecureMessage;
  theme: any;
  isCurrentUser: boolean;
}) {
  const isAi = message.senderType === "ai_assistant";
  
  return (
    <View style={[
      styles.messageBubble,
      isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
      { 
        backgroundColor: isCurrentUser 
          ? theme.primary 
          : isAi 
            ? theme.primary + "15" 
            : theme.backgroundDefault 
      }
    ]}>
      {isAi ? (
        <View style={styles.aiIndicator}>
          <Feather name="cpu" size={12} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>
            AI Assistant
          </ThemedText>
        </View>
      ) : null}
      <ThemedText 
        type="body" 
        style={{ 
          color: isCurrentUser ? "#FFFFFF" : theme.text,
        }}
      >
        {message.content}
      </ThemedText>
      <ThemedText 
        type="small" 
        style={{ 
          color: isCurrentUser ? "rgba(255,255,255,0.7)" : theme.textSecondary,
          marginTop: 4,
          textAlign: isCurrentUser ? "right" : "left",
        }}
      >
        {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </ThemedText>
    </View>
  );
}

function NewThreadModal({ visible, onClose, onSubmit, isLoading, theme }: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { subject: string; message: string; category: string }) => void;
  isLoading: boolean;
  theme: any;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");

  const handleSubmit = () => {
    if (!subject.trim() || !message.trim()) return;
    onSubmit({ subject, message, category });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close new message">
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3" style={{ color: theme.text, flex: 1, textAlign: "center" }}>
            New Message
          </ThemedText>
          <Pressable 
            onPress={handleSubmit}
            disabled={!subject.trim() || !message.trim() || isLoading}
            style={styles.sendButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <ThemedText type="body" style={{ 
                color: subject.trim() && message.trim() ? theme.primary : theme.textSecondary 
              }}>
                Send
              </ThemedText>
            )}
          </Pressable>
        </View>

        <View style={styles.modalContent}>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
            Start a secure conversation with your care team. Our AI will help route your message to the right provider.
          </ThemedText>

          <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.sm }}>
            Category
          </ThemedText>
          <View style={styles.categoryGrid}>
            {Object.entries(CATEGORY_CONFIG).slice(0, 6).map(([key, config]) => (
              <Pressable
                key={key}
                style={[
                  styles.categoryCard,
                  { 
                    backgroundColor: category === key ? config.color + "20" : theme.backgroundDefault,
                    borderColor: category === key ? config.color : theme.border,
                  },
                ]}
                onPress={() => setCategory(key)}
              >
                <Feather name={config.icon as any} size={18} color={config.color} />
                <ThemedText type="small" style={{ color: theme.text, marginTop: 4 }}>
                  {config.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Subject
          </ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
            placeholder="Brief description of your inquiry"
            placeholderTextColor={theme.textSecondary}
            value={subject}
            onChangeText={setSubject}
            testID="message-subject-input"
          />

          <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
            Message
          </ThemedText>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border }]}
            placeholder="Describe your question or concern in detail..."
            placeholderTextColor={theme.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            testID="message-content-input"
          />

          <View style={[styles.aiNote, { backgroundColor: theme.primary + "10" }]}>
            <Feather name="info" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary, marginLeft: 8, flex: 1 }}>
              Our AI will analyze your message to determine priority and route it to the appropriate care team member.
            </ThemedText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ProviderMessagingScreen({ navigation }: { navigation: any }) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  
  const [selectedThread, setSelectedThread] = useState<MessagingThread | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const { data: threads = [], isLoading: loadingThreads, refetch: refetchThreads } = useQuery<MessagingThread[]>({
    queryKey: ["/api/messaging/threads"],
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/messaging/unread-count"],
  });

  const { data: threadDetails, refetch: refetchThread } = useQuery<MessagingThread>({
    queryKey: ["/api/messaging/threads", selectedThread?.id],
    enabled: !!selectedThread,
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; category: string }) => {
      const response = await apiRequest("POST", "/api/messaging/threads", data);
      return response.json();
    },
    onSuccess: (newThread) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/unread-count"] });
      setShowNewModal(false);
      setSelectedThread(newThread);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      const response = await apiRequest("POST", `/api/messaging/threads/${threadId}/messages`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/threads", selectedThread?.id] });
      setNewMessage("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const messages = threadDetails?.messages || [];

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedThread) return;
    sendMessageMutation.mutate({ threadId: selectedThread.id, content: newMessage.trim() });
  };

  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {!selectedThread ? (
        <>
          <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
            <View style={styles.headerContent}>
              <ThemedText type="h2" style={{ color: theme.text }}>Messages</ThemedText>
              {unreadCount && unreadCount.count > 0 ? (
                <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}>
                  <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    {unreadCount.count}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <Pressable
              style={[styles.newButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowNewModal(true)}
              testID="new-message-button"
            >
              <Feather name="edit" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: 8 }}>
                New
              </ThemedText>
            </Pressable>
          </View>

          <FlatList
            data={threads}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ThreadCard
                thread={item}
                onPress={() => setSelectedThread(item)}
                theme={theme}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            ListEmptyComponent={
              <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
                <Feather name="message-circle" size={48} color={theme.textSecondary} />
                <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.md }}>
                  No Messages Yet
                </ThemedText>
                <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
                  Start a secure conversation with your healthcare team.
                </ThemedText>
                <Pressable
                  style={[styles.ctaButton, { backgroundColor: theme.primary }]}
                  onPress={() => setShowNewModal(true)}
                >
                  <Feather name="edit" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: 8 }}>
                    Start Conversation
                  </ThemedText>
                </Pressable>
              </Animated.View>
            }
            refreshing={loadingThreads}
            onRefresh={refetchThreads}
          />
        </>
      ) : (
        <KeyboardAvoidingView 
          style={styles.chatContainer} 
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.chatHeader, { paddingTop: insets.top + Spacing.sm, borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setSelectedThread(null)} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.chatHeaderInfo}>
              <ThemedText type="h4" style={{ color: theme.text }} numberOfLines={1}>
                {threadDetails?.subject || "Conversation"}
              </ThemedText>
              {threadDetails?.category ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {CATEGORY_CONFIG[threadDetails.category]?.label || threadDetails.category}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                theme={theme}
                isCurrentUser={item.senderType === "patient"}
              />
            )}
            contentContainerStyle={styles.messagesContent}
            inverted={false}
          />

          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.sm, borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.messageInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.textSecondary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              testID="chat-input"
            />
            <Pressable
              style={[styles.sendMessageButton, { 
                backgroundColor: newMessage.trim() ? theme.primary : theme.backgroundDefault 
              }]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={20} color={newMessage.trim() ? "#FFFFFF" : theme.textSecondary} />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <NewThreadModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSubmit={(data) => createThreadMutation.mutate(data)}
        isLoading={createThreadMutation.isPending}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
  },
  threadCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  threadInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  threadTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0066CC",
    marginLeft: 8,
  },
  threadMeta: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiTriageInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  threadFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: "center",
    marginTop: 100,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  messagesContent: {
    padding: Spacing.md,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  messageBubbleLeft: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageBubbleRight: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  aiIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  messageInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 20,
    marginRight: Spacing.sm,
    fontSize: 16,
  },
  sendMessageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 60,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  modalContent: {
    padding: Spacing.md,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryCard: {
    flex: 1,
    minWidth: "30%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 120,
  },
  aiNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});
