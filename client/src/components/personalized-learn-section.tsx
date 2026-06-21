import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Video,
  FileText,
  GraduationCap,
  Sparkles,
  Star,
  TrendingUp,
  Target,
  Award,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InteractiveQuiz, QuizData, QuizResultData } from "./interactive-quiz";
import { cn } from "@/lib/utils";

interface ContentRecommendation {
  contentId: string;
  title: string;
  description: string;
  type: "article" | "video" | "infographic" | "quiz" | "interactive";
  category: string;
  relevanceScore: number;
  relevanceReason: string;
  estimatedDuration: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  learningObjectives: string[];
}

interface LearningProgress {
  overallProgress: number;
  strengthAreas: string[];
  improvementAreas: string[];
  nextRecommendations: string[];
  learningVelocity: "slow" | "moderate" | "fast";
  encouragementMessage: string;
}

interface EducationalContent {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "infographic" | "quiz";
  category: string;
  duration: string;
  pathwayRelevant: boolean;
  completed: boolean;
  completedAt?: string;
}

interface PersonalizedLearnSectionProps {
  education: EducationalContent[];
  patientProfile: {
    patientId: string;
    name: string;
    healthLiteracyLevel: "basic" | "intermediate" | "advanced";
    preferredLanguage: string;
    communicationPreference: "formal" | "friendly" | "motivational";
    activeConditions: string[];
    learningStyle: "visual" | "reading" | "interactive" | "mixed";
  };
  pathwayContext: {
    pathwayId: string;
    pathwayName: string;
    currentPhase: string;
    phaseProgress: number;
    overallProgress: number;
    completedMilestones: string[];
    upcomingMilestones: string[];
    recentActivities: { activity: string; timestamp: string; success: boolean }[];
  };
  onContentComplete: (contentId: string) => void;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  article: <FileText className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
  infographic: <BookOpen className="w-4 h-4" />,
  quiz: <GraduationCap className="w-4 h-4" />,
  interactive: <Zap className="w-4 h-4" />,
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function PersonalizedLearnSection({
  education,
  patientProfile,
  pathwayContext,
  onContentComplete,
}: PersonalizedLearnSectionProps) {
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [activeContentId, setActiveContentId] = useState<string | null>(null);
  const [completedQuizzes, setCompletedQuizzes] = useState<QuizResultData[]>([]);
  const { toast } = useToast();

  const recommendationsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-personalized-engagement/recommend-content", {
        patientProfile,
        pathwayContext,
        behaviorPattern: {
          taskCompletionRate: 75,
          averageEngagementTime: 15,
          preferredTimeOfDay: "morning",
          missedTaskPatterns: [],
          successPatterns: ["consistent morning routine"],
          lastActiveDate: new Date().toISOString(),
          streakDays: 7,
          responseToNudgeTypes: [],
        },
        existingContent: education.map((e) => ({
          id: e.id,
          title: e.title,
          type: e.type,
          category: e.category,
          completed: e.completed,
        })),
      });
      return response.json();
    },
  });

  const progressMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-personalized-engagement/analyze-progress", {
        patientId: patientProfile.patientId,
        completedContent: education
          .filter((e) => e.completed)
          .map((e) => ({ id: e.id, title: e.title, completedAt: e.completedAt || "" })),
        quizResults: completedQuizzes,
        pathwayContext,
      });
      return response.json();
    },
  });

  const generateQuizMutation = useMutation({
    mutationFn: async ({ contentId, contentTitle, contentSummary }: { contentId: string; contentTitle: string; contentSummary: string }) => {
      const response = await apiRequest("POST", "/api/ai-personalized-engagement/generate-quiz", {
        contentId,
        contentTitle,
        contentSummary,
        patientProfile,
        questionCount: 5,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.quiz) {
        setActiveQuiz(data.quiz);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate quiz.", variant: "destructive" });
    },
  });

  const handleStartQuiz = (content: EducationalContent) => {
    setActiveContentId(content.id);
    generateQuizMutation.mutate({
      contentId: content.id,
      contentTitle: content.title,
      contentSummary: content.description,
    });
  };

  const handleQuizComplete = (result: QuizResultData) => {
    setCompletedQuizzes((prev) => [...prev, result]);
    if (result.passed && activeContentId) {
      onContentComplete(activeContentId);
    }
    toast({
      title: result.passed ? "Quiz Passed!" : "Keep Learning!",
      description: result.passed
        ? `You scored ${result.percentage}% and earned your knowledge badge!`
        : `You scored ${result.percentage}%. Review the material and try again!`,
    });
  };

  const handleCloseQuiz = () => {
    setActiveQuiz(null);
    setActiveContentId(null);
  };

  const recommendations = recommendationsMutation.data?.recommendations as ContentRecommendation[] | undefined;
  const progress = progressMutation.data?.analysis as LearningProgress | undefined;

  const completedContent = education.filter((e) => e.completed);
  const incompleteContent = education.filter((e) => !e.completed);

  return (
    <div className="space-y-6" data-testid="personalized-learn-section">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Personalized for You</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => recommendationsMutation.mutate()}
              disabled={recommendationsMutation.isPending}
              data-testid="button-refresh-recommendations"
            >
              <RefreshCw className={cn("w-4 h-4", recommendationsMutation.isPending && "animate-spin")} />
            </Button>
          </div>
          <CardDescription>
            AI-recommended content based on your care pathway and learning progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationsMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Finding best content for you...</span>
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div
                  key={rec.contentId}
                  className={cn(
                    "p-4 rounded-lg border hover-elevate",
                    index === 0 && "border-primary/30 bg-background"
                  )}
                  data-testid={`recommendation-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      index === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}>
                      {contentTypeIcons[rec.type] || <BookOpen className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {index === 0 && (
                          <Badge variant="default" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Top Pick
                          </Badge>
                        )}
                        <Badge variant="secondary" className={difficultyColors[rec.difficultyLevel]}>
                          {rec.difficultyLevel}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-sm">{rec.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{rec.relevanceReason}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rec.estimatedDuration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {Math.round(rec.relevanceScore * 100)}% match
                        </span>
                      </div>
                    </div>
                    <Button size="sm" data-testid={`button-start-${index}`}>
                      Start
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Button onClick={() => recommendationsMutation.mutate()} data-testid="button-get-recommendations">
                <Sparkles className="w-4 h-4 mr-2" />
                Get Personalized Recommendations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="learning-progress-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg">Your Learning Progress</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => progressMutation.mutate()}
              disabled={progressMutation.isPending}
              data-testid="button-refresh-progress"
            >
              <RefreshCw className={cn("w-4 h-4", progressMutation.isPending && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">{completedContent.length}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-yellow-600">{incompleteContent.length}</div>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-green-600">{completedQuizzes.filter((q) => q.passed).length}</div>
              <p className="text-xs text-muted-foreground">Quizzes Passed</p>
            </div>
          </div>

          {progress ? (
            <>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Learning Progress</span>
                  <span className="font-medium">{progress.overallProgress}%</span>
                </div>
                <Progress value={progress.overallProgress} className="h-2" />
              </div>

              <Alert className="bg-primary/5 border-primary/20">
                <Lightbulb className="w-4 h-4 text-primary" />
                <AlertDescription className="text-sm">{progress.encouragementMessage}</AlertDescription>
              </Alert>

              {progress.strengthAreas.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Award className="w-4 h-4 text-green-600" />
                    Your Strengths
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {progress.strengthAreas.map((area, i) => (
                      <Badge key={i} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {progress.improvementAreas.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Target className="w-4 h-4 text-yellow-600" />
                    Areas to Focus On
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {progress.improvementAreas.map((area, i) => (
                      <Badge key={i} variant="outline">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Button variant="outline" onClick={() => progressMutation.mutate()} className="w-full" data-testid="button-analyze-progress">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analyze My Progress
            </Button>
          )}
        </CardContent>
      </Card>

      <Card data-testid="interactive-quizzes-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">Test Your Knowledge</CardTitle>
          </div>
          <CardDescription>
            Complete interactive quizzes to reinforce your learning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {education.filter((e) => e.type === "quiz" || e.completed).slice(0, 4).map((content) => {
            const hasQuizResult = completedQuizzes.find((q) => q.quizId.includes(content.id));
            return (
              <div
                key={content.id}
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                data-testid={`quiz-item-${content.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{content.title}</h4>
                    <p className="text-xs text-muted-foreground">{content.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasQuizResult && (
                    <Badge variant={hasQuizResult.passed ? "default" : "secondary"}>
                      {hasQuizResult.percentage}%
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant={hasQuizResult?.passed ? "outline" : "default"}
                    onClick={() => handleStartQuiz(content)}
                    disabled={generateQuizMutation.isPending && activeContentId === content.id}
                    data-testid={`button-take-quiz-${content.id}`}
                  >
                    {generateQuizMutation.isPending && activeContentId === content.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : hasQuizResult?.passed ? (
                      <>Retake</>
                    ) : (
                      <>Take Quiz</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All Educational Resources</CardTitle>
          <CardDescription>Content recommended for your care pathway</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {education.map((content) => (
            <div
              key={content.id}
              className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
              data-testid={`content-item-${content.id}`}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  content.completed
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-muted"
                )}>
                  {content.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    contentTypeIcons[content.type] || <BookOpen className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className="font-medium text-sm">{content.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{content.category}</span>
                    <span>•</span>
                    <span>{content.duration}</span>
                    {content.pathwayRelevant && (
                      <>
                        <span>•</span>
                        <Badge variant="secondary" className="text-xs py-0">Pathway</Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={content.completed ? "ghost" : "default"}
                onClick={() => {
                  if (content.type === "quiz") {
                    handleStartQuiz(content);
                  } else {
                    onContentComplete(content.id);
                  }
                }}
                data-testid={`button-view-${content.id}`}
              >
                {content.completed ? "Review" : content.type === "quiz" ? "Take Quiz" : "Start"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!activeQuiz} onOpenChange={(open) => !open && handleCloseQuiz()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Knowledge Check
            </DialogTitle>
          </DialogHeader>
          {activeQuiz && (
            <InteractiveQuiz
              quiz={activeQuiz}
              onComplete={handleQuizComplete}
              onClose={handleCloseQuiz}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
