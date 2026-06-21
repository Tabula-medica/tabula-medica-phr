import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  Trophy, 
  Flame, 
  TrendingUp, 
  TrendingDown,
  Plus, 
  Sparkles, 
  Heart, 
  Droplets, 
  Moon,
  Pill,
  Scale,
  Apple,
  Brain,
  Activity,
  Award,
  Star,
  Bell,
  CheckCircle2,
  Circle,
  BarChart3,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
  Lightbulb,
  RefreshCw,
} from "lucide-react";

const PATIENT_ID = "patient-1";

type GoalCategory = 
  | "exercise" 
  | "medication_adherence" 
  | "weight_management" 
  | "nutrition" 
  | "sleep" 
  | "mental_health" 
  | "hydration" 
  | "vital_monitoring" 
  | "preventive_care"
  | "chronic_management";

interface HealthGoal {
  id: string;
  patientId: string;
  category: GoalCategory;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  currentValue: number;
  startDate: string;
  targetDate: string;
  frequency: "daily" | "weekly" | "monthly";
  status: "active" | "completed" | "paused" | "abandoned";
  priority: "high" | "medium" | "low";
  progress: number;
  streak: number;
  bestStreak: number;
  totalLogs: number;
  createdAt: string;
  updatedAt: string;
  aiSuggested: boolean;
  linkedConditions?: string[];
  linkedMedications?: string[];
  milestones: Array<{ id: string; title: string; targetValue: number; achieved: boolean; achievedDate?: string; reward?: string }>;
  reminders: Array<{ id: string; time: string; days: string[]; enabled: boolean; message: string }>;
}

interface GoalSuggestion {
  id: string;
  category: GoalCategory;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  frequency: "daily" | "weekly" | "monthly";
  rationale: string;
  linkedConditions: string[];
  difficulty: "easy" | "moderate" | "challenging";
  expectedBenefit: string;
  priority: "high" | "medium" | "low";
}

interface GoalAnalytics {
  goalId: string;
  averageProgress: number;
  trend: "improving" | "stable" | "declining";
  consistencyScore: number;
  daysActive: number;
  completionPrediction: number;
  weeklyData: Array<{ week: string; value: number; target: number }>;
  dailyData: Array<{ date: string; value: number; target: number }>;
  insights: string[];
}

interface MotivationalFeedback {
  message: string;
  type: "encouragement" | "celebration" | "tip" | "reminder" | "milestone";
  icon: string;
}

interface DashboardSummary {
  activeGoals: number;
  completedGoals: number;
  averageProgress: number;
  totalStreak: number;
  topPerformingGoal: HealthGoal | null;
  needsAttention: HealthGoal[];
  recentAchievements: Array<{ goalTitle: string; milestone: string; date: string }>;
}

const categoryIcons: Record<GoalCategory, any> = {
  exercise: Activity,
  medication_adherence: Pill,
  weight_management: Scale,
  nutrition: Apple,
  sleep: Moon,
  mental_health: Brain,
  hydration: Droplets,
  vital_monitoring: Heart,
  preventive_care: Target,
  chronic_management: Activity,
};

const categoryColors: Record<GoalCategory, string> = {
  exercise: "from-green-500 to-emerald-600",
  medication_adherence: "from-blue-500 to-indigo-600",
  weight_management: "from-purple-500 to-violet-600",
  nutrition: "from-orange-500 to-amber-600",
  sleep: "from-indigo-500 to-purple-600",
  mental_health: "from-pink-500 to-rose-600",
  hydration: "from-cyan-500 to-blue-600",
  vital_monitoring: "from-red-500 to-rose-600",
  preventive_care: "from-teal-500 to-emerald-600",
  chronic_management: "from-slate-500 to-gray-600",
};

const categoryLabels: Record<GoalCategory, string> = {
  exercise: "Exercise",
  medication_adherence: "Medication",
  weight_management: "Weight",
  nutrition: "Nutrition",
  sleep: "Sleep",
  mental_health: "Mental Health",
  hydration: "Hydration",
  vital_monitoring: "Vitals",
  preventive_care: "Preventive Care",
  chronic_management: "Chronic Care",
};

