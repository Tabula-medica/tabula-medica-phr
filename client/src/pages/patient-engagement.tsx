import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  BookOpen,
  GraduationCap,
  Pill,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  Lightbulb,
  Target,
  Award,
  HelpCircle,
  Search,
  Play,
  Loader2,
  Bell,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { MetricCard } from "@/components/shared";
import { clickable } from "@/lib/a11y";

const MOCK_PATIENT_ID = "patient_1";

interface EducationRecommendation {
  moduleId: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
  category: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface EducationModule {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  sections: {
    id: string;
    title: string;
    content: string;
    keyPoints: string[];
    quiz?: QuizQuestion[];
    completed: boolean;
  }[];
  progress: number;
}

interface AdherenceStats {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  adherenceRate: number;
  streak: number;
  commonSkipReasons: string[];
}

interface CoachingMessage {
  id: string;
  type: "reminder" | "encouragement" | "tip" | "warning" | "celebration";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
}

interface VitalTrend {
  type: string;
  currentValue: string;
  unit: string;
  trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  changePercent: number;
  isNormal: boolean;
}

interface DeteriorationAlert {
  id: string;
  severity: "critical" | "warning" | "watch";
  category: string;
  title: string;
  description: string;
  indicators: string[];
  recommendedActions: string[];
}

interface HealthSnapshot {
  summary: string;
  keyFindings: string[];
  concernAreas: string[];
  positiveIndicators: string[];
  actionItems: string[];
}

function EducationTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState<EducationModule | null>(null);
  const { toast } = useToast();

  const { data: recommendations, isLoading: loadingRecs } = useQuery<{ recommendations: EducationRecommendation[] }>({
    queryKey: [`/api/education/recommendations/${MOCK_PATIENT_ID}`],
  });

  const generateModuleMutation = useMutation({
    mutationFn: async (topic?: string) => {
      const response = await apiRequest("POST", `/api/education/generate/${MOCK_PATIENT_ID}`, { topic });
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedModule(data.module);
      toast({ title: "Module generated", description: "Your personalized education module is ready." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate education module", variant: "destructive" });
    },
  });

  const explainTermMutation = useMutation({
    mutationFn: async (term: string) => {
      const response = await apiRequest("POST", "/api/education/explain-term", { term, patientId: MOCK_PATIENT_ID });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: searchTerm,
        description: data.explanation.substring(0, 200) + "...",
      });
    },
  });

  const priorityColors = {
    high: "bg-red-500/10 text-red-700 dark:text-red-400",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    low: "bg-green-500/10 text-green-700 dark:text-green-400",
  };

  const categoryIcons: Record<string, typeof BookOpen> = {
    condition: Heart,
    medication: Pill,
    lifestyle: Activity,
    prevention: Target,
  };

