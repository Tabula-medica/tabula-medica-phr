import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList,
  Target,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  MessageSquare,
  Activity,
  User,
  Phone,
  Mail,
  Building,
  ChevronRight,
  Plus,
  TrendingUp,
  FileText,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CarePlan, CarePlanGoal, CarePlanIntervention, CareTeamMember, CarePlanProgress } from "@shared/schema";

const categoryLabels: Record<string, string> = {
  chronic_disease: "Chronic Disease Management",
  post_surgical: "Post-Surgical Care",
  preventive: "Preventive Care",
  mental_health: "Mental Health",
  rehabilitation: "Rehabilitation",
  palliative: "Palliative Care",
  wellness: "Wellness",
  other: "Other",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-500",
  active: "bg-green-500/10 text-green-500",
  on_hold: "bg-yellow-500/10 text-yellow-500",
  completed: "bg-blue-500/10 text-blue-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const goalStatusColors: Record<string, string> = {
  not_started: "bg-gray-500/10 text-gray-500",
  in_progress: "bg-blue-500/10 text-blue-500",
  achieved: "bg-green-500/10 text-green-500",
  not_achieved: "bg-red-500/10 text-red-500",
  cancelled: "bg-gray-500/10 text-gray-500",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/10 text-green-500 border-green-500/30",
};

const roleLabels: Record<string, string> = {
  primary_physician: "Primary Physician",
  specialist: "Specialist",
  nurse: "Nurse",
  care_coordinator: "Care Coordinator",
  pharmacist: "Pharmacist",
  therapist: "Therapist",
  social_worker: "Social Worker",
  caregiver: "Caregiver",
  other: "Other",
};

