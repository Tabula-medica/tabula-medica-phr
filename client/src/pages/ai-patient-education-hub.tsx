import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  Heart,
  Lightbulb,
  Pill,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Video,
  Zap,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PATIENT_ID = "patient-001";

interface MedicationInfo {
  name: string;
  dosage: string;
  frequency: string;
  purpose: string;
}

interface ContentSection {
  id: string;
  title: string;
  type: string;
  content: string;
  keyPoints: string[];
  completed: boolean;
}

interface PersonalizedContent {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  category: string;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  content: ContentSection[];
  relatedConditions: string[];
  relatedMedications: string[];
  relevanceScore: number;
  matchReasons: string[];
  noCdsCompliance: string;
}

interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  type: string;
  content: string;
  completed: boolean;
}

interface MedicationTutorial {
  id: string;
  medicationName: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  currentStep: number;
  completedSteps: string[];
  adherenceTips: string[];
  reminderStrategies: string[];
  sideEffectManagement: string[];
  noCdsCompliance: string;
}

interface TreatmentModule {
  id: string;
  moduleNumber: number;
  title: string;
  objective: string;
  completed: boolean;
  progress: number;
}

interface TreatmentTutorial {
  id: string;
  treatmentName: string;
  condition: string;
  title: string;
  description: string;
  modules: TreatmentModule[];
  currentModule: number;
  overallProgress: number;
  expectedOutcomes: string[];
  timelineExplanation: string;
  noCdsCompliance: string;
}

interface ContentRecommendation {
  id: string;
  title: string;
  summary: string;
  category: string;
  format: string;
  relevanceScore: number;
  matchReasons: string[];
  basedOn: string;
  estimatedMinutes: number;
  priority: string;
  status: string;
}

interface EducationProgress {
  totalModulesCompleted: number;
  totalTimeSpent: number;
  streak: number;
  weeklyGoal: number;
  weeklyProgress: number;
  achievements: Array<{ id: string; title: string; description: string; icon: string }>;
  categoryProgress: Record<string, number>;
}

interface PatientProfile {
  patientId: string;
  conditions: string[];
  medications: MedicationInfo[];
  riskFactors: string[];
  interests: string[];
}

