import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, TrendingUp, TrendingDown, Minus, CheckCircle, AlertCircle, Clock, Loader2, Activity, Heart, Scale, Footprints, Droplet, Moon, Pill } from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { clickable } from "@/lib/a11y";

interface HealthGoal {
  id: string;
  profileId: string;
  goalType: string;
  title: string;
  description?: string;
  targetValue: string;
  targetUnit: string;
  baselineValue?: string;
  currentValue?: string;
  startDate: string;
  targetDate?: string;
  status: string;
  priority: number;
  reminderFrequency?: string;
  notes?: string;
}

interface GoalProgress {
  id: string;
  goalId: string;
  recordedOn: string;
  value: string;
  notes?: string;
  source: string;
}

const goalTypeIcons: Record<string, typeof Target> = {
  weight_loss: Scale,
  weight_gain: Scale,
  exercise_frequency: Activity,
  blood_pressure: Heart,
  blood_glucose: Droplet,
  heart_rate: Heart,
  steps: Footprints,
  sleep_hours: Moon,
  water_intake: Droplet,
  medication_adherence: Pill,
  custom: Target,
};

const goalTypeLabels: Record<string, string> = {
  weight_loss: "Weight Loss",
  weight_gain: "Weight Gain",
  exercise_frequency: "Exercise Frequency",
  blood_pressure: "Blood Pressure",
  blood_glucose: "Blood Glucose",
  heart_rate: "Heart Rate",
  steps: "Daily Steps",
  sleep_hours: "Sleep Hours",
  water_intake: "Water Intake",
  medication_adherence: "Medication Adherence",
  custom: "Custom Goal",
};