function GoalCard({ goal, carePlanId, onUpdateProgress }: { goal: CarePlanGoal; carePlanId: string; onUpdateProgress: () => void }) {
  const { toast } = useToast();
  
  const updateGoalMutation = useMutation({
    mutationFn: async (updates: Partial<CarePlanGoal>) => {
      return apiRequest("PATCH", `/api/care-plans/${carePlanId}/goals/${goal.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      toast({ title: "Goal updated", description: "Your progress has been saved." });
      onUpdateProgress();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update goal.", variant: "destructive" });
    },
  });

  return (
    <Card className={`border-l-4 ${priorityColors[goal.priority]}`} data-testid={`goal-card-${goal.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1">
            <CardTitle className="text-base">{goal.description}</CardTitle>
            {goal.targetDate && (
              <CardDescription className="flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                Target: {new Date(goal.targetDate).toLocaleDateString()}
              </CardDescription>
            )}
          </div>
          <Badge className={goalStatusColors[goal.status]}>
            {goal.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="h-2" />
          </div>
          
          {goal.metrics && goal.metrics.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-sm font-medium text-muted-foreground">Metrics</h4>
              {goal.metrics.map((metric, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 rounded p-2">
                  <span>{metric.name}</span>
                  <span className="font-medium">{metric.current} / {metric.target} {metric.unit}</span>
                </div>
              ))}
            </div>
          )}
          
          {goal.status === "in_progress" && (
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => updateGoalMutation.mutate({ progress: Math.min(100, goal.progress + 10) })}
                disabled={updateGoalMutation.isPending}
                data-testid={`button-update-progress-${goal.id}`}
              >
                <Plus className="h-3 w-3 mr-1" />
                Update Progress
              </Button>
              {goal.progress >= 100 && (
                <Button 
                  size="sm"
                  onClick={() => updateGoalMutation.mutate({ status: "achieved" })}
                  disabled={updateGoalMutation.isPending}
                  data-testid={`button-mark-achieved-${goal.id}`}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Mark Achieved
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InterventionCard({ intervention, carePlanId }: { intervention: CarePlanIntervention; carePlanId: string }) {
  const { toast } = useToast();
  
  const updateInterventionMutation = useMutation({
    mutationFn: async (updates: Partial<CarePlanIntervention>) => {
      return apiRequest("PATCH", `/api/care-plans/${carePlanId}/interventions/${intervention.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      toast({ title: "Intervention updated", description: "Status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update intervention.", variant: "destructive" });
    },
  });

  const statusIcon = intervention.status === "completed" ? CheckCircle : 
                     intervention.status === "overdue" ? AlertCircle : Clock;
  const StatusIcon = statusIcon;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border" data-testid={`intervention-card-${intervention.id}`}>
      <div className={`p-2 rounded-full ${
        intervention.status === "completed" ? "bg-green-500/10" :
        intervention.status === "overdue" ? "bg-red-500/10" : "bg-blue-500/10"
      }`}>
        <StatusIcon className={`h-4 w-4 ${
          intervention.status === "completed" ? "text-green-500" :
          intervention.status === "overdue" ? "text-red-500" : "text-blue-500"
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{intervention.description}</p>
        <p className="text-sm text-muted-foreground">{intervention.frequency}</p>
        {intervention.lastPerformed && (
          <p className="text-xs text-muted-foreground mt-1">
            Last performed: {new Date(intervention.lastPerformed).toLocaleDateString()}
          </p>
        )}
      </div>
      {intervention.status === "scheduled" || intervention.status === "in_progress" ? (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => updateInterventionMutation.mutate({ 
            status: "completed", 
            lastPerformed: new Date().toISOString() 
          })}
          disabled={updateInterventionMutation.isPending}
          data-testid={`button-complete-intervention-${intervention.id}`}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Complete
        </Button>
      ) : (
        <Badge className={goalStatusColors[intervention.status]}>
          {intervention.status}
        </Badge>
      )}
    </div>
  );
}

function CareTeamCard({ member }: { member: CareTeamMember }) {
  return (
    <Card data-testid={`care-team-member-${member.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium">{member.name}</h4>
              {member.isPrimary && (
                <Badge variant="default" className="text-xs">Primary</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{roleLabels[member.role]}</p>
            {member.specialty && (
              <p className="text-sm text-muted-foreground">{member.specialty}</p>
            )}
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              {member.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {member.phone}
                </span>
              )}
              {member.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {member.email}
                </span>
              )}
              {member.organization && (
                <span className="flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {member.organization}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressNote({ note }: { note: CarePlanProgress }) {
  const typeIcons: Record<string, typeof MessageSquare> = {
    progress_note: MessageSquare,
    goal_update: Target,
    intervention_completed: CheckCircle,
    status_change: Activity,
    care_team_note: Users,
  };
  const Icon = typeIcons[note.type] || MessageSquare;

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <div className="p-2 rounded-full bg-muted h-fit">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm">{note.note}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{new Date(note.date).toLocaleString()}</span>
          <span>by {note.recordedBy}</span>
        </div>
      </div>
    </div>
  );
}

function CarePlanDetail({ plan }: { plan: CarePlan }) {
  const [activeTab, setActiveTab] = useState("goals");
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressNote, setProgressNote] = useState("");
  const [progressType, setProgressType] = useState<string>("progress_note");
  const { toast } = useToast();

  const addProgressMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/care-plans/${plan.id}/progress`, {
        note: progressNote,
        type: progressType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans"] });
      toast({ title: "Progress added", description: "Your note has been saved." });
      setProgressDialogOpen(false);
      setProgressNote("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add progress note.", variant: "destructive" });
    },
  });

  const activeGoals = plan.goals.filter(g => g.status === "in_progress" || g.status === "not_started");
  const completedGoals = plan.goals.filter(g => g.status === "achieved");
  const overallProgress = plan.goals.length > 0 
    ? Math.round(plan.goals.reduce((sum, g) => sum + g.progress, 0) / plan.goals.length)
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                {plan.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {plan.description || categoryLabels[plan.category]}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[plan.status]}>
                {plan.status.replace("_", " ")}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setProgressDialogOpen(true)}
                data-testid="button-add-progress"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Progress
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-primary">{overallProgress}%</div>
              <div className="text-sm text-muted-foreground">Overall Progress</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{activeGoals.length}</div>
              <div className="text-sm text-muted-foreground">Active Goals</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-green-500">{completedGoals.length}</div>
              <div className="text-sm text-muted-foreground">Achieved</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{plan.careTeam.length}</div>
              <div className="text-sm text-muted-foreground">Care Team</div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Started: {new Date(plan.startDate).toLocaleDateString()}
            </span>
            {plan.reviewDate && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Next Review: {new Date(plan.reviewDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="goals" data-testid="tab-goals">
            <Target className="h-4 w-4 mr-2" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="interventions" data-testid="tab-interventions">
            <Activity className="h-4 w-4 mr-2" />
            Interventions
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">
            <Users className="h-4 w-4 mr-2" />
            Care Team
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            <FileText className="h-4 w-4 mr-2" />
            Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-4">
          {plan.goals.length === 0 ? (
            <Card className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Goals Set</h3>
              <p className="text-muted-foreground">
                Your care team will add treatment goals here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {plan.goals.map(goal => (
                <GoalCard 
                  key={goal.id} 
                  goal={goal} 
                  carePlanId={plan.id}
                  onUpdateProgress={() => {}}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interventions" className="space-y-4">
          {plan.interventions.length === 0 ? (
            <Card className="p-8 text-center">
              <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Interventions</h3>
              <p className="text-muted-foreground">
                Your care team will add treatment interventions here.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {plan.interventions.map(intervention => (
                <InterventionCard 
                  key={intervention.id} 
                  intervention={intervention} 
                  carePlanId={plan.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {plan.careTeam.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Care Team</h3>
              <p className="text-muted-foreground">
                Your care team members will appear here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {plan.careTeam.map(member => (
                <CareTeamCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Progress History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plan.progressNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No progress notes yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {[...plan.progressNotes]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(note => (
                        <ProgressNote key={note.id} note={note} />
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Progress Note</DialogTitle>
            <DialogDescription>
              Record your progress or observations for this care plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="progress-type">Note Type</Label>
              <Select value={progressType} onValueChange={setProgressType}>
                <SelectTrigger data-testid="select-progress-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="progress_note">Progress Note</SelectItem>
                  <SelectItem value="goal_update">Goal Update</SelectItem>
                  <SelectItem value="intervention_completed">Intervention Completed</SelectItem>
                  <SelectItem value="status_change">Status Change</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="progress-note">Note</Label>
              <Textarea
                id="progress-note"
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                placeholder="Describe your progress..."
                rows={4}
                data-testid="textarea-progress-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => addProgressMutation.mutate()}
              disabled={!progressNote.trim() || addProgressMutation.isPending}
              data-testid="button-save-progress"
            >
              Save Progress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CarePlansPage() {
  useSEO({ title: "My Care Plans | Tabula Medica", description: "View and track your personalized care plans" });
  
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: carePlans, isLoading } = useQuery<CarePlan[]>({
    queryKey: ["/api/care-plans"],
  });

  const activePlans = carePlans?.filter(p => p.status === "active") || [];
  const otherPlans = carePlans?.filter(p => p.status !== "active") || [];
  const selectedPlan = carePlans?.find(p => p.id === selectedPlanId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedPlan) {
    return (
      <div className="container mx-auto p-6">
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => setSelectedPlanId(null)}
          data-testid="button-back-to-plans"
        >
          <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
          Back to Care Plans
        </Button>
        <CarePlanDetail plan={selectedPlan} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-care-plans">
            <ClipboardList className="h-6 w-6 text-primary" />
            My Care Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your personalized treatment plans and health goals
          </p>
        </div>
      </div>

      {(!carePlans || carePlans.length === 0) ? (
        <Card className="p-12 text-center">
          <ClipboardList className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Care Plans Yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your healthcare providers will create personalized care plans for you here. 
            These plans help coordinate your treatment goals and track your progress.
          </p>
        </Card>
      ) : (
        <>
          {activePlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Active Care Plans
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activePlans.map(plan => {
                  const overallProgress = plan.goals.length > 0 
                    ? Math.round(plan.goals.reduce((sum, g) => sum + g.progress, 0) / plan.goals.length)
                    : 0;
                  
                  return (
                    <Card 
                      key={plan.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedPlanId(plan.id)}
                      data-testid={`care-plan-card-${plan.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{plan.title}</CardTitle>
                          <Badge className={statusColors[plan.status]}>Active</Badge>
                        </div>
                        <CardDescription>{categoryLabels[plan.category]}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Overall Progress</span>
                              <span className="font-medium">{overallProgress}%</span>
                            </div>
                            <Progress value={overallProgress} className="h-2" />
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {plan.goals.filter(g => g.status === "in_progress").length} active goals
                            </span>
                            <span className="flex items-center gap-1 text-primary">
                              View Details <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {otherPlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                Other Care Plans
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {otherPlans.map(plan => (
                  <Card 
                    key={plan.id} 
                    className="cursor-pointer hover-elevate opacity-75"
                    onClick={() => setSelectedPlanId(plan.id)}
                    data-testid={`care-plan-card-${plan.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{plan.title}</CardTitle>
                        <Badge className={statusColors[plan.status]}>
                          {plan.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <CardDescription>{categoryLabels[plan.category]}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-care-plans-disclaimer" />
    </div>
  );
}