  if (selectedModule) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setSelectedModule(null)} data-testid="button-back-education">
            Back to Recommendations
          </Button>
          <Badge variant="outline">{selectedModule.estimatedMinutes} min</Badge>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {selectedModule.title}
            </CardTitle>
            <CardDescription>
              {selectedModule.category} - {selectedModule.difficulty} level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={selectedModule.progress} className="mb-4" />
            <ScrollArea className="h-[400px]">
              <div className="space-y-6">
                {selectedModule.sections.map((section, idx) => (
                  <div key={section.id} className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs">
                        {idx + 1}
                      </span>
                      {section.title}
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content}</p>
                    {section.keyPoints.length > 0 && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-md">
                        <p className="text-xs font-medium mb-1">Key Points:</p>
                        <ul className="text-sm space-y-1">
                          {section.keyPoints.map((point, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 mt-1 text-green-500 shrink-0" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {section.quiz && section.quiz.length > 0 && (
                      <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/20">
                        <p className="text-xs font-medium mb-2 flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          Quick Quiz
                        </p>
                        {section.quiz.map((q) => (
                          <div key={q.id} className="space-y-2">
                            <p className="text-sm font-medium">{q.question}</p>
                            <div className="grid gap-1">
                              {q.options.map((option, optIdx) => (
                                <div 
                                  key={optIdx} 
                                  className="flex items-center gap-2 p-2 text-xs rounded-md border hover-elevate cursor-pointer"
                                  data-testid={`quiz-option-${q.id}-${optIdx}`}
                                >
                                  <span className="h-4 w-4 rounded-full border flex items-center justify-center text-[10px]">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{option}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Tip: {q.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for a medical term to explain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-term"
          />
        </div>
        <Button
          onClick={() => explainTermMutation.mutate(searchTerm)}
          disabled={!searchTerm || explainTermMutation.isPending}
          data-testid="button-explain-term"
        >
          {explainTermMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <HelpCircle className="h-4 w-4" />}
          Explain
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Recommended for You
            </CardTitle>
            <CardDescription>Personalized education based on your health profile</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRecs ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations?.recommendations?.map((rec) => {
                  const Icon = categoryIcons[rec.category] || BookOpen;
                  return (
                    <div
                      key={rec.moduleId}
                      className="p-3 border rounded-md hover-elevate cursor-pointer"
                      {...clickable(() => generateModuleMutation.mutate(rec.title))}
                      data-testid={`education-rec-${rec.moduleId}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{rec.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                          </div>
                        </div>
                        <Badge className={priorityColors[rec.priority]} variant="outline">
                          {rec.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {rec.estimatedMinutes} min
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Quick Learn
            </CardTitle>
            <CardDescription>Start learning about any health topic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => generateModuleMutation.mutate(undefined)}
              disabled={generateModuleMutation.isPending}
              data-testid="button-generate-education"
            >
              {generateModuleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Generate Personalized Module
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {["Understanding My Medications", "Managing My Condition", "Healthy Lifestyle Tips", "Warning Signs to Watch"].map((topic) => (
                <Button
                  key={topic}
                  variant="ghost"
                  size="sm"
                  className="text-xs justify-start h-auto py-2"
                  onClick={() => generateModuleMutation.mutate(topic)}
                  disabled={generateModuleMutation.isPending}
                  data-testid={`button-topic-${topic.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {topic}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdherenceTab() {
  const { toast } = useToast();

  const { data: coachingPlan, isLoading } = useQuery<{
    overallAdherenceRate: number;
    riskLevel: string;
    medications: AdherenceStats[];
    coachingMessages: CoachingMessage[];
    personalizedTips: string[];
  }>({
    queryKey: [`/api/adherence/coaching/${MOCK_PATIENT_ID}`],
  });

  const { data: summary } = useQuery<{ weekly: number; monthly: number; trend: string }>({
    queryKey: [`/api/adherence/summary/${MOCK_PATIENT_ID}`],
  });

  const logAdherenceMutation = useMutation({
    mutationFn: async ({ medicationId, taken }: { medicationId: string; taken: boolean }) => {
      const response = await apiRequest("POST", "/api/adherence/log", {
        patientId: MOCK_PATIENT_ID,
        medicationId,
        taken,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.taken ? "Medication logged" : "Skipped dose logged",
        description: variables.taken ? "Great job staying on track!" : "We understand. Keep going!",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/adherence/coaching/${MOCK_PATIENT_ID}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/adherence/summary/${MOCK_PATIENT_ID}`] });
    },
  });

  const messageTypeStyles = {
    reminder: { icon: Bell, color: "text-blue-500" },
    encouragement: { icon: ThumbsUp, color: "text-green-500" },
    tip: { icon: Lightbulb, color: "text-yellow-500" },
    warning: { icon: AlertTriangle, color: "text-red-500" },
    celebration: { icon: Award, color: "text-purple-500" },
  };

  const trendIcon = {
    improving: TrendingUp,
    stable: Minus,
    declining: TrendingDown,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const TrendIcon = trendIcon[summary?.trend as keyof typeof trendIcon] || Minus;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Weekly Adherence"
          value={`${summary?.weekly || 0}%`}
          icon={TrendIcon}
          color={summary?.trend === "improving" ? "text-green-500" : summary?.trend === "declining" ? "text-red-500" : "text-muted-foreground"}
        />
        <MetricCard
          label="Monthly Adherence"
          value={`${summary?.monthly || 0}%`}
          icon={Target}
          color="text-muted-foreground"
        />
        <MetricCard
          label="Risk Level"
          value={(coachingPlan?.riskLevel || "low").charAt(0).toUpperCase() + (coachingPlan?.riskLevel || "low").slice(1)}
          icon={Activity}
          color={coachingPlan?.riskLevel === "high" ? "text-red-500" : coachingPlan?.riskLevel === "medium" ? "text-yellow-500" : "text-green-500"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Your Medications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {coachingPlan?.medications?.map((med) => (
                <div key={med.medicationId} className="p-3 border rounded-md" data-testid={`medication-adherence-${med.medicationId}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{med.medicationName}</p>
                      <p className="text-xs text-muted-foreground">{med.dosage} - {med.frequency}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{med.adherenceRate}%</p>
                      <p className="text-xs text-muted-foreground">{med.streak} day streak</p>
                    </div>
                  </div>
                  <Progress value={med.adherenceRate} className="mt-2 h-2" />
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => logAdherenceMutation.mutate({ medicationId: med.medicationId, taken: true })}
                      disabled={logAdherenceMutation.isPending}
                      data-testid={`button-took-${med.medicationId}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Took it
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => logAdherenceMutation.mutate({ medicationId: med.medicationId, taken: false })}
                      disabled={logAdherenceMutation.isPending}
                      data-testid={`button-skipped-${med.medicationId}`}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Skipped
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Coaching Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {coachingPlan?.coachingMessages?.map((msg) => {
                  const { icon: Icon, color } = messageTypeStyles[msg.type] || messageTypeStyles.tip;
                  return (
                    <div key={msg.id} className="p-3 bg-muted/30 rounded-md" data-testid={`coaching-message-${msg.id}`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                        <div>
                          <p className="font-medium text-sm">{msg.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{msg.message}</p>
                          {msg.actionable && msg.suggestedAction && (
                            <Button size="sm" variant="ghost" className="h-auto p-0 mt-1 text-primary underline">
                              {msg.suggestedAction}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {coachingPlan?.personalizedTips && coachingPlan.personalizedTips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Personalized Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {coachingPlan.personalizedTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MonitoringTab() {
  const { data: monitoringStatus, isLoading: loadingStatus } = useQuery<{
    overallRisk: string;
    vitalTrends: VitalTrend[];
    activeAlerts: DeteriorationAlert[];
    recentChanges: string[];
  }>({
    queryKey: [`/api/monitoring/status/${MOCK_PATIENT_ID}`],
  });

  const { data: snapshot, isLoading: loadingSnapshot } = useQuery<HealthSnapshot>({
    queryKey: [`/api/monitoring/snapshot/${MOCK_PATIENT_ID}`],
  });

  const vitalTypeLabels: Record<string, string> = {
    blood_pressure: "Blood Pressure",
    heart_rate: "Heart Rate",
    temperature: "Temperature",
    oxygen_saturation: "Oxygen Level",
    respiratory_rate: "Breathing Rate",
    weight: "Weight",
  };

  const riskColors = {
    low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    moderate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  };

  const severityColors = {
    critical: "border-red-500 bg-red-500/10",
    warning: "border-yellow-500 bg-yellow-500/10",
    watch: "border-blue-500 bg-blue-500/10",
  };

  if (loadingStatus || loadingSnapshot) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">Health Status</h3>
            <p className="text-sm text-muted-foreground">Based on your recent readings</p>
          </div>
        </div>
        <Badge className={riskColors[monitoringStatus?.overallRisk as keyof typeof riskColors] || riskColors.low} variant="outline">
          {monitoringStatus?.overallRisk || "low"} risk
        </Badge>
      </div>

      {monitoringStatus?.activeAlerts && monitoringStatus.activeAlerts.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monitoringStatus.activeAlerts.map((alert) => (
                <div key={alert.id} className={`p-3 border-l-4 rounded-md ${severityColors[alert.severity]}`} data-testid={`alert-${alert.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">{alert.severity}</Badge>
                  </div>
                  {alert.recommendedActions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium">Recommended Actions:</p>
                      <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                        {alert.recommendedActions.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span>-</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Vital Signs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monitoringStatus?.vitalTrends?.map((vital) => {
                const TrendIcon = vital.trend === "increasing" ? TrendingUp : vital.trend === "decreasing" ? TrendingDown : Minus;
                return (
                  <div key={vital.type} className="flex items-center justify-between p-2 border rounded-md" data-testid={`vital-${vital.type}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${vital.isNormal ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="text-sm">{vitalTypeLabels[vital.type] || vital.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{vital.currentValue} {vital.unit}</span>
                      <TrendIcon className={`h-4 w-4 ${vital.trend === "increasing" ? "text-red-500" : vital.trend === "decreasing" ? "text-blue-500" : "text-muted-foreground"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Health Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{snapshot?.summary}</p>
            
            {snapshot?.positiveIndicators && snapshot.positiveIndicators.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Positive Signs</p>
                <div className="space-y-1">
                  {snapshot.positiveIndicators.slice(0, 3).map((indicator, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      <span>{indicator}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot?.concernAreas && snapshot.concernAreas.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Areas to Watch</p>
                <div className="space-y-1">
                  {snapshot.concernAreas.map((concern, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                      <span>{concern}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshot?.actionItems && snapshot.actionItems.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">What You Can Do</p>
                <div className="space-y-1">
                  {snapshot.actionItems.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <Lightbulb className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {monitoringStatus?.recentChanges && monitoringStatus.recentChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {monitoringStatus.recentChanges.map((change, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-muted/30 rounded-md">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm">{change}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PatientEngagement() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Patient Engagement</h1>
        <p className="text-muted-foreground">Personalized education, medication coaching, and health monitoring</p>
      </div>

      <Tabs defaultValue="education" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="education" data-testid="tab-education">
            <BookOpen className="h-4 w-4 mr-2" />
            Education
          </TabsTrigger>
          <TabsTrigger value="adherence" data-testid="tab-adherence">
            <Pill className="h-4 w-4 mr-2" />
            Medication Coach
          </TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">
            <Activity className="h-4 w-4 mr-2" />
            Health Monitor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="education">
          <EducationTab />
        </TabsContent>

        <TabsContent value="adherence">
          <AdherenceTab />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
