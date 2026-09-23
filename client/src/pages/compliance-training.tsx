import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import { 
  GraduationCap, 
  BookOpen, 
  Target, 
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Play,
  ChevronRight,
  RefreshCw,
  Lightbulb,
  Award,
  BarChart3,
  Zap
} from "lucide-react";

interface TrainingModule {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  description: string;
  objectives: string[];
  content: Array<{ id: string; type: string; title: string; body: string; keyPoints: string[] }>;
  exercises: Array<{
    id: string;
    type: string;
    question: string;
    options?: string[];
    correctAnswer: string;
    explanation: string;
    points: number;
  }>;
  estimatedDurationMinutes: number;
  aiGenerated: boolean;
}

interface UserProgress {
  status: string;
  completedContentIds: string[];
  score: number;
  maxScore: number;
}

interface UserWeakness {
  category: string;
  severity: string;
  description: string;
  violationCount: number;
  recommendedTraining: string[];
}

interface TrainingProfile {
  userId: string;
  weaknesses: UserWeakness[];
  recommendedModules: string[];
  completedModules: string[];
  inProgressModules: string[];
  overallScore: number;
  strengthAreas: string[];
  improvementAreas: string[];
  learningPath: Array<{ moduleId: string; order: number; priority: string; reason: string }>;
}

interface TrainingAnalytics {
  totalModulesCompleted: number;
  totalExercisesAttempted: number;
  overallAccuracy: number;
  categoryPerformance: Record<string, { accuracy: number; completed: number }>;
  improvementTrend: string;
  nextRecommendation: string;
}

interface RealTimeFeedback {
  feedbackType: string;
  message: string;
  improvementSuggestions: string[];
  encouragement: string;
}

