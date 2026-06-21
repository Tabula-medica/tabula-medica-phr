import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  BookOpen, 
  HelpCircle, 
  Video, 
  ClipboardCheck, 
  TrendingUp,
  Flame,
  Trophy,
  Clock,
  Star,
  ChevronRight,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Brain,
  GraduationCap,
  MessageCircle,
  Library,
  Send,
  ExternalLink,
  FileText,
  BookMarked,
  Image as ImageIcon,
  Wrench,
  AlertCircle
} from "lucide-react";
import type { 
  EducationContent, 
  EducationFAQ, 
  EducationQuiz, 
  QuizQuestion, 
  QuizAttempt,
  LearningStats, 
  EducationCategory 
} from "@shared/schema";

const CATEGORIES: { value: EducationCategory; label: string }[] = [
  { value: "conditions", label: "Conditions" },
  { value: "medications", label: "Medications" },
  { value: "nutrition", label: "Nutrition" },
  { value: "exercise", label: "Exercise" },
  { value: "mental_health", label: "Mental Health" },
  { value: "prevention", label: "Preventive Care" },
  { value: "treatment", label: "Treatment" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "emergency", label: "Emergency" },
  { value: "general_wellness", label: "General Wellness" },
];

interface QuizAttemptWithFeedback {
  attempt: QuizAttempt;
  feedback: {
    passed: boolean;
    score: number;
    totalPoints: number;
    correctAnswers: number;
    totalQuestions: number;
    explanations: { questionId: string; explanation: string; wasCorrect: boolean }[];
  };
}

interface PatientQuestion {
  id: string;
  patientId: string;
  question: string;
  answer: string;
  category: string;
  followUpQuestions: string[];
  relatedTopics: string[];
  disclaimer: string;
  createdAt: string;
}

interface HealthResource {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "guide" | "infographic" | "tool";
  source: string;
  url?: string;
  relevanceScore: number;
  relevanceReason: string;
  tags: string[];
  readTimeMinutes?: number;
}

interface ResourceRecommendations {
  patientId: string;
  resources: HealthResource[];
  basedOn: {
    conditions: string[];
    medications: string[];
    recentTopics: string[];
  };
  generatedAt: string;
}

