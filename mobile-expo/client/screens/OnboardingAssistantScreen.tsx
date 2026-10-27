import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface QuickAction {
  label: string;
  action: string;
  icon: string;
}

interface IntakeField {
  id: string;
  label: string;
  type: "text" | "select" | "date" | "multiselect";
  options?: string[];
  value?: string;
  required?: boolean;
  category: string;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  timestamp: string;
  quickActions?: QuickAction[];
  intakeFields?: IntakeField[];
}

interface OnboardingAssistantProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const STEPS = ["welcome", "profile_basics", "health_conditions", "medications", "goals", "feature_tour", "complete"];

export default function OnboardingAssistantScreen({ onComplete, onSkip }: OnboardingAssistantProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("welcome");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [intakeData, setIntakeData] = useState<Record<string, any>>({});
  const [currentIntakeFields, setCurrentIntakeFields] = useState<IntakeField[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const stepIndex = STEPS.indexOf(currentStep);
  const progress = Math.max(0, stepIndex / (STEPS.length - 1));

  useEffect(() => {
    sendMessage("", "welcome", []);
  }, []);

  const sendMessage = useCallback(async (
    message: string,
    step?: string,
    completed?: string[],
    intake?: Record<string, any>,
  ) => {
    if (isLoading) return;
    setIsLoading(true);

    if (message.trim()) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
    }
    setInputText("");

    try {
      const response = await apiRequest("POST", "/api/onboarding/assistant/chat", {
        message: message.trim(),
        currentStep: step || currentStep,
        completedSteps: completed || completedSteps,
        intakeData: intake || (Object.keys(intakeData).length > 0 ? intakeData : undefined),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const data = await response.json();
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response.content,
        timestamp: data.response.timestamp,
        quickActions: data.response.quickActions,
        intakeFields: data.response.intakeFields,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.intakeFields) {
        setCurrentIntakeFields(data.intakeFields);
      }

      if (data.shouldAdvance && data.nextStep) {
        const newCompleted = [...completedSteps, step || currentStep];
        setCompletedSteps(newCompleted);
        setCurrentStep(data.nextStep);
        setIntakeData({});

        if (data.nextStep === "complete") {
          setIsCompleted(true);
        }
      }
    } catch (error: any) {
      console.error("Assistant chat error:", error);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "I'm having a moment - let me try again. You can also skip this step if you'd like.",
        timestamp: new Date().toISOString(),
        quickActions: [
          { label: "Try again", action: "retry", icon: "refresh-cw" },
          { label: "Skip ahead", action: "advance", icon: "skip-forward" },
        ],
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, currentStep, completedSteps, intakeData]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (action.action === "advance" || action.action === "skip") {
      const currentIdx = STEPS.indexOf(currentStep);
      if (currentIdx < STEPS.length - 1) {
        const newStep = STEPS[currentIdx + 1];
        const newCompleted = [...completedSteps, currentStep];
        setCompletedSteps(newCompleted);
        setCurrentStep(newStep);
        setIntakeData({});
        if (newStep === "complete") {
          setIsCompleted(true);
        }
        sendMessage("", newStep, newCompleted);
      }
      return;
    }

    if (action.action === "navigate_timeline" || action.action === "navigate_ai" || action.action === "navigate_summary") {
      onComplete();
      return;
    }

    sendMessage(action.label);
  }, [currentStep, completedSteps, sendMessage, onComplete]);

  const handleIntakeFieldChange = useCallback((fieldId: string, value: any) => {
    setIntakeData(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleIntakeSubmit = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    sendMessage("", currentStep, completedSteps, intakeData);
    setIntakeData({});
    setCurrentIntakeFields([]);
  }, [currentStep, completedSteps, intakeData, sendMessage]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || isLoading) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    sendMessage(inputText);
  }, [inputText, isLoading, sendMessage]);

  const renderIntakeField = useCallback((field: IntakeField) => {
    if (field.type === "text") {
      return (
        <View key={field.id} style={styles.intakeFieldContainer}>
          <ThemedText style={styles.intakeLabel}>{field.label}</ThemedText>
          <TextInput
            testID={`input-intake-${field.id}`}
            style={[styles.intakeInput, {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            }]}
            value={intakeData[field.id] || ""}
            onChangeText={(v) => handleIntakeFieldChange(field.id, v)}
            placeholder="Type here..."
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      );
    }

    if (field.type === "select") {
      return (
        <View key={field.id} style={styles.intakeFieldContainer}>
          <ThemedText style={styles.intakeLabel}>{field.label}</ThemedText>
          <View style={styles.optionsRow}>
            {field.options?.map((opt) => {
              const selected = intakeData[field.id] === opt;
              return (
                <Pressable
                  testID={`option-${field.id}-${opt}`}
                  key={opt}
                  onPress={() => handleIntakeFieldChange(field.id, opt)}
                  style={[styles.optionChip, {
                    backgroundColor: selected ? theme.primary : theme.backgroundDefault,
                    borderColor: selected ? theme.primary : theme.border,
                  }]}
                >
                  <ThemedText style={[styles.optionChipText, {
                    color: selected ? "#FFFFFF" : theme.textSecondary,
                  }]}>{opt}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (field.type === "multiselect") {
      const selected: string[] = intakeData[field.id] || [];
      return (
        <View key={field.id} style={styles.intakeFieldContainer}>
          <ThemedText style={styles.intakeLabel}>{field.label}</ThemedText>
          <View style={styles.optionsRow}>
            {field.options?.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <Pressable
                  testID={`multiselect-${field.id}-${opt}`}
                  key={opt}
                  onPress={() => {
                    const newVal = isSelected
                      ? selected.filter(s => s !== opt)
                      : [...selected, opt];
                    handleIntakeFieldChange(field.id, newVal);
                  }}
                  style={[styles.optionChip, {
                    backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                    borderColor: isSelected ? theme.primary : theme.border,
                  }]}
                >
                  {isSelected ? (
                    <Feather name="check" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  ) : null}
                  <ThemedText style={[styles.optionChipText, {
                    color: isSelected ? "#FFFFFF" : theme.textSecondary,
                  }]}>{opt}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    return null;
  }, [intakeData, theme, handleIntakeFieldChange]);

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === "user";

    return (
      <Animated.View
        entering={FadeInDown.delay(50).duration(300)}
        style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}
      >
        {!isUser ? (
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="heart" size={16} color={theme.primary} />
          </View>
        ) : null}

        <View style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: theme.primary }]
            : [styles.assistantBubble, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }],
        ]}>
          <ThemedText style={[
            styles.messageText,
            { color: isUser ? "#FFFFFF" : theme.text },
          ]}>{item.content}</ThemedText>
        </View>

        {isUser ? (
          <View style={[styles.avatarCircle, { backgroundColor: theme.textSecondary + "20" }]}>
            <Feather name="user" size={16} color={theme.textSecondary} />
          </View>
        ) : null}
      </Animated.View>
    );
  }, [theme]);

  const renderQuickActions = useCallback(() => {
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMsg?.quickActions || isLoading) return null;

    return (
      <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.quickActionsContainer}>
        {lastAssistantMsg.quickActions.map((action, idx) => (
          <AnimatedPressable
            testID={`quick-action-${action.action}`}
            key={`${action.action}-${idx}`}
            entering={FadeInRight.delay(100 * idx).duration(250)}
            onPress={() => handleQuickAction(action)}
            style={[styles.quickActionButton, { borderColor: theme.primary + "40", backgroundColor: theme.primary + "08" }]}
          >
            <Feather name={action.icon as any} size={16} color={theme.primary} />
            <ThemedText style={[styles.quickActionText, { color: theme.primary }]}>{action.label}</ThemedText>
          </AnimatedPressable>
        ))}
      </Animated.View>
    );
  }, [messages, isLoading, theme, handleQuickAction]);

  const renderIntakeForm = useCallback(() => {
    if (currentIntakeFields.length === 0) return null;

    return (
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={[styles.intakeFormContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        <View style={styles.intakeFormHeader}>
          <Feather name="edit-3" size={16} color={theme.primary} />
          <ThemedText style={[styles.intakeFormTitle, { color: theme.text }]}>
            {currentStep.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </ThemedText>
        </View>

        {currentIntakeFields.map(renderIntakeField)}

        <Pressable
          testID="button-submit-intake"
          onPress={handleIntakeSubmit}
          style={[styles.intakeSubmitButton, { backgroundColor: theme.primary }]}
        >
          <Feather name="check" size={16} color="#FFFFFF" />
          <ThemedText style={styles.intakeSubmitText}>Save & Continue</ThemedText>
        </Pressable>
      </Animated.View>
    );
  }, [currentIntakeFields, currentStep, theme, intakeData, renderIntakeField, handleIntakeSubmit]);

  const renderTypingIndicator = useCallback(() => {
    if (!isLoading) return null;
    return (
      <Animated.View entering={FadeIn.duration(200)} style={[styles.messageRow, styles.messageRowAssistant]}>
        <View style={[styles.avatarCircle, { backgroundColor: theme.primary + "20" }]}>
          <Feather name="heart" size={16} color={theme.primary} />
        </View>
        <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.typingDots}>
            <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
            <View style={[styles.dot, { backgroundColor: theme.textSecondary, opacity: 0.6 }]} />
            <View style={[styles.dot, { backgroundColor: theme.textSecondary, opacity: 0.3 }]} />
          </View>
        </View>
      </Animated.View>
    );
  }, [isLoading, theme]);

  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="message-circle" size={32} color={theme.primary} />
        </View>
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>Your Setup Assistant</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          I'll guide you through setting up your health hub step by step.
        </ThemedText>
      </View>
    );
  }, [theme]);

  const allMessages = [...messages];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={[theme.primary + "15", "transparent"]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerAvatar, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="heart" size={20} color={theme.primary} />
            </View>
            <View>
              <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
                Setup Assistant
              </ThemedText>
              <ThemedText style={[styles.headerSubtext, { color: theme.textSecondary }]}>
                Step {stepIndex + 1} of {STEPS.length}
              </ThemedText>
            </View>
          </View>
          {onSkip ? (
            <Pressable
              testID="button-skip-onboarding"
              onPress={onSkip}
              style={[styles.skipButton, { backgroundColor: theme.textSecondary + "15" }]}
            >
              <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Skip</ThemedText>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress * 100}%` as any }]} />
        </View>

        <View style={styles.stepIndicatorRow}>
          {STEPS.map((step, idx) => (
            <View
              key={step}
              style={[
                styles.stepDot,
                {
                  backgroundColor: idx <= stepIndex ? theme.primary : theme.border,
                },
                idx === stepIndex ? styles.stepDotActive : null,
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={allMessages.toReversed()}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted={allMessages.length > 0}
          ListEmptyComponent={renderEmptyState}
          ListHeaderComponent={
            <>
              {renderTypingIndicator()}
              {renderQuickActions()}
              {renderIntakeForm()}
            </>
          }
          contentContainerStyle={[styles.messagesList, { paddingBottom: Spacing.lg }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (allMessages.length > 0) {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }
          }}
        />

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, Spacing.sm), backgroundColor: theme.backgroundRoot, borderTopColor: theme.border }]}>
          {isCompleted ? (
            <Pressable
              testID="button-finish-setup"
              onPress={onComplete}
              style={[styles.finishButton, { backgroundColor: theme.primary }]}
            >
              <Feather name="check-circle" size={20} color="#FFFFFF" />
              <ThemedText style={styles.finishButtonText}>Start Using Tabula Medica</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                testID="input-assistant-message"
                style={[styles.textInput, {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask me anything about getting set up..."
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={500}
                editable={!isLoading}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable
                testID="button-send-message"
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
                style={[styles.sendButton, {
                  backgroundColor: inputText.trim() ? theme.primary : theme.border,
                }]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="send" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSubtext: {
    fontSize: 12,
    marginTop: 1,
  },
  skipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  stepIndicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 20,
    borderRadius: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  messageRowAssistant: {
    justifyContent: "flex-start",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.72,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickActionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingLeft: 40,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  intakeFormContainer: {
    marginTop: Spacing.sm,
    marginLeft: 40,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  intakeFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  intakeFormTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  intakeFieldContainer: {
    marginBottom: Spacing.md,
  },
  intakeLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  intakeInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  intakeSubmitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  intakeSubmitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["2xl"],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.sm + 2 : Spacing.sm,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  finishButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
