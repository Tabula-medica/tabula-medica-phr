import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as SMS from "expo-sms";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface SMSLogEntry {
  id: string;
  recipientPhone: string;
  recipientName: string;
  messagePreview: string;
  status: string;
  sentAt: string;
}

interface CareTeamContact {
  id: string;
  userId: string;
  userName: string;
  role: string;
  phone?: string;
}

interface ReminderStatus {
  configured: boolean;
  maskedPhone?: string;
}

type SendMode = "device" | "server";

export default function SMSMessageScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [smsAvailable, setSmsAvailable] = useState<boolean | null>(null);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CareTeamContact | null>(null);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "cancelled" | "error">("idle");
  const [sendMode, setSendMode] = useState<SendMode>("device");

  const [verificationPhone, setVerificationPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationStep, setVerificationStep] = useState<"phone" | "code" | "verified">("phone");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");

  const [reminderTestPhone, setReminderTestPhone] = useState("");
  const [reminderTestMessage, setReminderTestMessage] = useState("");
  const [reminderTestError, setReminderTestError] = useState("");

  useEffect(() => {
    checkSMSAvailability();
  }, []);

  const checkSMSAvailability = async () => {
    const isAvailable = await SMS.isAvailableAsync();
    setSmsAvailable(isAvailable);
  };

  const { data: smsLog = [], isLoading: loadingLog } = useQuery<SMSLogEntry[]>({
    queryKey: ["/api/sms/log"],
  });

  const { data: careTeamContacts = [] } = useQuery<CareTeamContact[]>({
    queryKey: ["/api/collaboration/my-care-team"],
    enabled: showContactPicker,
  });

  const { data: reminderStatus, isLoading: loadingReminderStatus } = useQuery<ReminderStatus>({
    queryKey: ["/api/sms/reminder-status"],
  });

  const logSmsMutation = useMutation({
    mutationFn: async (data: { recipientPhone: string; recipientName: string; messagePreview: string; status: string }) => {
      return apiRequest("POST", "/api/sms/log", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/log"] });
    },
  });

  const serverSmsMutation = useMutation({
    mutationFn: async (data: { to: string; message: string }) => {
      const res = await apiRequest("POST", "/api/sms/send", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms/log"] });
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async (data: { phone: string }) => {
      const res = await apiRequest("POST", "/api/sms/verification/send", data);
      return res.json();
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async (data: { code: string }) => {
      const res = await apiRequest("POST", "/api/sms/verification/verify", data);
      return res.json();
    },
  });

  const testReminderMutation = useMutation({
    mutationFn: async (data: { phone: string }) => {
      const res = await apiRequest("POST", "/api/sms/medication-reminder/test", data);
      return res.json();
    },
  });

  const handleSelectContact = useCallback((contact: CareTeamContact) => {
    setSelectedContact(contact);
    if (contact.phone) {
      setPhoneNumber(contact.phone);
    }
    setShowContactPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSendSMS = useCallback(async () => {
    if (!phoneNumber.trim() || !messageBody.trim()) return;

    setSendStatus("sending");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (sendMode === "server") {
      try {
        await serverSmsMutation.mutateAsync({
          to: phoneNumber.trim(),
          message: messageBody.trim(),
        });
        setSendStatus("sent");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        logSmsMutation.mutate({
          recipientPhone: phoneNumber.trim(),
          recipientName: selectedContact?.userName || "Unknown",
          messagePreview: messageBody.trim().substring(0, 100),
          status: "sent",
        });

        setMessageBody("");
        setPhoneNumber("");
        setSelectedContact(null);
        setTimeout(() => setSendStatus("idle"), 3000);
      } catch (error) {
        setSendStatus("error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => setSendStatus("idle"), 3000);
      }
      return;
    }

    try {
      const { result } = await SMS.sendSMSAsync(
        [phoneNumber.trim()],
        messageBody.trim()
      );

      if (result === "sent") {
        setSendStatus("sent");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result === "cancelled") {
        setSendStatus("cancelled");
      } else {
        setSendStatus("sent");
      }

      logSmsMutation.mutate({
        recipientPhone: phoneNumber.trim(),
        recipientName: selectedContact?.userName || "Unknown",
        messagePreview: messageBody.trim().substring(0, 100),
        status: result === "cancelled" ? "cancelled" : "sent",
      });

      if (result !== "cancelled") {
        setMessageBody("");
        setPhoneNumber("");
        setSelectedContact(null);
      }

      setTimeout(() => setSendStatus("idle"), 3000);
    } catch (error) {
      setSendStatus("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setSendStatus("idle"), 3000);
    }
  }, [phoneNumber, messageBody, selectedContact, sendMode]);

  const handleSendVerification = useCallback(async () => {
    if (!verificationPhone.trim()) return;
    setVerificationMessage("");
    setVerificationError("");
    try {
      await sendVerificationMutation.mutateAsync({ phone: verificationPhone.trim() });
      setVerificationStep("code");
      setVerificationMessage("Verification code sent successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setVerificationError(error?.message || "Failed to send verification code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [verificationPhone]);

  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode.trim()) return;
    setVerificationMessage("");
    setVerificationError("");
    try {
      await verifyCodeMutation.mutateAsync({ code: verificationCode.trim() });
      setVerificationStep("verified");
      setVerificationMessage("Phone number verified successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setVerificationError(error?.message || "Invalid verification code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [verificationCode]);

  const handleTestReminder = useCallback(async () => {
    if (!reminderTestPhone.trim()) return;
    setReminderTestMessage("");
    setReminderTestError("");
    try {
      await testReminderMutation.mutateAsync({ phone: reminderTestPhone.trim() });
      setReminderTestMessage("Test reminder sent successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setReminderTestError(error?.message || "Failed to send test reminder");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [reminderTestPhone]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return colors.success;
      case "cancelled":
        return colors.warning;
      case "error":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderLogEntry = ({ item, index }: { item: SMSLogEntry; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 30)}>
      <View
        style={[
          styles.logCard,
          { backgroundColor: colors.backgroundRootDefault },
        ]}
      >
        <View style={styles.logHeader}>
          <View style={[styles.logIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="smartphone" size={18} color={colors.primary} />
          </View>
          <View style={styles.logInfo}>
            <ThemedText style={[styles.logName, { color: colors.text }]} numberOfLines={1}>
              {item.recipientName}
            </ThemedText>
            <ThemedText style={[styles.logPhone, { color: colors.textSecondary }]}>
              {item.recipientPhone}
            </ThemedText>
          </View>
          <View style={styles.logMeta}>
            <ThemedText style={[styles.logTime, { color: colors.textSecondary }]}>
              {formatTime(item.sentAt)}
            </ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
              <ThemedText style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status}
              </ThemedText>
            </View>
          </View>
        </View>
        <ThemedText style={[styles.logPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.messagePreview}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderContactItem = ({ item, index }: { item: CareTeamContact; index: number }) => (
    <Pressable
      style={[styles.contactItem, { backgroundColor: colors.backgroundRoot }]}
      onPress={() => handleSelectContact(item)}
      testID={`contact-item-${item.id}`}
    >
      <View style={[styles.contactAvatar, { backgroundColor: colors.primary + "20" }]}>
        <ThemedText style={[styles.contactInitial, { color: colors.primary }]}>
          {item.userName.charAt(0).toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.contactInfo}>
        <ThemedText style={[styles.contactName, { color: colors.text }]}>
          {item.userName}
        </ThemedText>
        <ThemedText style={[styles.contactRole, { color: colors.textSecondary }]}>
          {item.role}
        </ThemedText>
      </View>
      {item.phone ? (
        <ThemedText style={[styles.contactPhone, { color: colors.textSecondary }]}>
          {item.phone}
        </ThemedText>
      ) : null}
    </Pressable>
  );

  if (smsAvailable === null) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.backgroundRoot, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (smsAvailable === false && Platform.OS !== "web" && sendMode === "device") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.backgroundRoot, paddingTop: headerHeight }]}>
        <Feather name="smartphone" size={48} color={colors.textSecondary} />
        <ThemedText style={[styles.unavailableTitle, { color: colors.text }]}>
          SMS Not Available
        </ThemedText>
        <ThemedText style={[styles.unavailableText, { color: colors.textSecondary }]}>
          Device SMS is not available. Try switching to Server SMS (Twilio) mode.
        </ThemedText>
        <Pressable
          style={[styles.switchModeButton, { backgroundColor: colors.primary }]}
          onPress={() => setSendMode("server")}
          testID="button-switch-to-server"
        >
          <Feather name="server" size={16} color="#fff" />
          <ThemedText style={styles.switchModeButtonText}>
            {"Switch to Server SMS"}
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {Platform.OS === "web" && sendMode === "device" ? (
          <Animated.View entering={FadeIn}>
            <View style={[styles.webNotice, { backgroundColor: colors.info + "15", borderColor: colors.info + "40" }]}>
              <Feather name="info" size={18} color={colors.info} />
              <ThemedText style={[styles.webNoticeText, { color: colors.info }]}>
                {"Run in Expo Go to use Device SMS, or switch to Server SMS (Twilio)"}
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(50)}>
          <View style={[styles.composeCard, { backgroundColor: colors.backgroundRootDefault }]}>
            <View style={styles.composeHeader}>
              <Feather name="send" size={20} color={colors.primary} />
              <ThemedText style={[styles.composeTitle, { color: colors.text }]}>
                {"Compose SMS"}
              </ThemedText>
            </View>

            <View style={styles.modeToggleContainer}>
              <Pressable
                style={[
                  styles.modeToggleButton,
                  { borderColor: colors.border },
                  sendMode === "device" ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundRoot },
                ]}
                onPress={() => setSendMode("device")}
                testID="toggle-device-sms"
              >
                <Feather
                  name="smartphone"
                  size={14}
                  color={sendMode === "device" ? "#fff" : colors.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.modeToggleText,
                    { color: sendMode === "device" ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {"Device SMS"}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modeToggleButton,
                  { borderColor: colors.border },
                  sendMode === "server" ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundRoot },
                ]}
                onPress={() => setSendMode("server")}
                testID="toggle-server-sms"
              >
                <Feather
                  name="server"
                  size={14}
                  color={sendMode === "server" ? "#fff" : colors.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.modeToggleText,
                    { color: sendMode === "server" ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {"Server SMS (Twilio)"}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {"Recipient"}
              </ThemedText>
              <View style={styles.recipientRow}>
                <TextInput
                  style={[
                    styles.phoneInput,
                    { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  testID="input-phone-number"
                />
                <Pressable
                  style={[styles.contactButton, { backgroundColor: colors.primary + "15" }]}
                  onPress={() => {
                    setShowContactPicker(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  testID="button-pick-contact"
                >
                  <Feather name="users" size={20} color={colors.primary} />
                </Pressable>
              </View>
              {selectedContact ? (
                <View style={[styles.selectedContactChip, { backgroundColor: colors.primary + "15" }]}>
                  <ThemedText style={[styles.selectedContactText, { color: colors.primary }]}>
                    {selectedContact.userName} ({selectedContact.role})
                  </ThemedText>
                  <Pressable
                    onPress={() => {
                      setSelectedContact(null);
                      setPhoneNumber("");
                    }}
                  >
                    <Feather name="x" size={16} color={colors.primary} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {"Message"}
              </ThemedText>
              <TextInput
                style={[
                  styles.messageInput,
                  { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Type your message..."
                placeholderTextColor={colors.textSecondary}
                value={messageBody}
                onChangeText={setMessageBody}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                testID="input-sms-message"
              />
              <ThemedText style={[styles.charCount, { color: colors.textSecondary }]}>
                {messageBody.length} / 160 characters
              </ThemedText>
            </View>

            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (!phoneNumber.trim() || !messageBody.trim() || sendStatus === "sending") ? styles.sendButtonDisabled : null,
              ]}
              onPress={handleSendSMS}
              disabled={!phoneNumber.trim() || !messageBody.trim() || sendStatus === "sending"}
              testID="button-send-sms"
            >
              {sendStatus === "sending" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather
                    name={sendStatus === "sent" ? "check-circle" : sendStatus === "error" ? "alert-circle" : "send"}
                    size={18}
                    color="#fff"
                  />
                  <ThemedText style={styles.sendButtonText}>
                    {sendStatus === "sent"
                      ? "Sent"
                      : sendStatus === "error"
                      ? "Failed - Try Again"
                      : sendStatus === "cancelled"
                      ? "Cancelled"
                      : sendMode === "server"
                      ? "Send via Twilio"
                      : "Send SMS"}
                  </ThemedText>
                </>
              )}
            </Pressable>

            {sendMode === "server" ? (
              <View style={[styles.modeInfoBanner, { backgroundColor: colors.info + "10", borderColor: colors.info + "30" }]}>
                <Feather name="zap" size={14} color={colors.info} />
                <ThemedText style={[styles.modeInfoText, { color: colors.info }]}>
                  {"Messages will be sent via Twilio server-side API"}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100)}>
          <View style={[styles.verificationCard, { backgroundColor: colors.backgroundRootDefault }]}>
            <View style={styles.composeHeader}>
              <Feather name="shield" size={20} color={colors.primary} />
              <ThemedText style={[styles.composeTitle, { color: colors.text }]}>
                {"SMS Verification"}
              </ThemedText>
            </View>

            {verificationStep === "phone" ? (
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {"Phone Number"}
                </ThemedText>
                <TextInput
                  style={[
                    styles.phoneInput,
                    { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Enter phone number to verify"
                  placeholderTextColor={colors.textSecondary}
                  value={verificationPhone}
                  onChangeText={setVerificationPhone}
                  keyboardType="phone-pad"
                  testID="input-verification-phone"
                />
                <Pressable
                  style={[
                    styles.verificationButton,
                    { backgroundColor: colors.primary },
                    !verificationPhone.trim() || sendVerificationMutation.isPending ? styles.sendButtonDisabled : null,
                  ]}
                  onPress={handleSendVerification}
                  disabled={!verificationPhone.trim() || sendVerificationMutation.isPending}
                  testID="button-send-verification"
                >
                  {sendVerificationMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="send" size={16} color="#fff" />
                      <ThemedText style={styles.sendButtonText}>
                        {"Send Verification Code"}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            {verificationStep === "code" ? (
              <View style={styles.fieldGroup}>
                <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {"Verification Code"}
                </ThemedText>
                <TextInput
                  style={[
                    styles.phoneInput,
                    { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={colors.textSecondary}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  testID="input-verification-code"
                />
                <View style={styles.verificationActions}>
                  <Pressable
                    style={[
                      styles.verificationButton,
                      { backgroundColor: colors.primary, flex: 1 },
                      !verificationCode.trim() || verifyCodeMutation.isPending ? styles.sendButtonDisabled : null,
                    ]}
                    onPress={handleVerifyCode}
                    disabled={!verificationCode.trim() || verifyCodeMutation.isPending}
                    testID="button-verify-code"
                  >
                    {verifyCodeMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check" size={16} color="#fff" />
                        <ThemedText style={styles.sendButtonText}>
                          {"Verify Code"}
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.resendButton, { borderColor: colors.border }]}
                    onPress={() => {
                      setVerificationStep("phone");
                      setVerificationCode("");
                      setVerificationMessage("");
                      setVerificationError("");
                    }}
                    testID="button-resend-code"
                  >
                    <Feather name="refresh-cw" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {verificationStep === "verified" ? (
              <View style={[styles.verificationSuccess, { backgroundColor: colors.success + "15" }]}>
                <Feather name="check-circle" size={24} color={colors.success} />
                <ThemedText style={[styles.verificationSuccessText, { color: colors.success }]}>
                  {"Phone number verified"}
                </ThemedText>
                <Pressable
                  style={[styles.resetButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setVerificationStep("phone");
                    setVerificationPhone("");
                    setVerificationCode("");
                    setVerificationMessage("");
                    setVerificationError("");
                  }}
                  testID="button-reset-verification"
                >
                  <ThemedText style={[styles.resetButtonText, { color: colors.textSecondary }]}>
                    {"Verify Another Number"}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            {verificationMessage ? (
              <View style={[styles.inlineMessage, { backgroundColor: colors.success + "15" }]}>
                <Feather name="check-circle" size={14} color={colors.success} />
                <ThemedText style={[styles.inlineMessageText, { color: colors.success }]}>
                  {verificationMessage}
                </ThemedText>
              </View>
            ) : null}

            {verificationError ? (
              <View style={[styles.inlineMessage, { backgroundColor: colors.error + "15" }]}>
                <Feather name="alert-circle" size={14} color={colors.error} />
                <ThemedText style={[styles.inlineMessageText, { color: colors.error }]}>
                  {verificationError}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120)}>
          <View style={[styles.reminderCard, { backgroundColor: colors.backgroundRootDefault }]}>
            <View style={styles.composeHeader}>
              <Feather name="clock" size={20} color={colors.primary} />
              <ThemedText style={[styles.composeTitle, { color: colors.text }]}>
                {"Medication Reminder Status"}
              </ThemedText>
            </View>

            {loadingReminderStatus ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            ) : (
              <View style={styles.reminderContent}>
                <View style={styles.reminderStatusRow}>
                  <View style={[
                    styles.reminderStatusDot,
                    { backgroundColor: reminderStatus?.configured ? colors.success : colors.textSecondary },
                  ]} />
                  <ThemedText style={[styles.reminderStatusText, { color: colors.text }]}>
                    {reminderStatus?.configured ? "SMS Reminders Configured" : "SMS Reminders Not Configured"}
                  </ThemedText>
                </View>

                {reminderStatus?.maskedPhone ? (
                  <View style={[styles.maskedPhoneRow, { backgroundColor: colors.backgroundRoot }]}>
                    <Feather name="phone" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.maskedPhoneText, { color: colors.textSecondary }]}>
                      {reminderStatus.maskedPhone}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={[styles.reminderDivider, { backgroundColor: colors.border }]} />

                <ThemedText style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  {"Send Test Reminder"}
                </ThemedText>
                <TextInput
                  style={[
                    styles.phoneInput,
                    { backgroundColor: colors.backgroundRoot, color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  value={reminderTestPhone}
                  onChangeText={setReminderTestPhone}
                  keyboardType="phone-pad"
                  testID="input-reminder-test-phone"
                />
                <Pressable
                  style={[
                    styles.verificationButton,
                    { backgroundColor: colors.primary },
                    !reminderTestPhone.trim() || testReminderMutation.isPending ? styles.sendButtonDisabled : null,
                  ]}
                  onPress={handleTestReminder}
                  disabled={!reminderTestPhone.trim() || testReminderMutation.isPending}
                  testID="button-send-test-reminder"
                >
                  {testReminderMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="bell" size={16} color="#fff" />
                      <ThemedText style={styles.sendButtonText}>
                        {"Send Test Reminder"}
                      </ThemedText>
                    </>
                  )}
                </Pressable>

                {reminderTestMessage ? (
                  <View style={[styles.inlineMessage, { backgroundColor: colors.success + "15" }]}>
                    <Feather name="check-circle" size={14} color={colors.success} />
                    <ThemedText style={[styles.inlineMessageText, { color: colors.success }]}>
                      {reminderTestMessage}
                    </ThemedText>
                  </View>
                ) : null}

                {reminderTestError ? (
                  <View style={[styles.inlineMessage, { backgroundColor: colors.error + "15" }]}>
                    <Feather name="alert-circle" size={14} color={colors.error} />
                    <ThemedText style={[styles.inlineMessageText, { color: colors.error }]}>
                      {reminderTestError}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150)}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              {"Recent Messages"}
            </ThemedText>
          </View>

          {loadingLog ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : smsLog.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
              <Feather name="smartphone" size={40} color={colors.textSecondary} />
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                {"No SMS Messages Yet"}
              </ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {"Send your first text message to a care team member"}
              </ThemedText>
            </View>
          ) : (
            smsLog.map((entry, index) => (
              <View key={entry.id}>
                {renderLogEntry({ item: entry, index })}
              </View>
            ))
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250)}>
          <View style={[styles.disclaimerCard, { backgroundColor: colors.warning + "10", borderColor: colors.warning + "30" }]}>
            <Feather name="alert-triangle" size={16} color={colors.warning} />
            <ThemedText style={[styles.disclaimerText, { color: colors.textSecondary }]}>
              {"Standard SMS is not encrypted. Do not send protected health information (PHI) via text message. Use Secure Messaging for sensitive communications."}
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.backgroundRoot }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.backgroundRootDefault, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setShowContactPicker(false)}>
              <ThemedText style={[styles.modalCancel, { color: colors.primary }]}>{"Cancel"}</ThemedText>
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{"Select Contact"}</ThemedText>
            <View style={{ width: 60 }} />
          </View>
          <FlatList
            data={careTeamContacts}
            renderItem={renderContactItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.contactList}
            ListEmptyComponent={
              <View style={styles.emptyContacts}>
                <Feather name="users" size={36} color={colors.textSecondary} />
                <ThemedText style={[styles.emptyContactsText, { color: colors.textSecondary }]}>
                  {"No care team contacts found"}
                </ThemedText>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: Spacing.lg,
  },
  unavailableText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  switchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  switchModeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  webNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  webNoticeText: {
    fontSize: 13,
    flex: 1,
  },
  composeCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  composeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modeToggleContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modeToggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  modeToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modeInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  modeInfoText: {
    fontSize: 12,
    flex: 1,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recipientRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  phoneInput: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  contactButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedContactChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  selectedContactText: {
    fontSize: 13,
    fontWeight: "500",
  },
  messageInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: Spacing.xs,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  verificationCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  verificationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  verificationActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  resendButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  verificationSuccess: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  verificationSuccessText: {
    fontSize: 16,
    fontWeight: "600",
  },
  resetButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  inlineMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  inlineMessageText: {
    fontSize: 13,
    flex: 1,
  },
  reminderCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  reminderContent: {
    gap: Spacing.sm,
  },
  reminderStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reminderStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reminderStatusText: {
    fontSize: 15,
    fontWeight: "500",
  },
  maskedPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  maskedPhoneText: {
    fontSize: 14,
  },
  reminderDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  logCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  logName: {
    fontSize: 15,
    fontWeight: "500",
  },
  logPhone: {
    fontSize: 12,
  },
  logMeta: {
    alignItems: "flex-end",
  },
  logTime: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  logPreview: {
    fontSize: 13,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  disclaimerCard: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  disclaimerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  loader: {
    padding: Spacing.xl,
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
  contactList: {
    padding: Spacing.lg,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInitial: {
    fontSize: 18,
    fontWeight: "600",
  },
  contactInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  contactName: {
    fontSize: 15,
    fontWeight: "500",
  },
  contactRole: {
    fontSize: 13,
  },
  contactPhone: {
    fontSize: 13,
  },
  emptyContacts: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyContactsText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
});
