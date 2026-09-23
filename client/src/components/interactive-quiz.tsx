import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Trophy,
  RefreshCw,
  Lightbulb,
  Target,
  Star,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuizQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
}

export interface QuizData {
  quizId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  passingScore: number;
  totalPoints: number;
  estimatedMinutes: number;
}

export interface QuizResultData {
  quizId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answers: { questionId: string; selectedAnswer: string; correct: boolean }[];
  feedback: string;
  recommendedReview: string[];
}

interface InteractiveQuizProps {
  quiz: QuizData;
  onComplete: (result: QuizResultData) => void;
  onClose: () => void;
}

export function InteractiveQuiz({ quiz, onComplete, onClose }: InteractiveQuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<QuizResultData | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const hasAnswered = answers[currentQuestion?.id] !== undefined;

  const handleSelectAnswer = (answer: string) => {
    if (showExplanation) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answer,
    }));
  };

  const handleNext = () => {
    if (showExplanation) {
      setShowExplanation(false);
      if (isLastQuestion) {
        calculateResult();
      } else {
        setCurrentQuestionIndex((prev) => prev + 1);
      }
    } else {
      setShowExplanation(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setShowExplanation(false);
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const calculateResult = () => {
    const answerResults = quiz.questions.map((q) => ({
      questionId: q.id,
      selectedAnswer: answers[q.id] || "",
      correct: answers[q.id] === q.correctAnswer,
    }));

    const score = answerResults.reduce((sum, a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      return sum + (a.correct ? question?.points || 0 : 0);
    }, 0);

    const percentage = Math.round((score / quiz.totalPoints) * 100);
    const passed = percentage >= quiz.passingScore;

    const incorrectQuestions = answerResults
      .filter((a) => !a.correct)
      .map((a) => quiz.questions.find((q) => q.id === a.questionId)?.question || "");

    const quizResult: QuizResultData = {
      quizId: quiz.quizId,
      score,
      totalPoints: quiz.totalPoints,
      percentage,
      passed,
      answers: answerResults,
      feedback: passed
        ? "Excellent work! You demonstrated a strong understanding of the material."
        : "Good effort! Review the topics you missed and try again when you're ready.",
      recommendedReview: incorrectQuestions.slice(0, 3),
    };

    setResult(quizResult);
    setShowResult(true);
    onComplete(quizResult);
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setShowResult(false);
    setResult(null);
    setShowExplanation(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "hard":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  if (showResult && result) {
    return (
      <Card className="w-full max-w-2xl mx-auto" data-testid="quiz-result">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {result.passed ? (
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl">
            {result.passed ? "Congratulations!" : "Keep Learning!"}
          </CardTitle>
          <CardDescription className="text-lg">
            You scored {result.percentage}% ({result.score}/{result.totalPoints} points)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-8 h-8",
                  i < Math.ceil(result.percentage / 20)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <Alert className={result.passed ? "border-green-500/50 bg-green-50 dark:bg-green-900/10" : "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/10"}>
            <Sparkles className="w-4 h-4" />
            <AlertDescription>{result.feedback}</AlertDescription>
          </Alert>

          {result.recommendedReview.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                Topics to Review
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.recommendedReview.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Target className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-medium">Question Summary</h4>
            <div className="flex flex-wrap gap-2">
              {result.answers.map((a, i) => (
                <div
                  key={a.questionId}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    a.correct
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  )}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          {!result.passed && (
            <Button onClick={handleRetry} variant="outline" className="flex-1" data-testid="button-retry-quiz">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button onClick={onClose} className="flex-1" data-testid="button-close-quiz">
            {result.passed ? "Continue Learning" : "Review Material"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto" data-testid="quiz-container">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className={getDifficultyColor(currentQuestion.difficulty)}>
            {currentQuestion.difficulty}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {quiz.questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <CardTitle className="text-lg mt-4">{quiz.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="text-lg font-medium">{currentQuestion.question}</p>

          {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={handleSelectAnswer}
              className="space-y-3"
              disabled={showExplanation}
            >
              {currentQuestion.options.map((option, i) => {
                const isSelected = answers[currentQuestion.id] === option;
                const isCorrect = option === currentQuestion.correctAnswer;
                const showCorrectness = showExplanation;

                return (
                  <div role="presentation"
                    key={i}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-lg border transition-all",
                      !showExplanation && "hover-elevate cursor-pointer",
                      isSelected && !showExplanation && "border-primary bg-primary/5",
                      showCorrectness && isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/20",
                      showCorrectness && isSelected && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-900/20"
                    )}
                    onClick={() => !showExplanation && handleSelectAnswer(option)}
                    data-testid={`option-${i}`}
                  >
                    <RadioGroupItem value={option} id={`option-${i}`} />
                    <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                    {showCorrectness && (
                      <>
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                      </>
                    )}
                  </div>
                );
              })}
            </RadioGroup>
          )}

          {currentQuestion.type === "true_false" && (
            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={handleSelectAnswer}
              className="space-y-3"
              disabled={showExplanation}
            >
              {["True", "False"].map((option) => {
                const isSelected = answers[currentQuestion.id] === option;
                const isCorrect = option === currentQuestion.correctAnswer;
                const showCorrectness = showExplanation;

                return (
                  <div role="presentation"
                    key={option}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-lg border transition-all",
                      !showExplanation && "hover-elevate cursor-pointer",
                      isSelected && !showExplanation && "border-primary bg-primary/5",
                      showCorrectness && isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/20",
                      showCorrectness && isSelected && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-900/20"
                    )}
                    onClick={() => !showExplanation && handleSelectAnswer(option)}
                    data-testid={`option-${option.toLowerCase()}`}
                  >
                    <RadioGroupItem value={option} id={`option-${option}`} />
                    <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                    {showCorrectness && (
                      <>
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        {isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-600" />}
                      </>
                    )}
                  </div>
                );
              })}
            </RadioGroup>
          )}
        </div>

        {showExplanation && (
          <Alert className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <Lightbulb className="w-4 h-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-400">Explanation</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              {currentQuestion.explanation}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Points: {currentQuestion.points}</span>
          <span>Est. time: ~{quiz.estimatedMinutes} min total</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          data-testid="button-previous"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={!hasAnswered}
          className="flex-1"
          data-testid="button-next"
        >
          {showExplanation ? (
            isLastQuestion ? (
              <>
                See Results
                <Trophy className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next Question
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )
          ) : (
            <>
              Check Answer
              <CheckCircle2 className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
