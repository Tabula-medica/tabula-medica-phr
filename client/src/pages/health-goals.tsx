import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Plus, TrendingUp, Calendar,
  Activity, Check, Pause,
  ArrowLeft, Heart, Moon, Pill, Brain,
  Droplets, Dumbbell, Flag, Clock,
  CheckCircle, Sparkles, Zap, BarChart3,
  ChevronRight,
} from "lucide-react";

interface HealthGoal {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  startDate: string;
  targetDate: string;
  status: string;
  priority: string;
  milestones: GoalMilestone[];
  progressHistory: ProgressEntry[];
  aiRecommendations: string[];
  linkedConditions: string[];
  createdAt: string;
  updatedAt: string;
}

interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  isReached: boolean;
  reachedAt: string | null;
  order: number;
}

interface ProgressEntry {
  id: string;
  goalId: string;
  value: number;
  note: string;
  recordedAt: string;
  source: string;
}

interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  suggestedTarget: number;
  unit: string;
  durationWeeks: number;
  milestoneCount: number;
  popularity: number;
}

interface GoalDashboard {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  overallProgress: number;
  goalsOnTrack: number;
  goalsBehind: number;
  recentMilestones: GoalMilestone[];
  categoryBreakdown: { category: string; count: number }[];
}

const PATIENT_ID = "patient-001";

function getCategoryIcon(category: string) {
  switch (category) {
    case "weight": return <TrendingUp className="w-4 h-4" />;
    case "exercise": return <Dumbbell className="w-4 h-4" />;
    case "nutrition": return <Droplets className="w-4 h-4" />;
    case "medication": return <Pill className="w-4 h-4" />;
    case "mental_health": return <Brain className="w-4 h-4" />;
    case "sleep": return <Moon className="w-4 h-4" />;
    case "vitals": return <Heart className="w-4 h-4" />;
    default: return <Target className="w-4 h-4" />;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "weight": return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "exercise": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "nutrition": return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400";
    case "medication": return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "mental_health": return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    case "sleep": return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400";
    case "vitals": return "bg-red-500/15 text-red-700 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function goalProgress(goal: HealthGoal): number {
  if (goal.targetValue === 0) return 0;
  if (goal.category === "vitals" && goal.progressHistory.length > 0) {
    const start = goal.progressHistory[0].value;
    const totalDrop = start - goal.targetValue;
    const currentDrop = start - goal.currentValue;
    return totalDrop > 0 ? Math.min(Math.round((currentDrop / totalDrop) * 100), 100) : 0;
  }
  return Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100);
}

