import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Target,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Plus,
  ChevronRight,
  History,
  UserCheck,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";

type GoalStatus = "not_started" | "in_progress" | "achieved" | "not_achieved" | "cancelled";

interface CarePlanGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string | null;
  status: GoalStatus;
  priority: "high" | "medium" | "low";
  metrics: Array<{
    name: string;
    target: string;
    current: string | null;
    unit: string;
  }>;
  notes: string[];
}

interface CarePlanIntervention {
  id: string;
  goalId: string;
  title: string;
  description: string;
  frequency: string;
  assignedTo: "patient" | "provider" | "caregiver";
  status: "planned" | "in_progress" | "completed" | "discontinued";
  progressNotes: Array<{
    date: string;
    note: string;
    author: string;
  }>;
}

interface CarePlanContributor {
  id: string;
  name: string;
  role: string;
  canEdit: boolean;
}

interface CarePlan {
  id: string;
  title: string;
  description: string;
  status: "draft" | "active" | "completed" | "on_hold" | "cancelled";
  condition: string;
  startDate: string;
  reviewDate: string | null;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  contributors: CarePlanContributor[];
  patientAcknowledged: boolean;
  patientAcknowledgedAt: string | null;
  versionHistory: Array<{
    version: number;
    changedBy: string;
    changedAt: string;
    summary: string;
  }>;
}