const createGoalSchema = z.object({
  goalType: z.string().min(1, "Select a goal type"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  targetValue: z.string().min(1, "Target value is required"),
  targetUnit: z.string().min(1, "Unit is required"),
  baselineValue: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  targetDate: z.string().optional(),
  priority: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

const progressSchema = z.object({
  value: z.string().min(1, "Value is required"),
  notes: z.string().optional(),
});

interface HealthGoalsCardProps {
  userId: string;
}

export function HealthGoalsCard({ userId }: HealthGoalsCardProps) {
  const { toast } = useToast();
  const [selectedGoal, setSelectedGoal] = useState<HealthGoal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  const { data: goalsData, isLoading } = useQuery<{ success: boolean; goals: HealthGoal[]; noCdsDisclaimer: string }>({
    queryKey: ["/api/health-tracking/goals", { profileId: userId, status: activeTab === "active" ? "active" : undefined }],
  });

  const { data: progressData } = useQuery<{ success: boolean; goal: HealthGoal; progress: GoalProgress[] }>({
    queryKey: ["/api/health-tracking/goals", selectedGoal?.id, "progress"],
    enabled: !!selectedGoal,
  });

  const createGoalForm = useForm<z.infer<typeof createGoalSchema>>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      goalType: "",
      title: "",
      description: "",
      targetValue: "",
      targetUnit: "",
      baselineValue: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      targetDate: "",
      priority: 3,
      notes: "",
    },
  });

  const progressForm = useForm<z.infer<typeof progressSchema>>({
    resolver: zodResolver(progressSchema),
    defaultValues: {
      value: "",
      notes: "",
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createGoalSchema>) => {
      return apiRequest("POST", "/api/health-tracking/goals", { ...data, profileId: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/goals"] });
      toast({ title: "Goal created", description: "Your health goal has been created successfully." });
      setShowCreateDialog(false);
      createGoalForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create goal", variant: "destructive" });
    },
  });

  const addProgressMutation = useMutation({
    mutationFn: async (data: z.infer<typeof progressSchema>) => {
      return apiRequest("POST", `/api/health-tracking/goals/${selectedGoal?.id}/progress`, { ...data, recordedOn: format(new Date(), "yyyy-MM-dd") });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/goals"] });
      toast({ title: "Progress logged", description: "Your progress has been recorded." });
      setShowProgressDialog(false);
      progressForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log progress", variant: "destructive" });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ goalId, status }: { goalId: string; status: string }) => {
      return apiRequest("PATCH", `/api/health-tracking/goals/${goalId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/goals"] });
      toast({ title: "Goal updated", description: "Goal status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update goal", variant: "destructive" });
    },
  });

  const calculateProgress = (goal: HealthGoal): number => {
    if (!goal.baselineValue || !goal.targetValue || !goal.currentValue) return 0;
    const baseline = parseFloat(goal.baselineValue);
    const target = parseFloat(goal.targetValue);
    const current = parseFloat(goal.currentValue);
    if (target === baseline) return 0;
    return Math.min(100, Math.max(0, ((current - baseline) / (target - baseline)) * 100));
  };

  const getTrend = (progress: GoalProgress[]): "up" | "down" | "stable" => {
    if (progress.length < 2) return "stable";
    const recent = parseFloat(progress[0].value);
    const previous = parseFloat(progress[1].value);
    if (recent > previous) return "up";
    if (recent < previous) return "down";
    return "stable";
  };

  const goals = goalsData?.goals || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Health Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Health Goals
          </CardTitle>
          <CardDescription>Track your personalized health goals and progress</CardDescription>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-goal">
              <Plus className="h-4 w-4 mr-1" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Health Goal</DialogTitle>
              <DialogDescription>Set a new personalized health goal to track your progress.</DialogDescription>
            </DialogHeader>
            <Form {...createGoalForm}>
              <form onSubmit={createGoalForm.handleSubmit((data) => createGoalMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={createGoalForm.control}
                  name="goalType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-goal-type">
                            <SelectValue placeholder="Select goal type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(goalTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createGoalForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Lose 10 pounds by summer" {...field} data-testid="input-goal-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createGoalForm.control}
                    name="targetValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Value</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 150" {...field} data-testid="input-target-value" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createGoalForm.control}
                    name="targetUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., lbs, steps/day" {...field} data-testid="input-target-unit" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createGoalForm.control}
                  name="baselineValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting Value (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 160" {...field} data-testid="input-baseline-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createGoalForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createGoalForm.control}
                    name="targetDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date (optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-target-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createGoalForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional notes..." {...field} data-testid="input-goal-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createGoalMutation.isPending} data-testid="button-create-goal">
                    {createGoalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Goal
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" data-testid="tab-active-goals">Active</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-goals">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {goals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No health goals yet</p>
                <p className="text-sm">Create your first goal to start tracking your progress</p>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => {
                  const Icon = goalTypeIcons[goal.goalType] || Target;
                  const progress = calculateProgress(goal);

                  return (
                    <div
                      key={goal.id}
                      className="p-4 border rounded-lg hover-elevate cursor-pointer"
                      {...clickable(() => setSelectedGoal(goal))}
                      data-testid={`goal-card-${goal.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 rounded-full bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium truncate">{goal.title}</h4>
                              <Badge variant={goal.status === "active" ? "default" : "secondary"}>
                                {goal.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Target: {goal.targetValue} {goal.targetUnit}
                              {goal.currentValue && ` • Current: ${goal.currentValue} ${goal.targetUnit}`}
                            </p>
                            {goal.targetDate && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Due: {format(new Date(goal.targetDate), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">{Math.round(progress)}%</div>
                          <Progress value={progress} className="w-20 h-2" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {goalsData?.noCdsDisclaimer && (
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            {goalsData.noCdsDisclaimer}
          </p>
        )}

        <Dialog open={!!selectedGoal && !showProgressDialog} onOpenChange={(open) => !open && setSelectedGoal(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedGoal && goalTypeIcons[selectedGoal.goalType] && (
                  (() => {
                    const Icon = goalTypeIcons[selectedGoal.goalType];
                    return <Icon className="h-5 w-5" />;
                  })()
                )}
                {selectedGoal?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedGoal?.description || goalTypeLabels[selectedGoal?.goalType || ""]}
              </DialogDescription>
            </DialogHeader>

            {selectedGoal && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Baseline</p>
                    <p className="text-lg font-semibold">{selectedGoal.baselineValue || "-"} {selectedGoal.targetUnit}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Current</p>
                    <p className="text-lg font-semibold">{selectedGoal.currentValue || "-"} {selectedGoal.targetUnit}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Target</p>
                    <p className="text-lg font-semibold text-primary">{selectedGoal.targetValue} {selectedGoal.targetUnit}</p>
                  </div>
                </div>

                <div>
                  <Progress value={calculateProgress(selectedGoal)} className="h-3" />
                  <p className="text-sm text-muted-foreground mt-1 text-center">
                    {Math.round(calculateProgress(selectedGoal))}% complete
                  </p>
                </div>

                {progressData?.progress && progressData.progress.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[...progressData.progress].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="recordedOn" tickFormatter={(d) => format(new Date(d), "M/d")} />
                        <YAxis />
                        <Tooltip labelFormatter={(d) => format(new Date(d), "MMM d, yyyy")} />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  {selectedGoal.status === "active" && (
                    <>
                      <Button variant="outline" onClick={() => setShowProgressDialog(true)} data-testid="button-log-progress">
                        <Plus className="h-4 w-4 mr-1" />
                        Log Progress
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => updateGoalMutation.mutate({ goalId: selectedGoal.id, status: "completed" })}
                        data-testid="button-complete-goal"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark Complete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Progress</DialogTitle>
              <DialogDescription>Record your current value for {selectedGoal?.title}</DialogDescription>
            </DialogHeader>
            <Form {...progressForm}>
              <form onSubmit={progressForm.handleSubmit((data) => addProgressMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={progressForm.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Value ({selectedGoal?.targetUnit})</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder={`e.g., ${selectedGoal?.targetValue}`} {...field} data-testid="input-progress-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={progressForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="How are you feeling?" {...field} data-testid="input-progress-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={addProgressMutation.isPending} data-testid="button-save-progress">
                    {addProgressMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Progress
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
