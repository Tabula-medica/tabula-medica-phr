import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Trophy, Target, BookOpen, CheckCircle, Clock, Flame, Star, Award, 
  Play, Lock, ChevronRight, Brain, Heart, Activity, Pill, Calendar,
  TrendingUp, Sparkles, AlertCircle, PartyPopper, Lightbulb, Plus,
  Medal, Crown, Zap
} from "lucide-react";

interface HealthJourney {
  id: string;
  patientId: string;
  conditionType: string;
  title: string;
  description: string;
  status: string;
  startDate: string;
  targetEndDate: string;
  currentPhase: number;
  totalPhases: number;
  overallProgress: number;
  lastActivityAt: string;
  aiPersonalizationLevel: string;
}

interface EducationalModule {
  id: string;
  journeyId: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  estimatedMinutes: number;
  phase: number;
  order: number;
  status: string;
  progress: number;
  score?: number;
  completedAt?: string;
}

interface CarePlanTask {
  id: string;
  journeyId: string;
  title: string;
  description: string;
  category: string;
  frequency: string;
  scheduledTime?: string;
  status: string;
  dueDate: string;
  streakCount: number;
  pointsValue: number;
  aiSuggestion?: string;
}

interface GamificationProfile {
  totalPoints: number;
  level: number;
  levelTitle: string;
  nextLevelPoints: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  achievements: Achievement[];
  weeklyGoalProgress: number;
  weeklyGoalTarget: number;
  leaderboardRank?: number;
  engagementScore: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earnedAt: string;
  rarity: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  pointsReward: number;
  unlocked: boolean;
  category: string;
}

interface JourneyInsight {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  actionable: boolean;
  suggestedAction?: string;
  disclaimer: string;
}

const patientId = "patient-1";

