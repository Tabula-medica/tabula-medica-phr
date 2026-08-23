import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Target, 
  ClipboardList, 
  Pill, 
  Clock, 
  Users, 
  Heart, 
  Trophy, 
  Medal,
  Star,
  Flame,
  Plus,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  AlertTriangle,
  Phone,
  Shield,
  Award,
  Zap,
  Droplet,
  Brain,
  Moon,
  Footprints,
  ChevronRight
} from "lucide-react";

export default function PatientFeaturesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showSymptomDialog, setShowSymptomDialog] = useState(false);
  const [showMedicationDialog, setShowMedicationDialog] = useState(false);
  const [showTimelineDialog, setShowTimelineDialog] = useState(false);
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);

  const { data: dashboardData } = useQuery<any>({
    queryKey: ["/api/patient-features/dashboard-summary"],
  });

  const { data: goalsData } = useQuery<any>({
    queryKey: ["/api/patient-features/goals"],
  });

  const { data: symptomsData } = useQuery<any>({
    queryKey: ["/api/patient-features/symptoms"],
  });

  const { data: patternsData } = useQuery<any>({
    queryKey: ["/api/patient-features/symptoms/patterns"],
  });

  const { data: medicationsData } = useQuery<any>({
    queryKey: ["/api/patient-features/medications/reminders"],
  });

  const { data: timelineData } = useQuery<any>({
    queryKey: ["/api/patient-features/timeline"],
  });

  const { data: familyData } = useQuery<any>({
    queryKey: ["/api/patient-features/family-history"],
  });

  const { data: risksData } = useQuery<any>({
    queryKey: ["/api/patient-features/family-history/risks"],
  });

  const { data: emergencyCardData } = useQuery<any>({
    queryKey: ["/api/patient-features/emergency-card"],
  });

  const { data: challengesData } = useQuery<any>({
    queryKey: ["/api/patient-features/challenges"],
  });

  const { data: myChallengesData } = useQuery<any>({
    queryKey: ["/api/patient-features/challenges/my-progress"],
  });

  const { data: leaderboardData } = useQuery<any>({
    queryKey: ["/api/patient-features/leaderboard"],
  });

  const { data: badgesData } = useQuery<any>({
    queryKey: ["/api/patient-features/badges"],
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/patient-features/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/dashboard-summary"] });
      setShowGoalDialog(false);
      toast({ title: "Goal created successfully!" });
    },
  });

  const logSymptomMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/patient-features/symptoms", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/symptoms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/symptoms/patterns"] });
      setShowSymptomDialog(false);
      toast({ title: "Symptoms logged successfully!" });
    },
  });

  const createMedicationMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/patient-features/medications/reminders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/medications/reminders"] });
      setShowMedicationDialog(false);
      toast({ title: "Medication reminder created!" });
    },
  });

  const addTimelineEventMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/patient-features/timeline", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/timeline"] });
      setShowTimelineDialog(false);
      toast({ title: "Timeline event added!" });
    },
  });

  const addFamilyMemberMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/patient-features/family-history", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/family-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/family-history/risks"] });
      setShowFamilyDialog(false);
      toast({ title: "Family member added!" });
    },
  });

  const joinChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => apiRequest("POST", `/api/patient-features/challenges/${challengeId}/join`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-features/challenges/my-progress"] });
      toast({ title: "Joined challenge successfully!" });
    },
  });

  const summary = dashboardData?.data;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "medication": return <Pill className="h-4 w-4" />;
      case "exercise": case "steps": return <Footprints className="h-4 w-4" />;
      case "nutrition": return <Heart className="h-4 w-4" />;
      case "sleep": return <Moon className="h-4 w-4" />;
      case "mental_health": return <Brain className="h-4 w-4" />;
      case "hydration": return <Droplet className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "medium": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "hard": return "bg-red-500/10 text-red-600 dark:text-red-400";
      default: return "bg-muted";
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "border-gray-400";
      case "uncommon": return "border-green-500";
      case "rare": return "border-blue-500";
      case "epic": return "border-purple-500";
      case "legendary": return "border-yellow-500";
      default: return "border-muted";
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">My Health Hub</h1>
          <p className="text-muted-foreground">Track, manage, and improve your health journey</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 gap-1">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
          <TabsTrigger value="symptoms" data-testid="tab-symptoms">Symptoms</TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          <TabsTrigger value="family" data-testid="tab-family">Family</TabsTrigger>
          <TabsTrigger value="emergency" data-testid="tab-emergency">Emergency</TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges">Challenges</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("goals")}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Health Goals</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.goals?.active || 0}</div>
                <p className="text-xs text-muted-foreground">{summary?.goals?.completed || 0} completed</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("symptoms")}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Symptom Logs</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.symptoms?.totalEntries || 0}</div>
                <p className="text-xs text-muted-foreground">Total entries</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("medications")}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Medication Adherence</CardTitle>
                <Pill className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.medications?.avgAdherence || 0}%</div>
                <p className="text-xs text-muted-foreground">{summary?.medications?.activeReminders || 0} active</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("challenges")}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Challenges</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.challenges?.active || 0}</div>
                <p className="text-xs text-muted-foreground">{summary?.badges?.earned || 0} badges earned</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Health Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">
                  {summary?.timeline?.totalEvents || 0} events recorded
                </p>
                <p className="text-sm">{summary?.timeline?.milestones || 0} milestones</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("timeline")} data-testid="button-view-timeline">
                  View Timeline <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Family Health History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">
                  {summary?.familyHistory?.membersDocumented || 0} family members documented
                </p>
                <p className="text-sm">{summary?.familyHistory?.conditionsTracked || 0} conditions tracked</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("family")} data-testid="button-view-family">
                  View History <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Emergency Health Card
              </CardTitle>
              <CardDescription>Quick access to critical health information</CardDescription>
            </CardHeader>
            <CardContent>
              {summary?.emergencyCard?.isComplete ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span>Emergency card complete</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Emergency card incomplete</span>
                </div>
              )}
              <Button variant="outline" className="mt-4" onClick={() => setActiveTab("emergency")} data-testid="button-view-emergency">
                {summary?.emergencyCard?.isComplete ? "View Card" : "Complete Card"} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Personal Health Goals</h2>
            <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-goal"><Plus className="h-4 w-4 mr-2" /> Add Goal</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Health Goal</DialogTitle>
                  <DialogDescription>Set a new health goal to track your progress</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createGoalMutation.mutate({
                    title: formData.get("title"),
                    description: formData.get("description"),
                    category: formData.get("category"),
                    targetValue: Number(formData.get("targetValue")),
                    unit: formData.get("unit"),
                    frequency: formData.get("frequency"),
                    targetDate: formData.get("targetDate"),
                    reminders: formData.get("reminders") === "on",
                  });
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Goal Title</Label>
                    <Input id="title" name="title" placeholder="e.g., Walk 10,000 steps daily" required data-testid="input-goal-title" />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" placeholder="Describe your goal..." data-testid="input-goal-description" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select name="category" defaultValue="exercise">
                        <SelectTrigger data-testid="select-goal-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medication">Medication</SelectItem>
                          <SelectItem value="exercise">Exercise</SelectItem>
                          <SelectItem value="nutrition">Nutrition</SelectItem>
                          <SelectItem value="sleep">Sleep</SelectItem>
                          <SelectItem value="mental_health">Mental Health</SelectItem>
                          <SelectItem value="vitals">Vitals</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select name="frequency" defaultValue="daily">
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="targetValue">Target Value</Label>
                      <Input id="targetValue" name="targetValue" type="number" placeholder="10000" required data-testid="input-goal-target" />
                    </div>
                    <div>
                      <Label htmlFor="unit">Unit</Label>
                      <Input id="unit" name="unit" placeholder="steps" required data-testid="input-goal-unit" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="targetDate">Target Date</Label>
                    <Input id="targetDate" name="targetDate" type="date" required data-testid="input-goal-date" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="reminders" name="reminders" />
                    <Label htmlFor="reminders">Enable reminders</Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={createGoalMutation.isPending} data-testid="button-submit-goal">
                    {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {goalsData?.data?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No health goals yet. Create your first goal to start tracking!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {goalsData?.data?.map((goal: any) => (
                <Card key={goal.id} data-testid={`card-goal-${goal.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div>
                      <CardTitle className="text-lg">{goal.title}</CardTitle>
                      <CardDescription>{goal.description}</CardDescription>
                    </div>
                    <Badge variant={goal.status === "completed" ? "default" : "secondary"}>
                      {goal.status}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(goal.category)}
                      <span className="text-sm capitalize">{goal.category.replace("_", " ")}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-sm">{goal.frequency}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                        <span>{Math.round((goal.currentValue / goal.targetValue) * 100)}%</span>
                      </div>
                      <Progress value={(goal.currentValue / goal.targetValue) * 100} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {goal.milestones?.map((m: any) => (
                        <Badge key={m.id} variant={m.reached ? "default" : "outline"} className="text-xs">
                          {m.percentage}% {m.reached && <Check className="h-3 w-3 ml-1" />}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="symptoms" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Symptom Journal</h2>
            <Dialog open={showSymptomDialog} onOpenChange={setShowSymptomDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-log-symptom"><Plus className="h-4 w-4 mr-2" /> Log Symptoms</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Log Today's Symptoms</DialogTitle>
                  <DialogDescription>Track your symptoms for pattern analysis</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  logSymptomMutation.mutate({
                    symptoms: [{
                      name: formData.get("symptomName"),
                      severity: Number(formData.get("severity")),
                      duration: formData.get("duration"),
                      frequency: formData.get("symptomFrequency"),
                    }],
                    mood: Number(formData.get("mood")),
                    energyLevel: Number(formData.get("energy")),
                    sleepQuality: Number(formData.get("sleep")),
                    notes: formData.get("notes"),
                    triggers: (formData.get("triggers") as string)?.split(",").map(t => t.trim()).filter(Boolean),
                  });
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="symptomName">Symptom</Label>
                    <Input id="symptomName" name="symptomName" placeholder="e.g., Headache" required data-testid="input-symptom-name" />
                  </div>
                  <div>
                    <Label htmlFor="patient-features-severity-1-10">Severity (1-10)</Label>
                    <Input id="patient-features-severity-1-10" name="severity" type="number" min="1" max="10" defaultValue="5" required data-testid="input-symptom-severity" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="duration">Duration</Label>
                      <Input id="duration" name="duration" placeholder="e.g., 2 hours" data-testid="input-symptom-duration" />
                    </div>
                    <div>
                      <Label htmlFor="symptomFrequency">Frequency</Label>
                      <Input id="symptomFrequency" name="symptomFrequency" placeholder="e.g., daily" data-testid="input-symptom-frequency" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="patient-features-mood-1-10">Mood (1-10)</Label>
                      <Input id="patient-features-mood-1-10" name="mood" type="number" min="1" max="10" defaultValue="5" data-testid="input-mood" />
                    </div>
                    <div>
                      <Label htmlFor="patient-features-energy-1-10">Energy (1-10)</Label>
                      <Input id="patient-features-energy-1-10" name="energy" type="number" min="1" max="10" defaultValue="5" data-testid="input-energy" />
                    </div>
                    <div>
                      <Label htmlFor="patient-features-sleep-1-10">Sleep (1-10)</Label>
                      <Input id="patient-features-sleep-1-10" name="sleep" type="number" min="1" max="10" defaultValue="5" data-testid="input-sleep" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="triggers">Possible Triggers (comma-separated)</Label>
                    <Input id="triggers" name="triggers" placeholder="e.g., stress, weather, food" data-testid="input-triggers" />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" placeholder="Additional notes..." data-testid="input-notes" />
                  </div>
                  <Button type="submit" className="w-full" disabled={logSymptomMutation.isPending} data-testid="button-submit-symptom">
                    {logSymptomMutation.isPending ? "Logging..." : "Log Symptoms"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {patternsData?.data?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pattern Analysis</CardTitle>
                <CardDescription>AI-detected patterns in your symptom data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {patternsData.data.map((pattern: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{pattern.symptom}</p>
                        <p className="text-sm text-muted-foreground">
                          Avg severity: {pattern.avgSeverity}/10 | Frequency: {pattern.frequency}x
                        </p>
                        {pattern.commonTriggers.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {pattern.commonTriggers.map((t: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {pattern.trend === "improving" && <TrendingDown className="h-5 w-5 text-green-500" />}
                        {pattern.trend === "stable" && <Minus className="h-5 w-5 text-yellow-500" />}
                        {pattern.trend === "worsening" && <TrendingUp className="h-5 w-5 text-red-500" />}
                        <span className="text-sm capitalize">{pattern.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">{patternsData.disclaimer}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {symptomsData?.data?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No symptom entries yet. Start logging to track patterns.</p>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {symptomsData?.data?.map((entry: any) => (
                      <div key={entry.id} className="p-3 rounded-lg border" data-testid={`card-symptom-${entry.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{new Date(entry.date).toLocaleDateString()}</span>
                          <div className="flex gap-2">
                            <Badge variant="outline">Mood: {entry.mood}/10</Badge>
                            <Badge variant="outline">Energy: {entry.energyLevel}/10</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {entry.symptoms.map((s: any, i: number) => (
                            <Badge key={i}>{s.name} ({s.severity}/10)</Badge>
                          ))}
                        </div>
                        {entry.notes && <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Medication Reminders</h2>
            <Dialog open={showMedicationDialog} onOpenChange={setShowMedicationDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-medication"><Plus className="h-4 w-4 mr-2" /> Add Medication</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Medication Reminder</DialogTitle>
                  <DialogDescription>Set up reminders for your medications</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createMedicationMutation.mutate({
                    medicationName: formData.get("medicationName"),
                    dosage: formData.get("dosage"),
                    frequency: formData.get("frequency"),
                    times: [(formData.get("time") as string)],
                    pillCount: Number(formData.get("pillCount")) || undefined,
                    pillsPerDose: Number(formData.get("pillsPerDose")) || 1,
                    pharmacy: formData.get("pharmacy"),
                    instructions: formData.get("instructions"),
                    refillReminder: formData.get("refillReminder") === "on",
                  });
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="medicationName">Medication Name</Label>
                    <Input id="medicationName" name="medicationName" placeholder="e.g., Lisinopril" required data-testid="input-med-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dosage">Dosage</Label>
                      <Input id="dosage" name="dosage" placeholder="e.g., 10mg" required data-testid="input-med-dosage" />
                    </div>
                    <div>
                      <Label htmlFor="frequency">Frequency</Label>
                      <Select name="frequency" defaultValue="once_daily">
                        <SelectTrigger data-testid="select-med-frequency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once_daily">Once Daily</SelectItem>
                          <SelectItem value="twice_daily">Twice Daily</SelectItem>
                          <SelectItem value="three_times">Three Times</SelectItem>
                          <SelectItem value="four_times">Four Times</SelectItem>
                          <SelectItem value="as_needed">As Needed</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="time">Reminder Time</Label>
                    <Input id="time" name="time" type="time" defaultValue="08:00" data-testid="input-med-time" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pillCount">Pills Remaining</Label>
                      <Input id="pillCount" name="pillCount" type="number" placeholder="30" data-testid="input-pill-count" />
                    </div>
                    <div>
                      <Label htmlFor="pillsPerDose">Pills per Dose</Label>
                      <Input id="pillsPerDose" name="pillsPerDose" type="number" defaultValue="1" data-testid="input-pills-per-dose" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pharmacy">Pharmacy</Label>
                    <Input id="pharmacy" name="pharmacy" placeholder="e.g., CVS Main Street" data-testid="input-pharmacy" />
                  </div>
                  <div>
                    <Label htmlFor="instructions">Instructions</Label>
                    <Textarea id="instructions" name="instructions" placeholder="e.g., Take with food" data-testid="input-med-instructions" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="refillReminder" name="refillReminder" />
                    <Label htmlFor="refillReminder">Enable refill reminders</Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMedicationMutation.isPending} data-testid="button-submit-medication">
                    {createMedicationMutation.isPending ? "Adding..." : "Add Medication"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {medicationsData?.data?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Pill className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No medication reminders set. Add your medications to track adherence.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {medicationsData?.data?.map((med: any) => (
                <Card key={med.id} data-testid={`card-medication-${med.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div>
                      <CardTitle className="text-lg">{med.medicationName}</CardTitle>
                      <CardDescription>{med.dosage} - {med.frequency.replace("_", " ")}</CardDescription>
                    </div>
                    <Badge variant={med.adherenceRate >= 80 ? "default" : "destructive"}>
                      {med.adherenceRate}% adherence
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {med.times.map((t: string, i: number) => (
                        <Badge key={i} variant="outline">{t}</Badge>
                      ))}
                    </div>
                    {med.pillCount !== undefined && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Pills remaining:</span> {med.pillCount}
                        {med.pillCount <= 7 && (
                          <Badge variant="destructive" className="ml-2">Refill soon</Badge>
                        )}
                      </p>
                    )}
                    {med.instructions && (
                      <p className="text-sm text-muted-foreground">{med.instructions}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Health Timeline</h2>
            <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-event"><Plus className="h-4 w-4 mr-2" /> Add Event</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Timeline Event</DialogTitle>
                  <DialogDescription>Record a health event or milestone</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  addTimelineEventMutation.mutate({
                    date: formData.get("date"),
                    eventType: formData.get("eventType"),
                    title: formData.get("title"),
                    description: formData.get("description"),
                    provider: formData.get("provider"),
                    isMilestone: formData.get("isMilestone") === "on",
                  });
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" name="date" type="date" required data-testid="input-event-date" />
                  </div>
                  <div>
                    <Label htmlFor="eventType">Event Type</Label>
                    <Select name="eventType" defaultValue="appointment">
                      <SelectTrigger data-testid="select-event-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diagnosis">Diagnosis</SelectItem>
                        <SelectItem value="procedure">Procedure</SelectItem>
                        <SelectItem value="medication">Medication Change</SelectItem>
                        <SelectItem value="lab_result">Lab Result</SelectItem>
                        <SelectItem value="vaccination">Vaccination</SelectItem>
                        <SelectItem value="hospitalization">Hospitalization</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="milestone">Milestone</SelectItem>
                        <SelectItem value="symptom_onset">Symptom Onset</SelectItem>
                        <SelectItem value="recovery">Recovery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" placeholder="e.g., Annual Physical" required data-testid="input-event-title" />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" placeholder="Details about the event..." data-testid="input-event-description" />
                  </div>
                  <div>
                    <Label htmlFor="provider">Provider/Location</Label>
                    <Input id="provider" name="provider" placeholder="e.g., Dr. Smith" data-testid="input-event-provider" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="isMilestone" name="isMilestone" />
                    <Label htmlFor="isMilestone">Mark as milestone</Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={addTimelineEventMutation.isPending} data-testid="button-submit-event">
                    {addTimelineEventMutation.isPending ? "Adding..." : "Add Event"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {timelineData?.data?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No timeline events yet. Start documenting your health journey.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4 pl-10">
                {timelineData?.data?.map((event: any) => (
                  <div key={event.id} className="relative" data-testid={`card-event-${event.id}`}>
                    <div className="absolute -left-10 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                      {event.isMilestone ? <Star className="h-4 w-4 text-primary" /> : <Calendar className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="capitalize">{event.eventType.replace("_", " ")}</Badge>
                            {event.isMilestone && <Badge>Milestone</Badge>}
                          </div>
                        </div>
                        <CardDescription>{new Date(event.date).toLocaleDateString()}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{event.description}</p>
                        {event.provider && (
                          <p className="text-sm text-muted-foreground mt-2">Provider: {event.provider}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="family" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Family Health History</h2>
            <Dialog open={showFamilyDialog} onOpenChange={setShowFamilyDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-family"><Plus className="h-4 w-4 mr-2" /> Add Family Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Family Member</DialogTitle>
                  <DialogDescription>Document family health history for risk assessment</DialogDescription>
                </DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const conditionName = formData.get("conditionName") as string;
                  addFamilyMemberMutation.mutate({
                    relationship: formData.get("relationship"),
                    name: formData.get("name"),
                    birthYear: Number(formData.get("birthYear")) || undefined,
                    isAlive: formData.get("isAlive") === "on",
                    conditions: conditionName ? [{
                      id: crypto.randomUUID(),
                      conditionName,
                      ageAtDiagnosis: Number(formData.get("ageAtDiagnosis")) || undefined,
                      isHereditary: formData.get("isHereditary") === "on",
                    }] : [],
                    notes: formData.get("notes"),
                  });
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="relationship">Relationship</Label>
                    <Select name="relationship" defaultValue="mother">
                      <SelectTrigger data-testid="select-relationship">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="grandparent">Grandparent</SelectItem>
                        <SelectItem value="aunt_uncle">Aunt/Uncle</SelectItem>
                        <SelectItem value="cousin">Cousin</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="name">Name (optional)</Label>
                    <Input id="name" name="name" placeholder="e.g., Mary" data-testid="input-family-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="birthYear">Birth Year</Label>
                      <Input id="birthYear" name="birthYear" type="number" placeholder="1950" data-testid="input-birth-year" />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch id="isAlive" name="isAlive" defaultChecked />
                      <Label htmlFor="isAlive">Living</Label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="conditionName">Known Condition</Label>
                    <Input id="conditionName" name="conditionName" placeholder="e.g., Type 2 Diabetes" data-testid="input-condition" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ageAtDiagnosis">Age at Diagnosis</Label>
                      <Input id="ageAtDiagnosis" name="ageAtDiagnosis" type="number" placeholder="55" data-testid="input-age-diagnosis" />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch id="isHereditary" name="isHereditary" />
                      <Label htmlFor="isHereditary">Hereditary</Label>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" placeholder="Additional information..." data-testid="input-family-notes" />
                  </div>
                  <Button type="submit" className="w-full" disabled={addFamilyMemberMutation.isPending} data-testid="button-submit-family">
                    {addFamilyMemberMutation.isPending ? "Adding..." : "Add Family Member"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {risksData?.data?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Assessment
                </CardTitle>
                <CardDescription>Based on your family health history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {risksData.data.map((risk: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{risk.condition}</p>
                        <p className="text-sm text-muted-foreground">{risk.affectedRelatives} affected relative(s)</p>
                      </div>
                      <Badge variant={
                        risk.riskLevel === "high" ? "destructive" :
                        risk.riskLevel === "moderate" ? "secondary" : "outline"
                      } className="capitalize">
                        {risk.riskLevel} risk
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">{risksData.disclaimer}</p>
              </CardContent>
            </Card>
          )}

          {familyData?.data?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">No family health history documented. Add family members to assess hereditary risks.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {familyData?.data?.map((member: any) => (
                <Card key={member.id} data-testid={`card-family-${member.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <div>
                      <CardTitle className="text-lg capitalize">{member.relationship.replace("_", "/")}</CardTitle>
                      {member.name && <CardDescription>{member.name}</CardDescription>}
                    </div>
                    <Badge variant={member.isAlive ? "default" : "secondary"}>
                      {member.isAlive ? "Living" : "Deceased"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {member.conditions.length > 0 ? (
                      <div className="space-y-2">
                        {member.conditions.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <Badge variant="outline">{c.conditionName}</Badge>
                            {c.ageAtDiagnosis && <span className="text-sm text-muted-foreground">Age {c.ageAtDiagnosis}</span>}
                            {c.isHereditary && <Badge variant="destructive" className="text-xs">Hereditary</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No conditions documented</p>
                    )}
                    {member.notes && <p className="text-sm text-muted-foreground mt-2">{member.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="emergency" className="space-y-4">
          <h2 className="text-xl font-semibold">Emergency Health Card</h2>
          <p className="text-muted-foreground">Quick access to critical health information for emergency responders</p>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Heart className="h-5 w-5" />
                Emergency Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {emergencyCardData?.data ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">{emergencyCardData.data.fullName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{new Date(emergencyCardData.data.dateOfBirth).toLocaleDateString()}</p>
                    </div>
                    {emergencyCardData.data.bloodType && (
                      <div>
                        <p className="text-sm text-muted-foreground">Blood Type</p>
                        <p className="font-medium">{emergencyCardData.data.bloodType}</p>
                      </div>
                    )}
                  </div>

                  {emergencyCardData.data.allergies?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Allergies</p>
                      <div className="flex gap-2 flex-wrap">
                        {emergencyCardData.data.allergies.map((a: string, i: number) => (
                          <Badge key={i} variant="destructive">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {emergencyCardData.data.currentMedications?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Current Medications</p>
                      <div className="space-y-1">
                        {emergencyCardData.data.currentMedications.map((m: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <Badge variant={m.critical ? "destructive" : "secondary"}>{m.name}</Badge>
                            <span className="text-sm">{m.dosage} - {m.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {emergencyCardData.data.conditions?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Medical Conditions</p>
                      <div className="flex gap-2 flex-wrap">
                        {emergencyCardData.data.conditions.map((c: string, i: number) => (
                          <Badge key={i} variant="outline">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {emergencyCardData.data.emergencyContacts?.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Emergency Contacts</p>
                      <div className="space-y-2">
                        {emergencyCardData.data.emergencyContacts.map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span className="font-medium">{c.name}</span>
                            <span className="text-muted-foreground">({c.relationship})</span>
                            <span>{c.phone}</span>
                            {c.isPrimary && <Badge variant="default">Primary</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {emergencyCardData.data.specialInstructions && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Special Instructions</p>
                      <p className="text-sm">{emergencyCardData.data.specialInstructions}</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    {emergencyCardData.data.dnrStatus !== undefined && (
                      <Badge variant={emergencyCardData.data.dnrStatus ? "destructive" : "secondary"}>
                        DNR: {emergencyCardData.data.dnrStatus ? "Yes" : "No"}
                      </Badge>
                    )}
                    {emergencyCardData.data.organDonor !== undefined && (
                      <Badge variant={emergencyCardData.data.organDonor ? "default" : "secondary"}>
                        Organ Donor: {emergencyCardData.data.organDonor ? "Yes" : "No"}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">Last updated: {new Date(emergencyCardData.data.lastUpdated).toLocaleString()}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No emergency card created yet. Set up your emergency health information.</p>
                  <Button data-testid="button-create-emergency-card">Create Emergency Card</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Active Challenges</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myChallengesData?.data?.filter((p: any) => p.status === "active").length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Badges Earned</CardTitle>
                <Medal className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{badgesData?.data?.totalEarned || 0} / {badgesData?.data?.totalAvailable || 8}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Leaderboard Rank</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">#{leaderboardData?.userRank || "-"}</div>
                <p className="text-xs text-muted-foreground">of {leaderboardData?.totalParticipants || 0} participants</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Available Challenges</h3>
              {challengesData?.data?.map((challenge: any) => (
                <Card key={challenge.id} className="hover-elevate" data-testid={`card-challenge-${challenge.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {getCategoryIcon(challenge.category)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{challenge.title}</CardTitle>
                        <CardDescription>{challenge.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Badge className={getDifficultyColor(challenge.difficulty)}>{challenge.difficulty}</Badge>
                      <Badge variant="outline">{challenge.duration} days</Badge>
                      <Badge variant="secondary">{challenge.pointsReward} pts</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{challenge.participants} participants</span>
                      <Button 
                        size="sm" 
                        onClick={() => joinChallengeMutation.mutate(challenge.id)}
                        disabled={joinChallengeMutation.isPending}
                        data-testid={`button-join-${challenge.id}`}
                      >
                        Join Challenge
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Leaderboard</h3>
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    {leaderboardData?.data?.map((entry: any) => (
                      <div 
                        key={entry.anonymousId} 
                        className={`flex items-center justify-between p-2 rounded-lg ${entry.isCurrentUser ? "bg-primary/10" : "hover:bg-muted/50"}`}
                        data-testid={`leaderboard-entry-${entry.rank}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-bold ${entry.rank <= 3 ? "text-primary" : ""}`}>
                            {entry.rank <= 3 ? (
                              <Trophy className={`h-4 w-4 ${entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-gray-400" : "text-amber-600"}`} />
                            ) : entry.rank}
                          </span>
                          <div>
                            <p className="font-medium">{entry.displayName}</p>
                            <p className="text-xs text-muted-foreground">{entry.challengesCompleted} challenges | {entry.currentStreak} day streak</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{entry.points.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <h3 className="text-lg font-semibold">My Progress</h3>
              {myChallengesData?.data?.filter((p: any) => p.status === "active").length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No active challenges. Join one to start earning points!</p>
                  </CardContent>
                </Card>
              ) : (
                myChallengesData?.data?.filter((p: any) => p.status === "active").map((progress: any) => (
                  <Card key={progress.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{progress.challenge?.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{progress.currentValue} / {progress.challenge?.targetValue} {progress.challenge?.unit}</span>
                          <span>{Math.round((progress.currentValue / (progress.challenge?.targetValue || 1)) * 100)}%</span>
                        </div>
                        <Progress value={(progress.currentValue / (progress.challenge?.targetValue || 1)) * 100} />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
