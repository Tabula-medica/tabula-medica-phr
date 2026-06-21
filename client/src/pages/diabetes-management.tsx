import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Droplet,
  Eye,
  FileText,
  Footprints,
  Heart,
  HelpCircle,
  Info,
  Pill,
  Plus,
  RefreshCw,
  Settings,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const NO_ADVICE_DISCLAIMER = "This information is for tracking and educational purposes only. It does not constitute medical advice. Always consult your healthcare provider.";
const PROFILE_ID = "profile-default";

type GlucoseContext = "fasting" | "pre_meal" | "post_meal" | "bedtime" | "other";

interface DashboardSummary {
  lastGlucoseUpdate?: { value: number; unit: string; timestamp: string; context: GlucoseContext };
  medicationsDueToday: { id: string; name: string; dueTime: string; taken: boolean }[];
  careTasksDue: CareTask[];
  glucoseSummary24h: { readings: number; average?: number; timeInRange?: number; hypoEvents: number; hyperEvents: number };
  hypoHyperEvents7d: { hypo: number; hyper: number };
  keyLabsSnapshot: { a1c?: { value: number; date: string }; egfr?: { value: number; date: string }; urineAlbumin?: { value: number; date: string }; ldl?: { value: number; date: string } };
  screeningsOverdue: ScreeningRecord[];
  disclaimer: string;
  guidelineVersion: string;
}

interface GlucoseEntry {
  id: string;
  value: number;
  unit: string;
  context: GlucoseContext;
  timestamp: string;
  source: string;
  notes?: string;
  isOutOfRange: boolean;
}

interface DiabetesMedication {
  id: string;
  name: string;
  genericName?: string;
  category: "insulin" | "non_insulin" | "supply";
  dosage: string;
  frequency: string;
  isActive: boolean;
  prescriber?: string;
  source: string;
}

interface DiabetesLab {
  id: string;
  labType: string;
  value: number;
  unit: string;
  collectedAt: string;
  source: string;
  providerName?: string;
}

interface CareTask {
  id: string;
  title: string;
  description: string;
  category: string;
  cadenceMonths?: number;
  lastCompletedAt?: string;
  nextDueAt?: string;
  isActive: boolean;
  priority: string;
}

interface ScreeningRecord {
  id: string;
  screeningType: string;
  completedAt?: string;
  nextDueAt?: string;
  cadenceMonths: number;
}

interface ComplicationRecord {
  id: string;
  category: string;
  condition: string;
  diagnosedAt?: string;
  symptoms: string[];
}

const contextLabels: Record<GlucoseContext, string> = {
  fasting: "Fasting",
  pre_meal: "Before Meal",
  post_meal: "After Meal",
  bedtime: "Bedtime",
  other: "Other",
};

const labTypeLabels: Record<string, string> = {
  a1c: "A1c",
  egfr: "eGFR",
  urine_albumin: "Urine Albumin",
  ldl: "LDL Cholesterol",
  hdl: "HDL Cholesterol",
  triglycerides: "Triglycerides",
  creatinine: "Creatinine",
};