export default function HealthEducation() {
  const params = useParams();
  const patientId = params.patientId || "default-patient";
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<EducationCategory | "all">("all");
  const [activeQuiz, setActiveQuiz] = useState<EducationQuiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizAttemptWithFeedback | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [questionInput, setQuestionInput] = useState("");
  const [chatHistory, setChatHistory] = useState<PatientQuestion[]>([]);

  const { data: dashboard, isLoading } = useQuery<{
    content: EducationContent[];
    faqs: EducationFAQ[];
    quizzes: EducationQuiz[];
    stats: LearningStats;
  }>({
    queryKey: [`/api/patients/${patientId}/education/dashboard`],
  });

  const { data: allContent } = useQuery<EducationContent[]>({
    queryKey: [`/api/patients/${patientId}/education/content?category=${selectedCategory}`],
    enabled: selectedCategory !== "all",
  });

  const { data: allQuizzes } = useQuery<EducationQuiz[]>({
    queryKey: [`/api/patients/${patientId}/education/quizzes`],
  });

  const { data: quizAttempts } = useQuery<QuizAttempt[]>({
    queryKey: [`/api/patients/${patientId}/education/quiz-attempts`],
  });

  const { data: questionHistory } = useQuery<{ questions: PatientQuestion[] }>({
    queryKey: [`/api/patients/${patientId}/education/questions`],
  });

  const { data: resourceRecommendations, isLoading: resourcesLoading, refetch: refetchResources } = useQuery<ResourceRecommendations>({
    queryKey: [`/api/patients/${patientId}/education/resources`],
  });

  useEffect(() => {
    if (questionHistory?.questions && questionHistory.questions.length > 0) {
      setChatHistory(questionHistory.questions);
    }
  }, [questionHistory]);

  const askQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const conversationHistory = chatHistory.slice(-4).flatMap(q => [
        { role: "user" as const, content: q.question },
        { role: "assistant" as const, content: q.answer }
      ]);
      const response = await apiRequest("POST", `/api/patients/${patientId}/education/ask`, { 
        question, 
        conversationHistory 
      });
      return response.json() as Promise<PatientQuestion>;
    },
    onSuccess: (result) => {
      setChatHistory(prev => [...prev, result]);
      setQuestionInput("");
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/education/questions`] });
    },
    onError: () => {
      toast({
        title: "Couldn't Get Answer",
        description: "We couldn't answer your question right now. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async ({ type, category }: { type: string; category: string }) => {
      const response = await apiRequest("POST", `/api/patients/${patientId}/education/generate`, { type, category });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/education`] });
      toast({
        title: "Content Generated",
        description: `New ${variables.type} has been created for you.`,
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Could not generate personalized content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async ({ quizId, answers }: { quizId: string; answers: { questionId: string; answer: string }[] }) => {
      const timeSpent = Math.round((Date.now() - quizStartTime) / 1000);
      const response = await apiRequest("POST", `/api/patients/${patientId}/education/quizzes/${quizId}/submit`, { 
        answers,
        timeSpent,
      });
      return response.json() as Promise<QuizAttemptWithFeedback>;
    },
    onSuccess: (result) => {
      setQuizResult(result);
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/education`] });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Could not submit your quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const voteFaqMutation = useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const response = await apiRequest("POST", `/api/education/faqs/${id}/vote`, { helpful });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/education`] });
    },
  });

  const content = selectedCategory !== "all" && allContent ? allContent : (dashboard?.content || []);
  const faqs = dashboard?.faqs || [];
  const quizzes = allQuizzes || dashboard?.quizzes || [];
  const stats = dashboard?.stats;

  const handleStartQuiz = (quiz: EducationQuiz) => {
    setActiveQuiz(quiz);
    setQuizAnswers({});
    setQuizResult(null);
    setQuizStartTime(Date.now());
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz) return;
    const answers = Object.entries(quizAnswers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
    submitQuizMutation.mutate({ quizId: activeQuiz.id, answers });
  };

  const handleExitQuiz = () => {
    setActiveQuiz(null);
    setQuizAnswers({});
    setQuizResult(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "intermediate": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "advanced": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "";
    }
  };

  const getResourceIcon = (type: HealthResource["type"]) => {
    switch (type) {
      case "article": return <FileText className="h-5 w-5" />;
      case "video": return <Video className="h-5 w-5" />;
      case "guide": return <BookMarked className="h-5 w-5" />;
      case "infographic": return <ImageIcon className="h-5 w-5" />;
      case "tool": return <Wrench className="h-5 w-5" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const handleAskQuestion = () => {
    if (!questionInput.trim()) return;
    askQuestionMutation.mutate(questionInput.trim());
  };

  const handleFollowUpClick = (question: string) => {
    setQuestionInput(question);
    askQuestionMutation.mutate(question);
  };

  if (activeQuiz) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Button 
          variant="ghost" 
          onClick={handleExitQuiz}
          className="mb-4"
          data-testid="button-exit-quiz"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Exit Quiz
        </Button>

        <Card data-testid="card-quiz-active">
          <CardHeader>
            <CardTitle data-testid="text-quiz-title">{activeQuiz.title}</CardTitle>
            <CardDescription>{activeQuiz.description}</CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{activeQuiz.questions.length} questions</Badge>
              <Badge variant="secondary">Pass: {activeQuiz.passingScore}%</Badge>
              <Badge variant="secondary">{activeQuiz.pointsReward} points</Badge>
            </div>
          </CardHeader>

          <CardContent>
            {quizResult ? (
              <div className="space-y-6" data-testid="quiz-results">
                <div className={`text-center p-6 rounded-lg ${quizResult.feedback.passed ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                  {quizResult.feedback.passed ? (
                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
                  ) : (
                    <XCircle className="h-16 w-16 mx-auto text-red-600 mb-4" />
                  )}
                  <h3 className="text-2xl font-bold mb-2" data-testid="text-quiz-result">
                    {quizResult.feedback.passed ? "Congratulations!" : "Keep Learning!"}
                  </h3>
                  <p className="text-muted-foreground">
                    You scored {quizResult.feedback.score}% ({quizResult.feedback.correctAnswers}/{quizResult.feedback.totalQuestions} correct)
                  </p>
                  {quizResult.feedback.passed && (
                    <p className="text-green-600 font-medium mt-2">
                      +{quizResult.feedback.totalPoints} points earned!
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Review Answers</h4>
                  {quizResult.feedback.explanations.map((exp, idx) => (
                    <div key={exp.questionId} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-2">
                        {exp.wasCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">Question {idx + 1}</p>
                          <p className="text-sm text-muted-foreground mt-1">{exp.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={handleExitQuiz} className="w-full" data-testid="button-finish-review">
                  Finish Review
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {activeQuiz.questions.map((question, index) => (
                  <div key={question.id} className="p-4 border rounded-lg" data-testid={`quiz-question-${index}`}>
                    <p className="font-medium mb-4">
                      {index + 1}. {question.question}
                    </p>
                    <RadioGroup
                      value={quizAnswers[question.id] || ""}
                      onValueChange={(value) => setQuizAnswers(prev => ({ ...prev, [question.id]: value }))}
                    >
                      {(question.options || []).map((option, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-2 p-2 rounded hover-elevate">
                          <RadioGroupItem 
                            value={option} 
                            id={`${question.id}-${optIdx}`}
                            data-testid={`radio-${question.id}-${optIdx}`}
                          />
                          <Label htmlFor={`${question.id}-${optIdx}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}

                <Button 
                  onClick={handleSubmitQuiz}
                  disabled={Object.keys(quizAnswers).length < activeQuiz.questions.length || submitQuizMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-quiz"
                >
                  {submitQuizMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Submit Quiz
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Health Education</h1>
          <p className="text-muted-foreground">Personalized learning resources for your health journey</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-stat-streak">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-streak-value">{stats.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-points">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/20">
                <Trophy className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-points-value">{stats.pointsEarned}</p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-quizzes">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <GraduationCap className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-quizzes-value">{stats.totalQuizzesPassed}/{stats.totalQuizzesTaken}</p>
                <p className="text-xs text-muted-foreground">Quizzes Passed</p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-time">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-time-value">{stats.totalTimeSpentMinutes}</p>
                <p className="text-xs text-muted-foreground">Minutes Learning</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="articles" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList data-testid="tabs-education" className="flex-wrap h-auto">
            <TabsTrigger value="ask" data-testid="tab-ask">
              <MessageCircle className="h-4 w-4 mr-2" />
              Ask a Question
            </TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-resources">
              <Library className="h-4 w-4 mr-2" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="articles" data-testid="tab-articles">
              <BookOpen className="h-4 w-4 mr-2" />
              Articles
            </TabsTrigger>
            <TabsTrigger value="faqs" data-testid="tab-faqs">
              <HelpCircle className="h-4 w-4 mr-2" />
              FAQs
            </TabsTrigger>
            <TabsTrigger value="quizzes" data-testid="tab-quizzes">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Quizzes
            </TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">
              <TrendingUp className="h-4 w-4 mr-2" />
              Progress
            </TabsTrigger>
          </TabsList>

          <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as EducationCategory | "all")}>
            <SelectTrigger className="w-48" data-testid="select-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="ask" className="space-y-4">
          <Card data-testid="card-ask-question">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Ask About Your Health
              </CardTitle>
              <CardDescription>
                Ask any question about your conditions, medications, or health in your own words. 
                I'll provide personalized, easy-to-understand answers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your health question here... For example: 'What are the side effects of my blood pressure medication?' or 'How can I manage my diabetes better?'"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-question"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleAskQuestion}
                  disabled={!questionInput.trim() || askQuestionMutation.isPending}
                  data-testid="button-ask"
                >
                  {askQuestionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Ask Question
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {chatHistory.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Conversation</h3>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 pr-4">
                  {chatHistory.map((item) => (
                    <div key={item.id} className="space-y-3" data-testid={`qa-item-${item.id}`}>
                      <Card className="bg-primary/5">
                        <CardContent className="p-4">
                          <p className="font-medium text-sm text-muted-foreground mb-1" data-testid={`label-question-${item.id}`}>Your Question</p>
                          <p data-testid={`text-question-${item.id}`}>{item.question}</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-muted/50">
                        <CardContent className="p-4 space-y-4">
                          <div>
                            <p className="font-medium text-sm text-muted-foreground mb-2" data-testid={`label-answer-${item.id}`}>Answer</p>
                            <p className="whitespace-pre-wrap" data-testid={`text-answer-${item.id}`}>{item.answer}</p>
                          </div>
                          
                          {item.followUpQuestions && item.followUpQuestions.length > 0 && (
                            <div data-testid={`section-followups-${item.id}`}>
                              <p className="font-medium text-sm text-muted-foreground mb-2">Related Questions You Might Ask</p>
                              <div className="flex flex-wrap gap-2">
                                {item.followUpQuestions.map((q, i) => (
                                  <Button 
                                    key={i} 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleFollowUpClick(q)}
                                    data-testid={`button-followup-${item.id}-${i}`}
                                  >
                                    {q}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {item.relatedTopics && item.relatedTopics.length > 0 && (
                            <div data-testid={`section-topics-${item.id}`}>
                              <p className="font-medium text-sm text-muted-foreground mb-2">Learn More About</p>
                              <div className="flex flex-wrap gap-2">
                                {item.relatedTopics.map((topic, i) => (
                                  <Badge key={i} variant="secondary" data-testid={`badge-topic-${item.id}-${i}`}>{topic}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm" data-testid={`disclaimer-${item.id}`}>
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-amber-800 dark:text-amber-200">{item.disclaimer}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {chatHistory.length === 0 && (
            <Card className="border-dashed" data-testid="card-empty-chat">
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Your Personal Health Guide</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Ask any question about your health conditions, medications, symptoms, or lifestyle. 
                  Answers are personalized based on your health profile.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleFollowUpClick("What should I know about my medications?")}
                    data-testid="button-suggestion-medications"
                  >
                    About my medications
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleFollowUpClick("How can I manage my conditions better?")}
                    data-testid="button-suggestion-conditions"
                  >
                    Managing my conditions
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleFollowUpClick("What lifestyle changes would help my health?")}
                    data-testid="button-suggestion-lifestyle"
                  >
                    Lifestyle tips
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Recommended Resources</h2>
              <p className="text-sm text-muted-foreground">Curated articles, videos, and guides based on your health profile</p>
            </div>
            <Button 
              onClick={() => refetchResources()}
              disabled={resourcesLoading}
              variant="outline"
              data-testid="button-refresh-resources"
            >
              {resourcesLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>

          {resourceRecommendations?.basedOn && (
            <Card className="bg-muted/30" data-testid="card-resources-context">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Resources selected based on:</p>
                <div className="flex flex-wrap gap-2">
                  {resourceRecommendations.basedOn.conditions.map((c, i) => (
                    <Badge key={`cond-${i}`} variant="outline">{c}</Badge>
                  ))}
                  {resourceRecommendations.basedOn.medications.map((m, i) => (
                    <Badge key={`med-${i}`} variant="secondary">{m}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {resourcesLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !resourceRecommendations?.resources?.length ? (
            <Card data-testid="card-empty-resources">
              <CardContent className="p-12 text-center">
                <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Resources Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Click refresh to generate personalized resource recommendations based on your health profile.
                </p>
                <Button onClick={() => refetchResources()} data-testid="button-generate-resources">
                  Generate Recommendations
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {resourceRecommendations.resources.map((resource) => (
                <Card key={resource.id} className="hover-elevate" data-testid={`card-resource-${resource.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {getResourceIcon(resource.type)}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base" data-testid={`text-resource-title-${resource.id}`}>
                          {resource.title}
                        </CardTitle>
                        <CardDescription className="mt-1">{resource.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {resource.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{resource.source}</span>
                      {resource.readTimeMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {resource.readTimeMinutes} min
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      {resource.relevanceReason}
                    </p>
                  </CardContent>
                  <CardFooter>
                    {resource.url ? (
                      <Button 
                        variant="ghost" 
                        className="w-full" 
                        asChild
                        data-testid={`button-view-resource-${resource.id}`}
                      >
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          View Resource
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" className="w-full" data-testid={`button-view-resource-${resource.id}`}>
                        Learn More
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Personalized Articles</h2>
            <Button 
              onClick={() => generateMutation.mutate({ type: "article", category: selectedCategory !== "all" ? selectedCategory : "general_wellness" })}
              disabled={generateMutation.isPending}
              data-testid="button-generate-article"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Generate New Article
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : content.length === 0 ? (
            <Card data-testid="card-empty-articles">
              <CardContent className="p-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Articles Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate personalized health articles based on your conditions and medications.
                </p>
                <Button 
                  onClick={() => generateMutation.mutate({ type: "article", category: "general_wellness" })}
                  data-testid="button-generate-first-article"
                >
                  Generate Your First Article
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {content.map((article) => (
                <Card key={article.id} className="hover-elevate" data-testid={`card-article-${article.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-base" data-testid={`text-article-title-${article.id}`}>{article.title}</CardTitle>
                      <Badge className={getDifficultyColor(article.difficulty)} variant="secondary" data-testid={`badge-article-difficulty-${article.id}`}>
                        {article.difficulty}
                      </Badge>
                    </div>
                    <CardDescription data-testid={`text-article-summary-${article.id}`}>{article.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {article.relatedConditions.slice(0, 2).map((cond, i) => (
                        <Badge key={i} variant="outline">{cond}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {article.readTimeMinutes} min read
                      </span>
                      {article.isAiGenerated && (
                        <span className="flex items-center gap-1">
                          <Brain className="h-4 w-4" />
                          AI Generated
                        </span>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="ghost" className="w-full" data-testid={`button-read-article-${article.id}`}>
                      Read Article
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="faqs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
            <Button 
              onClick={() => generateMutation.mutate({ type: "faq", category: selectedCategory !== "all" ? selectedCategory : "general_wellness" })}
              disabled={generateMutation.isPending}
              data-testid="button-generate-faqs"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Generate FAQs
            </Button>
          </div>

          {faqs.length === 0 ? (
            <Card data-testid="card-empty-faqs">
              <CardContent className="p-12 text-center">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No FAQs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate personalized answers to common health questions.
                </p>
                <Button 
                  onClick={() => generateMutation.mutate({ type: "faq", category: "general_wellness" })}
                  data-testid="button-generate-first-faq"
                >
                  Generate FAQs
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => (
                <Card 
                  key={faq.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  data-testid={`card-faq-${faq.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base" data-testid={`text-faq-question-${faq.id}`}>{faq.question}</CardTitle>
                      <ChevronRight className={`h-5 w-5 transition-transform ${expandedFaq === faq.id ? "rotate-90" : ""}`} />
                    </div>
                  </CardHeader>
                  {expandedFaq === faq.id && (
                    <CardContent>
                      <p className="text-muted-foreground" data-testid={`text-faq-answer-${faq.id}`}>{faq.answer}</p>
                      <Separator className="my-4" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Was this helpful?</span>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); voteFaqMutation.mutate({ id: faq.id, helpful: true }); }}
                            data-testid={`button-faq-helpful-${faq.id}`}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Yes
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); voteFaqMutation.mutate({ id: faq.id, helpful: false }); }}
                            data-testid={`button-faq-not-helpful-${faq.id}`}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            No
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Knowledge Quizzes</h2>
            <Button 
              onClick={() => generateMutation.mutate({ type: "quiz", category: selectedCategory !== "all" ? selectedCategory : "general_wellness" })}
              disabled={generateMutation.isPending}
              data-testid="button-generate-quiz"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Generate New Quiz
            </Button>
          </div>

          {quizzes.length === 0 ? (
            <Card data-testid="card-empty-quizzes">
              <CardContent className="p-12 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Quizzes Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate personalized quizzes to test your health knowledge.
                </p>
                <Button 
                  onClick={() => generateMutation.mutate({ type: "quiz", category: "general_wellness" })}
                  data-testid="button-generate-first-quiz"
                >
                  Generate Your First Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {quizzes.map((quiz) => {
                const attempts = quizAttempts?.filter(a => a.quizId === quiz.id) || [];
                const bestScore = attempts.length > 0 ? Math.max(...attempts.map(a => a.score)) : null;
                const hasPassed = attempts.some(a => a.passed);

                return (
                  <Card key={quiz.id} className="hover-elevate" data-testid={`card-quiz-${quiz.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{quiz.title}</CardTitle>
                        {hasPassed && <Badge className="bg-green-100 text-green-800">Passed</Badge>}
                      </div>
                      <CardDescription>{quiz.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>{quiz.questions.length} questions</span>
                        <span>Pass: {quiz.passingScore}%</span>
                        <span>{quiz.pointsReward} points</span>
                      </div>
                      {bestScore !== null && (
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Best Score</span>
                            <span>{bestScore}%</span>
                          </div>
                          <Progress value={bestScore} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button 
                        onClick={() => handleStartQuiz(quiz)} 
                        className="w-full"
                        data-testid={`button-start-quiz-${quiz.id}`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {attempts.length > 0 ? "Retake Quiz" : "Start Quiz"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <h2 className="text-lg font-semibold">Learning Progress</h2>

          {!stats ? (
            <Card data-testid="card-empty-progress">
              <CardContent className="p-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Start Your Learning Journey</h3>
                <p className="text-muted-foreground">
                  Read articles and complete quizzes to track your progress here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <Card data-testid="card-progress-overview">
                <CardHeader>
                  <CardTitle className="text-base">Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Articles Read</span>
                    <span className="font-bold">{stats.articlesRead}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>FAQs Viewed</span>
                    <span className="font-bold">{stats.faqsViewed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Quizzes Completed</span>
                    <span className="font-bold">{stats.totalQuizzesTaken}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Quiz Score</span>
                    <span className="font-bold">{stats.averageQuizScore}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span>Total Learning Time</span>
                    <span className="font-bold">{stats.totalTimeSpentMinutes} minutes</span>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-progress-streaks">
                <CardHeader>
                  <CardTitle className="text-base">Streaks & Achievements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <Flame className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.currentStreak} days</p>
                      <p className="text-sm text-muted-foreground">Current Streak</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <Star className="h-8 w-8 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.longestStreak} days</p>
                      <p className="text-sm text-muted-foreground">Longest Streak</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Trophy className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.pointsEarned}</p>
                      <p className="text-sm text-muted-foreground">Total Points</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stats.topCategories && stats.topCategories.length > 0 && (
                <Card className="md:col-span-2" data-testid="card-progress-categories">
                  <CardHeader>
                    <CardTitle className="text-base">Top Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topCategories.map((cat, i) => {
                        const maxCount = Math.max(...stats.topCategories.map(c => c.count));
                        const percentage = (cat.count / maxCount) * 100;
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize">{cat.category.replace(/_/g, " ")}</span>
                              <span>{cat.count} items</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}