export default function PersonalizedHealthJourney() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedModule, setSelectedModule] = useState<EducationalModule | null>(null);
  const [showNewJourneyDialog, setShowNewJourneyDialog] = useState(false);

  const { data: dashboard, isLoading } = useQuery<{
    journey: HealthJourney | null;
    modules: { total: number; completed: number; inProgress: number; available: number; list: EducationalModule[] };
    tasks: { today: CarePlanTask[]; completedToday: number; pendingToday: number; streakDays: number };
    gamification: GamificationProfile | null;
    insights: JourneyInsight[];
    disclaimer: string;
  }>({
    queryKey: ["/api/health-journey/dashboard", patientId],
  });

  const { data: conditionTypes } = useQuery<{ id: string; name: string; description: string }[]>({
    queryKey: ["/api/health-journey/condition-types"],
  });

  const { data: leaderboard } = useQuery<{ rank: number; patientId: string; level: number; levelTitle: string; totalPoints: number; currentStreak: number }[]>({
    queryKey: ["/api/health-journey/leaderboard"],
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("POST", `/api/health-journey/task/${taskId}/complete`);
      return response as { task: CarePlanTask; pointsEarned: number; newBadges: Badge[] };
    },
    onSuccess: (data) => {
      toast({
        title: "Task Completed!",
        description: `You earned ${data.pointsEarned} points!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/health-journey/dashboard"] });
    },
  });

  const updateModuleProgressMutation = useMutation({
    mutationFn: async ({ moduleId, progress, quizScore }: { moduleId: string; progress: number; quizScore?: number }) => {
      return apiRequest("POST", `/api/health-journey/module/${moduleId}/progress`, { progress, quizScore });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journey/dashboard"] });
      setSelectedModule(null);
    },
  });

  const createJourneyMutation = useMutation({
    mutationFn: async (data: { patientId: string; conditionType: string; title: string; description: string; durationWeeks: number }) => {
      return apiRequest("POST", "/api/health-journey/journeys", data);
    },
    onSuccess: () => {
      toast({
        title: "Journey Created",
        description: "Your personalized health journey has started!",
      });
      setShowNewJourneyDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/health-journey/dashboard"] });
    },
  });

  const dismissInsightMutation = useMutation({
    mutationFn: async (insightId: string) => {
      return apiRequest("POST", `/api/health-journey/insights/${insightId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-journey/dashboard"] });
    },
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "medication": return <Pill className="h-4 w-4" />;
      case "exercise": return <Activity className="h-4 w-4" />;
      case "diet": return <Heart className="h-4 w-4" />;
      case "monitoring": return <Target className="h-4 w-4" />;
      case "appointment": return <Calendar className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getModuleStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in_progress": return <Play className="h-5 w-5 text-blue-500" />;
      case "available": return <BookOpen className="h-5 w-5 text-purple-500" />;
      default: return <Lock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "celebration": return <PartyPopper className="h-5 w-5 text-yellow-500" />;
      case "recommendation": return <Lightbulb className="h-5 w-5 text-blue-500" />;
      case "alert": return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <TrendingUp className="h-5 w-5 text-green-500" />;
    }
  };

  const getBadgeIcon = (icon: string) => {
    switch (icon) {
      case "flame": return <Flame className="h-6 w-6" />;
      case "footprints": return <Activity className="h-6 w-6" />;
      case "brain": return <Brain className="h-6 w-6" />;
      case "target": return <Target className="h-6 w-6" />;
      default: return <Award className="h-6 w-6" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "bg-gradient-to-r from-yellow-400 to-orange-500 text-white";
      case "epic": return "bg-gradient-to-r from-purple-400 to-pink-500 text-white";
      case "rare": return "bg-gradient-to-r from-blue-400 to-cyan-500 text-white";
      default: return "bg-gradient-to-r from-gray-400 to-gray-500 text-white";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading your health journey...</div>
      </div>
    );
  }

  const journey = dashboard?.journey;
  const gamification = dashboard?.gamification;

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">My Health Journey</h1>
            <p className="text-muted-foreground">
              Personalized care plans and adaptive learning for your health goals
            </p>
          </div>
          {!journey && (
            <Dialog open={showNewJourneyDialog} onOpenChange={setShowNewJourneyDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-start-journey">
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Journey
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start Your Health Journey</DialogTitle>
                  <DialogDescription>
                    Choose a condition to receive personalized education and care plans
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    createJourneyMutation.mutate({
                      patientId,
                      conditionType: formData.get("conditionType") as string,
                      title: formData.get("title") as string,
                      description: formData.get("description") as string,
                      durationWeeks: parseInt(formData.get("durationWeeks") as string),
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="conditionType">Condition</Label>
                    <Select name="conditionType" required>
                      <SelectTrigger data-testid="select-condition">
                        <SelectValue placeholder="Select a condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {conditionTypes?.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>
                            {ct.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Journey Title</Label>
                    <Input name="title" placeholder="My Health Journey" defaultValue="My Health Journey" data-testid="input-journey-title" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea name="description" placeholder="Describe your goals..." data-testid="input-journey-description" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="durationWeeks">Duration (weeks)</Label>
                    <Select name="durationWeeks" defaultValue="12">
                      <SelectTrigger data-testid="select-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 weeks</SelectItem>
                        <SelectItem value="8">8 weeks</SelectItem>
                        <SelectItem value="12">12 weeks</SelectItem>
                        <SelectItem value="24">24 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createJourneyMutation.isPending} data-testid="button-create-journey">
                    {createJourneyMutation.isPending ? "Creating..." : "Start Journey"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {journey && gamification && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Level</p>
                    <p className="text-2xl font-bold">{gamification.level}</p>
                    <p className="text-xs text-muted-foreground">{gamification.levelTitle}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-yellow-500/10">
                    <Star className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Points</p>
                    <p className="text-2xl font-bold">{gamification.totalPoints.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{gamification.nextLevelPoints - gamification.totalPoints} to next level</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-orange-500/10">
                    <Flame className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Streak</p>
                    <p className="text-2xl font-bold">{gamification.currentStreak} days</p>
                    <p className="text-xs text-muted-foreground">Best: {gamification.longestStreak} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Journey Progress</p>
                    <p className="text-2xl font-bold">{journey.overallProgress}%</p>
                    <p className="text-xs text-muted-foreground">Phase {journey.currentPhase}/{journey.totalPhases}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {journey && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="modules" data-testid="tab-modules">Learning</TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks">Care Plan</TabsTrigger>
              <TabsTrigger value="achievements" data-testid="tab-achievements">Achievements</TabsTrigger>
              <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {journey.title}
                    </CardTitle>
                    <CardDescription>{journey.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Overall Progress</span>
                        <span>{journey.overallProgress}%</span>
                      </div>
                      <Progress value={journey.overallProgress} className="h-3" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{dashboard?.modules.completed}</p>
                        <p className="text-xs text-muted-foreground">Modules Done</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{dashboard?.tasks.completedToday}</p>
                        <p className="text-xs text-muted-foreground">Tasks Today</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{gamification?.badges.length || 0}</p>
                        <p className="text-xs text-muted-foreground">Badges Earned</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">#{gamification?.leaderboardRank || '-'}</p>
                        <p className="text-xs text-muted-foreground">Rank</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dashboard?.insights.slice(0, 3).map((insight) => (
                      <div key={insight.id} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-start gap-2">
                          {getInsightIcon(insight.type)}
                          <div className="flex-1">
                            <p className="font-medium text-sm">{insight.title}</p>
                            <p className="text-xs text-muted-foreground">{insight.message}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissInsightMutation.mutate(insight.id)}
                            data-testid={`button-dismiss-insight-${insight.id}`}
                          >
                            Dismiss
                          </Button>
                        </div>
                        {insight.actionable && insight.suggestedAction && (
                          <Button variant="outline" size="sm" className="w-full" data-testid={`button-action-${insight.id}`}>
                            {insight.suggestedAction}
                          </Button>
                        )}
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      {dashboard?.disclaimer}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Today's Tasks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dashboard?.tasks.today.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className={`p-2 rounded-full ${task.status === 'completed' ? 'bg-green-500/10' : 'bg-muted'}`}>
                          {getCategoryIcon(task.category)}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {task.scheduledTime && <span>{task.scheduledTime}</span>}
                            <Badge variant="outline" className="text-xs">
                              <Flame className="h-3 w-3 mr-1" />
                              {task.streakCount} streak
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              +{task.pointsValue} pts
                            </Badge>
                          </div>
                          {task.aiSuggestion && (
                            <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              {task.aiSuggestion}
                            </p>
                          )}
                        </div>
                        {task.status !== 'completed' && (
                          <Button
                            size="sm"
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            disabled={completeTaskMutation.isPending}
                            data-testid={`button-complete-task-${task.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Recent Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      {gamification?.badges.slice(0, 6).map((badge) => (
                        <div
                          key={badge.id}
                          className={`p-3 rounded-lg text-center ${getRarityColor(badge.rarity)}`}
                        >
                          {getBadgeIcon(badge.icon)}
                          <p className="text-xs font-medium mt-1">{badge.name}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="modules" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Educational Modules
                  </CardTitle>
                  <CardDescription>
                    Complete modules to earn points and unlock new content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dashboard?.modules.list.map((module) => (
                    <div
                      key={module.id}
                      className={`p-4 rounded-lg border ${module.status === 'locked' ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-4">
                        {getModuleStatusIcon(module.status)}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{module.title}</p>
                              <p className="text-sm text-muted-foreground">{module.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{module.difficulty}</Badge>
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                {module.estimatedMinutes} min
                              </Badge>
                            </div>
                          </div>
                          {module.status === 'in_progress' && (
                            <Progress value={module.progress} className="h-2" />
                          )}
                          {module.status === 'completed' && module.score !== undefined && (
                            <div className="flex items-center gap-2 text-sm text-green-500">
                              <CheckCircle className="h-4 w-4" />
                              Completed with {module.score}% score
                            </div>
                          )}
                          <div className="flex gap-2 pt-2">
                            {module.status === 'available' && (
                              <Button
                                size="sm"
                                onClick={() => updateModuleProgressMutation.mutate({ moduleId: module.id, progress: 10 })}
                                data-testid={`button-start-module-${module.id}`}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Start Module
                              </Button>
                            )}
                            {module.status === 'in_progress' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedModule(module)}
                                  data-testid={`button-continue-module-${module.id}`}
                                >
                                  <Play className="h-4 w-4 mr-1" />
                                  Continue
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateModuleProgressMutation.mutate({ moduleId: module.id, progress: 100, quizScore: 85 })}
                                  data-testid={`button-complete-module-${module.id}`}
                                >
                                  Complete Module
                                </Button>
                              </>
                            )}
                            {module.status === 'locked' && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Lock className="h-4 w-4 mr-1" />
                                Complete prerequisite modules first
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Care Plan Tasks
                  </CardTitle>
                  <CardDescription>
                    Complete daily tasks to build healthy habits and maintain your streak
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dashboard?.tasks.today.map((task) => (
                    <div key={task.id} className="p-4 rounded-lg border">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${task.status === 'completed' ? 'bg-green-500/10' : 'bg-muted'}`}>
                          {getCategoryIcon(task.category)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              <p className="text-sm text-muted-foreground">{task.description}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary">+{task.pointsValue} pts</Badge>
                              {task.streakCount > 0 && (
                                <Badge variant="outline" className="text-orange-500">
                                  <Flame className="h-3 w-3 mr-1" />
                                  {task.streakCount} day streak
                                </Badge>
                              )}
                            </div>
                          </div>
                          {task.aiSuggestion && (
                            <div className="mt-2 p-2 rounded bg-blue-500/10 text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                              <Sparkles className="h-4 w-4 mt-0.5" />
                              <span>{task.aiSuggestion}</span>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            {task.status !== 'completed' ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => completeTaskMutation.mutate(task.id)}
                                  disabled={completeTaskMutation.isPending}
                                  data-testid={`button-complete-task-${task.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Mark Complete
                                </Button>
                                <Button size="sm" variant="outline" data-testid={`button-skip-task-${task.id}`}>
                                  Skip Today
                                </Button>
                              </>
                            ) : (
                              <div className="flex items-center text-sm text-green-500">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Completed
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="achievements" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Medal className="h-5 w-5" />
                      Badges Earned
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {gamification?.badges.map((badge) => (
                        <div
                          key={badge.id}
                          className={`p-4 rounded-lg text-center ${getRarityColor(badge.rarity)}`}
                        >
                          <div className="flex justify-center mb-2">
                            {getBadgeIcon(badge.icon)}
                          </div>
                          <p className="font-medium text-sm">{badge.name}</p>
                          <p className="text-xs opacity-80">{badge.description}</p>
                          <Badge variant="outline" className="mt-2 text-xs bg-white/20">
                            {badge.rarity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {gamification?.achievements.map((achievement) => (
                      <div key={achievement.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-full ${achievement.unlocked ? 'bg-green-500/10' : 'bg-muted'}`}>
                              {achievement.unlocked ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <Target className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{achievement.name}</p>
                              <p className="text-xs text-muted-foreground">{achievement.description}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1" />
                            {achievement.pointsReward} pts
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{achievement.progress}/{achievement.target}</span>
                            <span>{Math.round((achievement.progress / achievement.target) * 100)}%</span>
                          </div>
                          <Progress value={(achievement.progress / achievement.target) * 100} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="leaderboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    Community Leaderboard
                  </CardTitle>
                  <CardDescription>
                    See how you compare with others on their health journeys
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {leaderboard?.map((entry, index) => (
                      <div
                        key={entry.patientId}
                        className={`flex items-center gap-4 p-3 rounded-lg ${
                          entry.patientId === patientId ? 'bg-primary/10 border border-primary' : 'bg-muted/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-muted'
                        }`}>
                          {index === 0 ? <Crown className="h-4 w-4" /> : entry.rank}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {entry.patientId === patientId ? "You" : `Health Champion ${entry.rank}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Level {entry.level} - {entry.levelTitle}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{entry.totalPoints.toLocaleString()} pts</p>
                          <div className="flex items-center gap-1 text-xs text-orange-500">
                            <Flame className="h-3 w-3" />
                            {entry.currentStreak} day streak
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {!journey && (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
                <Heart className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Start Your Health Journey</h2>
              <p className="text-muted-foreground">
                Begin a personalized health journey with adaptive educational modules, 
                interactive care plans, and gamification to keep you motivated.
              </p>
              <Button size="lg" onClick={() => setShowNewJourneyDialog(true)} data-testid="button-start-journey-empty">
                <Plus className="h-5 w-5 mr-2" />
                Get Started
              </Button>
            </div>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">
          {dashboard?.disclaimer || "This information is for educational purposes only and does not constitute medical advice. Always consult your healthcare provider for personalized medical decisions."}
        </p>
      </div>
    </ScrollArea>
  );
}
