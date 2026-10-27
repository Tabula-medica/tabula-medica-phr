import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  FlatList,
  Platform,
  Modal,
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
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";

interface MessageThread {
  thread: {
    id: string;
    patientId: string;
    providerId: string | null;
    subject: string;
    status: string;
    category: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
  };
  lastMessage: {
    id: string;
    content: string;
    senderType: string;
    createdAt: string;
  } | null;
  participants: {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
  }[];
  unreadCount: number;
}

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderType: string;
  messageType: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface CareTeamMember {
  id: string;
  userId: string;
  userName: string;
  role: string;
  accessLevel: string;
}

export default function SecureMessagingScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const { checkFeature, promptProps } = useFeatureGate();

  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<CareTeamMember | null>(null);

  const { data: threads = [], isLoading: loadingThreads, refetch: refetchThreads } = useQuery<MessageThread[]>({
    queryKey: ["/api/messaging/threads"],
  });

  const { data: messages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery<Message[]>({
    queryKey: [`/api/messaging/threads/${selectedThread?.thread.id}`],
    enabled: !!selectedThread,
  });

  const { data: careTeamMembers = [] } = useQuery<CareTeamMember[]>({
    queryKey: ["/api/collaboration/my-care-team"],
    enabled: showNewThreadModal,
  });

  const { data: unreadCount = { unreadCount: 0 } } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/messaging/unread-count"],
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/messaging/threads", {
        recipientId: selectedRecipient?.userId || null,
        subject: newThreadSubject,
        category: "general",
        priority: "routine",
      });
    },
    onSuccess: async (thread: any) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/messaging/threads"] });
      setShowNewThreadModal(false);
      setNewThreadSubject("");
      setSelectedRecipient(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newThread: MessageThread = {
        thread: thread,
        lastMessage: null,
        participants: [],
        unreadCount: 0,
      };
      setSelectedThread(newThread);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/messaging/threads/${selectedThread?.thread.id}/messages`, {
        content: newMessage,
        messageType: "text",
      });
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      refetchThreads();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest("POST", `/api/messaging/messages/${messageId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/threads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messaging/unread-count"] });
    },
  });

  const handleSelectThread = useCallback((thread: MessageThread) => {
    setSelectedThread(thread);
    if (thread.unreadCount > 0) {
      markAsReadMutation.mutate(thread.thread.id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || !selectedThread) return;
    sendMessageMutation.mutate();
  }, [newMessage, selectedThread]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const renderThreadItem = ({ item, index }: { item: MessageThread; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30)}>
      <Pressable
        style={[
          styles.threadCard,
          { backgroundColor: colors.backgroundRootDefault },
          item.unreadCount > 0 && { borderLeftColor: colors.primary, borderLeftWidth: 3 },
        ]}
        onPress={() => handleSelectThread(item)}
        testID={`thread-item-${item.thread.id}`}
      >
        <View style={styles.threadHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="message-circle" size={20} color={colors.primary} />
          </View>
          <View style={styles.threadInfo}>
            <ThemedText style={[styles.threadSubject, { color: colors.text }]} numberOfLines={1}>
              {item.thread.subject}
            </ThemedText>
            {item.lastMessage ? (
              <ThemedText style={[styles.threadPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.lastMessage.content}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.threadMeta}>
            {item.lastMessage ? (
              <ThemedText style={[styles.threadTime, { color: colors.textSecondary }]}>
                {formatTime(item.lastMessage.createdAt)}
              </ThemedText>
            ) : null}
            {item.unreadCount > 0 ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.unreadText}>{item.unreadCount}</ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.participantRow}>
          {item.participants.slice(0, 3).map((p, i) => (
            <View
              key={p.id || i}
              style={[styles.participantChip, { backgroundColor: colors.backgroundRoot }]}
            >
              <ThemedText style={[styles.participantName, { color: colors.textSecondary }]}>
                {p.userName}
              </ThemedText>
            </View>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.senderType === "patient";
    
    return (
      <Animated.View
        entering={FadeIn.delay(index * 20)}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.backgroundRoot },
          ]}
        >
          <ThemedText
            style={[
              styles.messageContent,
              { color: isOwnMessage ? "#fff" : colors.text },
            ]}
          >
            {item.content}
          </ThemedText>
          <ThemedText
            style={[
              styles.messageTime,
              { color: isOwnMessage ? "rgba(255,255,255,0.7)" : colors.textSecondary },
            ]}
          >
            {formatTime(item.createdAt)}
          </ThemedText>
        </View>
      </Animated.View>
    );
  };

  const renderThreadList = () => (
    <View style={styles.container}>
      <UpgradePrompt {...promptProps} />
      <Pressable
        style={[styles.newThreadButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (!checkFeature("secure_messaging")) return;
          setShowNewThreadModal(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        testID="new-thread-button"
      >
        <Feather name="plus" size={20} color="#fff" />
        <ThemedText style={styles.newThreadButtonText}>New Conversation</ThemedText>
      </Pressable>

      {loadingThreads ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : threads.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="message-circle" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
            No Conversations
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Start a secure conversation with your care team
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={threads}
          renderItem={renderThreadItem}
          keyExtractor={(item) => item.thread.id}
          contentContainerStyle={[
            styles.threadList,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderConversation = () => (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <View style={[styles.conversationHeader, { backgroundColor: colors.backgroundRootDefault }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            setSelectedThread(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Feather name="arrow-left" size={20} color={colors.primary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {selectedThread?.thread.subject}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {selectedThread?.participants.map(p => p.userName).join(", ") || "Secure conversation"}
          </ThemedText>
        </View>
      </View>

      {loadingMessages ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            { paddingTop: Spacing.md, paddingBottom: Spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
          inverted={messages.length > 0}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Feather name="message-square" size={36} color={colors.textSecondary} />
              <ThemedText style={[styles.emptyMessagesText, { color: colors.textSecondary }]}>
                Start the conversation
              </ThemedText>
            </View>
          }
        />
      )}

      <View style={[styles.inputContainer, { backgroundColor: colors.backgroundRootDefault, paddingBottom: insets.bottom + Spacing.sm }]}>
        <TextInput
          style={[
            styles.messageInput,
            { backgroundColor: colors.backgroundRoot, color: colors.text },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={2000}
          testID="message-input"
        />
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: newMessage.trim() ? colors.primary : colors.backgroundRoot },
          ]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sendMessageMutation.isPending}
          testID="send-message-button"
        >
          {sendMessageMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather
              name="send"
              size={20}
              color={newMessage.trim() ? "#fff" : colors.textSecondary}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <View style={[styles.screen, { paddingTop: headerHeight + Spacing.md }]}>
      {selectedThread ? renderConversation() : renderThreadList()}

      <Modal
        visible={showNewThreadModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewThreadModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRootDefault }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowNewThreadModal(false)}>
              <ThemedText style={[styles.modalCancel, { color: colors.textSecondary }]}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              New Conversation
            </ThemedText>
            <Pressable
              onPress={() => createThreadMutation.mutate()}
              disabled={!newThreadSubject.trim() || createThreadMutation.isPending}
            >
              {createThreadMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ThemedText
                  style={[
                    styles.modalCreate,
                    { color: newThreadSubject.trim() ? colors.primary : colors.textSecondary },
                  ]}
                >
                  Create
                </ThemedText>
              )}
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            <ThemedText style={[styles.inputLabel, { color: colors.text }]}>Subject</ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="What would you like to discuss?"
              placeholderTextColor={colors.textSecondary}
              value={newThreadSubject}
              onChangeText={setNewThreadSubject}
              maxLength={200}
              testID="thread-subject-input"
            />

            <ThemedText style={[styles.inputLabel, { color: colors.text, marginTop: Spacing.lg }]}>
              Recipient (Optional)
            </ThemedText>
            {careTeamMembers.length === 0 ? (
              <View style={[styles.noRecipients, { backgroundColor: colors.backgroundRoot }]}>
                <Feather name="users" size={24} color={colors.textSecondary} />
                <ThemedText style={[styles.noRecipientsText, { color: colors.textSecondary }]}>
                  No care team members yet. Invite providers or family members first.
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={careTeamMembers}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.recipientItem,
                      { backgroundColor: colors.backgroundRoot },
                      selectedRecipient?.userId === item.userId && {
                        borderColor: colors.primary,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => {
                      setSelectedRecipient(
                        selectedRecipient?.userId === item.userId ? null : item
                      );
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View style={[styles.recipientAvatar, { backgroundColor: colors.primary + "20" }]}>
                      <ThemedText style={[styles.recipientInitial, { color: colors.primary }]}>
                        {item.userName.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.recipientInfo}>
                      <ThemedText style={[styles.recipientName, { color: colors.text }]}>
                        {item.userName}
                      </ThemedText>
                      <ThemedText style={[styles.recipientRole, { color: colors.textSecondary }]}>
                        {item.role.replace(/_/g, " ")}
                      </ThemedText>
                    </View>
                    {selectedRecipient?.userId === item.userId ? (
                      <Feather name="check-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                )}
                keyExtractor={(item) => item.id}
                style={styles.recipientList}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loader: {
    marginTop: Spacing["2xl"],
  },
  newThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  newThreadButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  threadList: {
    paddingHorizontal: Spacing.lg,
  },
  threadCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  threadInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  threadSubject: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  threadPreview: {
    fontSize: 14,
  },
  threadMeta: {
    alignItems: "flex-end",
  },
  threadTime: {
    fontSize: 12,
    marginBottom: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  participantRow: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  participantChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  participantName: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: Spacing.sm,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    fontSize: 12,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
  },
  messageContainer: {
    marginBottom: Spacing.sm,
    maxWidth: "80%",
  },
  ownMessage: {
    alignSelf: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: Spacing.xs,
    alignSelf: "flex-end",
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyMessagesText: {
    marginTop: Spacing.sm,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  messageInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  modalCreate: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  modalInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  noRecipients: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  noRecipientsText: {
    fontSize: 14,
    textAlign: "center",
  },
  recipientList: {
    maxHeight: 300,
  },
  recipientItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  recipientInitial: {
    fontSize: 18,
    fontWeight: "600",
  },
  recipientInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  recipientName: {
    fontSize: 15,
    fontWeight: "500",
  },
  recipientRole: {
    fontSize: 13,
  },
});