export default function HealthGoalTracking() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedGoal, setSelectedGoal] = useState<HealthGoal | null>(null);
  const [showNewGoalDialog, setShowNewGoalDialog] = useState(false);
  const [showLogProgressDialog, setShowLogProgressDialog] = useState(false);
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false);
  const [progressValue, setProgressValue] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [progressMood, setProgressMood] = useState<string>("");

  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "exercise" as GoalCategory,
    targetValue: "",
    targetUnit: "",
    frequency: "daily" as "daily" | "weekly" | "monthly",
    priority: "medium" as "high" | "medium" | "low",
    targetDate: "",
  });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/health-goals/dashboard", PATIENT_ID],
  });

  const { data: goals, isLoading: goalsLoading } = useQuery<HealthGoal[]>({
    queryKey: ["/api/health-goals/goals", PATIENT_ID],
  });

  const { data: motivation } = useQuery<MotivationalFeedback[]>({
    queryKey: ["/api/health-goals/motivation", PATIENT_ID],
  });

  const { data: suggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<{ suggestions: GoalSuggestion[]; disclaimer: string }>({
    queryKey: ["/api/health-goals/suggestions", PATIENT_ID],
    enabled: false,
  });

  const { data: selectedGoalAnalytics } = useQuery<GoalAnalytics>({
    queryKey: ["/api/health-goals/analytics", selectedGoal?.id],
    enabled: !!selectedGoal,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      return apiRequest("POST", "/api/health-goals/goals", goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals/dashboard"] });
      setShowNewGoalDialog(false);
      setNewGoal({
        title: "",
        description: "",
        category: "exercise",
        targetValue: "",
        targetUnit: "",
        frequency: "daily",
        priority: "medium",
        targetDate: "",
      });
      toast({ title: "Goal created!", description: "Your new health goal has been set." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create goal", variant: "destructive" });
    },
  });

  const logProgressMutation = useMutation({
    mutationFn: async (logData: any) => {
      return apiRequest("POST", "/api/health-goals/progress", logData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-goals/motivation"] });
      setShowLogProgressDialog(false);
      setProgressValue("");
      setProgressNote("");
      setProgressMood("");
      toast({ title: "Progress logged!", description: "Keep up the great work!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log progress", variant: "destructive" });
    },
  });

  const handleCreateGoal = () => {
    if (!newGoal.title || !newGoal.targetValue || !newGoal.targetUnit) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const targetDate = newGoal.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    createGoalMutation.mutate({
      patientId: PATIENT_ID,
      title: newGoal.title,
      description: newGoal.description,
      category: newGoal.category,
      targetValue: parseFloat(newGoal.targetValue),
      targetUnit: newGoal.targetUnit,
      currentValue: 0,
      startDate: new Date().toISOString().split("T")[0],
      targetDate,
      frequency: newGoal.frequency,
      status: "active",
      priority: newGoal.priority,
      aiSuggested: false,
      milestones: [],
      reminders: [],
    });
  };

  const handleLogProgress = () => {
    if (!selectedGoal || !progressValue) {
      toast({ title: "Missing value", description: "Please enter a progress value", variant: "destructive" });
      return;
    }

    logProgressMutation.mutate({
      goalId: selectedGoal.id,
      patientId: PATIENT_ID,
      value: parseFloat(progressValue),
      unit: selectedGoal.targetUnit,
      note: progressNote || undefined,
      mood: progressMood || undefined,
      source: "manual",
    });
  };

  const handleGetSuggestions = async () => {
    setShowSuggestionsDialog(true);
    await apiRequest("POST", `/api/health-goals/suggestions/${PATIENT_ID}`, {
      conditions: [
        { name: "Type 2 Diabetes Mellitus", status: "active", severity: "moderate" },
        { name: "Essential Hypertension", status: "active", severity: "mild" },
      ],
      medications: [
        { name: "Metformin", dosage: "1000mg", frequency: "Twice daily" },
        { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
      ],
      allergies: [],
      recentVitals: {
        bloodPressure: { systolic: 135, diastolic: 85 },
        weight: { value: 182, unit: "lbs" },
        bmi: { value: 27.5 },
      },
      demographics: { age: 45, gender: "female" },
    }).then((data) => {
      queryClient.setQueryData(["/api/health-goals/suggestions", PATIENT_ID], data);
    });
  };

  const handleAdoptSuggestion = (suggestion: GoalSuggestion) => {
    createGoalMutation.mutate({
      patientId: PATIENT_ID,
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category,
      targetValue: suggestion.targetValue,
      targetUnit: suggestion.targetUnit,
      currentValue: 0,
      startDate: new Date().toISOString().split("T")[0],
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      frequency: suggestion.frequency,
      status: "active",
      priority: suggestion.priority,
      aiSuggested: true,
      linkedConditions: suggestion.linkedConditions,
      milestones: [],
      reminders: [],
    });
    setShowSuggestionsDialog(false);
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case "great": return "🌟";
      case "good": return "😊";
      case "okay": return "😐";
      case "struggling": return "😔";
      default: return "";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getMotivationIcon = (iconName: string) => {
    switch (iconName) {
      case "flame": return <Flame className="h-5 w-5 text-orange-500" />;
      case "trophy": return <Trophy className="h-5 w-5 text-yellow-500" />;
      case "star": return <Star className="h-5 w-5 text-yellow-500" />;
      case "trending-up": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "bell": return <Bell className="h-5 w-5 text-blue-500" />;
      case "award": return <Award className="h-5 w-5 text-purple-500" />;
      case "target": return <Target className="h-5 w-5 text-indigo-500" />;
      default: return <Sparkles className="h-5 w-5 text-yellow-500" />;
    }
  };

  const renderSimpleChart = (data: Array<{ date: string; value: number; target: number }>) => {
    if (!data || data.length === 0) return null;
    
    const maxValue = Math.max(...data.map(d => Math.max(d.value, d.target))) * 1.2;
    
    return (
      <div className="flex items-end gap-1 h-32 mt-4">
        {data.map((item, index) => {
          const valueHeight = (item.value / maxValue) * 100;
          const targetHeight = (item.target / maxValue) * 100;
          const dayLabel = new Date(item.date).toLocaleDateString("en-US", { weekday: "short" });
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full h-24 flex items-end justify-center gap-0.5">
                <div 
                  className="w-3 bg-primary/80 rounded-t transition-all duration-300"
                  style={{ height: `${valueHeight}%` }}
                  title={`${item.value}`}
                />
                <div 
                  className="w-1 bg-muted-foreground/30 rounded-t"
                  style={{ height: `${targetHeight}%` }}
                  title={`Target: ${item.target}`}
                />
              </div>
              <span className="text-xs text-muted-foreground">{dayLabel}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (dashboardLoading || goalsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent" data-testid="text-page-title">
          Health Goals
        </h1>
        <p className="text-muted-foreground mt-1">Track your progress and achieve your health goals</p>
      </div>

      {motivation && motivation.length > 0 && (
        <div className="mb-6 space-y-2">
          {motivation.slice(0, 2).map((msg, i) => (
            <div 
              key={i} 
              className={`flex items-center gap-3 p-3 rounded-lg ${
                msg.type === "celebration" ? "bg-yellow-500/10 border border-yellow-500/20" :
                msg.type === "milestone" ? "bg-purple-500/10 border border-purple-500/20" :
                msg.type === "reminder" ? "bg-blue-500/10 border border-blue-500/20" :
                "bg-green-500/10 border border-green-500/20"
              }`}
              data-testid={`card-motivation-${i}`}
            >
              {getMotivationIcon(msg.icon)}
              <span className="text-sm font-medium">{msg.message}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard" data-testid="button-tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="goals" data-testid="button-tab-goals">
            <Target className="h-4 w-4 mr-2" />
            My Goals
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="button-tab-progress">
            <TrendingUp className="h-4 w-4 mr-2" />
            Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {dashboard && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card className="hover-elevate" data-testid="card-active-goals">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Goals</p>
                      <p className="text-3xl font-bold">{dashboard.activeGoals}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-avg-progress">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Average Progress</p>
                      <p className="text-3xl font-bold">{dashboard.averageProgress}%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                  <Progress value={dashboard.averageProgress} className="mt-3" />
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-streak">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Streak</p>
                      <p className="text-3xl font-bold">{dashboard.totalStreak} days</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <Flame className="h-6 w-6 text-orange-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate" data-testid="card-completed">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completed Goals</p>
                      <p className="text-3xl font-bold">{dashboard.completedGoals}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-yellow-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {dashboard?.topPerformingGoal && (
              <Card data-testid="card-top-goal">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Top Performing Goal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const Icon = categoryIcons[dashboard.topPerformingGoal.category];
                      return (
                        <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${categoryColors[dashboard.topPerformingGoal.category]} flex items-center justify-center`}>
                          <Icon className="h-7 w-7 text-white" />
                        </div>
                      );
                    })()}
                    <div className="flex-1">
                      <h3 className="font-semibold">{dashboard.topPerformingGoal.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={dashboard.topPerformingGoal.progress} className="flex-1" />
                        <span className="text-sm font-medium">{dashboard.topPerformingGoal.progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Flame className="h-4 w-4 text-orange-500" />
                          {dashboard.topPerformingGoal.streak} day streak
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {dashboard?.recentAchievements && dashboard.recentAchievements.length > 0 && (
              <Card data-testid="card-achievements">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-500" />
                    Recent Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.recentAchievements.slice(0, 3).map((achievement, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{achievement.milestone}</p>
                          <p className="text-xs text-muted-foreground">{achievement.goalTitle}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{achievement.date}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {dashboard?.needsAttention && dashboard.needsAttention.length > 0 && (
            <Card className="mt-6" data-testid="card-needs-attention">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Needs Attention
                </CardTitle>
                <CardDescription>These goals could use some extra focus</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {dashboard.needsAttention.map((goal) => {
                    const Icon = categoryIcons[goal.category];
                    return (
                      <div 
                        key={goal.id} 
                        className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 cursor-pointer hover-elevate"
                        onClick={() => { setSelectedGoal(goal); setActiveTab("progress"); }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${categoryColors[goal.category]} flex items-center justify-center`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{goal.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={goal.progress} className="flex-1 h-1.5" />
                              <span className="text-xs">{goal.progress}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="goals">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">My Health Goals</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGetSuggestions} data-testid="button-get-suggestions">
                <Lightbulb className="h-4 w-4 mr-2" />
                AI Suggestions
              </Button>
              <Button onClick={() => setShowNewGoalDialog(true)} data-testid="button-new-goal">
                <Plus className="h-4 w-4 mr-2" />
                New Goal
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals?.filter(g => g.status === "active").map((goal) => {
              const Icon = categoryIcons[goal.category];
              return (
                <Card 
                  key={goal.id} 
                  className="hover-elevate cursor-pointer overflow-visible"
                  onClick={() => { setSelectedGoal(goal); setActiveTab("progress"); }}
                  data-testid={`card-goal-${goal.id}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${categoryColors[goal.category]} flex items-center justify-center shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        {goal.aiSuggested && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        )}
                        <Badge variant={goal.priority === "high" ? "destructive" : goal.priority === "medium" ? "default" : "secondary"}>
                          {goal.priority}
                        </Badge>
                      </div>
                    </div>

                    <h3 className="font-semibold text-lg mb-1">{goal.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{goal.description}</p>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{goal.progress}%</span>
                        </div>
                        <Progress value={goal.progress} />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Target className="h-4 w-4" />
                          <span>{goal.currentValue} / {goal.targetValue} {goal.targetUnit}</span>
                        </div>
                        <div className="flex items-center gap-1 text-orange-500">
                          <Flame className="h-4 w-4" />
                          <span className="font-medium">{goal.streak}</span>
                        </div>
                      </div>

                      {goal.milestones.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {goal.milestones.map((m, i) => (
                            <div 
                              key={m.id}
                              className={`h-2 flex-1 rounded-full ${m.achieved ? "bg-green-500" : "bg-muted"}`}
                              title={m.title}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); setSelectedGoal(goal); setShowLogProgressDialog(true); }}
                        data-testid={`button-log-progress-${goal.id}`}
                      >
                        Log Progress
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="progress">
          {selectedGoal ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card data-testid="card-goal-detail">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {(() => {
                          const Icon = categoryIcons[selectedGoal.category];
                          return (
                            <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${categoryColors[selectedGoal.category]} flex items-center justify-center shadow-lg`}>
                              <Icon className="h-7 w-7 text-white" />
                            </div>
                          );
                        })()}
                        <div>
                          <CardTitle>{selectedGoal.title}</CardTitle>
                          <CardDescription>{selectedGoal.description}</CardDescription>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setShowLogProgressDialog(true)}
                        data-testid="button-log-progress-main"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Log Progress
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedGoal.progress}%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedGoal.streak}</p>
                        <p className="text-xs text-muted-foreground">Current Streak</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedGoal.bestStreak}</p>
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedGoal.totalLogs}</p>
                        <p className="text-xs text-muted-foreground">Total Logs</p>
                      </div>
                    </div>

                    {selectedGoalAnalytics && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Daily Progress (Last 14 Days)</h4>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(selectedGoalAnalytics.trend)}
                            <span className="text-sm capitalize">{selectedGoalAnalytics.trend}</span>
                          </div>
                        </div>
                        {renderSimpleChart(selectedGoalAnalytics.dailyData)}

                        {selectedGoalAnalytics.insights.length > 0 && (
                          <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <h4 className="font-medium flex items-center gap-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-blue-500" />
                              Insights
                            </h4>
                            <ul className="space-y-1">
                              {selectedGoalAnalytics.insights.map((insight, i) => (
                                <li key={i} className="text-sm text-muted-foreground">{insight}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {selectedGoal.milestones.length > 0 && (
                  <Card data-testid="card-milestones">
                    <CardHeader>
                      <CardTitle className="text-lg">Milestones</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedGoal.milestones.map((milestone) => (
                          <div 
                            key={milestone.id}
                            className={`flex items-center gap-4 p-3 rounded-lg ${milestone.achieved ? "bg-green-500/10 border border-green-500/20" : "bg-muted/50"}`}
                          >
                            {milestone.achieved ? (
                              <CheckCircle2 className="h-6 w-6 text-green-500" />
                            ) : (
                              <Circle className="h-6 w-6 text-muted-foreground" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium">{milestone.title}</p>
                              {milestone.reward && (
                                <p className="text-sm text-muted-foreground">Reward: {milestone.reward}</p>
                              )}
                            </div>
                            {milestone.achieved && milestone.achievedDate && (
                              <span className="text-sm text-muted-foreground">{milestone.achievedDate}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                {selectedGoalAnalytics && (
                  <Card data-testid="card-analytics">
                    <CardHeader>
                      <CardTitle className="text-lg">Analytics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Consistency Score</span>
                        <span className="font-medium">{selectedGoalAnalytics.consistencyScore}%</span>
                      </div>
                      <Progress value={selectedGoalAnalytics.consistencyScore} />

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Average Progress</span>
                        <span className="font-medium">{selectedGoalAnalytics.averageProgress}%</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Days Active</span>
                        <span className="font-medium">{selectedGoalAnalytics.daysActive}</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Completion Prediction</span>
                        <span className="font-medium">{selectedGoalAnalytics.completionPrediction}%</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card data-testid="card-goal-info">
                  <CardHeader>
                    <CardTitle className="text-lg">Goal Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Target</span>
                      <span className="font-medium">{selectedGoal.targetValue} {selectedGoal.targetUnit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Frequency</span>
                      <Badge variant="outline" className="capitalize">{selectedGoal.frequency}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Start Date</span>
                      <span className="font-medium">{selectedGoal.startDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Target Date</span>
                      <span className="font-medium">{selectedGoal.targetDate}</span>
                    </div>
                    {selectedGoal.linkedConditions && selectedGoal.linkedConditions.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Linked Conditions</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedGoal.linkedConditions.map((c, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedGoal(null)}
                >
                  <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                  Back to Goals List
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Goal</h3>
                <p className="text-muted-foreground mb-4">Choose a goal from the Goals tab to view detailed progress</p>
                <Button onClick={() => setActiveTab("goals")}>View Goals</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showNewGoalDialog} onOpenChange={setShowNewGoalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Goal</DialogTitle>
            <DialogDescription>Set a personalized health goal to track your progress</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Goal Title *</Label>
              <Input 
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                placeholder="e.g., Daily Walking"
                data-testid="input-goal-title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Describe your goal..."
                data-testid="input-goal-description"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newGoal.category} onValueChange={(v) => setNewGoal({ ...newGoal, category: v as GoalCategory })}>
                <SelectTrigger data-testid="select-goal-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Value *</Label>
                <Input 
                  type="number"
                  value={newGoal.targetValue}
                  onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                  placeholder="e.g., 30"
                  data-testid="input-goal-target-value"
                />
              </div>
              <div>
                <Label>Unit *</Label>
                <Input 
                  value={newGoal.targetUnit}
                  onChange={(e) => setNewGoal({ ...newGoal, targetUnit: e.target.value })}
                  placeholder="e.g., minutes"
                  data-testid="input-goal-unit"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select value={newGoal.frequency} onValueChange={(v) => setNewGoal({ ...newGoal, frequency: v as any })}>
                  <SelectTrigger data-testid="select-goal-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={newGoal.priority} onValueChange={(v) => setNewGoal({ ...newGoal, priority: v as any })}>
                  <SelectTrigger data-testid="select-goal-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Target Date</Label>
              <Input 
                type="date"
                value={newGoal.targetDate}
                onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                data-testid="input-goal-target-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewGoalDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateGoal} disabled={createGoalMutation.isPending} data-testid="button-create-goal">
              {createGoalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogProgressDialog} onOpenChange={setShowLogProgressDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Progress</DialogTitle>
            <DialogDescription>
              {selectedGoal ? `Track your progress for "${selectedGoal.title}"` : "Log your progress"}
            </DialogDescription>
          </DialogHeader>
          {selectedGoal && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-2">
                  {(() => {
                    const Icon = categoryIcons[selectedGoal.category];
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <span className="font-medium">{selectedGoal.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Target: {selectedGoal.targetValue} {selectedGoal.targetUnit} ({selectedGoal.frequency})
                </p>
              </div>
              <div>
                <Label>Value *</Label>
                <div className="flex gap-2">
                  <Input 
                    type="number"
                    value={progressValue}
                    onChange={(e) => setProgressValue(e.target.value)}
                    placeholder={`Enter ${selectedGoal.targetUnit}`}
                    className="flex-1"
                    data-testid="input-progress-value"
                  />
                  <span className="flex items-center px-3 bg-muted rounded-md text-sm">
                    {selectedGoal.targetUnit}
                  </span>
                </div>
              </div>
              <div>
                <Label>How are you feeling?</Label>
                <div className="flex gap-2 mt-2">
                  {["great", "good", "okay", "struggling"].map((mood) => (
                    <Button
                      key={mood}
                      type="button"
                      variant={progressMood === mood ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProgressMood(mood)}
                      data-testid={`button-mood-${mood}`}
                    >
                      {getMoodIcon(mood)} {mood}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea 
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="How did it go? Any thoughts..."
                  data-testid="input-progress-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogProgressDialog(false)}>Cancel</Button>
            <Button onClick={handleLogProgress} disabled={logProgressMutation.isPending} data-testid="button-submit-progress">
              {logProgressMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Log Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuggestionsDialog} onOpenChange={setShowSuggestionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI-Powered Goal Suggestions
            </DialogTitle>
            <DialogDescription>
              Personalized goal recommendations based on your health profile
            </DialogDescription>
          </DialogHeader>
          
          {suggestionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : suggestions?.suggestions && suggestions.suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.suggestions.map((suggestion) => {
                const Icon = categoryIcons[suggestion.category];
                return (
                  <Card key={suggestion.id} className="hover-elevate" data-testid={`card-suggestion-${suggestion.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${categoryColors[suggestion.category]} flex items-center justify-center shrink-0`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold">{suggestion.title}</h4>
                            <div className="flex gap-2">
                              <Badge variant={suggestion.difficulty === "easy" ? "secondary" : suggestion.difficulty === "moderate" ? "default" : "destructive"}>
                                {suggestion.difficulty}
                              </Badge>
                              <Badge variant="outline">{suggestion.priority}</Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                          <p className="text-sm mb-2">
                            <span className="text-muted-foreground">Target: </span>
                            <span className="font-medium">{suggestion.targetValue} {suggestion.targetUnit}</span>
                            <span className="text-muted-foreground"> ({suggestion.frequency})</span>
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                            <Lightbulb className="h-4 w-4 inline mr-1" />
                            {suggestion.rationale}
                          </p>
                          {suggestion.linkedConditions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {suggestion.linkedConditions.map((c, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                              ))}
                            </div>
                          )}
                          <Button 
                            size="sm" 
                            onClick={() => handleAdoptSuggestion(suggestion)}
                            disabled={createGoalMutation.isPending}
                            data-testid={`button-adopt-${suggestion.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Adopt This Goal
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                {suggestions.disclaimer}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading suggestions...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-goal-tracking-disclaimer" />
    </div>
  );
}