import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  TextInput,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import OnboardingAssistantScreen from "@/screens/OnboardingAssistantScreen";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingQuestion {
  id: string;
  text: string;
  type: "single_choice" | "multi_choice" | "scale" | "yes_no" | "text";
  category: string;
  options?: Array<{ value?: string; id?: string; label: string; icon?: string }>;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  scaleRange?: { min: number; max: number; minLabel: string; maxLabel: string };
  required?: boolean;
  helpText?: string;
}

interface AnsweredQuestion {
  questionId: string;
  answer: string | string[] | number;
}

interface OnboardingState {
  answeredQuestions: AnsweredQuestion[];
  currentPhase: number;
  totalPhases: number;
  completionPercent: number;
}

interface HealthSummary {
  overallAssessment: string;
  identifiedConditions: Array<string | { name: string; severity?: string; notes?: string }>;
  riskFactors: Array<{ factor: string; level: string; recommendation?: string; explanation?: string }>;
  recommendedScreenings: string[];
  lifestyleNotes: string[];
  disclaimer: string;
}

interface EducationalCard {
  title: string;
  content: string;
  icon: string;
  category: string;
  priority: number;
}

interface WelcomeEducation {
  welcomeMessage: string;
  educationalCards: EducationalCard[];
  quickTips: string[];
  suggestedActions: Array<{ action: string; screen: string; icon: string }>;
  disclaimer: string;
}

type FlowPhase = "questions" | "generating" | "summary" | "education" | "consent" | "assistant";

interface DynamicOnboardingScreenProps {
  onComplete: () => void;
  onSkip?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  demographics: "user",
  conditions: "activity",
  lifestyle: "sun",
  symptoms: "thermometer",
  medications: "package",
  family_history: "users",
  preferences: "sliders",
};

const CATEGORY_COLORS: Record<string, string> = {
  demographics: "#3B82F6",
  conditions: "#EF4444",
  lifestyle: "#10B981",
  symptoms: "#F59E0B",
  medications: "#8B5CF6",
  family_history: "#EC4899",
  preferences: "#06B6D4",
};