export default function AIPatientEducationHub() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedMedication, setSelectedMedication] = useState<string>("");
  const [topicInput, setTopicInput] = useState("");
  const [activeContent, setActiveContent] = useState<PersonalizedContent | null>(null);
  const [activeMedTutorial, setActiveMedTutorial] = useState<MedicationTutorial | null>(null);
  const [activeTreatmentTutorial, setActiveTreatmentTutorial] = useState<TreatmentTutorial | null>(null);
  const { toast } = useToast();

  const { data: profileData } = useQuery<{ profile: PatientProfile }>({
    queryKey: ["/api/education-hub/profile", PATIENT_ID]
  });

  const { data: progressData, refetch: refetchProgress } = useQuery<{ progress: EducationProgress }>({
    queryKey: ["/api/education-hub/progress", PATIENT_ID]
  });

  const { data: recommendationsData, refetch: refetchRecommendations } = useQuery<{ recommendations: ContentRecommendation[] }>({
    queryKey: ["/api/education-hub/recommendations", PATIENT_ID]
  });

  const generateContentMutation = useMutation({
    mutationFn: async ({ topic, category }: { topic?: string; category?: string }) => {
      return apiRequest("POST", `/api/education-hub/content/generate/${PATIENT_ID}`, { topic, category });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setActiveContent(data.content);
      toast({ title: "Content Generated", description: "Your personalized content is ready" });
    }
  });

  const generateMedTutorialMutation = useMutation({
    mutationFn: async (medicationName: string) => {
      return apiRequest("POST", `/api/education-hub/tutorials/medication/${PATIENT_ID}`, { medicationName });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setActiveMedTutorial(data.tutorial);
      toast({ title: "Tutorial Ready", description: "Your medication tutorial is ready" });
    }
  });

  const generateTreatmentTutorialMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/education-hub/tutorials/treatment/${PATIENT_ID}`, {});
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setActiveTreatmentTutorial(data.tutorial);
      toast({ title: "Tutorial Ready", description: "Your treatment plan tutorial is ready" });
    }
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ tutorialId, stepId, type }: { tutorialId: string; stepId: string; type: "medication" | "treatment" }) => {
      return apiRequest("POST", `/api/education-hub/tutorials/${tutorialId}/progress`, { stepId, type });
    },
    onSuccess: () => {
      refetchProgress();
      toast({ title: "Progress Saved", description: "Your progress has been updated" });
    }
  });

  const refreshRecommendationsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/education-hub/recommendations/${PATIENT_ID}/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education-hub/recommendations", PATIENT_ID] });
      toast({ title: "Recommendations Updated", description: "New personalized recommendations generated" });
    }
  });

  const profile = profileData?.profile;
  const progress = progressData?.progress;
  const recommendations = recommendationsData?.recommendations || [];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "condition": return Heart;
      case "medication": return Pill;
      case "treatment": return Target;
      case "lifestyle": return Zap;
      case "prevention": return Shield;
      case "nutrition": return Star;
      default: return BookOpen;
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "video": return Video;
      case "tutorial": return GraduationCap;
      case "interactive": return Sparkles;
      default: return FileText;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-education-hub">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-education-hub">
            <GraduationCap className="h-8 w-8 text-primary" />
            AI Patient Education Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Personalized learning for better health understanding
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetchRecommendations()}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs" data-testid="alert-no-medical-advice">
          EDUCATIONAL CONTENT ONLY: This information is for learning purposes and is NOT medical advice. Always consult your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="personalized" data-testid="tab-personalized">For You</TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
          <TabsTrigger value="treatment" data-testid="tab-treatment">Treatment</TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">Suggested</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="card-streak">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Learning Streak</CardTitle>
                <Trophy className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-500" data-testid="text-streak">{progress?.streak || 0} days</div>
                <p className="text-xs text-muted-foreground">Keep it going!</p>
              </CardContent>
            </Card>

            <Card data-testid="card-modules-completed">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Modules Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500" data-testid="text-modules">{progress?.totalModulesCompleted || 0}</div>
                <p className="text-xs text-muted-foreground">Great progress!</p>
              </CardContent>
            </Card>

            <Card data-testid="card-time-spent">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Time Invested</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500" data-testid="text-time">{progress?.totalTimeSpent || 0} min</div>
                <p className="text-xs text-muted-foreground">Learning time</p>
              </CardContent>
            </Card>

            <Card data-testid="card-weekly-goal">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Weekly Goal</CardTitle>
                <Target className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold" data-testid="text-weekly-progress">
                  {progress?.weeklyProgress || 0}/{progress?.weeklyGoal || 30} min
                </div>
                <Progress value={((progress?.weeklyProgress || 0) / (progress?.weeklyGoal || 30)) * 100} className="h-2 mt-2" />
              </CardContent>
            </Card>
          </div>

          {progress?.achievements && progress.achievements.length > 0 && (
            <Card data-testid="card-achievements">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Your Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {progress.achievements.map(achievement => (
                    <div key={achievement.id} className="flex items-center gap-2 p-3 rounded-lg border" data-testid={`achievement-${achievement.id}`}>
                      <Star className="h-6 w-6 text-yellow-500" />
                      <div>
                        <div className="font-medium">{achievement.title}</div>
                        <div className="text-xs text-muted-foreground">{achievement.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-quick-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Start
                </CardTitle>
                <CardDescription>Jump into personalized learning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    generateContentMutation.mutate({});
                    setActiveTab("personalized");
                  }}
                  disabled={generateContentMutation.isPending}
                  data-testid="button-start-learning"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Learn About My Conditions
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setActiveTab("medications")}
                  data-testid="button-medication-tutorials"
                >
                  <Pill className="h-4 w-4 mr-2" />
                  Medication Tutorials
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setActiveTab("treatment")}
                  data-testid="button-treatment-plan"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Understand My Treatment Plan
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-category-progress">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Learning Progress by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {progress?.categoryProgress && Object.entries(progress.categoryProgress).slice(0, 5).map(([category, value]) => (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{category.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{value}%</span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="personalized" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Generate Personalized Content
              </CardTitle>
              <CardDescription>
                Create educational content tailored to your health profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a topic (optional)..."
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  data-testid="input-topic"
                />
                <Button 
                  onClick={() => generateContentMutation.mutate({ topic: topicInput || undefined })}
                  disabled={generateContentMutation.isPending}
                  data-testid="button-generate-content"
                >
                  {generateContentMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {profile?.conditions.map(condition => (
                  <Button 
                    key={condition} 
                    variant="outline" 
                    size="sm"
                    onClick={() => generateContentMutation.mutate({ topic: condition })}
                    data-testid={`button-condition-${condition}`}
                  >
                    <Heart className="h-3 w-3 mr-1" />
                    {condition}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {activeContent && (
            <Card data-testid="card-active-content">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle data-testid="text-content-title">{activeContent.title}</CardTitle>
                    <CardDescription>{activeContent.summary}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="capitalize">{activeContent.category}</Badge>
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      {activeContent.estimatedMinutes} min
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 bg-muted/50">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">{activeContent.noCdsCompliance}</AlertDescription>
                </Alert>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-6">
                    {activeContent.content.map((section, idx) => (
                      <div key={section.id} className="space-y-3" data-testid={`section-${section.id}`}>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">
                            {idx + 1}
                          </span>
                          {section.title}
                        </h3>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
                        {section.keyPoints.length > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-yellow-500" />
                              Key Points
                            </div>
                            <ul className="space-y-1">
                              {section.keyPoints.map((point, pidx) => (
                                <li key={pidx} className="text-sm flex items-start gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Separator />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <div className="flex gap-2 w-full">
                  <Button variant="outline" className="flex-1" data-testid="button-mark-complete">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Complete
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="medications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Medication Adherence Tutorials
              </CardTitle>
              <CardDescription>
                Interactive guides for understanding and taking your medications correctly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-muted/50">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Educational tutorials only. Always follow your healthcare provider's specific instructions for your medications.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profile?.medications.map(med => (
                  <Card key={med.name} className="hover-elevate cursor-pointer" data-testid={`card-medication-${med.name}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Pill className="h-4 w-4 text-blue-500" />
                        {med.name}
                      </CardTitle>
                      <CardDescription>{med.dosage} - {med.frequency}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <p className="text-sm text-muted-foreground">{med.purpose}</p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          setSelectedMedication(med.name);
                          generateMedTutorialMutation.mutate(med.name);
                        }}
                        disabled={generateMedTutorialMutation.isPending}
                        data-testid={`button-start-tutorial-${med.name}`}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Tutorial
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {activeMedTutorial && (
            <Card data-testid="card-active-med-tutorial">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle data-testid="text-med-tutorial-title">{activeMedTutorial.title}</CardTitle>
                    <CardDescription>{activeMedTutorial.description}</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    Step {activeMedTutorial.currentStep + 1} of {activeMedTutorial.steps.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 bg-muted/50">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">{activeMedTutorial.noCdsCompliance}</AlertDescription>
                </Alert>

                <Progress 
                  value={(activeMedTutorial.completedSteps.length / activeMedTutorial.steps.length) * 100} 
                  className="h-2 mb-4"
                />

                <ScrollArea className="h-[350px]">
                  <div className="space-y-4">
                    {activeMedTutorial.steps.map((step, idx) => (
                      <div 
                        key={step.id} 
                        className={`p-4 rounded-lg border ${step.completed ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : idx === activeMedTutorial.currentStep ? "bg-primary/5 border-primary" : ""}`}
                        data-testid={`step-${step.id}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`flex items-center justify-center w-8 h-8 rounded-full ${step.completed ? "bg-green-500 text-white" : idx === activeMedTutorial.currentStep ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {step.completed ? <CheckCircle className="h-4 w-4" /> : step.stepNumber}
                          </span>
                          <div>
                            <div className="font-medium">{step.title}</div>
                            <Badge variant="outline" className="text-xs capitalize">{step.type}</Badge>
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed ml-11">{step.content}</p>
                        {!step.completed && idx === activeMedTutorial.currentStep && (
                          <div className="ml-11 mt-3">
                            <Button 
                              size="sm"
                              onClick={() => updateProgressMutation.mutate({
                                tutorialId: activeMedTutorial.id,
                                stepId: step.id,
                                type: "medication"
                              })}
                              disabled={updateProgressMutation.isPending}
                              data-testid={`button-complete-step-${step.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete Step
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Adherence Tips
                    </h4>
                    <ul className="space-y-1">
                      {activeMedTutorial.adherenceTips.slice(0, 3).map((tip, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Reminder Strategies
                    </h4>
                    <ul className="space-y-1">
                      {activeMedTutorial.reminderStrategies.slice(0, 3).map((strategy, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          {strategy}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="treatment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Treatment Plan Understanding
              </CardTitle>
              <CardDescription>
                Step-by-step guides to help you understand and follow your treatment plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-muted/50">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Educational content to help you understand your treatment plan. This is not medical advice.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => generateTreatmentTutorialMutation.mutate()}
                disabled={generateTreatmentTutorialMutation.isPending}
                data-testid="button-generate-treatment-tutorial"
              >
                {generateTreatmentTutorialMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Treatment Plan Tutorial
              </Button>
            </CardContent>
          </Card>

          {activeTreatmentTutorial && (
            <Card data-testid="card-active-treatment-tutorial">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle data-testid="text-treatment-title">{activeTreatmentTutorial.title}</CardTitle>
                    <CardDescription>
                      {activeTreatmentTutorial.treatmentName} for {activeTreatmentTutorial.condition}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {Math.round(activeTreatmentTutorial.overallProgress)}% Complete
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4 bg-muted/50">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">{activeTreatmentTutorial.noCdsCompliance}</AlertDescription>
                </Alert>

                <Progress value={activeTreatmentTutorial.overallProgress} className="h-2 mb-4" />

                <p className="text-sm text-muted-foreground mb-4">{activeTreatmentTutorial.description}</p>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {activeTreatmentTutorial.modules.map((module, idx) => (
                      <div 
                        key={module.id}
                        className={`p-4 rounded-lg border ${module.completed ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" : idx === activeTreatmentTutorial.currentModule ? "bg-primary/5 border-primary" : ""}`}
                        data-testid={`module-${module.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className={`flex items-center justify-center w-8 h-8 rounded-full ${module.completed ? "bg-green-500 text-white" : "bg-muted"}`}>
                              {module.completed ? <CheckCircle className="h-4 w-4" /> : module.moduleNumber}
                            </span>
                            <div>
                              <div className="font-medium">{module.title}</div>
                              <div className="text-xs text-muted-foreground">{module.objective}</div>
                            </div>
                          </div>
                          <Progress value={module.progress} className="w-20 h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <h4 className="font-medium">Expected Outcomes</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeTreatmentTutorial.expectedOutcomes.map((outcome, idx) => (
                      <Badge key={idx} variant="outline">{outcome}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Personalized Recommendations
                  </CardTitle>
                  <CardDescription>
                    Content suggestions based on your health profile, conditions, and interests
                  </CardDescription>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => refreshRecommendationsMutation.mutate()}
                  disabled={refreshRecommendationsMutation.isPending}
                  data-testid="button-refresh-recommendations"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshRecommendationsMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-muted/50">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  These recommendations are for educational purposes only, not medical advice.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {recommendations.map(rec => {
                    const CategoryIcon = getCategoryIcon(rec.category);
                    const FormatIcon = getFormatIcon(rec.format);
                    
                    return (
                      <Card key={rec.id} className="hover-elevate" data-testid={`card-recommendation-${rec.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CategoryIcon className="h-5 w-5 text-primary" />
                              <CardTitle className="text-base" data-testid={`text-rec-title-${rec.id}`}>{rec.title}</CardTitle>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={getPriorityColor(rec.priority) as any}>
                                {rec.priority}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                <FormatIcon className="h-3 w-3 mr-1" />
                                {rec.format}
                              </Badge>
                            </div>
                          </div>
                          <CardDescription>{rec.summary}</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {rec.estimatedMinutes} min
                            </span>
                            <span className="capitalize">{rec.category.replace("_", " ")}</span>
                            <span className="text-xs">
                              Based on: <span className="capitalize">{rec.basedOn.replace("_", " ")}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {rec.matchReasons.map((reason, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{reason}</Badge>
                            ))}
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            className="w-full"
                            onClick={() => {
                              generateContentMutation.mutate({ topic: rec.title });
                              setActiveTab("personalized");
                            }}
                            data-testid={`button-start-rec-${rec.id}`}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start Learning
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