const screeningLabels: Record<string, { label: string; icon: typeof Eye }> = {
  eye_exam: { label: "Eye Exam", icon: Eye },
  foot_exam: { label: "Foot Exam", icon: Footprints },
  kidney_labs: { label: "Kidney Labs", icon: Activity },
  lipid_panel: { label: "Lipid Panel", icon: Heart },
  flu_vaccine: { label: "Flu Vaccine", icon: Stethoscope },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getDaysUntil(dateString: string): number {
  const now = new Date();
  const target = new Date(dateString);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DiabetesManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [glucoseDialogOpen, setGlucoseDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [packetDialogOpen, setPacketDialogOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [glucoseDays, setGlucoseDays] = useState(7);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/diabetes/dashboard", PROFILE_ID],
    queryFn: () => fetch(`/api/diabetes/dashboard/${PROFILE_ID}`).then(res => res.json()),
  });

  const { data: glucoseData, isLoading: glucoseLoading } = useQuery<{ entries: GlucoseEntry[]; disclaimer: string }>({
    queryKey: ["/api/diabetes/glucose", PROFILE_ID, glucoseDays],
    queryFn: () => fetch(`/api/diabetes/glucose/${PROFILE_ID}?days=${glucoseDays}`).then(res => res.json()),
  });

  const { data: medsData } = useQuery<{ medications: DiabetesMedication[]; disclaimer: string }>({
    queryKey: ["/api/diabetes/medications", PROFILE_ID],
    queryFn: () => fetch(`/api/diabetes/medications/${PROFILE_ID}`).then(res => res.json()),
  });

  const { data: labsData } = useQuery<{ labs: DiabetesLab[]; disclaimer: string }>({
    queryKey: ["/api/diabetes/labs", PROFILE_ID],
    queryFn: () => fetch(`/api/diabetes/labs/${PROFILE_ID}`).then(res => res.json()),
  });

  const { data: tasksData, refetch: refetchTasks } = useQuery<{ tasks: CareTask[]; disclaimer: string; guidelineVersion: string }>({
    queryKey: ["/api/diabetes/tasks", PROFILE_ID],
    queryFn: () => fetch(`/api/diabetes/tasks/${PROFILE_ID}`).then(res => res.json()),
  });

  const { data: complicationsData } = useQuery<{ complications: ComplicationRecord[]; disclaimer: string }>({
    queryKey: ["/api/diabetes/complications", PROFILE_ID],
    queryFn: () => fetch(`/api/diabetes/complications/${PROFILE_ID}`).then(res => res.json()),
  });

  const { data: screeningsData } = useQuery<{ screenings: ScreeningRecord[]; disclaimer: string }>({
    queryKey: ["/api/diabetes/screenings", PROFILE_ID],
    queryFn: () => fetch(`/api/diabetes/screenings/${PROFILE_ID}`).then(res => res.json()),
  });

  const { data: labExplanation, isLoading: labExplanationLoading } = useQuery<{ explanation: string; questionsToAsk: string[]; disclaimer: string }>({
    queryKey: ["/api/diabetes/labs/explain", PROFILE_ID, selectedLabId],
    queryFn: () => fetch(`/api/diabetes/labs/${PROFILE_ID}/${selectedLabId}/explain`).then(res => res.json()),
    enabled: !!selectedLabId,
  });

  const addGlucoseMutation = useMutation({
    mutationFn: async (data: { value: number; unit: string; context: string; timestamp: string; notes?: string }) => {
      return apiRequest("POST", `/api/diabetes/glucose/${PROFILE_ID}`, { ...data, source: "manual" });
    },
    onSuccess: () => {
      toast({ title: "Glucose logged", description: "Your reading has been saved." });
      setGlucoseDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/diabetes"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save glucose reading.", variant: "destructive" });
    },
  });

  const logEventMutation = useMutation({
    mutationFn: async (data: object) => {
      return apiRequest("POST", `/api/diabetes/events/${PROFILE_ID}`, data);
    },
    onSuccess: () => {
      toast({ title: "Event logged", description: "Your event has been recorded." });
      setEventDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/diabetes"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log event.", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("POST", `/api/diabetes/tasks/${PROFILE_ID}/${taskId}/complete`, {});
    },
    onSuccess: () => {
      toast({ title: "Task completed", description: "Next due date has been updated." });
      refetchTasks();
    },
  });

  const generatePacketMutation = useMutation({
    mutationFn: async (options: object) => {
      return apiRequest("POST", `/api/diabetes/packet/${PROFILE_ID}`, options);
    },
    onSuccess: () => {
      toast({ title: "Packet generated", description: "Your visit packet is ready for download." });
      setPacketDialogOpen(false);
    },
  });

  const handleAddGlucose = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = parseFloat(formData.get("value") as string);
    const context = formData.get("context") as string;
    const notes = formData.get("notes") as string;

    if (!value || !context) {
      toast({ title: "Missing info", description: "Please enter value and context.", variant: "destructive" });
      return;
    }

    addGlucoseMutation.mutate({
      value,
      unit: "mg/dL",
      context,
      timestamp: new Date().toISOString(),
      notes: notes || undefined,
    });
  };

  const handleLogEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const eventType = formData.get("eventType") as string;
    const severity = formData.get("severity") as string;
    const symptoms = (formData.get("symptoms") as string).split(",").map((s) => s.trim()).filter(Boolean);
    const context = formData.get("context") as string;
    const actionTaken = formData.get("actionTaken") as string;

    if (!eventType || !severity || symptoms.length === 0) {
      toast({ title: "Missing info", description: "Please fill required fields.", variant: "destructive" });
      return;
    }

    logEventMutation.mutate({
      eventType,
      severity,
      symptoms,
      context: context || undefined,
      actionTaken: actionTaken || undefined,
      timestamp: new Date().toISOString(),
      resolved: false,
    });
  };

  if (dashboardLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4" data-testid="page-diabetes-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="page-diabetes-management">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800" data-testid="alert-disclaimer">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Information Only</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">{NO_ADVICE_DISCLAIMER}</AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-diabetes">
            <Droplet className="w-8 h-8 text-primary" />
            Diabetes Management
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage your diabetes care</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPacketDialogOpen(true)} data-testid="button-export-packet">
            <Download className="w-4 h-4 mr-2" />
            Create Visit Packet
          </Button>
          <Button size="sm" onClick={() => setGlucoseDialogOpen(true)} data-testid="button-add-glucose">
            <Plus className="w-4 h-4 mr-2" />
            Log Glucose
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-diabetes">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="glucose" data-testid="tab-glucose">Glucose</TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">Labs</TabsTrigger>
          <TabsTrigger value="tasks" className="hidden lg:flex" data-testid="tab-tasks">Care Tasks</TabsTrigger>
          <TabsTrigger value="complications" className="hidden lg:flex" data-testid="tab-complications">Complications</TabsTrigger>
          <TabsTrigger value="screenings" className="hidden lg:flex" data-testid="tab-screenings">Screenings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4" data-testid="content-dashboard">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-today">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.lastGlucoseUpdate ? (
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last glucose</span>
                      <span className="text-sm text-muted-foreground">{formatTime(dashboard.lastGlucoseUpdate.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl font-bold">{dashboard.lastGlucoseUpdate.value}</span>
                      <span className="text-muted-foreground">{dashboard.lastGlucoseUpdate.unit}</span>
                      <Badge variant="outline">{contextLabels[dashboard.lastGlucoseUpdate.context]}</Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No glucose readings today</p>
                )}
                <div>
                  <p className="text-sm font-medium mb-2">Medications due</p>
                  {dashboard?.medicationsDueToday.slice(0, 3).map((med) => (
                    <div key={med.id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{med.name}</span>
                      <Checkbox checked={med.taken} data-testid={`checkbox-med-${med.id}`} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-glucose-summary">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Glucose (24h)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-muted">
                    <p className="text-2xl font-bold">{dashboard?.glucoseSummary24h.readings || 0}</p>
                    <p className="text-xs text-muted-foreground">Readings</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted">
                    <p className="text-2xl font-bold">{dashboard?.glucoseSummary24h.average || "--"}</p>
                    <p className="text-xs text-muted-foreground">Average mg/dL</p>
                  </div>
                </div>
                {dashboard?.glucoseSummary24h.timeInRange !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Time in Range</span>
                      <span>{dashboard.glucoseSummary24h.timeInRange}%</span>
                    </div>
                    <Progress value={dashboard.glucoseSummary24h.timeInRange} className="h-2" />
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <ArrowDown className="w-4 h-4 text-red-500" />
                    <span>Hypo (7d): {dashboard?.hypoHyperEvents7d.hypo || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUp className="w-4 h-4 text-orange-500" />
                    <span>Hyper (7d): {dashboard?.hypoHyperEvents7d.hyper || 0}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setEventDialogOpen(true)} data-testid="button-log-event">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Log Hypo/Hyper Event
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-labs-snapshot">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Key Labs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard?.keyLabsSnapshot.a1c && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted hover-elevate cursor-pointer" onClick={() => setActiveTab("labs")} data-testid="lab-a1c">
                    <div>
                      <p className="font-medium">A1c</p>
                      <p className="text-xs text-muted-foreground">{formatDate(dashboard.keyLabsSnapshot.a1c.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{dashboard.keyLabsSnapshot.a1c.value}%</p>
                    </div>
                  </div>
                )}
                {dashboard?.keyLabsSnapshot.egfr && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted hover-elevate cursor-pointer" onClick={() => setActiveTab("labs")} data-testid="lab-egfr">
                    <div>
                      <p className="font-medium">eGFR (Kidney)</p>
                      <p className="text-xs text-muted-foreground">{formatDate(dashboard.keyLabsSnapshot.egfr.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{dashboard.keyLabsSnapshot.egfr.value}</p>
                    </div>
                  </div>
                )}
                {dashboard?.keyLabsSnapshot.ldl && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted hover-elevate cursor-pointer" onClick={() => setActiveTab("labs")} data-testid="lab-ldl">
                    <div>
                      <p className="font-medium">LDL</p>
                      <p className="text-xs text-muted-foreground">{formatDate(dashboard.keyLabsSnapshot.ldl.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{dashboard.keyLabsSnapshot.ldl.value}</p>
                      <p className="text-xs text-muted-foreground">mg/dL</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {dashboard?.careTasksDue && dashboard.careTasksDue.length > 0 && (
            <Card data-testid="card-tasks-due">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Care Tasks Due Soon
                </CardTitle>
                <CardDescription>Commonly tracked items based on {dashboard.guidelineVersion}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashboard.careTasksDue.slice(0, 5).map((task) => {
                  const daysUntil = task.nextDueAt ? getDaysUntil(task.nextDueAt) : null;
                  return (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate" data-testid={`task-${task.id}`}>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {daysUntil !== null && (
                          <Badge variant={daysUntil < 0 ? "destructive" : daysUntil < 7 ? "secondary" : "outline"}>
                            {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? "Today" : `${daysUntil}d`}
                          </Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={() => completeTaskMutation.mutate(task.id)} data-testid={`button-complete-${task.id}`}>
                          Done
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="w-full" onClick={() => setActiveTab("tasks")} data-testid="button-view-all-tasks">
                  View All Tasks
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          )}

          {dashboard?.screeningsOverdue && dashboard.screeningsOverdue.length > 0 && (
            <Alert variant="destructive" data-testid="alert-screenings-overdue">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Screenings May Be Overdue</AlertTitle>
              <AlertDescription>
                {dashboard.screeningsOverdue.map((s) => screeningLabels[s.screeningType]?.label || s.screeningType).join(", ")} may be due. Consider contacting your care team.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="glucose" className="space-y-4 mt-4" data-testid="content-glucose">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {[7, 14, 30, 90].map((days) => (
                <Button key={days} variant={glucoseDays === days ? "default" : "outline"} size="sm" onClick={() => setGlucoseDays(days)} data-testid={`button-days-${days}`}>
                  {days}d
                </Button>
              ))}
            </div>
            <Button size="sm" onClick={() => setGlucoseDialogOpen(true)} data-testid="button-add-glucose-2">
              <Plus className="w-4 h-4 mr-2" />
              Add Reading
            </Button>
          </div>

          <Card data-testid="card-glucose-log">
            <CardHeader>
              <CardTitle>Glucose Log</CardTitle>
              <CardDescription>Last {glucoseDays} days of readings</CardDescription>
            </CardHeader>
            <CardContent>
              {glucoseLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : glucoseData?.entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Droplet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No glucose readings in this period</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {glucoseData?.entries.map((entry) => (
                    <div key={entry.id} className={`flex items-center justify-between p-3 rounded-lg border ${entry.isOutOfRange ? "border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800" : ""}`} data-testid={`glucose-entry-${entry.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.isOutOfRange ? "bg-yellow-100 dark:bg-yellow-900" : "bg-primary/10"}`}>
                          <Droplet className={`w-5 h-5 ${entry.isOutOfRange ? "text-yellow-600" : "text-primary"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{entry.value}</span>
                            <span className="text-muted-foreground">{entry.unit}</span>
                            {entry.isOutOfRange && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Outside range
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{formatDate(entry.timestamp)} at {formatTime(entry.timestamp)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{contextLabels[entry.context]}</Badge>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">{entry.source}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {glucoseData?.entries.some((e) => e.isOutOfRange) && (
              <CardFooter>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Some values are outside your saved range. Consider contacting your care team if this continues.
                  </AlertDescription>
                </Alert>
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4 mt-4" data-testid="content-medications">
          <Card>
            <CardHeader>
              <CardTitle>Diabetes Medications</CardTitle>
              <CardDescription>Your current diabetes regimen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {["insulin", "non_insulin", "supply"].map((category) => {
                const categoryMeds = medsData?.medications.filter((m) => m.category === category && m.isActive) || [];
                if (categoryMeds.length === 0) return null;
                
                const categoryLabels = { insulin: "Insulin", non_insulin: "Non-Insulin Medications", supply: "Supplies" };
                
                return (
                  <div key={category}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Pill className="w-4 h-4" />
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </h3>
                    <div className="space-y-2">
                      {categoryMeds.map((med) => (
                        <div key={med.id} className="p-3 rounded-lg border hover-elevate" data-testid={`med-${med.id}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{med.name}</p>
                              {med.genericName && <p className="text-sm text-muted-foreground">{med.genericName}</p>}
                            </div>
                            <Badge variant="outline" className="capitalize">{med.source}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <span>{med.dosage}</span>
                            <span>•</span>
                            <span>{med.frequency}</span>
                            {med.prescriber && (
                              <>
                                <span>•</span>
                                <span>{med.prescriber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Side effects are patient-reported and included for your reference. {NO_ADVICE_DISCLAIMER}
                </AlertDescription>
              </Alert>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="labs" className="space-y-4 mt-4" data-testid="content-labs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["a1c", "egfr", "ldl", "triglycerides"].map((labType) => {
              const typeLabs = labsData?.labs.filter((l) => l.labType === labType).sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()) || [];
              const latest = typeLabs[0];
              
              if (!latest) return null;
              
              const trend = typeLabs.length > 1 ? (latest.value > typeLabs[1].value ? "up" : latest.value < typeLabs[1].value ? "down" : "same") : null;
              
              return (
                <Card key={labType} className="hover-elevate cursor-pointer" onClick={() => setSelectedLabId(latest.id)} data-testid={`card-lab-${labType}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{labTypeLabels[labType] || labType}</CardTitle>
                      {trend && (
                        <div className="flex items-center gap-1">
                          {trend === "up" ? <TrendingUp className="w-4 h-4 text-muted-foreground" /> : trend === "down" ? <TrendingDown className="w-4 h-4 text-muted-foreground" /> : null}
                        </div>
                      )}
                    </div>
                    <CardDescription>{formatDate(latest.collectedAt)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{latest.value}</span>
                      <span className="text-muted-foreground">{latest.unit}</span>
                    </div>
                    {typeLabs.length > 1 && (
                      <div className="mt-2 flex gap-2 text-sm text-muted-foreground">
                        {typeLabs.slice(1, 4).map((lab, idx) => (
                          <span key={lab.id}>{lab.value} ({formatDate(lab.collectedAt).split(",")[0]})</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="ghost" size="sm" className="w-full" data-testid={`button-explain-${labType}`}>
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Explain This Result
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {selectedLabId && (
            <Card data-testid="card-lab-explanation">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    Understanding Your Result
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLabId(null)} data-testid="button-close-explanation">
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {labExplanationLoading ? (
                  <div className="space-y-3" data-testid="skeleton-lab-explanation">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : labExplanation ? (
                  <>
                    <p data-testid="text-lab-explanation">{labExplanation.explanation}</p>
                    <div>
                      <p className="font-medium mb-2">Questions to ask your clinician:</p>
                      <ul className="list-disc pl-5 space-y-1" data-testid="list-questions-to-ask">
                        {labExplanation.questionsToAsk.map((q, idx) => (
                          <li key={idx} className="text-muted-foreground" data-testid={`text-question-${idx}`}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Unable to load explanation.</p>
                )}
              </CardContent>
              {labExplanation && (
                <CardFooter>
                  <Alert data-testid="alert-lab-disclaimer">
                    <Info className="h-4 w-4" />
                    <AlertDescription>{labExplanation.disclaimer}</AlertDescription>
                  </Alert>
                </CardFooter>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 mt-4" data-testid="content-tasks">
          <Card>
            <CardHeader>
              <CardTitle>Care Tasks Checklist</CardTitle>
              <CardDescription>Commonly tracked items based on {tasksData?.guidelineVersion}. These can be customized by you or your care team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksData?.tasks.filter((t) => t.isActive).map((task) => {
                const daysUntil = task.nextDueAt ? getDaysUntil(task.nextDueAt) : null;
                const isOverdue = daysUntil !== null && daysUntil < 0;
                
                return (
                  <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800" : ""}`} data-testid={`task-item-${task.id}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={false} onCheckedChange={() => completeTaskMutation.mutate(task.id)} data-testid={`checkbox-task-${task.id}`} />
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                        {task.lastCompletedAt && (
                          <p className="text-xs text-muted-foreground">Last: {formatDate(task.lastCompletedAt)}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {task.nextDueAt && (
                        <Badge variant={isOverdue ? "destructive" : daysUntil !== null && daysUntil < 14 ? "secondary" : "outline"}>
                          {isOverdue ? `${Math.abs(daysUntil!)}d overdue` : daysUntil === 0 ? "Due today" : `Due in ${daysUntil}d`}
                        </Badge>
                      )}
                      {task.cadenceMonths && (
                        <p className="text-xs text-muted-foreground mt-1">Every {task.cadenceMonths} months</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complications" className="space-y-4 mt-4" data-testid="content-complications">
          <Card>
            <CardHeader>
              <CardTitle>Complications & Comorbidities Tracking</CardTitle>
              <CardDescription>Track diabetes-related conditions. This is informational only and does not generate management advice.</CardDescription>
            </CardHeader>
            <CardContent>
              {complicationsData?.complications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No complications tracked</p>
                  <p className="text-sm mt-2">You can add records here for your own tracking</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {complicationsData?.complications.map((comp) => (
                    <div key={comp.id} className="p-3 rounded-lg border" data-testid={`complication-${comp.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant="outline" className="mb-1 capitalize">{comp.category}</Badge>
                          <p className="font-medium">{comp.condition}</p>
                        </div>
                        {comp.diagnosedAt && (
                          <p className="text-sm text-muted-foreground">Dx: {formatDate(comp.diagnosedAt)}</p>
                        )}
                      </div>
                      {comp.symptoms.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {comp.symptoms.map((s, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screenings" className="space-y-4 mt-4" data-testid="content-screenings">
          <Card>
            <CardHeader>
              <CardTitle>Complications Screening Tracker</CardTitle>
              <CardDescription>Track regular screenings commonly recommended for people with diabetes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {screeningsData?.screenings.map((screen) => {
                const info = screeningLabels[screen.screeningType] || { label: screen.screeningType, icon: Stethoscope };
                const Icon = info.icon;
                const daysUntil = screen.nextDueAt ? getDaysUntil(screen.nextDueAt) : null;
                const isOverdue = daysUntil !== null && daysUntil < 0;
                
                return (
                  <div key={screen.id} className={`flex items-center justify-between p-3 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800" : ""}`} data-testid={`screening-${screen.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? "bg-red-100 dark:bg-red-900" : "bg-primary/10"}`}>
                        <Icon className={`w-5 h-5 ${isOverdue ? "text-red-600" : "text-primary"}`} />
                      </div>
                      <div>
                        <p className="font-medium">{info.label}</p>
                        {screen.completedAt && (
                          <p className="text-sm text-muted-foreground">Last: {formatDate(screen.completedAt)}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {screen.nextDueAt && (
                        <Badge variant={isOverdue ? "destructive" : daysUntil !== null && daysUntil < 30 ? "secondary" : "outline"}>
                          {isOverdue ? `${Math.abs(daysUntil!)}d overdue` : `Due ${formatDate(screen.nextDueAt)}`}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Every {screen.cadenceMonths} months</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={glucoseDialogOpen} onOpenChange={setGlucoseDialogOpen}>
        <DialogContent data-testid="dialog-add-glucose">
          <DialogHeader>
            <DialogTitle>Log Glucose Reading</DialogTitle>
            <DialogDescription>Enter your blood glucose measurement</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddGlucose} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Value (mg/dL)</Label>
                <Input id="value" name="value" type="number" placeholder="120" required data-testid="input-glucose-value" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="context">Context</Label>
                <Select name="context" required>
                  <SelectTrigger data-testid="select-glucose-context">
                    <SelectValue placeholder="When measured" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(contextLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" name="notes" placeholder="Any additional notes..." data-testid="input-glucose-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGlucoseDialogOpen(false)} data-testid="button-cancel-glucose">Cancel</Button>
              <Button type="submit" disabled={addGlucoseMutation.isPending} data-testid="button-submit-glucose">
                {addGlucoseMutation.isPending ? "Saving..." : "Save Reading"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent data-testid="dialog-log-event">
          <DialogHeader>
            <DialogTitle>Log Hypo/Hyper Event</DialogTitle>
            <DialogDescription>Record details about a low or high blood sugar event</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogEvent} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Select name="eventType" required>
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hypoglycemia">Hypoglycemia (Low)</SelectItem>
                    <SelectItem value="hyperglycemia">Hyperglycemia (High)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select name="severity" required>
                  <SelectTrigger data-testid="select-severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="symptoms">Symptoms (comma-separated)</Label>
              <Input id="symptoms" name="symptoms" placeholder="shakiness, sweating, confusion" required data-testid="input-symptoms" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="context">Context (what were you doing?)</Label>
              <Input id="context" name="context" placeholder="e.g., Delayed lunch, exercised" data-testid="input-event-context" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actionTaken">Action Taken</Label>
              <Input id="actionTaken" name="actionTaken" placeholder="e.g., Had juice and crackers" data-testid="input-action-taken" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEventDialogOpen(false)} data-testid="button-cancel-event">Cancel</Button>
              <Button type="submit" disabled={logEventMutation.isPending} data-testid="button-submit-event">
                {logEventMutation.isPending ? "Saving..." : "Log Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={packetDialogOpen} onOpenChange={setPacketDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-packet">
          <DialogHeader>
            <DialogTitle>Create Visit Packet</DialogTitle>
            <DialogDescription>Generate a summary for your healthcare provider</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            generatePacketMutation.mutate({
              packetType: formData.get("packetType"),
              timeframeMonths: parseInt(formData.get("timeframe") as string),
              includeGlucoseLogs: formData.get("glucose") === "on",
              includeMedications: formData.get("medications") === "on",
              includeLabs: formData.get("labs") === "on",
              includeCareTasks: formData.get("tasks") === "on",
              includeComplications: formData.get("complications") === "on",
              includeSensitiveNotes: false,
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Packet Type</Label>
              <Select name="packetType" defaultValue="quick_summary">
                <SelectTrigger data-testid="select-packet-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick_summary">Quick Summary (1 page)</SelectItem>
                  <SelectItem value="full_record">Full Record</SelectItem>
                  <SelectItem value="caregiver_copy">Caregiver Copy (simplified)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select name="timeframe" defaultValue="3">
                <SelectTrigger data-testid="select-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Last 1 month</SelectItem>
                  <SelectItem value="3">Last 3 months</SelectItem>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Include Sections</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "glucose", label: "Glucose Logs" },
                  { id: "medications", label: "Medications" },
                  { id: "labs", label: "Lab Results" },
                  { id: "tasks", label: "Care Tasks" },
                  { id: "complications", label: "Complications" },
                ].map((section) => (
                  <div key={section.id} className="flex items-center space-x-2">
                    <Checkbox id={section.id} name={section.id} defaultChecked data-testid={`checkbox-${section.id}`} />
                    <Label htmlFor={section.id} className="text-sm">{section.label}</Label>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPacketDialogOpen(false)} data-testid="button-cancel-packet">Cancel</Button>
              <Button type="submit" disabled={generatePacketMutation.isPending} data-testid="button-generate-packet">
                {generatePacketMutation.isPending ? "Generating..." : "Generate Packet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
