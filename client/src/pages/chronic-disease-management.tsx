import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  Loader2,
  Pill,
  Plus,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  X,
  ClipboardList,
  Dumbbell,
  Moon,
  Droplets,
  Brain,
  Utensils,
  Sparkles,
  ShieldAlert,
  GraduationCap,
} from "lucide-react";
import { format } from "date-fns";

const conditionOptions = [
  { value: "diabetes_type2", label: "Type 2 Diabetes" },
  { value: "diabetes_type1", label: "Type 1 Diabetes" },
  { value: "hypertension", label: "High Blood Pressure" },
  { value: "heart_failure", label: "Heart Failure" },
  { value: "copd", label: "COPD" },
  { value: "asthma", label: "Asthma" },
  { value: "chronic_kidney_disease", label: "Chronic Kidney Disease" },
  { value: "arthritis", label: "Arthritis" },
  { value: "obesity", label: "Obesity" },
  { value: "depression", label: "Depression" },
  { value: "anxiety", label: "Anxiety" },
  { value: "hypothyroidism", label: "Hypothyroidism" },
  { value: "other", label: "Other" },
];

const severityOptions = [
  { value: "none", label: "None", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
  { value: "mild", label: "Mild", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "moderate", label: "Moderate", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "severe", label: "Severe", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const lifestyleCategories = [
  { value: "exercise", label: "Exercise", icon: Dumbbell },
  { value: "diet", label: "Diet", icon: Utensils },
  { value: "sleep", label: "Sleep", icon: Moon },
  { value: "hydration", label: "Hydration", icon: Droplets },
  { value: "stress", label: "Stress", icon: Brain },
  { value: "other", label: "Other", icon: Activity },
];

export default function ChronicDiseaseManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [showLogSymptom, setShowLogSymptom] = useState(false);
  const [showLogAdherence, setShowLogAdherence] = useState(false);
  const [showLogLifestyle, setShowLogLifestyle] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const [newCondition, setNewCondition] = useState({ conditionType: "", conditionName: "", diagnosisDate: "", severity: "", notes: "" });
  const [newSymptom, setNewSymptom] = useState({ symptomName: "", severity: "mild", description: "", affectsDaily: false, duration: "", notes: "" });
  const [newAdherence, setNewAdherence] = useState({ medicationName: "", status: "taken", scheduledTime: "", notes: "" });
  const [newLifestyle, setNewLifestyle] = useState({ category: "exercise", description: "", value: "", duration: 0, notes: "" });

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<{
    conditions: any[];
    activePlans: any[];
    recentAlerts: any[];
    weeklyAdherenceRate: number;
    symptomTrend: string;
    nextGoals: any[];
    educationProgress: { completed: number; total: number };
  }>({
    queryKey: ["/api/chronic-disease/dashboard"],
  });

  const { data: symptoms } = useQuery<any[]>({
    queryKey: ["/api/chronic-disease/symptoms"],
  });

  const { data: adherence } = useQuery<any[]>({
    queryKey: ["/api/chronic-disease/adherence"],
  });

  const { data: lifestyle } = useQuery<any[]>({
    queryKey: ["/api/chronic-disease/lifestyle"],
  });

  const { data: alerts } = useQuery<any[]>({
    queryKey: ["/api/chronic-disease/alerts"],
  });

  const { data: education } = useQuery<any[]>({
    queryKey: ["/api/chronic-disease/education"],
  });

  const { data: planDetail, isLoading: planLoading } = useQuery<any>({
    queryKey: ["/api/chronic-disease/plans", selectedPlan],
    enabled: !!selectedPlan,
  });

  const addConditionMutation = useMutation({
    mutationFn: async (data: typeof newCondition) => {
      const res = await fetch("/api/chronic-disease/conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add condition");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/conditions"] });
      toast({ title: "Condition added successfully" });
      setShowAddCondition(false);
      setNewCondition({ conditionType: "", conditionName: "", diagnosisDate: "", severity: "", notes: "" });
    },
  });

  const generatePlanMutation = useMutation({
    mutationFn: async (conditionId: string) => {
      const res = await fetch("/api/chronic-disease/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditionId }),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      return res.json();
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/plans"] });
      toast({ title: "Management plan generated!", description: "Review and activate your personalized plan." });
      setSelectedPlan(plan.id);
      setActiveTab("plan");
    },
  });

  const logSymptomMutation = useMutation({
    mutationFn: async (data: typeof newSymptom) => {
      const res = await fetch("/api/chronic-disease/symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log symptom");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/symptoms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/alerts"] });
      toast({ title: "Symptom logged" });
      setShowLogSymptom(false);
      setNewSymptom({ symptomName: "", severity: "mild", description: "", affectsDaily: false, duration: "", notes: "" });
    },
  });

  const logAdherenceMutation = useMutation({
    mutationFn: async (data: typeof newAdherence) => {
      const res = await fetch("/api/chronic-disease/adherence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log adherence");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/adherence"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/dashboard"] });
      toast({ title: "Medication logged" });
      setShowLogAdherence(false);
      setNewAdherence({ medicationName: "", status: "taken", scheduledTime: "", notes: "" });
    },
  });

  const logLifestyleMutation = useMutation({
    mutationFn: async (data: typeof newLifestyle) => {
      const res = await fetch("/api/chronic-disease/lifestyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log lifestyle");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/lifestyle"] });
      toast({ title: "Lifestyle activity logged" });
      setShowLogLifestyle(false);
      setNewLifestyle({ category: "exercise", description: "", value: "", duration: 0, notes: "" });
    },
  });

  const dismissAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await fetch(`/api/chronic-disease/alerts/${alertId}/dismiss`, { method: "PATCH" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/dashboard"] });
    },
  });

  const activatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/chronic-disease/plans/${planId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/plans", selectedPlan] });
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/dashboard"] });
      toast({ title: "Plan activated!" });
    },
  });

  const generateProgressMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await fetch(`/api/chronic-disease/plans/${planId}/progress`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chronic-disease/plans", selectedPlan] });
      toast({ title: "Progress updated" });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="loading-state">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl" data-testid="chronic-disease-management-page">
      <header className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Chronic Disease Management</h1>
            <p className="text-muted-foreground">AI-powered tools to help you manage your health</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowLogSymptom(true)} variant="outline" size="sm" data-testid="button-log-symptom">
              <ClipboardList className="w-4 h-4 mr-2" /> Log Symptom
            </Button>
            <Button onClick={() => setShowLogAdherence(true)} variant="outline" size="sm" data-testid="button-log-medication">
              <Pill className="w-4 h-4 mr-2" /> Log Medication
            </Button>
            <Button onClick={() => setShowLogLifestyle(true)} variant="outline" size="sm" data-testid="button-log-lifestyle">
              <Activity className="w-4 h-4 mr-2" /> Log Activity
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl" data-testid="tabs-list">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="plan" data-testid="tab-plan">My Plan</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            Alerts
            {(alerts?.length || 0) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center" data-testid="badge-alert-count">
                {alerts?.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">Learn</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4" data-testid="tab-content-dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-adherence-rate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Weekly Adherence</CardTitle>
                <Pill className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.weeklyAdherenceRate || 0}%</div>
                <Progress value={dashboard?.weeklyAdherenceRate || 0} className="mt-2" data-testid="progress-adherence" />
              </CardContent>
            </Card>

            <Card data-testid="card-symptom-trend">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Symptom Trend</CardTitle>
                {dashboard?.symptomTrend === "good" ? (
                  <TrendingDown className="w-4 h-4 text-green-500" />
                ) : dashboard?.symptomTrend === "needs_attention" ? (
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                ) : (
                  <Minus className="w-4 h-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {dashboard?.symptomTrend === "good" ? "Improving" : dashboard?.symptomTrend === "needs_attention" ? "Needs Attention" : "Stable"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Based on last 7 days</p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-conditions">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Conditions</CardTitle>
                <Heart className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.conditions?.length || 0}</div>
                <Button variant="ghost" className="p-0 h-auto text-xs" onClick={() => setShowAddCondition(true)} data-testid="button-add-condition">
                  <Plus className="w-3 h-3 mr-1" /> Add condition
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-education-progress">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium">Education Progress</CardTitle>
                <GraduationCap className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.educationProgress?.completed || 0}/{dashboard?.educationProgress?.total || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Modules completed</p>
              </CardContent>
            </Card>
          </div>

          {(dashboard?.recentAlerts?.length || 0) > 0 && (
            <Card className="border-orange-200 dark:border-orange-800" data-testid="card-recent-alerts">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" /> Recent Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboard?.recentAlerts?.slice(0, 3).map((alert: any) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`alert-item-${alert.id}`}>
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${alert.priority === "urgent" ? "text-red-500" : alert.priority === "high" ? "text-orange-500" : "text-yellow-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{alert.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => dismissAlertMutation.mutate(alert.id)} data-testid={`button-dismiss-alert-${alert.id}`}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-conditions-list">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>My Conditions</CardTitle>
                <Button size="sm" onClick={() => setShowAddCondition(true)} data-testid="button-add-condition-header">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </CardHeader>
              <CardContent>
                {(dashboard?.conditions?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No conditions added yet</p>
                    <p className="text-sm">Add your chronic conditions to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard?.conditions?.map((condition: any) => (
                      <div key={condition.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`condition-item-${condition.id}`}>
                        <div>
                          <p className="font-medium">{condition.conditionName}</p>
                          <p className="text-xs text-muted-foreground">
                            {condition.diagnosisDate ? `Diagnosed: ${format(new Date(condition.diagnosisDate), "MMM yyyy")}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={condition.status === "active" ? "default" : "secondary"}>{condition.status}</Badge>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => generatePlanMutation.mutate(condition.id)}
                            disabled={generatePlanMutation.isPending}
                            data-testid={`button-create-plan-${condition.id}`}
                          >
                            {generatePlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                            Create Plan
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-next-goals">
              <CardHeader>
                <CardTitle>Next Goals</CardTitle>
                <CardDescription>Focus areas from your management plans</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard?.nextGoals?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No active goals</p>
                    <p className="text-sm">Generate a management plan to set goals</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard?.nextGoals?.map((goal: any, index: number) => (
                      <div key={goal.id || index} className="space-y-2" data-testid={`goal-item-${goal.id || index}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{goal.title}</p>
                          <Badge variant="outline">{goal.progressPercentage || 0}%</Badge>
                        </div>
                        <Progress value={goal.progressPercentage || 0} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4" data-testid="tab-content-plan">
          {!selectedPlan ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Plan Selected</h3>
                <p className="text-muted-foreground mb-4">
                  Select a condition from your dashboard and generate a personalized management plan.
                </p>
                <Button onClick={() => setActiveTab("dashboard")} data-testid="button-go-to-dashboard">
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          ) : planLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : planDetail ? (
            <>
              <Card data-testid="card-plan-header">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>{planDetail.title}</CardTitle>
                      <CardDescription>{planDetail.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={planDetail.status === "active" ? "default" : planDetail.status === "draft" ? "secondary" : "outline"}>
                        {planDetail.status}
                      </Badge>
                      {planDetail.status === "draft" && (
                        <Button onClick={() => activatePlanMutation.mutate(planDetail.id)} disabled={activatePlanMutation.isPending} data-testid="button-activate-plan">
                          {activatePlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                          Activate Plan
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => generateProgressMutation.mutate(planDetail.id)} disabled={generateProgressMutation.isPending} data-testid="button-update-progress">
                        <RefreshCw className={`w-4 h-4 mr-2 ${generateProgressMutation.isPending ? "animate-spin" : ""}`} />
                        Update Progress
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {planDetail.aiGeneratedInsights && (
                  <CardContent>
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm mb-1">AI Insights</p>
                          <p className="text-sm text-muted-foreground">{planDetail.aiGeneratedInsights}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card data-testid="card-plan-goals">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5" /> Goals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {planDetail.goals?.map((goal: any, index: number) => (
                        <div key={goal.id || index} className="p-3 rounded-lg border" data-testid={`plan-goal-${goal.id || index}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium">{goal.title}</p>
                              <p className="text-sm text-muted-foreground">{goal.description}</p>
                            </div>
                            <Badge variant={goal.status === "achieved" ? "default" : "outline"} className="capitalize">
                              {goal.status?.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {goal.progressPercentage !== undefined && (
                            <Progress value={goal.progressPercentage} className="mt-3 h-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-plan-interventions">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5" /> Interventions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {planDetail.interventions?.map((intervention: any, index: number) => (
                        <div key={intervention.id || index} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`plan-intervention-${intervention.id || index}`}>
                          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${intervention.isActive ? "text-green-500" : "text-muted-foreground"}`} />
                          <div>
                            <p className="font-medium">{intervention.title}</p>
                            <p className="text-sm text-muted-foreground">{intervention.description}</p>
                            {intervention.frequency && (
                              <Badge variant="outline" className="mt-1">{intervention.frequency}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-plan-monitoring">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" /> Monitoring Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {planDetail.monitoringSchedule?.map((item: any, index: number) => (
                      <div key={item.id || index} className="p-3 rounded-lg border" data-testid={`monitoring-item-${item.id || index}`}>
                        <p className="font-medium">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{item.frequency}</Badge>
                          {item.targetRange && <span className="text-xs text-muted-foreground">Target: {item.targetRange}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-plan-education">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5" /> Education Topics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {planDetail.educationTopics?.map((topic: any, index: number) => (
                      <div key={topic.id || index} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`education-topic-${topic.id || index}`}>
                        <div className="flex items-center gap-3">
                          {topic.isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2" />
                          )}
                          <div>
                            <p className="font-medium">{topic.title}</p>
                            <Badge variant="outline" className="text-xs">{topic.category}</Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" data-testid={`button-view-topic-${topic.id || index}`}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <strong>Disclaimer:</strong> This management plan is for educational purposes only and is not medical advice. 
                    Always consult your healthcare provider before making changes to your treatment plan.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4" data-testid="tab-content-logs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card data-testid="card-symptom-logs">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Symptom Logs</CardTitle>
                <Button size="sm" onClick={() => setShowLogSymptom(true)} data-testid="button-add-symptom">
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {(symptoms?.length || 0) === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No symptoms logged yet</p>
                  ) : (
                    <div className="space-y-3">
                      {symptoms?.map((symptom: any) => (
                        <div key={symptom.id} className="p-3 rounded-lg border" data-testid={`symptom-log-${symptom.id}`}>
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{symptom.symptomName}</p>
                            <Badge className={severityOptions.find(s => s.value === symptom.severity)?.color}>
                              {symptom.severity}
                            </Badge>
                          </div>
                          {symptom.description && (
                            <p className="text-sm text-muted-foreground mt-1">{symptom.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(symptom.loggedAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-adherence-logs">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Medication Logs</CardTitle>
                <Button size="sm" onClick={() => setShowLogAdherence(true)} data-testid="button-add-adherence">
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {(adherence?.length || 0) === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No medications logged yet</p>
                  ) : (
                    <div className="space-y-3">
                      {adherence?.map((log: any) => (
                        <div key={log.id} className="p-3 rounded-lg border" data-testid={`adherence-log-${log.id}`}>
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{log.medicationName}</p>
                            <Badge variant={log.status === "taken" ? "default" : log.status === "missed" ? "destructive" : "secondary"}>
                              {log.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(log.loggedAt), "MMM d, h:mm a")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-lifestyle-logs">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Lifestyle Logs</CardTitle>
                <Button size="sm" onClick={() => setShowLogLifestyle(true)} data-testid="button-add-lifestyle">
                  <Plus className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {(lifestyle?.length || 0) === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No activities logged yet</p>
                  ) : (
                    <div className="space-y-3">
                      {lifestyle?.map((log: any) => {
                        const CategoryIcon = lifestyleCategories.find(c => c.value === log.category)?.icon || Activity;
                        return (
                          <div key={log.id} className="p-3 rounded-lg border" data-testid={`lifestyle-log-${log.id}`}>
                            <div className="flex items-start gap-2">
                              <CategoryIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium capitalize">{log.category}</p>
                                <p className="text-sm text-muted-foreground">{log.description}</p>
                                {log.duration && (
                                  <Badge variant="outline" className="mt-1 text-xs">{log.duration} min</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(log.loggedAt), "MMM d, h:mm a")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4" data-testid="tab-content-alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" /> Alerts & Notifications
              </CardTitle>
              <CardDescription>Stay informed about your health management</CardDescription>
            </CardHeader>
            <CardContent>
              {(alerts?.length || 0) === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p>No pending alerts at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts?.map((alert: any) => (
                    <div 
                      key={alert.id} 
                      className={`p-4 rounded-lg border ${
                        alert.priority === "urgent" ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950" :
                        alert.priority === "high" ? "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950" :
                        "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
                      }`}
                      data-testid={`alert-card-${alert.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                          alert.priority === "urgent" ? "text-red-500" :
                          alert.priority === "high" ? "text-orange-500" : "text-yellow-500"
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">{alert.title}</p>
                            <Badge variant={alert.priority === "urgent" ? "destructive" : alert.priority === "high" ? "default" : "secondary"}>
                              {alert.priority}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1">{alert.message}</p>
                          {alert.recommendation && (
                            <div className="mt-2 p-2 rounded bg-background/50">
                              <p className="text-sm"><strong>Suggestion:</strong> {alert.recommendation}</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-3">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(alert.createdAt), "MMM d, h:mm a")}
                            </p>
                            <Button variant="ghost" size="sm" onClick={() => dismissAlertMutation.mutate(alert.id)} data-testid={`button-dismiss-${alert.id}`}>
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education" className="space-y-4" data-testid="tab-content-education">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Personalized Education
              </CardTitle>
              <CardDescription>Learn about managing your conditions</CardDescription>
            </CardHeader>
            <CardContent>
              {(education?.length || 0) === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No content yet</p>
                  <p>Add a condition and create a management plan to get personalized education.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {education?.map((content: any) => (
                    <Card key={content.id} className="overflow-hidden" data-testid={`education-card-${content.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{content.title}</CardTitle>
                          {content.isAIGenerated && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> AI
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {content.conditionType?.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{content.contentType}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-3">{content.content}</p>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between pt-0">
                        {content.isCompleted ? (
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm" data-testid={`button-read-${content.id}`}>
                            Read More
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong>Educational content only.</strong> This information is for learning purposes and does not replace professional medical advice. 
                Always consult your healthcare provider for guidance specific to your situation.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddCondition} onOpenChange={setShowAddCondition}>
        <DialogContent data-testid="dialog-add-condition">
          <DialogHeader>
            <DialogTitle>Add Chronic Condition</DialogTitle>
            <DialogDescription>Add a condition to track and manage</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chronic-disease-manageme-condition-type">Condition Type</Label>
              <Select value={newCondition.conditionType} onValueChange={(v) => setNewCondition({ ...newCondition, conditionType: v })}>
                <SelectTrigger id="chronic-disease-manageme-condition-type" data-testid="select-condition-type">
                  <SelectValue placeholder="Select condition type" />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-condition-name-optional">Condition Name (optional)</Label>
              <Input id="chronic-disease-manageme-condition-name-optional" 
                value={newCondition.conditionName} 
                onChange={(e) => setNewCondition({ ...newCondition, conditionName: e.target.value })}
                placeholder="e.g., Type 2 Diabetes Mellitus"
                data-testid="input-condition-name"
              />
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-diagnosis-date-optional">Diagnosis Date (optional)</Label>
              <Input id="chronic-disease-manageme-diagnosis-date-optional" 
                type="date" 
                value={newCondition.diagnosisDate} 
                onChange={(e) => setNewCondition({ ...newCondition, diagnosisDate: e.target.value })}
                data-testid="input-diagnosis-date"
              />
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-notes-optional">Notes (optional)</Label>
              <Textarea id="chronic-disease-manageme-notes-optional" 
                value={newCondition.notes} 
                onChange={(e) => setNewCondition({ ...newCondition, notes: e.target.value })}
                placeholder="Any additional notes about your condition"
                data-testid="textarea-condition-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCondition(false)}>Cancel</Button>
            <Button 
              onClick={() => addConditionMutation.mutate(newCondition)} 
              disabled={!newCondition.conditionType || addConditionMutation.isPending}
              data-testid="button-save-condition"
            >
              {addConditionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Condition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogSymptom} onOpenChange={setShowLogSymptom}>
        <DialogContent data-testid="dialog-log-symptom">
          <DialogHeader>
            <DialogTitle>Log Symptom</DialogTitle>
            <DialogDescription>Track how you're feeling</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chronic-disease-manageme-symptom-name">Symptom Name</Label>
              <Input id="chronic-disease-manageme-symptom-name" 
                value={newSymptom.symptomName} 
                onChange={(e) => setNewSymptom({ ...newSymptom, symptomName: e.target.value })}
                placeholder="e.g., Headache, Fatigue, Joint pain"
                data-testid="input-symptom-name"
              />
            </div>
            <div>
              <FieldCaption>Severity</FieldCaption>
              <RadioGroup 
                value={newSymptom.severity} 
                onValueChange={(v) => setNewSymptom({ ...newSymptom, severity: v })}
                className="flex flex-wrap gap-2"
              >
                {severityOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center">
                    <RadioGroupItem value={opt.value} id={`severity-${opt.value}`} className="sr-only" />
                    <Label 
                      htmlFor={`severity-${opt.value}`} 
                      className={`px-3 py-1.5 rounded-full cursor-pointer border-2 transition-colors ${
                        newSymptom.severity === opt.value ? opt.color + " border-current" : "border-transparent hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-description-optional">Description (optional)</Label>
              <Textarea id="chronic-disease-manageme-description-optional" 
                value={newSymptom.description} 
                onChange={(e) => setNewSymptom({ ...newSymptom, description: e.target.value })}
                placeholder="Describe the symptom"
                data-testid="textarea-symptom-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={newSymptom.affectsDaily} 
                onCheckedChange={(v) => setNewSymptom({ ...newSymptom, affectsDaily: v })}
                data-testid="switch-affects-daily"
              />
              <FieldCaption>Affects daily activities</FieldCaption>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogSymptom(false)}>Cancel</Button>
            <Button 
              onClick={() => logSymptomMutation.mutate(newSymptom)} 
              disabled={!newSymptom.symptomName || logSymptomMutation.isPending}
              data-testid="button-save-symptom"
            >
              {logSymptomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Symptom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogAdherence} onOpenChange={setShowLogAdherence}>
        <DialogContent data-testid="dialog-log-adherence">
          <DialogHeader>
            <DialogTitle>Log Medication</DialogTitle>
            <DialogDescription>Track your medication adherence</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="chronic-disease-manageme-medication-name">Medication Name</Label>
              <Input id="chronic-disease-manageme-medication-name" 
                value={newAdherence.medicationName} 
                onChange={(e) => setNewAdherence({ ...newAdherence, medicationName: e.target.value })}
                placeholder="e.g., Metformin 500mg"
                data-testid="input-medication-name"
              />
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-status">Status</Label>
              <Select value={newAdherence.status} onValueChange={(v) => setNewAdherence({ ...newAdherence, status: v })}>
                <SelectTrigger id="chronic-disease-manageme-status" data-testid="select-adherence-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taken">Taken</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="partial">Partial dose</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-scheduled-time">Scheduled Time</Label>
              <Input id="chronic-disease-manageme-scheduled-time" 
                type="time" 
                value={newAdherence.scheduledTime} 
                onChange={(e) => setNewAdherence({ ...newAdherence, scheduledTime: e.target.value })}
                data-testid="input-scheduled-time"
              />
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-notes-optional-2">Notes (optional)</Label>
              <Textarea id="chronic-disease-manageme-notes-optional-2" 
                value={newAdherence.notes} 
                onChange={(e) => setNewAdherence({ ...newAdherence, notes: e.target.value })}
                placeholder="Any notes about this dose"
                data-testid="textarea-adherence-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogAdherence(false)}>Cancel</Button>
            <Button 
              onClick={() => logAdherenceMutation.mutate(newAdherence)} 
              disabled={!newAdherence.medicationName || !newAdherence.scheduledTime || logAdherenceMutation.isPending}
              data-testid="button-save-adherence"
            >
              {logAdherenceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Medication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogLifestyle} onOpenChange={setShowLogLifestyle}>
        <DialogContent data-testid="dialog-log-lifestyle">
          <DialogHeader>
            <DialogTitle>Log Lifestyle Activity</DialogTitle>
            <DialogDescription>Track your daily activities</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <FieldCaption>Category</FieldCaption>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {lifestyleCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <Button
                      key={cat.value}
                      type="button"
                      variant={newLifestyle.category === cat.value ? "default" : "outline"}
                      className="flex flex-col gap-1 h-auto py-3"
                      onClick={() => setNewLifestyle({ ...newLifestyle, category: cat.value as any })}
                      data-testid={`button-category-${cat.value}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs">{cat.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-description">Description</Label>
              <Input id="chronic-disease-manageme-description" 
                value={newLifestyle.description} 
                onChange={(e) => setNewLifestyle({ ...newLifestyle, description: e.target.value })}
                placeholder="e.g., 30 min walk, salad for lunch"
                data-testid="input-lifestyle-description"
              />
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-duration-minutes-optional">Duration (minutes, optional)</Label>
              <Input id="chronic-disease-manageme-duration-minutes-optional" 
                type="number" 
                value={newLifestyle.duration || ""} 
                onChange={(e) => setNewLifestyle({ ...newLifestyle, duration: parseInt(e.target.value) || 0 })}
                placeholder="30"
                data-testid="input-lifestyle-duration"
              />
            </div>
            <div>
              <Label htmlFor="chronic-disease-manageme-notes-optional-3">Notes (optional)</Label>
              <Textarea id="chronic-disease-manageme-notes-optional-3" 
                value={newLifestyle.notes} 
                onChange={(e) => setNewLifestyle({ ...newLifestyle, notes: e.target.value })}
                placeholder="Any additional notes"
                data-testid="textarea-lifestyle-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogLifestyle(false)}>Cancel</Button>
            <Button 
              onClick={() => logLifestyleMutation.mutate(newLifestyle)} 
              disabled={!newLifestyle.description || logLifestyleMutation.isPending}
              data-testid="button-save-lifestyle"
            >
              {logLifestyleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-chronic-disease-disclaimer" />
    </div>
  );
}