function daysRemaining(targetDate: string): number {
  return Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function GoalCard({ goal, isSelected, onSelect }: { goal: HealthGoal; isSelected: boolean; onSelect: () => void }) {
  const { toast } = useToast();
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressValue, setProgressValue] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const pct = goalProgress(goal);
  const days = daysRemaining(goal.targetDate);
  const milestonesReached = goal.milestones.filter(m => m.isReached).length;

  const logMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/infrastructure/health-goals/goal/${goal.id}/progress`, {
        value: parseFloat(progressValue),
        note: progressNote,
        source: "manual",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Progress logged", description: `Updated ${goal.title}` });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/health-goals", PATIENT_ID] });
      setProgressOpen(false);
      setProgressValue("");
      setProgressNote("");
    },
    onError: () => toast({ title: "Error", description: "Failed to log progress", variant: "destructive" }),
  });

  return (
    <Card
      className={`hover-elevate cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
      data-testid={`card-goal-${goal.id}`}
    >
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-md flex-shrink-0 ${getCategoryColor(goal.category)}`}>
              {getCategoryIcon(goal.category)}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight" data-testid={`text-goal-title-${goal.id}`}>{goal.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{goal.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {goal.priority === "high" && <Badge variant="outline" className="border-red-500/50 text-red-600 dark:text-red-400 text-xs">High</Badge>}
            <Badge variant={goal.status === "active" ? "default" : "secondary"} className={goal.status === "active" ? "bg-emerald-600 dark:bg-emerald-700" : ""}>
              {goal.status === "active" && <Activity className="w-3 h-3 mr-1" />}
              {goal.status === "completed" && <Check className="w-3 h-3 mr-1" />}
              {goal.status === "paused" && <Pause className="w-3 h-3 mr-1" />}
              {goal.status}
            </Badge>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-medium" data-testid={`text-goal-progress-${goal.id}`}>{pct}%</span>
            <span className="text-xs text-muted-foreground">
              {goal.currentValue} / {goal.targetValue} {goal.unit}
            </span>
          </div>
          <Progress value={pct} className="h-2" data-testid={`progress-bar-${goal.id}`} />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Flag className="w-3 h-3" />
              {milestonesReached}/{goal.milestones.length} milestones
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {days}d left
            </span>
          </div>
          {goal.linkedConditions.length > 0 && (
            <Badge variant="outline" className="text-[10px] no-default-active-elevate">{goal.linkedConditions[0]}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {goal.milestones.map((ms) => (
            <div
              key={ms.id}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                ms.isReached ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground border"
              }`}
              title={ms.title}
              data-testid={`milestone-${ms.id}`}
            >
              {ms.isReached ? <Check className="w-3 h-3" /> : ms.order}
            </div>
          ))}
        </div>

        {goal.status === "active" && (
          <div role="presentation" onClick={(e) => e.stopPropagation()}>
            <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid={`button-log-progress-${goal.id}`}>
                  <Plus className="w-3 h-3 mr-1" />
                  Log Progress
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Progress: {goal.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="health-goals-value">Value ({goal.unit})</Label>
                    <Input id="health-goals-value" type="number" value={progressValue} onChange={(e) => setProgressValue(e.target.value)} placeholder={`Current: ${goal.currentValue}`} data-testid="input-progress-value" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="health-goals-note-optional">Note (optional)</Label>
                    <Input id="health-goals-note-optional" value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder="What helped?" data-testid="input-progress-note" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setProgressOpen(false)}>Cancel</Button>
                  <Button onClick={() => logMutation.mutate()} disabled={!progressValue || logMutation.isPending} data-testid="button-save-progress">
                    {logMutation.isPending ? "Saving..." : "Save Progress"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalDetailPanel({ goal }: { goal: HealthGoal }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Progress Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goal.progressHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No progress entries yet</p>
          ) : (
            <div className="space-y-2">
              {goal.progressHistory.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm" data-testid={`progress-entry-${entry.id}`}>
                  <div className="w-16 text-xs text-muted-foreground flex-shrink-0">
                    {formatDate(entry.recordedAt)}
                  </div>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="font-medium">{entry.value} {goal.unit}</span>
                    {entry.note && <span className="text-muted-foreground text-xs truncate">- {entry.note}</span>}
                  </div>
                  <Badge variant="outline" className="text-[10px] no-default-active-elevate flex-shrink-0">{entry.source}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="w-4 h-4" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {goal.milestones.map((ms) => (
              <div key={ms.id} className="flex items-center gap-3" data-testid={`milestone-detail-${ms.id}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ms.isReached ? "bg-emerald-500 text-white" : "border-2 border-muted-foreground/30"
                }`}>
                  {ms.isReached ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="text-xs">{ms.order}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${ms.isReached ? "line-through text-muted-foreground" : "font-medium"}`}>{ms.title}</p>
                  {ms.reachedAt && <p className="text-xs text-muted-foreground">Reached {formatDate(ms.reachedAt)}</p>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{ms.targetValue} {goal.unit}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {goal.aiRecommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI Recommendations
            </CardTitle>
            <CardDescription>Personalized suggestions based on your progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {goal.aiRecommendations.map((rec, idx) => (
                <div key={idx} className="flex gap-2 text-sm" data-testid={`recommendation-${idx}`}>
                  <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">{rec}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 italic">
              These are informational suggestions only and do not constitute medical advice. Consult your healthcare provider.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function HealthGoalsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("exercise");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDate, setNewDate] = useState("");

  const { data: dashData, isLoading: dashLoading } = useQuery<{ success: boolean; dashboard: GoalDashboard }>({
    queryKey: ["/api/infrastructure/health-goals", PATIENT_ID, "dashboard"],
  });

  const { data: goalsData, isLoading: goalsLoading } = useQuery<{ success: boolean; goals: HealthGoal[] }>({
    queryKey: ["/api/infrastructure/health-goals", PATIENT_ID, "goals"],
  });

  const { data: templatesData } = useQuery<{ success: boolean; templates: GoalTemplate[] }>({
    queryKey: ["/api/infrastructure/health-goals/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/infrastructure/health-goals/create", {
        patientId: PATIENT_ID,
        title: newTitle,
        description: newDesc,
        category: newCategory,
        targetValue: parseFloat(newTarget),
        unit: newUnit,
        targetDate: newDate,
        priority: newPriority,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Goal Created", description: "Your new health goal has been set up." });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/health-goals", PATIENT_ID] });
      setCreateOpen(false);
      setNewTitle(""); setNewDesc(""); setNewCategory("exercise");
      setNewTarget(""); setNewUnit(""); setNewPriority("medium"); setNewDate("");
    },
    onError: () => toast({ title: "Error", description: "Failed to create goal", variant: "destructive" }),
  });

  const dashboard = dashData?.dashboard;
  const goals = goalsData?.goals || [];
  const templates = templatesData?.templates || [];
  const isLoading = dashLoading || goalsLoading;
  const activeGoals = goals.filter(g => g.status === "active");
  const completedGoals = goals.filter(g => g.status === "completed");
  const selectedGoal = selectedGoalId ? goals.find(g => g.id === selectedGoalId) : null;

  function applyTemplate(tmpl: GoalTemplate) {
    setNewTitle(tmpl.title);
    setNewDesc(tmpl.description);
    setNewCategory(tmpl.category);
    setNewTarget(tmpl.suggestedTarget.toString());
    setNewUnit(tmpl.unit);
    const target = new Date(Date.now() + tmpl.durationWeeks * 7 * 86400000);
    setNewDate(target.toISOString().split("T")[0]);
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-health-goals">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="page-title">
              <Target className="w-6 h-6 text-primary" />
              Health Goals
            </h1>
            <p className="text-sm text-muted-foreground">
              Set, track, and achieve your personal health objectives
            </p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-goal">
              <Plus className="w-4 h-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Health Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {templates.length > 0 && (
                <div className="space-y-2">
                  <FieldCaption className="text-sm font-medium">Quick Start Templates</FieldCaption>
                  <div className="grid grid-cols-2 gap-2">
                    {templates.slice(0, 4).map((tmpl) => (
                      <Button key={tmpl.id} variant="outline" size="sm" className="justify-start text-left h-auto py-2" onClick={() => applyTemplate(tmpl)} data-testid={`button-template-${tmpl.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {getCategoryIcon(tmpl.category)}
                          <span className="text-xs truncate">{tmpl.title}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="health-goals-goal-title">Goal Title</Label>
                <Input id="health-goals-goal-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g., Reduce Blood Pressure" data-testid="input-goal-title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-goals-description">Description</Label>
                <Textarea id="health-goals-description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Describe your goal..." data-testid="input-goal-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="health-goals-category">Category</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger id="health-goals-category" data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exercise">Exercise</SelectItem>
                      <SelectItem value="weight">Weight</SelectItem>
                      <SelectItem value="nutrition">Nutrition</SelectItem>
                      <SelectItem value="vitals">Vitals</SelectItem>
                      <SelectItem value="sleep">Sleep</SelectItem>
                      <SelectItem value="medication">Medication</SelectItem>
                      <SelectItem value="mental_health">Mental Health</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="health-goals-priority">Priority</Label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger id="health-goals-priority" data-testid="select-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="health-goals-target-value">Target Value</Label>
                  <Input id="health-goals-target-value" type="number" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} placeholder="e.g., 10000" data-testid="input-target-value" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="health-goals-unit">Unit</Label>
                  <Input id="health-goals-unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="e.g., steps/day" data-testid="input-unit" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-goals-target-date">Target Date</Label>
                <Input id="health-goals-target-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} data-testid="input-target-date" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!newTitle || !newTarget || !newUnit || !newDate || createMutation.isPending} data-testid="button-save-goal">
                {createMutation.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="section-goal-stats">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/15"><Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-active-goals">{dashboard?.activeGoals || 0}</p>
                <p className="text-xs text-muted-foreground">Active Goals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/15"><TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-overall-progress">{dashboard?.overallProgress || 0}%</p>
                <p className="text-xs text-muted-foreground">Overall Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/15"><CheckCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-on-track">{dashboard?.goalsOnTrack || 0}</p>
                <p className="text-xs text-muted-foreground">On Track</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-500/15"><Flag className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-completed">{dashboard?.completedGoals || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList data-testid="tabs-list">
              <TabsTrigger value="active" data-testid="tab-active">
                <Activity className="w-4 h-4 mr-1" /> Active ({activeGoals.length})
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">
                <CheckCircle className="w-4 h-4 mr-1" /> Completed ({completedGoals.length})
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">
                <Sparkles className="w-4 h-4 mr-1" /> Templates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeGoals.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Target className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No active goals. Create one to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} isSelected={selectedGoalId === goal.id} onSelect={() => setSelectedGoalId(selectedGoalId === goal.id ? null : goal.id)} />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedGoals.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No completed goals yet. Keep working toward your objectives.</p>
                  </CardContent>
                </Card>
              ) : (
                completedGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} isSelected={selectedGoalId === goal.id} onSelect={() => setSelectedGoalId(goal.id)} />
                ))
              )}
            </TabsContent>

            <TabsContent value="templates" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((tmpl) => (
                  <Card key={tmpl.id} className="hover-elevate cursor-pointer" onClick={() => { applyTemplate(tmpl); setCreateOpen(true); }} data-testid={`card-template-${tmpl.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-md flex-shrink-0 ${getCategoryColor(tmpl.category)}`}>
                          {getCategoryIcon(tmpl.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{tmpl.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tmpl.description}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] no-default-active-elevate">{tmpl.suggestedTarget} {tmpl.unit}</Badge>
                            <Badge variant="outline" className="text-[10px] no-default-active-elevate">{tmpl.durationWeeks} weeks</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {selectedGoal ? (
            <GoalDetailPanel goal={selectedGoal} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <ChevronRight className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Select a goal to view progress, milestones, and AI recommendations</p>
              </CardContent>
            </Card>
          )}

          {dashboard && dashboard.recentMilestones.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Flag className="w-4 h-4" /> Recent Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboard.recentMilestones.map((ms) => (
                    <div key={ms.id} className="flex items-center gap-2 text-sm" data-testid={`recent-milestone-${ms.id}`}>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="truncate">{ms.title}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-goals-disclaimer" />
    </div>
  );
}