interface CarePlanStats {
  totalPlans: number;
  activePlans: number;
  totalGoals: number;
  goalsAchieved: number;
  pendingAcknowledgment: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  on_hold: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const goalStatusColors: Record<GoalStatus, string> = {
  not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
  achieved: "bg-green-100 text-green-700 dark:bg-green-900/30",
  not_achieved: "bg-red-100 text-red-700 dark:bg-red-900/30",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800",
};

const priorityColors: Record<string, string> = {
  high: "border-red-500",
  medium: "border-yellow-500",
  low: "border-gray-400",
};

function CarePlanDetail({ plan, onClose }: { plan: CarePlan; onClose: () => void }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("goals");
  const [noteText, setNoteText] = useState("");
  const [selectedIntervention, setSelectedIntervention] = useState<string | null>(null);

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/care-plans/${plan.id}/acknowledge`, {});
      if (!response.ok) throw new Error("Failed to acknowledge");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      toast({ title: "Care Plan Acknowledged", description: "You have acknowledged this care plan" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ interventionId, note }: { interventionId: string; note: string }) => {
      const response = await apiRequest("POST", `/api/care-plans/${plan.id}/progress-note`, {
        interventionId,
        note,
      });
      if (!response.ok) throw new Error("Failed to add note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      setNoteText("");
      setSelectedIntervention(null);
      toast({ title: "Progress Note Added" });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ goalId, status }: { goalId: string; status: GoalStatus }) => {
      const response = await apiRequest("PATCH", `/api/care-plans/${plan.id}/goals/${goalId}`, { status });
      if (!response.ok) throw new Error("Failed to update goal");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      toast({ title: "Goal Updated" });
    },
  });

  const { data: suggestions } = useQuery<string[]>({
    queryKey: ["/api/care-plans", plan.id, "suggestions"],
    enabled: activeTab === "overview",
  });

  const goalsProgress = plan.goals.length > 0
    ? (plan.goals.filter(g => g.status === "achieved").length / plan.goals.length) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className={statusColors[plan.status]} data-testid="badge-plan-status">
              {plan.status.replace("_", " ")}
            </Badge>
            {!plan.patientAcknowledged && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                Needs Acknowledgment
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-plan-condition">{plan.condition}</p>
        </div>
        {!plan.patientAcknowledged && (
          <Button 
            onClick={() => acknowledgeMutation.mutate()}
            disabled={acknowledgeMutation.isPending}
            data-testid="button-acknowledge-plan"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Acknowledge Plan
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-2xl font-bold" data-testid="text-goals-count">{plan.goals.length}</p>
          <p className="text-xs text-muted-foreground">Goals</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-2xl font-bold" data-testid="text-interventions-count">{plan.interventions.length}</p>
          <p className="text-xs text-muted-foreground">Interventions</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-2xl font-bold" data-testid="text-contributors-count">{plan.contributors.length}</p>
          <p className="text-xs text-muted-foreground">Team Members</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Goal Progress</span>
          <span className="text-sm text-muted-foreground">{Math.round(goalsProgress)}%</span>
        </div>
        <Progress value={goalsProgress} className="h-2" data-testid="progress-goals" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
          <TabsTrigger value="interventions" data-testid="tab-interventions">Tasks</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div>
            <p className="text-sm" data-testid="text-plan-description">{plan.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Started: {new Date(plan.startDate).toLocaleDateString()}</span>
            </div>
            {plan.reviewDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Review: {new Date(plan.reviewDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {suggestions && suggestions.length > 0 && (
            <div className="p-3 rounded-lg bg-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Suggestions</span>
              </div>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                    <span data-testid={`text-suggestion-${i}`}>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Version History</span>
            </div>
            <div className="space-y-2">
              {plan.versionHistory.slice(0, 3).map((v) => (
                <div key={v.version} className="text-sm flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">v{v.version}</Badge>
                  <div>
                    <p data-testid={`text-version-summary-${v.version}`}>{v.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.changedBy} • {new Date(v.changedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="goals">
          <ScrollArea className="h-[300px]">
            <div className="space-y-3 pr-4">
              {plan.goals.map((goal) => (
                <div 
                  key={goal.id} 
                  className={`p-3 rounded-lg border-l-4 bg-muted/30 ${priorityColors[goal.priority]}`}
                  data-testid={`goal-card-${goal.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium" data-testid={`text-goal-title-${goal.id}`}>{goal.title}</p>
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    </div>
                    <Select
                      value={goal.status}
                      onValueChange={(value) => updateGoalMutation.mutate({ goalId: goal.id, status: value as GoalStatus })}
                    >
                      <SelectTrigger className="w-[140px]" data-testid={`select-goal-status-${goal.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="achieved">Achieved</SelectItem>
                        <SelectItem value="not_achieved">Not Achieved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {goal.metrics.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {goal.metrics.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{m.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.current || "—"}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-green-600 dark:text-green-400">{m.target}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {goal.targetDate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Target: {new Date(goal.targetDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="interventions">
          <ScrollArea className="h-[300px]">
            <Accordion type="single" collapsible className="space-y-2 pr-4">
              {plan.interventions.map((intervention) => (
                <AccordionItem 
                  key={intervention.id} 
                  value={intervention.id}
                  className="border rounded-lg px-3"
                  data-testid={`intervention-item-${intervention.id}`}
                >
                  <AccordionTrigger className="hover:no-underline py-2">
                    <div className="flex items-center gap-2 text-left">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium" data-testid={`text-intervention-title-${intervention.id}`}>
                          {intervention.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {intervention.frequency} • {intervention.assignedTo}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 space-y-3">
                    <p className="text-sm text-muted-foreground">{intervention.description}</p>

                    {intervention.progressNotes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Progress Notes</p>
                        {intervention.progressNotes.slice(-3).map((note, i) => (
                          <div key={i} className="p-2 rounded bg-muted/50 text-sm">
                            <p>{note.note}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {note.author} • {new Date(note.date).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedIntervention === intervention.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add a progress note..."
                          className="text-sm"
                          data-testid={`textarea-progress-note-${intervention.id}`}
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm"
                            onClick={() => addNoteMutation.mutate({ interventionId: intervention.id, note: noteText })}
                            disabled={!noteText.trim() || addNoteMutation.isPending}
                            data-testid={`button-save-note-${intervention.id}`}
                          >
                            Save Note
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => { setSelectedIntervention(null); setNoteText(""); }}
                            data-testid={`button-cancel-note-${intervention.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="gap-1"
                        onClick={() => setSelectedIntervention(intervention.id)}
                        data-testid={`button-add-note-${intervention.id}`}
                      >
                        <Plus className="h-3 w-3" />
                        Add Progress Note
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="team">
          <div className="space-y-3">
            {plan.contributors.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30" data-testid={`contributor-${c.id}`}>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium" data-testid={`text-contributor-name-${c.id}`}>{c.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{c.role.replace("_", " ")}</p>
                </div>
                {c.canEdit && (
                  <Badge variant="outline">Can Edit</Badge>
                )}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CarePlanListItem({ plan, onClick }: { plan: CarePlan; onClick: () => void }) {
  const goalsAchieved = plan.goals.filter(g => g.status === "achieved").length;

  return (
    <div 
      className="p-4 rounded-lg border hover-elevate cursor-pointer"
      {...clickable(onClick)}
      data-testid={`card-care-plan-${plan.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-medium" data-testid={`text-plan-title-${plan.id}`}>{plan.title}</p>
          <p className="text-sm text-muted-foreground">{plan.condition}</p>
        </div>
        <Badge className={statusColors[plan.status]}>
          {plan.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Target className="h-4 w-4" />
          <span>{goalsAchieved}/{plan.goals.length} goals</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="h-4 w-4" />
          <span>{plan.interventions.length} tasks</span>
        </div>
      </div>

      {!plan.patientAcknowledged && (
        <div className="mt-2 flex items-center gap-1 text-orange-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Needs acknowledgment</span>
        </div>
      )}
    </div>
  );
}

export function CarePlanManagement() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null);

  const { data: plans, isLoading } = useQuery<CarePlan[]>({
    queryKey: ["/api/care-plans"],
    enabled: open,
  });

  const { data: stats } = useQuery<CarePlanStats>({
    queryKey: ["/api/care-plans/stats"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-care-plans">
          <ClipboardList className="h-4 w-4" />
          Care Plans
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Care Plan Management
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {selectedPlan ? (
            <div className="space-y-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedPlan(null)}
                data-testid="button-back-to-plans"
              >
                ← Back to plans
              </Button>
              <h3 className="font-semibold text-lg" data-testid="text-selected-plan-title">
                {selectedPlan.title}
              </h3>
              <ScrollArea className="h-[500px] pr-4">
                <CarePlanDetail plan={selectedPlan} onClose={() => setSelectedPlan(null)} />
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-4">
              {stats && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold" data-testid="text-stat-active">{stats.activePlans}</p>
                    <p className="text-xs text-muted-foreground">Active Plans</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold" data-testid="text-stat-goals">{stats.totalGoals}</p>
                    <p className="text-xs text-muted-foreground">Total Goals</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold text-green-600" data-testid="text-stat-achieved">{stats.goalsAchieved}</p>
                    <p className="text-xs text-muted-foreground">Achieved</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold" data-testid="text-stat-pending">
                      {stats.pendingAcknowledgment}
                    </p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : plans && plans.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {plans.map((plan) => (
                      <CarePlanListItem 
                        key={plan.id} 
                        plan={plan} 
                        onClick={() => setSelectedPlan(plan)} 
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="font-medium">No care plans yet</p>
                  <p className="text-sm text-muted-foreground">
                    Your care team will create plans for your conditions
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CarePlanCard() {
  const { data: stats } = useQuery<CarePlanStats>({
    queryKey: ["/api/care-plans/stats"],
  });

  return (
    <Card data-testid="card-care-plan-management">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          Care Plans
          {stats && stats.pendingAcknowledgment > 0 && (
            <Badge className="ml-auto" variant="outline">
              {stats.pendingAcknowledgment} needs attention
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Manage your treatment goals and progress</CardDescription>
      </CardHeader>
      <CardContent>
        <CarePlanManagement />
        {stats && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>{stats.activePlans} active plans</span>
            <span>•</span>
            <span>{stats.goalsAchieved}/{stats.totalGoals} goals achieved</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