export default function DynamicOnboardingScreen({ onComplete, onSkip }: DynamicOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [flowPhase, setFlowPhase] = useState<FlowPhase>("questions");
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<string | string[] | number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [totalPhases, setTotalPhases] = useState(3);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [welcomeEducation, setWelcomeEducation] = useState<WelcomeEducation | null>(null);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [validationError, setValidationError] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [expandedHelpText, setExpandedHelpText] = useState(false);
  const [consentAiSummary, setConsentAiSummary] = useState(false);
  const [consentFastenHealth, setConsentFastenHealth] = useState(false);

  const savedOpacity = useSharedValue(0);

  const savedAnimatedStyle = useAnimatedStyle(() => ({
    opacity: savedOpacity.value,
  }));

  const showSavedIndicator = useCallback(() => {
    setShowSavedConfirmation(true);
    savedOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(800, withTiming(0, { duration: 300 }, () => {
        runOnJS(setShowSavedConfirmation)(false);
      })),
    );
  }, []);

  const fetchQuestionsMutation = useMutation({
    mutationFn: async (state: OnboardingState) => {
      const res = await apiRequest("POST", "/api/onboarding/dynamic/questions", state);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setCurrentAnswer(null);
        setTextAnswer("");
        setTotalPhases(data.totalPhases || 3);
        setCompletionPercent(data.completionPercent || 0);
        setQuestionsLoaded(true);
      } else {
        generateHealthSummary();
      }
    },
    onError: () => {
    },
  });

  const healthSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/dynamic/health-summary", { answers });
      return res.json();
    },
    onSuccess: (data) => {
      setHealthSummary(data);
      setFlowPhase("summary");
    },
    onError: () => {
      setHealthSummary({
        overallAssessment: "We were unable to generate a detailed summary at this time, but your information has been saved.",
        identifiedConditions: [],
        riskFactors: [],
        recommendedScreenings: [],
        lifestyleNotes: ["Your health profile will be updated as you add more information."],
        disclaimer: "This is not medical advice. Always consult your healthcare provider.",
      });
      setFlowPhase("summary");
    },
  });

  const educationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/dynamic/welcome-education", {
        answers,
        healthSummary,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setWelcomeEducation(data);
      setFlowPhase("education");
    },
    onError: () => {
      setFlowPhase("education");
    },
  });

  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/consent", {
        consentAiSummary,
        consentFastenHealth,
      });
      return res.json();
    },
    onSuccess: () => {
      setFlowPhase("assistant");
    },
    onError: () => {
      setFlowPhase("assistant");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/dynamic/complete", {
        answers,
        healthSummary,
      });
      return res.json();
    },
    onSuccess: () => {
      onComplete();
    },
    onError: () => {
      onComplete();
    },
  });

  React.useEffect(() => {
    if (!questionsLoaded) {
      fetchQuestionsMutation.mutate({
        answeredQuestions: [],
        currentPhase: 0,
        totalPhases: 3,
        completionPercent: 0,
      });
    }
  }, []);

  const generateHealthSummary = useCallback(() => {
    setFlowPhase("generating");
    healthSummaryMutation.mutate();
  }, [answers]);

  const handleAnswer = useCallback(async (answer: string | string[] | number) => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setCurrentAnswer(answer);
    setValidationError(false);
  }, []);

  const handleMultiSelect = useCallback((value: string) => {
    setCurrentAnswer((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (current.includes(value)) {
        return current.filter((v) => v !== value);
      }
      return [...current, value];
    });
    setValidationError(false);
  }, []);

  const handleNext = useCallback(async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    const question = questions[currentQuestionIndex];
    if (!question) return;

    let answerValue = currentAnswer;
    if (question.type === "text") {
      answerValue = textAnswer;
    }

    if (answerValue === null && question.required) {
      setValidationError(true);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      return;
    }
    if (question.required && question.type === "text" && textAnswer.trim().length === 0) {
      setValidationError(true);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      return;
    }
    if (question.required && question.type === "multi_choice" && (!Array.isArray(currentAnswer) || currentAnswer.length === 0)) {
      setValidationError(true);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      return;
    }

    const newAnswer: AnsweredQuestion = {
      questionId: question.id,
      answer: answerValue ?? "",
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setValidationError(false);
    setExpandedHelpText(false);
    showSavedIndicator();

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer(null);
      setTextAnswer("");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      const newState: OnboardingState = {
        answeredQuestions: updatedAnswers,
        currentPhase: totalPhases,
        totalPhases,
        completionPercent: 100,
      };
      fetchQuestionsMutation.mutate(newState);
    }
  }, [currentQuestionIndex, questions, currentAnswer, textAnswer, answers, totalPhases]);

  const handleBack = useCallback(async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const prevAnswer = answers[currentQuestionIndex - 1];
      if (prevAnswer) {
        setCurrentAnswer(prevAnswer.answer);
        if (typeof prevAnswer.answer === "string") setTextAnswer(prevAnswer.answer);
      }
      setAnswers(answers.slice(0, -1));
      setValidationError(false);
      setExpandedHelpText(false);
    }
  }, [currentQuestionIndex, answers]);

  const categoryProgress = useMemo(() => {
    if (questions.length === 0) return [];
    const categories = Array.from(new Set(questions.map((q) => q.category)));
    const answeredIds = new Set(answers.map((a) => a.questionId));
    return categories.map((cat) => {
      const catQuestions = questions.filter((q) => q.category === cat);
      const allAnswered = catQuestions.every((q) => answeredIds.has(q.id));
      return { category: cat, completed: allAnswered, color: CATEGORY_COLORS[cat] || theme.primary };
    });
  }, [questions, answers, theme.primary]);

  const progressPercent = questions.length > 0
    ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
    : completionPercent;

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.primary,
              width: `${progressPercent}%`,
            },
          ]}
        />
      </View>
      <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
        {flowPhase === "questions"
          ? `${currentQuestionIndex + 1} of ${questions.length}`
          : flowPhase === "summary"
          ? "Review your summary"
          : flowPhase === "education"
          ? "Personalized for you"
          : flowPhase === "consent"
          ? "Legal agreements"
          : flowPhase === "assistant"
          ? "Setup assistant"
          : "Analyzing..."}
      </ThemedText>
      {flowPhase === "questions" && categoryProgress.length > 0 ? (
        <View style={styles.categoryDotsRow}>
          {categoryProgress.map((cp) => (
            <View
              key={cp.category}
              style={[
                styles.categoryDot,
                {
                  backgroundColor: cp.completed ? cp.color : `${cp.color}30`,
                  borderColor: cp.color,
                  borderWidth: cp.completed ? 0 : 1,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderSingleChoice = (question: OnboardingQuestion) => (
    <View style={styles.optionsContainer}>
      {question.options?.map((option, index) => {
        const optVal = option.value || option.id || "";
        const isSelected = currentAnswer === optVal;
        return (
          <Animated.View key={optVal} entering={FadeInDown.delay(index * 60).springify()}>
            <Pressable
              testID={`option-${optVal}`}
              onPress={() => handleAnswer(optVal)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected ? `${theme.primary}15` : theme.backgroundDefault,
                  borderColor: isSelected ? theme.primary : theme.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              {option.icon ? (
                <View style={[styles.optionIcon, { backgroundColor: `${theme.primary}10` }]}>
                  <Feather name={option.icon as any} size={20} color={theme.primary} />
                </View>
              ) : null}
              <ThemedText style={[styles.optionLabel, isSelected ? { color: theme.primary, fontWeight: "600" } : null]}>
                {option.label}
              </ThemedText>
              {isSelected ? (
                <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
                  <Feather name="check" size={14} color="#fff" />
                </View>
              ) : (
                <View style={[styles.emptyCircle, { borderColor: theme.border }]} />
              )}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );

  const renderMultiChoice = (question: OnboardingQuestion) => {
    const selected = Array.isArray(currentAnswer) ? currentAnswer : [];
    return (
      <View style={styles.multiGrid}>
        {question.options?.map((option, index) => {
          const optVal = option.value || option.id || "";
          const isSelected = selected.includes(optVal);
          return (
            <Animated.View key={optVal} entering={FadeInDown.delay(index * 40).springify()}>
              <Pressable
                testID={`multi-${optVal}`}
                onPress={() => handleMultiSelect(optVal)}
                style={[
                  styles.multiChip,
                  {
                    backgroundColor: isSelected ? `${theme.primary}15` : theme.backgroundDefault,
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                {isSelected ? (
                  <Feather name="check-circle" size={16} color={theme.primary} />
                ) : (
                  <Feather name="circle" size={16} color={theme.textSecondary} />
                )}
                <ThemedText
                  style={[styles.multiChipText, isSelected ? { color: theme.primary, fontWeight: "600" } : null]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderScale = (question: OnboardingQuestion) => {
    const min = question.scaleRange?.min ?? question.scaleMin ?? 1;
    const max = question.scaleRange?.max ?? question.scaleMax ?? 10;
    const labels = question.scaleRange
      ? { min: question.scaleRange.minLabel, max: question.scaleRange.maxLabel }
      : question.scaleLabels;
    const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

    return (
      <View style={styles.scaleContainer}>
        {labels ? (
          <View style={styles.scaleLabels}>
            <ThemedText style={[styles.scaleLabel, { color: theme.textSecondary }]}>{labels.min}</ThemedText>
            <ThemedText style={[styles.scaleLabel, { color: theme.textSecondary }]}>{labels.max}</ThemedText>
          </View>
        ) : null}
        <View style={styles.scaleButtons}>
          {values.map((val) => {
            const isSelected = currentAnswer === val;
            return (
              <Pressable
                key={val}
                testID={`scale-${val}`}
                onPress={() => handleAnswer(val)}
                style={[
                  styles.scaleButton,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
              >
                <ThemedText style={[styles.scaleButtonText, { color: isSelected ? "#fff" : theme.text }]}>
                  {val}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderYesNo = (question: OnboardingQuestion) => (
    <View style={styles.yesNoContainer}>
      {[
        { value: "yes", label: "Yes", icon: "check-circle" },
        { value: "no", label: "No", icon: "x-circle" },
      ].map((opt) => {
        const isSelected = currentAnswer === opt.value;
        return (
          <Pressable
            key={opt.value}
            testID={`yesno-${opt.value}`}
            onPress={() => handleAnswer(opt.value)}
            style={[
              styles.yesNoButton,
              {
                backgroundColor: isSelected
                  ? opt.value === "yes" ? `${theme.success}15` : `${theme.error}15`
                  : theme.backgroundDefault,
                borderColor: isSelected
                  ? opt.value === "yes" ? theme.success : theme.error
                  : theme.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
          >
            <Feather
              name={opt.icon as any}
              size={28}
              color={isSelected ? (opt.value === "yes" ? theme.success : theme.error) : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.yesNoText,
                isSelected ? { color: opt.value === "yes" ? theme.success : theme.error, fontWeight: "700" } : null,
              ]}
            >
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  const renderTextInput = () => (
    <View style={styles.textInputContainer}>
      <TextInput
        testID="input-freetext"
        style={[
          styles.textInputField,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: validationError ? theme.error : theme.border,
            color: theme.text,
            borderWidth: validationError ? 2 : 1,
          },
        ]}
        placeholder="Type your answer here..."
        placeholderTextColor={theme.textSecondary}
        value={textAnswer}
        onChangeText={(text) => {
          setTextAnswer(text);
          setValidationError(false);
        }}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </View>
  );

  const renderQuestion = () => {
    if (questions.length === 0) return null;
    const question = questions[currentQuestionIndex];
    if (!question) return null;

    const catColor = CATEGORY_COLORS[question.category] || theme.primary;
    const catIcon = CATEGORY_ICONS[question.category] || "help-circle";

    return (
      <Animated.View key={question.id} entering={SlideInRight.springify()} exiting={SlideOutLeft.springify()}>
        <View style={styles.questionHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${catColor}15` }]}>
            <Feather name={catIcon as any} size={14} color={catColor} />
            <ThemedText style={[styles.categoryText, { color: catColor }]}>
              {question.category.replace("_", " ").toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="h2" style={styles.questionText}>
          {question.text}
        </ThemedText>

        {question.helpText ? (
          <View>
            <Pressable
              testID="button-why-we-ask"
              onPress={() => setExpandedHelpText((prev) => !prev)}
              style={styles.whyWeAskButton}
            >
              <Feather name="info" size={14} color={theme.info} />
              <ThemedText style={[styles.whyWeAskText, { color: theme.info }]}>
                Why do we ask?
              </ThemedText>
              <Feather
                name={expandedHelpText ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.info}
              />
            </Pressable>
            {expandedHelpText ? (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={[styles.helpTextCard, { backgroundColor: `${theme.info}08`, borderColor: `${theme.info}20` }]}
              >
                <ThemedText style={[styles.helpTextContent, { color: theme.textSecondary }]}>
                  {question.helpText}
                </ThemedText>
              </Animated.View>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.answerAreaWrapper,
            validationError ? { borderColor: theme.error, borderWidth: 2, borderRadius: BorderRadius.md } : null,
          ]}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.answerArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.answerContent}
          >
            {question.type === "single_choice" ? renderSingleChoice(question) : null}
            {question.type === "multi_choice" ? renderMultiChoice(question) : null}
            {question.type === "scale" ? renderScale(question) : null}
            {question.type === "yes_no" ? renderYesNo(question) : null}
            {question.type === "text" ? renderTextInput() : null}
          </ScrollView>
        </View>

        {validationError ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.validationRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Feather name="alert-triangle" size={14} color={theme.error} />
            <ThemedText style={[styles.validationText, { color: theme.error }]}>
              Please answer this question to continue
            </ThemedText>
          </Animated.View>
        ) : null}

        {showSavedConfirmation ? (
          <Animated.View style={[styles.savedRow, savedAnimatedStyle]}>
            <Feather name="check-circle" size={14} color={theme.success} />
            <ThemedText style={[styles.savedText, { color: theme.success }]}>
              Answer saved
            </ThemedText>
          </Animated.View>
        ) : null}
      </Animated.View>
    );
  };

  const renderGenerating = () => (
    <Animated.View entering={FadeIn.springify()} style={styles.generatingContainer}>
      <View style={[styles.generatingIcon, { backgroundColor: `${theme.primary}15` }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
      <ThemedText type="h2" style={styles.generatingTitle}>
        Analyzing Your Health Profile
      </ThemedText>
      <ThemedText style={[styles.generatingSubtext, { color: theme.textSecondary }]}>
        Our AI is creating a personalized health summary based on your responses...
      </ThemedText>
      <View style={styles.generatingSteps}>
        {["Reviewing your health history", "Identifying risk factors", "Creating recommendations"].map(
          (step, i) => (
            <Animated.View key={step} entering={FadeInDown.delay(i * 400).springify()} style={styles.genStep}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText style={[styles.genStepText, { color: theme.textSecondary }]}>{step}</ThemedText>
            </Animated.View>
          )
        )}
      </View>
    </Animated.View>
  );

  const renderSummary = () => {
    if (!healthSummary) return null;

    const riskColors: Record<string, string> = { low: theme.success, moderate: theme.warning, high: theme.error };

    return (
      <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.summaryContent}>
        <Animated.View entering={FadeInDown.springify()}>
          <View style={[styles.summaryHeader, { backgroundColor: `${theme.primary}08` }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="clipboard" size={32} color={theme.primary} />
            </View>
            <ThemedText type="h2" style={styles.summaryTitle}>
              Your Health Summary
            </ThemedText>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText type="h4" style={styles.summaryCardTitle}>
              Overall Assessment
            </ThemedText>
            <ThemedText style={[styles.summaryCardText, { color: theme.textSecondary }]}>
              {healthSummary.overallAssessment}
            </ThemedText>
          </View>

          {healthSummary.identifiedConditions.length > 0 ? (
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h4" style={styles.summaryCardTitle}>
                Identified Health Conditions
              </ThemedText>
              {healthSummary.identifiedConditions.map((cond, i) => {
                const condName = typeof cond === "string" ? cond : cond.name;
                const condNotes = typeof cond === "string" ? "" : (cond.notes || "");
                return (
                  <View key={i} style={styles.conditionRow}>
                    <Feather name="activity" size={16} color={theme.primary} />
                    <View style={styles.conditionInfo}>
                      <ThemedText style={styles.conditionName}>{condName}</ThemedText>
                      {condNotes ? (
                        <ThemedText style={[styles.conditionNotes, { color: theme.textSecondary }]}>
                          {condNotes}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {healthSummary.riskFactors.length > 0 ? (
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h4" style={styles.summaryCardTitle}>
                Risk Factors
              </ThemedText>
              {healthSummary.riskFactors.map((risk, i) => (
                <View key={i} style={styles.riskRow}>
                  <View style={[styles.riskBadge, { backgroundColor: `${riskColors[risk.level] || theme.info}15` }]}>
                    <ThemedText style={[styles.riskLevel, { color: riskColors[risk.level] || theme.info }]}>
                      {risk.level.toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.riskInfo}>
                    <ThemedText style={styles.riskFactor}>{risk.factor}</ThemedText>
                    <ThemedText style={[styles.riskRec, { color: theme.textSecondary }]}>
                      {risk.recommendation || risk.explanation || ""}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {healthSummary.recommendedScreenings.length > 0 ? (
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h4" style={styles.summaryCardTitle}>
                Recommended Screenings
              </ThemedText>
              {healthSummary.recommendedScreenings.map((screening, i) => (
                <View key={i} style={styles.screeningRow}>
                  <Feather name="check-square" size={16} color={theme.success} />
                  <ThemedText style={styles.screeningText}>{screening}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.disclaimerBox, { backgroundColor: `${theme.warning}10`, borderColor: `${theme.warning}30` }]}>
            <Feather name="alert-circle" size={16} color={theme.warning} />
            <ThemedText style={[styles.disclaimerText, { color: theme.textSecondary }]}>
              {healthSummary.disclaimer}
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>
    );
  };

  const renderEducation = () => {
    const edu = welcomeEducation;

    return (
      <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.summaryContent}>
        <Animated.View entering={FadeInDown.springify()}>
          <View style={[styles.summaryHeader, { backgroundColor: `${theme.success}08` }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: `${theme.success}15` }]}>
              <Feather name="book-open" size={32} color={theme.success} />
            </View>
            <ThemedText type="h2" style={styles.summaryTitle}>
              Welcome to Your Health Journey
            </ThemedText>
          </View>

          {edu?.welcomeMessage ? (
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={[styles.summaryCardText, { color: theme.textSecondary }]}>
                {edu.welcomeMessage}
              </ThemedText>
            </View>
          ) : null}

          {edu?.educationalCards && edu.educationalCards.length > 0 ? (
            <View style={styles.eduCardsContainer}>
              {edu.educationalCards.map((card, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInDown.delay(i * 100).springify()}
                  style={[styles.eduCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                >
                  <View style={[styles.eduCardIcon, { backgroundColor: `${theme.primary}10` }]}>
                    <Feather name={(card.icon || "book") as any} size={22} color={theme.primary} />
                  </View>
                  <View style={styles.eduCardContent}>
                    <ThemedText type="h4" style={styles.eduCardTitle}>
                      {card.title}
                    </ThemedText>
                    <ThemedText style={[styles.eduCardText, { color: theme.textSecondary }]}>
                      {card.content}
                    </ThemedText>
                    <View style={[styles.eduCategoryTag, { backgroundColor: `${theme.info}10` }]}>
                      <ThemedText style={[styles.eduCategoryText, { color: theme.info }]}>
                        {card.category}
                      </ThemedText>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          ) : null}

          {edu?.quickTips && edu.quickTips.length > 0 ? (
            <View style={[styles.summaryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="h4" style={styles.summaryCardTitle}>
                Quick Tips
              </ThemedText>
              {edu.quickTips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Feather name="zap" size={16} color={theme.warning} />
                  <ThemedText style={styles.tipText}>{tip}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {edu?.disclaimer ? (
            <View style={[styles.disclaimerBox, { backgroundColor: `${theme.warning}10`, borderColor: `${theme.warning}30` }]}>
              <Feather name="alert-circle" size={16} color={theme.warning} />
              <ThemedText style={[styles.disclaimerText, { color: theme.textSecondary }]}>
                {edu.disclaimer}
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    );
  };

  const renderConsent = () => (
    <ScrollView
      style={styles.bodyContainer}
      contentContainerStyle={styles.consentScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.springify()} style={styles.consentContainer}>
        <View style={[styles.consentIconWrap, { backgroundColor: `${theme.primary}15` }]}>
          <Feather name="shield" size={48} color={theme.primary} />
        </View>
        <ThemedText type="h2" style={styles.consentTitle}>
          Your Privacy Matters
        </ThemedText>
        <ThemedText style={[styles.consentSubtitle, { color: theme.textSecondary }]}>
          Your health records are protected by three layers of security.
        </ThemedText>

        <View style={styles.securityPillars}>
          {[
            { icon: "lock" as const, title: "Bank-Grade Encryption", desc: "AES-256 encryption protects every record", color: "#3B82F6" },
            { icon: "check-circle" as const, title: "HIPAA Certified", desc: "Full compliance with federal health privacy law", color: "#10B981" },
            { icon: "eye-off" as const, title: "You Own Your Data", desc: "We never sell your health information", color: "#8B5CF6" },
          ].map((pillar, idx) => (
            <Animated.View
              key={pillar.title}
              entering={FadeInDown.delay(100 + idx * 120).springify()}
              style={[styles.securityPillarRow, { borderColor: `${pillar.color}20` }]}
            >
              <View style={[styles.securityPillarIcon, { backgroundColor: `${pillar.color}12` }]}>
                <Feather name={pillar.icon} size={18} color={pillar.color} />
              </View>
              <View style={styles.securityPillarText}>
                <ThemedText style={[styles.securityPillarTitle, { color: theme.text }]}>{pillar.title}</ThemedText>
                <ThemedText style={[styles.securityPillarDesc, { color: theme.textSecondary }]}>{pillar.desc}</ThemedText>
              </View>
            </Animated.View>
          ))}
        </View>

        <ThemedText style={[styles.consentSubtitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
          Please review and agree to the following before continuing.
        </ThemedText>

        <View style={styles.consentItems}>
          <Pressable
            testID="checkbox-ai-consent"
            onPress={async () => {
              try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setConsentAiSummary(!consentAiSummary);
            }}
            style={[
              styles.consentRow,
              {
                backgroundColor: consentAiSummary ? `${theme.primary}08` : theme.backgroundDefault,
                borderColor: consentAiSummary ? theme.primary : theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.consentCheckbox,
                {
                  backgroundColor: consentAiSummary ? theme.primary : "transparent",
                  borderColor: consentAiSummary ? theme.primary : theme.border,
                },
              ]}
            >
              {consentAiSummary ? <Feather name="check" size={14} color="#fff" /> : null}
            </View>
            <View style={styles.consentTextWrap}>
              <ThemedText style={styles.consentLabel}>HIPAA AI Disclosure</ThemedText>
              <ThemedText style={[styles.consentDescription, { color: theme.textSecondary }]}>
                I authorize Tabula Medica to use AI to summarize my health records. AI-generated summaries are not medical advice.
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            testID="checkbox-fasten-consent"
            onPress={async () => {
              try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setConsentFastenHealth(!consentFastenHealth);
            }}
            style={[
              styles.consentRow,
              {
                backgroundColor: consentFastenHealth ? `${theme.primary}08` : theme.backgroundDefault,
                borderColor: consentFastenHealth ? theme.primary : theme.border,
              },
            ]}
          >
            <View
              style={[
                styles.consentCheckbox,
                {
                  backgroundColor: consentFastenHealth ? theme.primary : "transparent",
                  borderColor: consentFastenHealth ? theme.primary : theme.border,
                },
              ]}
            >
              {consentFastenHealth ? <Feather name="check" size={14} color="#fff" /> : null}
            </View>
            <View style={styles.consentTextWrap}>
              <ThemedText style={styles.consentLabel}>Health Record Retrieval</ThemedText>
              <ThemedText style={[styles.consentDescription, { color: theme.textSecondary }]}>
                I authorize Fasten Health to retrieve my records from my selected hospitals and health systems.
              </ThemedText>
            </View>
          </Pressable>
        </View>

        <View style={[styles.consentNotice, { backgroundColor: `${theme.warning}10`, borderColor: `${theme.warning}30` }]}>
          <Feather name="info" size={16} color={theme.warning} />
          <ThemedText style={[styles.consentNoticeText, { color: theme.textSecondary }]}>
            You can manage or revoke these permissions at any time from Settings &gt; Consent Management.
          </ThemedText>
        </View>
      </Animated.View>
    </ScrollView>
  );

  const canProceed = () => {
    if (flowPhase === "consent") return consentAiSummary && consentFastenHealth;
    if (flowPhase !== "questions") return true;
    const question = questions[currentQuestionIndex];
    if (!question) return false;
    return true;
  };

  const handleFooterPress = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    if (flowPhase === "questions") {
      handleNext();
    } else if (flowPhase === "summary") {
      educationMutation.mutate();
    } else if (flowPhase === "education") {
      setFlowPhase("consent");
    } else if (flowPhase === "consent") {
      consentMutation.mutate();
    } else if (flowPhase === "assistant") {
      completeMutation.mutate();
    }
  };

  const getFooterLabel = () => {
    if (flowPhase === "questions") {
      return currentQuestionIndex === questions.length - 1 ? "See My Summary" : "Next";
    }
    if (flowPhase === "summary") return "Continue";
    if (flowPhase === "education") return "Review Agreements";
    if (flowPhase === "consent") return "I Agree & Continue";
    if (flowPhase === "assistant") return "Get Started";
    return "Continue";
  };

  const isLoading =
    fetchQuestionsMutation.isPending ||
    healthSummaryMutation.isPending ||
    educationMutation.isPending ||
    consentMutation.isPending ||
    completeMutation.isPending;

  const renderSkipModal = () => (
    <Modal
      visible={showSkipModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSkipModal(false)}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.modalCard, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.modalIconWrap, { backgroundColor: `${theme.warning}15` }]}>
            <Feather name="fast-forward" size={28} color={theme.warning} />
          </View>
          <ThemedText type="h3" style={styles.modalTitle}>
            Skip for now?
          </ThemedText>
          <ThemedText style={[styles.modalBody, { color: theme.textSecondary }]}>
            You can complete this later from your Profile.
          </ThemedText>
          <View style={styles.modalActions}>
            <Pressable
              testID="button-skip-confirm"
              style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => {
                setShowSkipModal(false);
                onSkip?.();
              }}
            >
              <ThemedText style={[styles.modalButtonText, { color: theme.text }]}>
                Skip
              </ThemedText>
            </Pressable>
            <Pressable
              testID="button-skip-cancel"
              style={[styles.modalButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowSkipModal(false)}
            >
              <ThemedText style={[styles.modalButtonText, { color: "#fff" }]}>
                Continue Setup
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  if (flowPhase === "assistant") {
    return (
      <OnboardingAssistantScreen
        onComplete={() => {
          completeMutation.mutate();
        }}
        onSkip={() => {
          completeMutation.mutate();
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ["#1a1a2e", "#16213e"] : [theme.backgroundRoot, theme.backgroundDefault]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        {flowPhase === "questions" && currentQuestionIndex > 0 ? (
          <Pressable testID="button-back" onPress={handleBack} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}

        {renderProgressBar()}

        {onSkip && flowPhase === "questions" ? (
          <Pressable testID="button-skip" onPress={() => setShowSkipModal(true)} style={styles.headerBtn}>
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Skip</ThemedText>
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <View style={styles.bodyContainer}>
        {!questionsLoaded && fetchQuestionsMutation.isPending ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Preparing your personalized questions...
            </ThemedText>
          </View>
        ) : null}

        {!questionsLoaded && fetchQuestionsMutation.isError ? (
          <View style={styles.loadingCenter}>
            <Feather name="alert-circle" size={48} color={theme.warning} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
              Unable to load questions right now.
            </ThemedText>
            <Pressable
              testID="button-retry-questions"
              onPress={() => fetchQuestionsMutation.mutate({ answeredQuestions: [], currentPhase: 0, totalPhases: 3, completionPercent: 0 })}
              style={[styles.continueButton, { backgroundColor: theme.primary, marginTop: Spacing.lg, paddingHorizontal: Spacing.xl }]}
            >
              <ThemedText style={styles.continueText}>Try Again</ThemedText>
            </Pressable>
            <Pressable
              testID="button-skip-questions"
              onPress={() => { if (onSkip) { onSkip(); } else { onComplete(); } }}
              style={{ marginTop: Spacing.md, padding: Spacing.md }}
            >
              <ThemedText style={[{ color: theme.textSecondary, fontSize: 15 }]}>Skip for now</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {flowPhase === "questions" && questionsLoaded ? renderQuestion() : null}
        {flowPhase === "generating" ? renderGenerating() : null}
        {flowPhase === "summary" ? renderSummary() : null}
        {flowPhase === "education" ? renderEducation() : null}
        {flowPhase === "consent" ? renderConsent() : null}
      </View>

      {flowPhase !== "generating" && questionsLoaded ? (
        <Animated.View entering={FadeInUp} style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            testID="button-continue"
            style={[
              styles.continueButton,
              { backgroundColor: !isLoading && canProceed() ? theme.primary : theme.border },
            ]}
            onPress={handleFooterPress}
            disabled={isLoading || !canProceed()}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <ThemedText style={styles.continueText}>{getFooterLabel()}</ThemedText>
                <Feather name="arrow-right" size={20} color="#fff" />
              </>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {renderSkipModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
  },
  headerBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  skipText: { fontSize: 14, fontWeight: "500" },
  progressContainer: { flex: 1, alignItems: "center", gap: 4 },
  progressTrack: { width: "80%", height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 12 },
  categoryDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bodyContainer: { flex: 1, paddingHorizontal: Spacing.lg },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  loadingText: { fontSize: 15, textAlign: "center" },
  questionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  categoryText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  questionText: { marginBottom: Spacing.sm },
  whyWeAskButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  whyWeAskText: {
    fontSize: 13,
    fontWeight: "500",
  },
  helpTextCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  helpTextContent: {
    fontSize: 13,
    lineHeight: 20,
  },
  answerAreaWrapper: {},
  answerArea: { flex: 1, marginTop: Spacing.sm },
  answerContent: { paddingBottom: Spacing.xl },
  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  validationText: {
    fontSize: 13,
    fontWeight: "500",
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  savedText: {
    fontSize: 13,
    fontWeight: "500",
  },
  optionsContainer: { gap: Spacing.sm },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  optionIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  optionLabel: { flex: 1, fontSize: 15 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  emptyCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  multiGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  multiChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  multiChipText: { fontSize: 14 },
  scaleContainer: { gap: Spacing.md },
  scaleLabels: { flexDirection: "row", justifyContent: "space-between" },
  scaleLabel: { fontSize: 13 },
  scaleButtons: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, justifyContent: "center" },
  scaleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scaleButtonText: { fontSize: 16, fontWeight: "600" },
  yesNoContainer: { flexDirection: "row", gap: Spacing.md },
  yesNoButton: {
    flex: 1,
    paddingVertical: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  yesNoText: { fontSize: 16, fontWeight: "600" },
  textInputContainer: { marginTop: Spacing.sm },
  textInputField: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 120,
  },
  generatingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.xl },
  generatingIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  generatingTitle: { textAlign: "center", marginBottom: Spacing.md },
  generatingSubtext: { textAlign: "center", fontSize: 15, marginBottom: Spacing["2xl"] },
  generatingSteps: { gap: Spacing.md, alignSelf: "stretch" },
  genStep: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  genStepText: { fontSize: 14 },
  summaryScroll: { flex: 1 },
  summaryContent: { paddingTop: Spacing.lg, paddingBottom: Spacing["3xl"] },
  summaryHeader: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  summaryIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  summaryTitle: { textAlign: "center" },
  summaryCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryCardTitle: { marginBottom: Spacing.sm },
  summaryCardText: { fontSize: 15, lineHeight: 22 },
  conditionRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginTop: Spacing.sm },
  conditionInfo: { flex: 1 },
  conditionName: { fontSize: 15, fontWeight: "600" },
  conditionNotes: { fontSize: 13, marginTop: 2 },
  riskRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginTop: Spacing.sm },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  riskLevel: { fontSize: 11, fontWeight: "700" },
  riskInfo: { flex: 1 },
  riskFactor: { fontSize: 15, fontWeight: "600" },
  riskRec: { fontSize: 13, marginTop: 2 },
  screeningRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  screeningText: { fontSize: 14, flex: 1 },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  eduCardsContainer: { gap: Spacing.md },
  eduCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  eduCardIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  eduCardContent: { flex: 1 },
  eduCardTitle: { marginBottom: 4 },
  eduCardText: { fontSize: 13, lineHeight: 20 },
  eduCategoryTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: Spacing.xs,
  },
  eduCategoryText: { fontSize: 11, fontWeight: "600" },
  tipRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  tipText: { fontSize: 14, flex: 1 },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  continueText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  modalBody: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  consentScrollContent: {
    paddingBottom: 120,
    paddingHorizontal: Spacing.lg,
  },
  consentContainer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  consentIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  consentTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  consentSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing["2xl"],
  },
  consentItems: {
    width: "100%",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.md,
  },
  consentCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  consentTextWrap: {
    flex: 1,
    gap: 4,
  },
  consentLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  consentDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  consentNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "100%",
  },
  consentNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  securityPillars: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  securityPillarRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  securityPillarIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  securityPillarText: {
    flex: 1,
  },
  securityPillarTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  securityPillarDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
});
