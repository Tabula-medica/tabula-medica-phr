import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: "multiple_choice" | "true_false" | "fill_in_blank";
  options: string[];
  correctAnswer: string;
  explanation: string;
  orderIndex: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  category: string;
  difficultyLevel: string;
  estimatedTimeMinutes: number;
  passingScore: number;
  totalQuestions: number;
  questions: QuizQuestion[];
}

interface QuizAttempt {
  id: string;
  attemptNumber: number;
  startedAt: string;
}

interface QuizResult {
  attemptId: string;
  score: number;
  maxScore: number;
  percentageScore: number;
  passed: boolean;
  feedback: string;
  incorrectQuestions: string[];
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    correctAnswer: string;
    explanation: string;
  }>;
}

export default function QuizScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { theme: colors } = useTheme();

  const { quizId } = route.params || {};
  const [currentStep, setCurrentStep] = useState<"intro" | "quiz" | "results">("intro");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);

  const { data: quizData, isLoading } = useQuery<Quiz>({
    queryKey: ["/api/education/quizzes", quizId],
    enabled: !!quizId,
  });

  const startAttempt = useMutation({
    mutationFn: () => apiRequest("POST", `/api/education/quizzes/${quizId}/start`),
    onSuccess: async (response) => {
      const data = await response.json();
      setAttempt(data.attempt);
      setCurrentStep("quiz");
      setCurrentQuestionIndex(0);
      setAnswers({});
    },
  });

  const submitAttempt = useMutation({
    mutationFn: (responses: Array<{ questionId: string; selectedAnswer: string }>) =>
      apiRequest("POST", `/api/education/attempts/${attempt?.id}/submit`, { responses }),
    onSuccess: async (response) => {
      const data = await response.json();
      setResult(data);
      setCurrentStep("results");
      queryClient.invalidateQueries({ queryKey: ["/api/education/my-attempts"] });
    },
  });

  const questions = quizData?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleAnswer = (answer: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answer,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    const responses = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
      questionId,
      selectedAnswer,
    }));
    submitAttempt.mutate(responses);
  };

  const renderIntro = () => {
    if (!quizData) return null;

    return (
      <View style={styles.introContainer}>
        <View style={[styles.quizIconLarge, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="file-text" size={48} color={colors.primary} />
        </View>

        <ThemedText style={styles.quizTitle}>{quizData.title}</ThemedText>
        <ThemedText style={styles.quizDescription}>{quizData.description}</ThemedText>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Feather name="list" size={18} color={colors.primary} />
              <ThemedText style={styles.infoValue}>{quizData.totalQuestions}</ThemedText>
              <ThemedText style={styles.infoLabel}>Questions</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="clock" size={18} color={colors.warning} />
              <ThemedText style={styles.infoValue}>{quizData.estimatedTimeMinutes}</ThemedText>
              <ThemedText style={styles.infoLabel}>Minutes</ThemedText>
            </View>
            <View style={styles.infoItem}>
              <Feather name="target" size={18} color={colors.success} />
              <ThemedText style={styles.infoValue}>{quizData.passingScore}%</ThemedText>
              <ThemedText style={styles.infoLabel}>To Pass</ThemedText>
            </View>
          </View>
        </Card>

        <View style={styles.tipsCard}>
          <ThemedText style={styles.tipsTitle}>Tips</ThemedText>
          <View style={styles.tipItem}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <ThemedText style={styles.tipText}>Read each question carefully</ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <ThemedText style={styles.tipText}>You can go back to previous questions</ThemedText>
          </View>
          <View style={styles.tipItem}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <ThemedText style={styles.tipText}>Take your time - there's no time limit</ThemedText>
          </View>
        </View>

        <Pressable
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={() => startAttempt.mutate()}
          disabled={startAttempt.isPending}
        >
          {startAttempt.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="play" size={20} color="#FFFFFF" />
              <ThemedText style={styles.startButtonText}>Start Quiz</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  const renderQuiz = () => {
    if (!currentQuestion) return null;

    const selectedAnswer = answers[currentQuestion.id];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const allAnswered = Object.keys(answers).length === questions.length;

    return (
      <View style={styles.quizContainer}>
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <ThemedText style={styles.progressText}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </ThemedText>
            <ThemedText style={[styles.progressPercent, { color: colors.primary }]}>
              {Math.round(progress)}%
            </ThemedText>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]}
            />
          </View>
        </View>

        <ScrollView style={styles.questionScroll} showsVerticalScrollIndicator={false}>
          <Card style={styles.questionCard}>
            <View style={styles.questionTypeTag}>
              <ThemedText style={[styles.questionTypeText, { color: colors.primary }]}>
                {currentQuestion.questionType === "multiple_choice"
                  ? "Multiple Choice"
                  : currentQuestion.questionType === "true_false"
                  ? "True/False"
                  : "Fill in Blank"}
              </ThemedText>
            </View>

            <ThemedText style={styles.questionText}>{currentQuestion.questionText}</ThemedText>

            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === option;
                const optionLetter = String.fromCharCode(65 + index);

                return (
                  <Pressable
                    key={index}
                    style={[
                      styles.optionButton,
                      isSelected && { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
                    ]}
                    onPress={() => handleAnswer(option)}
                  >
                    <View
                      style={[
                        styles.optionLetter,
                        isSelected && { backgroundColor: colors.primary },
                      ]}
                    >
                      <ThemedText
                        style={[styles.optionLetterText, isSelected && { color: "#FFFFFF" }]}
                      >
                        {optionLetter}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.optionText}>{option}</ThemedText>
                    {isSelected ? (
                      <Feather name="check-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <View style={styles.questionNav}>
            <View style={styles.navDots}>
              {questions.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => setCurrentQuestionIndex(index)}
                >
                  <View
                    style={[
                      styles.navDot,
                      index === currentQuestionIndex && { backgroundColor: colors.primary },
                      answers[questions[index].id] && { backgroundColor: colors.success },
                    ]}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.navigationButtons}>
          <Pressable
            style={[styles.navButton, { opacity: currentQuestionIndex === 0 ? 0.5 : 1 }]}
            onPress={handlePrevious}
            disabled={currentQuestionIndex === 0}
          >
            <Feather name="chevron-left" size={20} color={colors.text} />
            <ThemedText style={styles.navButtonText}>Previous</ThemedText>
          </Pressable>

          {isLastQuestion ? (
            <Pressable
              style={[
                styles.submitButton,
                { backgroundColor: allAnswered ? colors.success : colors.textSecondary },
              ]}
              onPress={handleSubmit}
              disabled={!allAnswered || submitAttempt.isPending}
            >
              {submitAttempt.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.submitButtonText}>Submit</ThemedText>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.navButton, { opacity: !selectedAnswer ? 0.5 : 1 }]}
              onPress={handleNext}
              disabled={!selectedAnswer}
            >
              <ThemedText style={styles.navButtonText}>Next</ThemedText>
              <Feather name="chevron-right" size={20} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderResults = () => {
    if (!result || !quizData) return null;

    const getResultMessage = () => {
      if (result.passed) {
        if (result.percentageScore >= 90) return "Outstanding!";
        if (result.percentageScore >= 80) return "Great job!";
        return "Well done!";
      }
      return "Keep learning!";
    };

    const getResultIcon = () => {
      if (result.passed) return "award";
      return "book-open";
    };

    return (
      <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.resultsContainer}>
          <View
            style={[
              styles.resultIconLarge,
              { backgroundColor: result.passed ? `${colors.success}15` : `${colors.warning}15` },
            ]}
          >
            <Feather
              name={getResultIcon()}
              size={48}
              color={result.passed ? colors.success : colors.warning}
            />
          </View>

          <ThemedText style={styles.resultTitle}>{getResultMessage()}</ThemedText>
          <ThemedText style={styles.resultSubtitle}>
            {result.passed
              ? "You've successfully completed this quiz!"
              : `You need ${quizData.passingScore}% to pass. Keep practicing!`}
          </ThemedText>

          <Card style={styles.scoreCard}>
            <View style={styles.scoreCircle}>
              <ThemedText
                style={[
                  styles.scoreValue,
                  { color: result.passed ? colors.success : colors.warning },
                ]}
              >
                {result.percentageScore}%
              </ThemedText>
              <ThemedText style={styles.scoreLabel}>Your Score</ThemedText>
            </View>
            <View style={styles.scoreDetails}>
              <View style={styles.scoreDetailItem}>
                <ThemedText style={[styles.scoreDetailValue, { color: colors.success }]}>
                  {result.score}
                </ThemedText>
                <ThemedText style={styles.scoreDetailLabel}>Correct</ThemedText>
              </View>
              <View style={styles.scoreDetailItem}>
                <ThemedText style={[styles.scoreDetailValue, { color: colors.error }]}>
                  {result.maxScore - result.score}
                </ThemedText>
                <ThemedText style={styles.scoreDetailLabel}>Incorrect</ThemedText>
              </View>
            </View>
          </Card>

          {result.feedback ? (
            <Card style={styles.feedbackCard}>
              <View style={styles.feedbackHeader}>
                <Feather name="message-circle" size={18} color={colors.primary} />
                <ThemedText style={styles.feedbackTitle}>AI Feedback</ThemedText>
              </View>
              <ThemedText style={styles.feedbackText}>{result.feedback}</ThemedText>
            </Card>
          ) : null}

          {result.incorrectQuestions.length > 0 ? (
            <Card style={styles.reviewCard}>
              <ThemedText style={styles.reviewTitle}>Areas to Review</ThemedText>
              {result.results
                .filter((r) => !r.isCorrect)
                .map((r, index) => {
                  const question = questions.find((q) => q.id === r.questionId);
                  return question ? (
                    <View key={r.questionId} style={styles.reviewItem}>
                      <View style={styles.reviewQuestion}>
                        <ThemedText style={styles.reviewQuestionNum}>Q{index + 1}</ThemedText>
                        <ThemedText style={styles.reviewQuestionText} numberOfLines={2}>
                          {question.questionText}
                        </ThemedText>
                      </View>
                      <View style={styles.reviewAnswer}>
                        <Feather name="check" size={14} color={colors.success} />
                        <ThemedText style={[styles.reviewAnswerText, { color: colors.success }]}>
                          {r.correctAnswer}
                        </ThemedText>
                      </View>
                      {r.explanation ? (
                        <ThemedText style={styles.reviewExplanation}>{r.explanation}</ThemedText>
                      ) : null}
                    </View>
                  ) : null;
                })}
            </Card>
          ) : null}

          <View style={styles.resultActions}>
            <Pressable
              style={[styles.retryButton, { borderColor: colors.primary }]}
              onPress={() => {
                setCurrentStep("intro");
                setResult(null);
                setAttempt(null);
                setAnswers({});
              }}
            >
              <Feather name="refresh-cw" size={18} color={colors.primary} />
              <ThemedText style={[styles.retryButtonText, { color: colors.primary }]}>
                Try Again
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={styles.doneButtonText}>Done</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Loading quiz...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!quizData) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={colors.error} />
          <ThemedText style={styles.errorText}>Quiz not found</ThemedText>
          <Pressable
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
        ]}
      >
        {currentStep === "intro" && renderIntro()}
        {currentStep === "quiz" && renderQuiz()}
        {currentStep === "results" && renderResults()}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  introContainer: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing.xl,
  },
  quizIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  quizTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  quizDescription: {
    fontSize: 15,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  infoCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  infoItem: {
    alignItems: "center",
  },
  infoValue: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: Spacing.sm,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  tipsCard: {
    width: "100%",
    marginBottom: Spacing.xl,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  tipText: {
    fontSize: 14,
    opacity: 0.8,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  quizContainer: {
    flex: 1,
  },
  progressContainer: {
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  progressText: {
    fontSize: 14,
    opacity: 0.7,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  questionScroll: {
    flex: 1,
  },
  questionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  questionTypeTag: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(0,102,204,0.1)",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  questionTypeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  optionLetterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  optionText: {
    flex: 1,
    fontSize: 15,
  },
  questionNav: {
    paddingVertical: Spacing.lg,
  },
  navDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  navDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContainer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  resultIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  resultSubtitle: {
    fontSize: 15,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  scoreCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  scoreCircle: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "700",
  },
  scoreLabel: {
    fontSize: 14,
    opacity: 0.6,
  },
  scoreDetails: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  scoreDetailItem: {
    alignItems: "center",
  },
  scoreDetailValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  scoreDetailLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  feedbackCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  reviewCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  reviewItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  reviewQuestion: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  reviewQuestionNum: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.5,
  },
  reviewQuestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  reviewAnswer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  reviewAnswerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  reviewExplanation: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  resultActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  doneButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