export default function ComplianceTraining() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [lastFeedback, setLastFeedback] = useState<RealTimeFeedback | null>(null);
  const [exerciseStartTime, setExerciseStartTime] = useState<number>(Date.now());

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<{
    profile: TrainingProfile | null;
    analytics: TrainingAnalytics;
    recommendedModules: TrainingModule[];
    inProgressModules: Array<{ module: TrainingModule; progress: UserProgress }>;
  }>({
    queryKey: ["/api/compliance-training/dashboard"]
  });

  const { data: modules } = useQuery<TrainingModule[]>({
    queryKey: ["/api/compliance-training/modules"]
  });

  const { data: weaknesses } = useQuery<UserWeakness[]>({
    queryKey: ["/api/compliance-training/analyze-weaknesses"],
    enabled: activeTab === "weaknesses"
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ moduleId, exerciseId, answer }: { moduleId: string; exerciseId: string; answer: string }) => {
      const timeSpent = Math.floor((Date.now() - exerciseStartTime) / 1000);
      const result = await apiRequest("POST", `/api/compliance-training/modules/${moduleId}/exercises/${exerciseId}/submit`, {
        answer,
        timeSpentSeconds: timeSpent
      });
      return result.json();
    },
    onSuccess: (feedback: RealTimeFeedback) => {
      setLastFeedback(feedback);
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-training/dashboard"] });
      toast({ 
        title: feedback.feedbackType === "correct" ? "Correct!" : "Not quite",
        description: feedback.encouragement
      });
    },
  });

  const generateModuleMutation = useMutation({
    mutationFn: async (weakness: UserWeakness) => {
      const result = await apiRequest("POST", "/api/compliance-training/generate-personalized-module", { weakness });
      return result.json();
    },
    onSuccess: (module: TrainingModule) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-training/modules"] });
      setSelectedModule(module);
      setActiveTab("learning");
      toast({ title: "Personalized module created" });
    },
  });

  const markContentCompleteMutation = useMutation({
    mutationFn: async ({ moduleId, contentId }: { moduleId: string; contentId: string }) => {
      return apiRequest("POST", `/api/compliance-training/modules/${moduleId}/content/${contentId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-training/dashboard"] });
    },
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "intermediate": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "advanced": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const startModule = (module: TrainingModule) => {
    setSelectedModule(module);
    setCurrentExerciseIndex(0);
    setSelectedAnswer("");
    setLastFeedback(null);
    setExerciseStartTime(Date.now());
    setActiveTab("learning");
  };

  const handleAnswerSubmit = () => {
    if (!selectedModule || !selectedAnswer) return;
    
    const exercise = selectedModule.exercises[currentExerciseIndex];
    submitAnswerMutation.mutate({
      moduleId: selectedModule.id,
      exerciseId: exercise.id,
      answer: selectedAnswer
    });
  };

  const nextExercise = () => {
    if (!selectedModule) return;
    
    if (currentExerciseIndex < selectedModule.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setSelectedAnswer("");
      setLastFeedback(null);
      setExerciseStartTime(Date.now());
    } else {
      toast({ title: "Module completed!", description: "Great job finishing this training module." });
      setSelectedModule(null);
      setActiveTab("dashboard");
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <GraduationCap className="h-8 w-8" />
            Compliance Training
          </h1>
          <p className="text-muted-foreground">Personalized training based on your compliance profile</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-navigation">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="modules" data-testid="tab-modules">All Modules</TabsTrigger>
          <TabsTrigger value="weaknesses" data-testid="tab-weaknesses">My Weaknesses</TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-learning" disabled={!selectedModule}>
            {selectedModule ? "Active Learning" : "Learning"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboard && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-accuracy">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Overall Accuracy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {dashboard.analytics.overallAccuracy}%
                    </div>
                    <Progress value={dashboard.analytics.overallAccuracy} className="mt-2" />
                  </CardContent>
                </Card>

                <Card data-testid="card-completed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Modules Completed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {dashboard.analytics.totalModulesCompleted}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dashboard.analytics.totalExercisesAttempted} exercises attempted
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-trend">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Improvement Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-2xl font-bold">
                      {dashboard.analytics.improvementTrend === "improving" ? (
                        <>
                          <TrendingUp className="h-6 w-6 text-green-500" />
                          <span className="text-green-500">Improving</span>
                        </>
                      ) : dashboard.analytics.improvementTrend === "declining" ? (
                        <>
                          <TrendingDown className="h-6 w-6 text-red-500" />
                          <span className="text-red-500">Needs Work</span>
                        </>
                      ) : (
                        <>
                          <Target className="h-6 w-6 text-muted-foreground" />
                          <span>Stable</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-next">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Next Step
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{dashboard.analytics.nextRecommendation}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-recommended">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Recommended Training
                    </CardTitle>
                    <CardDescription>Based on your compliance profile</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboard.recommendedModules.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No recommended modules at this time
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dashboard.recommendedModules.map((module) => (
                          <button 
                            key={module.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer w-full text-left"
                            onClick={() => startModule(module)}
                            data-testid={`module-item-${module.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{module.title}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge className={getDifficultyColor(module.difficulty)}>
                                    {module.difficulty}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {module.estimatedDurationMinutes} min
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-md bg-primary text-primary-foreground">
                              <Play className="h-4 w-4" />
                              Start
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-in-progress">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      In Progress
                    </CardTitle>
                    <CardDescription>Continue where you left off</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboard.inProgressModules.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No modules in progress
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dashboard.inProgressModules.map(({ module, progress }) => (
                          <button 
                            key={module.id}
                            className="p-3 rounded-lg border hover-elevate cursor-pointer w-full text-left"
                            onClick={() => startModule(module)}
                            data-testid={`progress-item-${module.id}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium">{module.title}</p>
                              <span className="text-sm text-muted-foreground">
                                {progress.score}/{progress.maxScore} pts
                              </span>
                            </div>
                            <Progress 
                              value={(progress.score / Math.max(progress.maxScore, 1)) * 100} 
                              className="h-2"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {dashboard.profile && dashboard.profile.strengthAreas.length > 0 && (
                <Card data-testid="card-performance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Performance by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(dashboard.analytics.categoryPerformance).map(([category, perf]) => (
                        <div key={category} className="text-center p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">
                            {category.replace(/_/g, " ")}
                          </p>
                          <p className="text-lg font-bold">
                            {perf.completed > 0 ? `${perf.accuracy}%` : "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                All Training Modules
              </CardTitle>
              <CardDescription>Browse all available compliance training</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules?.map((module) => (
                  <Card key={module.id} className="hover-elevate" data-testid={`module-card-${module.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <div className="flex gap-2 mt-2">
                            <Badge className={getDifficultyColor(module.difficulty)}>
                              {module.difficulty}
                            </Badge>
                            <Badge variant="outline">
                              {module.category.replace(/_/g, " ")}
                            </Badge>
                            {module.aiGenerated && (
                              <Badge className="bg-purple-500/10 text-purple-500">
                                <Zap className="h-3 w-3 mr-1" />
                                AI Generated
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">{module.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {module.estimatedDurationMinutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-4 w-4" />
                          {module.exercises.length} exercises
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full"
                        onClick={() => startModule(module)}
                        data-testid={`button-start-module-${module.id}`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Module
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weaknesses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Identified Weaknesses
              </CardTitle>
              <CardDescription>
                Areas needing improvement based on your access patterns and policy violations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!weaknesses || weaknesses.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No significant weaknesses identified</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Keep up the great work with your compliance practices!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {weaknesses.map((weakness, index) => (
                    <Card key={index} data-testid={`weakness-card-${index}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {weakness.category.replace(/_/g, " ")}
                              <Badge className={getSeverityColor(weakness.severity)}>
                                {weakness.severity}
                              </Badge>
                            </CardTitle>
                            <CardDescription>{weakness.description}</CardDescription>
                          </div>
                          <Badge variant="outline">{weakness.violationCount} occurrences</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4">
                          <h4 className="text-sm font-medium mb-2">Recommended Training</h4>
                          <div className="flex flex-wrap gap-2">
                            {weakness.recommendedTraining.map((moduleId) => {
                              const module = modules?.find(m => m.id === moduleId);
                              return module ? (
                                <Button 
                                  key={moduleId} 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startModule(module)}
                                  data-testid={`button-recommended-${moduleId}`}
                                >
                                  {module.title}
                                </Button>
                              ) : null;
                            })}
                          </div>
                        </div>
                        <Button
                          onClick={() => generateModuleMutation.mutate(weakness)}
                          disabled={generateModuleMutation.isPending}
                          data-testid={`button-generate-training-${index}`}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Generate Personalized Training
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          {selectedModule ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedModule.title}</CardTitle>
                      <CardDescription>
                        Exercise {currentExerciseIndex + 1} of {selectedModule.exercises.length}
                      </CardDescription>
                    </div>
                    <Badge className={getDifficultyColor(selectedModule.difficulty)}>
                      {selectedModule.difficulty}
                    </Badge>
                  </div>
                  <Progress 
                    value={((currentExerciseIndex + 1) / selectedModule.exercises.length) * 100}
                    className="mt-4"
                  />
                </CardHeader>
                <CardContent className="space-y-6">
                  {selectedModule.exercises[currentExerciseIndex] && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">
                        {selectedModule.exercises[currentExerciseIndex].question}
                      </h3>
                      
                      <RadioGroup
                        value={selectedAnswer}
                        onValueChange={setSelectedAnswer}
                        disabled={!!lastFeedback}
                      >
                        {selectedModule.exercises[currentExerciseIndex].options?.map((option, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value={option} 
                              id={`option-${idx}`}
                              data-testid={`radio-option-${idx}`}
                            />
                            <Label 
                              htmlFor={`option-${idx}`}
                              className={`cursor-pointer ${
                                lastFeedback && option === selectedModule.exercises[currentExerciseIndex].correctAnswer
                                  ? "text-green-500 font-medium"
                                  : lastFeedback && option === selectedAnswer && lastFeedback.feedbackType === "incorrect"
                                  ? "text-red-500"
                                  : ""
                              }`}
                            >
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {lastFeedback && (
                    <Card className={`${
                      lastFeedback.feedbackType === "correct" 
                        ? "border-green-500 bg-green-500/10" 
                        : "border-red-500 bg-red-500/10"
                    }`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          {lastFeedback.feedbackType === "correct" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium">{lastFeedback.message}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                              {lastFeedback.encouragement}
                            </p>
                            {lastFeedback.improvementSuggestions.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium">Suggestions:</p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground">
                                  {lastFeedback.improvementSuggestions.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setSelectedModule(null);
                      setActiveTab("dashboard");
                    }}
                  >
                    Exit Module
                  </Button>
                  {!lastFeedback ? (
                    <Button
                      onClick={handleAnswerSubmit}
                      disabled={!selectedAnswer || submitAnswerMutation.isPending}
                      data-testid="button-submit-answer"
                    >
                      Submit Answer
                    </Button>
                  ) : (
                    <Button onClick={nextExercise} data-testid="button-next-exercise">
                      {currentExerciseIndex < selectedModule.exercises.length - 1 ? (
                        <>
                          Next Exercise
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Complete Module
                          <Trophy className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Module Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Objectives</h4>
                      <ul className="space-y-1">
                        {selectedModule.objectives.map((obj, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Points Available</h4>
                      <p className="text-2xl font-bold">
                        {selectedModule.exercises.reduce((sum, e) => sum + e.points, 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {selectedModule.content.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Reference Material</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedModule.content.slice(0, 2).map((content) => (
                          <div 
                            key={content.id}
                            className="p-3 rounded-lg bg-muted/50"
                            {...clickable(() => markContentCompleteMutation.mutate({
                              moduleId: selectedModule.id,
                              contentId: content.id
                            }))}
                          >
                            <h4 className="text-sm font-medium">{content.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {content.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a module to start learning</p>
                <Button 
                  className="mt-4"
                  onClick={() => setActiveTab("modules")}
                >
                  Browse Modules
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
