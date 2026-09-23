import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ListTodo,
  Activity,
  FileText,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  CheckCircle2,
  Circle,
  Loader2,
  User,
  Zap,
  FileSearch,
  Bell,
  ArrowRight,
  BarChart3,
  Thermometer,
  Droplets,
  Wind,
  ClipboardList,
  Send,
  Stethoscope,
  Copy,
  Download,
  Plus,
  X,
  Shield,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { clickable } from "@/lib/a11y";

interface DashboardStats {
  providerId: string;
  taskSummary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    critical: number;
    high: number;
    overdue: number;
  };
  vitalsSummary: {
    patientsMonitored: number;
    criticalAlerts: number;
    warningAlerts: number;
    normalPatients: number;
  };
  documentationSummary: {
    pendingReviews: number;
    summariesGenerated: number;
    avgCompletionTime: number;
  };
  lastUpdated: string;
}

interface ProviderTask {
  id: string;
  providerId: string;
  patientId?: string;
  patientName?: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  dueDate: string;
  estimatedMinutes: number;
  status: "pending" | "in_progress" | "completed" | "deferred";
  source: string;
  aiRationale?: string;
  createdAt: string;
}

interface VitalsMonitoringResult {
  patientId: string;
  patientName: string;
  monitoringPeriod: { start: string; end: string };
  currentVitals: {
    id: string;
    type: string;
    value: number;
    unit: string;
    timestamp: string;
    status: "normal" | "warning" | "critical";
  }[];
  trends: {
    vitalType: string;
    direction: "increasing" | "decreasing" | "stable" | "fluctuating";
    changePercentage: number;
    averageValue: number;
    significance: "normal" | "notable" | "concerning";
  }[];
  alerts: {
    id: string;
    vitalType: string;
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
    triggeredAt: string;
    acknowledged: boolean;
  }[];
  aiAnalysis: {
    summary: string;
    keyFindings: string[];
    recommendedReviews: string[];
    confidenceScore: number;
  };
  lastUpdated: string;
}

interface ClinicalDocSummary {
  id: string;
  patientId: string;
  patientName: string;
  documentType: string;
  generatedAt: string;
  summary: {
    overview: string;
    keyPoints: string[];
    diagnoses: { code: string; display: string; status: string }[];
    medications: { name: string; dosage: string; frequency: string; status: string }[];
    followUpItems: string[];
    providerNotes: string;
  };
  metadata: {
    originalWordCount: number;
    summaryWordCount: number;
    compressionRatio: number;
    documentDate: string;
    author?: string;
  };
  qualityMetrics: {
    completeness: number;
    accuracy: number;
    readability: number;
    overallScore: number;
  };
  confidenceScore: number;
}

interface PatientRecordSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  demographics: { age?: string; gender?: string };
  activeConditions: { name: string; status: string; onsetDate?: string }[];
  currentMedications: { name: string; dosage: string; frequency: string }[];
  allergies: { substance: string; reaction: string; severity: string }[];
  recentLabs: { name: string; value: string; unit: string; date: string; status: string }[];
  recentVitals: { type: string; value: string; unit: string; date: string; status: string }[];
  aiSummary: {
    overview: string;
    keyFindings: string[];
    activeIssues: string[];
    recentChanges: string[];
    preventiveCareGaps: string[];
  };
  confidenceScore: number;
}

interface ReferralLetterDraft {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  referringProvider: string;
  targetSpecialty: string;
  urgency: "routine" | "urgent" | "emergent";
  referringDiagnosis: string;
  letterContent: {
    salutation: string;
    introduction: string;
    clinicalHistory: string;
    currentFindings: string;
    reasonForReferral: string;
    requestedActions: string;
    closing: string;
  };
  attachmentSuggestions: string[];
  confidenceScore: number;
}

interface DifferentialDxSuggestion {
  id: string;
  patientId: string;
  generatedAt: string;
  inputSymptoms: string[];
  possibleConditions: {
    name: string;
    icdCode?: string;
    likelihoodLevel: "high" | "moderate" | "low";
    supportingFactors: string[];
    contraindicatingFactors: string[];
    suggestedWorkup: string[];
  }[];
  generalRecommendations: string[];
  confidenceScore: number;
}

function getPriorityBadgeVariant(priority: string) {
  switch (priority) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTrendIcon(direction: string) {
  switch (direction) {
    case "increasing":
      return <TrendingUp className="h-4 w-4 text-yellow-500" />;
    case "decreasing":
      return <TrendingDown className="h-4 w-4 text-blue-500" />;
    case "fluctuating":
      return <Activity className="h-4 w-4 text-orange-500" />;
    default:
      return <Minus className="h-4 w-4 text-green-500" />;
  }
}

function getVitalIcon(vitalType: string) {
  if (vitalType.includes("heart")) return <Heart className="h-4 w-4" />;
  if (vitalType.includes("pressure")) return <Activity className="h-4 w-4" />;
  if (vitalType.includes("oxygen")) return <Wind className="h-4 w-4" />;
  if (vitalType.includes("temperature")) return <Thermometer className="h-4 w-4" />;
  if (vitalType.includes("glucose")) return <Droplets className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function formatVitalType(type: string): string {
  return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function AIProviderDashboardEnhanced() {
  const [activeTab, setActiveTab] = useState("tasks");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>("patient-001");
  const [documentContent, setDocumentContent] = useState("");
  const [documentType, setDocumentType] = useState<string>("encounter_note");
  const [referralSpecialty, setReferralSpecialty] = useState("");
  const [referralDiagnosis, setReferralDiagnosis] = useState("");
  const [referralUrgency, setReferralUrgency] = useState<string>("routine");
  const [referralProviderName, setReferralProviderName] = useState("");
  const [referralNotes, setReferralNotes] = useState("");
  const [symptomInput, setSymptomInput] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomDuration, setSymptomDuration] = useState("");
  const [symptomSeverity, setSymptomSeverity] = useState("");
  const [patientSummaryResult, setPatientSummaryResult] = useState<PatientRecordSummary | null>(null);
  const [referralLetterResult, setReferralLetterResult] = useState<ReferralLetterDraft | null>(null);
  const [differentialDxResult, setDifferentialDxResult] = useState<DifferentialDxSuggestion | null>(null);
  const { toast } = useToast();

  const { data: statsResponse, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ["/api/ai-provider-dashboard-enhanced/stats"],
  });

  const { data: tasksResponse, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<{ success: boolean; data: { tasks: ProviderTask[] } }>({
    queryKey: ["/api/ai-provider-dashboard-enhanced/tasks"],
  });

  const { data: patientsResponse } = useQuery<{ success: boolean; data: { patients: { patientId: string; patientName: string; hasAlerts: boolean }[] } }>({
    queryKey: ["/api/ai-provider-dashboard-enhanced/vitals/patients"],
  });

  const { data: vitalsResponse, isLoading: vitalsLoading, refetch: refetchVitals } = useQuery<{ success: boolean; data: VitalsMonitoringResult }>({
    queryKey: ["/api/ai-provider-dashboard-enhanced/vitals/patient", selectedPatientId],
    enabled: !!selectedPatientId && activeTab === "vitals",
  });

  const { data: summariesResponse, isLoading: summariesLoading, refetch: refetchSummaries } = useQuery<{ success: boolean; data: { summaries: ClinicalDocSummary[] } }>({
    queryKey: ["/api/ai-provider-dashboard-enhanced/documentation/patient", selectedPatientId],
    enabled: !!selectedPatientId && activeTab === "documentation",
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/ai-provider-dashboard-enhanced/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-provider-dashboard-enhanced/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-provider-dashboard-enhanced/stats"] });
      toast({ title: "Task Updated", description: "Task status has been updated" });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async ({ patientId, alertId }: { patientId: string; alertId: string }) => {
      return apiRequest("POST", `/api/ai-provider-dashboard-enhanced/vitals/patient/${patientId}/acknowledge`, { alertId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-provider-dashboard-enhanced/vitals/patient", selectedPatientId] });
      toast({ title: "Alert Acknowledged", description: "Vitals alert has been acknowledged" });
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (data: { patientId: string; documentContent: string; documentType: string }) => {
      return apiRequest("POST", `/api/ai-provider-dashboard-enhanced/documentation/patient/${data.patientId}/generate`, {
        documentContent: data.documentContent,
        documentType: data.documentType,
        documentDate: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-provider-dashboard-enhanced/documentation/patient", selectedPatientId] });
      setDocumentContent("");
      toast({ title: "Summary Generated", description: "AI documentation summary has been created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    },
  });

  const patientSummaryMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-dashboard-enhanced/patient-summary/${patientId}`, {
        conditions: [
          { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2020-03-15" },
          { name: "Essential Hypertension", status: "active", onsetDate: "2019-06-01" },
          { name: "Hyperlipidemia", status: "active", onsetDate: "2021-01-10" }
        ],
        medications: [
          { name: "Metformin", dosage: "1000mg", frequency: "Twice daily" },
          { name: "Lisinopril", dosage: "20mg", frequency: "Once daily" },
          { name: "Atorvastatin", dosage: "40mg", frequency: "At bedtime" }
        ],
        allergies: [
          { substance: "Penicillin", reaction: "Rash", severity: "Moderate" },
          { substance: "Sulfa drugs", reaction: "Hives", severity: "Mild" }
        ],
        labs: [
          { name: "HbA1c", value: "7.8", unit: "%", date: "2024-01-15", status: "High" },
          { name: "LDL Cholesterol", value: "142", unit: "mg/dL", date: "2024-01-15", status: "High" },
          { name: "Creatinine", value: "1.1", unit: "mg/dL", date: "2024-01-15", status: "Normal" },
          { name: "eGFR", value: "78", unit: "mL/min", date: "2024-01-15", status: "Normal" }
        ],
        vitals: [
          { type: "Blood Pressure", value: "142/88", unit: "mmHg", date: "2024-02-01", status: "Warning" },
          { type: "Heart Rate", value: "78", unit: "bpm", date: "2024-02-01", status: "Normal" },
          { type: "Weight", value: "198", unit: "lbs", date: "2024-02-01", status: "Normal" }
        ],
        demographics: { age: "58", gender: "Male" }
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPatientSummaryResult(data.data);
      }
      toast({ title: "Summary Generated", description: "Patient record summary has been created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate patient summary", variant: "destructive" });
    },
  });

  const referralLetterMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-dashboard-enhanced/referral-letter/${patientId}`, {
        targetSpecialty: referralSpecialty,
        referringDiagnosis: referralDiagnosis,
        urgency: referralUrgency,
        referringProviderName: referralProviderName || "Dr. Provider",
        additionalNotes: referralNotes || undefined,
        patientConditions: ["Type 2 Diabetes Mellitus", "Essential Hypertension", "Hyperlipidemia"],
        patientMedications: ["Metformin 1000mg BID", "Lisinopril 20mg QD", "Atorvastatin 40mg QHS"],
        patientAllergies: ["Penicillin", "Sulfa drugs"],
        relevantLabs: ["HbA1c: 7.8%", "LDL: 142 mg/dL"]
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setReferralLetterResult(data.data);
      }
      toast({ title: "Referral Letter Generated", description: "AI-drafted referral letter is ready for review" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate referral letter", variant: "destructive" });
    },
  });

  const differentialDxMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-dashboard-enhanced/differential-dx/${patientId}`, {
        symptoms,
        duration: symptomDuration || undefined,
        severity: symptomSeverity || undefined,
        patientAge: "58",
        patientGender: "Male",
        existingConditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
        currentMedications: ["Metformin", "Lisinopril", "Atorvastatin"]
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setDifferentialDxResult(data.data);
      }
      toast({ title: "Analysis Complete", description: "Differential possibilities generated for review" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate differential analysis", variant: "destructive" });
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchTasks();
    if (selectedPatientId) {
      if (activeTab === "vitals") refetchVitals();
      if (activeTab === "documentation") refetchSummaries();
    }
  };

  const stats = statsResponse?.data;
  const tasks = tasksResponse?.data?.tasks || [];
  const patients = patientsResponse?.data?.patients || [];
  const vitals = vitalsResponse?.data;
  const summaries = summariesResponse?.data?.summaries || [];

  const loadSampleDocument = () => {
    setDocumentContent(`ENCOUNTER NOTE
Date: ${new Date().toLocaleDateString()}
Patient: ${patients.find(p => p.patientId === selectedPatientId)?.patientName || "Unknown Patient"}

CHIEF COMPLAINT:
Follow-up for diabetes management and hypertension control.

HISTORY OF PRESENT ILLNESS:
Patient presents for routine follow-up. Reports improved dietary habits over the past month. Blood glucose readings at home have been ranging 150-200 mg/dL. Denies polyuria, polydipsia, or visual changes. Blood pressure has been stable on current medications.

CURRENT MEDICATIONS:
- Metformin 1000mg twice daily
- Lisinopril 20mg once daily
- Atorvastatin 40mg at bedtime

PHYSICAL EXAMINATION:
Blood Pressure: 142/88 mmHg
Heart Rate: 78 bpm
Weight: 198 lbs (down 4 lbs from last visit)
General: Well-appearing, no acute distress
Cardiovascular: Regular rate and rhythm, no murmurs

ASSESSMENT:
1. Type 2 Diabetes Mellitus - suboptimally controlled
2. Essential Hypertension - controlled
3. Hyperlipidemia - on statin therapy

PLAN:
1. Continue current medications
2. Reinforce dietary modifications and exercise
3. Order HbA1c and lipid panel
4. Follow up in 3 months
5. Referral to diabetes educator if A1c > 8%`);
  };

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="ai-provider-dashboard-enhanced">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Provider Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Personalized tasks, real-time vitals monitoring, and AI documentation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/ai-provider-dashboard">
            <Button variant="ghost" data-testid="link-classic-dashboard">
              Classic Dashboard
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-pending-tasks">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-tasks">
                {stats?.taskSummary.pending || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.taskSummary.critical || 0} critical, {stats?.taskSummary.high || 0} high priority
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-vitals-alerts">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Vitals Alerts</CardTitle>
              <Activity className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-vitals-alerts">
                {(stats?.vitalsSummary.criticalAlerts || 0) + (stats?.vitalsSummary.warningAlerts || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.vitalsSummary.patientsMonitored || 0} patients monitored
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-docs">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-docs">
                {stats?.documentationSummary.pendingReviews || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.documentationSummary.summariesGenerated || 0} summaries generated
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-overdue-tasks">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
              <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-overdue-tasks">
                {stats?.taskSummary.overdue || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.taskSummary.completed || 0} completed today
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            AI Task List
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">
            <Activity className="h-4 w-4 mr-2" />
            Vitals Monitor
          </TabsTrigger>
          <TabsTrigger value="documentation" data-testid="tab-documentation">
            <FileText className="h-4 w-4 mr-2" />
            Doc Summaries
          </TabsTrigger>
          <TabsTrigger value="patient-summary" data-testid="tab-patient-summary">
            <ClipboardList className="h-4 w-4 mr-2" />
            Patient Summary
          </TabsTrigger>
          <TabsTrigger value="referral" data-testid="tab-referral">
            <Send className="h-4 w-4 mr-2" />
            Referral Letter
          </TabsTrigger>
          <TabsTrigger value="differential-dx" data-testid="tab-differential-dx">
            <Stethoscope className="h-4 w-4 mr-2" />
            Differential Dx
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI-Driven Task List
              </CardTitle>
              <CardDescription>
                Personalized tasks prioritized by AI based on patient data and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : tasks.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {tasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className={`p-4 border rounded-lg hover-elevate ${task.priority === "critical" ? "border-destructive" : ""}`}
                        data-testid={`task-item-${idx}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            {getStatusIcon(task.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{task.title}</span>
                                <Badge variant={getPriorityBadgeVariant(task.priority)}>
                                  {task.priority}
                                </Badge>
                                <Badge variant="outline">{task.category.replace("_", " ")}</Badge>
                                {task.source === "ai_generated" && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                              {task.patientName && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  <User className="h-3 w-3 inline mr-1" />
                                  {task.patientName}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                              {task.aiRationale && (
                                <p className="text-xs text-primary mt-2 bg-primary/5 p-2 rounded">
                                  <Sparkles className="h-3 w-3 inline mr-1" />
                                  {task.aiRationale}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {task.estimatedMinutes} min
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Due: {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {task.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "in_progress" })}
                              disabled={updateTaskMutation.isPending}
                              data-testid={`button-start-task-${idx}`}
                            >
                              Start Task
                            </Button>
                          )}
                          {task.status === "in_progress" && (
                            <Button
                              size="sm"
                              onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "completed" })}
                              disabled={updateTaskMutation.isPending}
                              data-testid={`button-complete-task-${idx}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                          {task.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "deferred" })}
                              disabled={updateTaskMutation.isPending}
                            >
                              Defer
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>All tasks completed! Great work.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Monitored Patients</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {patients.map((patient) => (
                      <div
                        key={patient.patientId}
                        className={`p-3 rounded-lg cursor-pointer hover-elevate ${selectedPatientId === patient.patientId ? "bg-primary/10 border border-primary" : "border"}`}
                        {...clickable(() => setSelectedPatientId(patient.patientId))}
                        data-testid={`patient-${patient.patientId}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="font-medium text-sm">{patient.patientName}</span>
                          </div>
                          {patient.hasAlerts && (
                            <Bell className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Real-Time Vitals Monitoring
                </CardTitle>
                <CardDescription>
                  AI-powered trend analysis and anomaly detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vitalsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : vitals ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Analysis
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">{vitals.aiAnalysis.summary}</p>
                      {vitals.aiAnalysis.keyFindings.length > 0 && (
                        <div className="space-y-1">
                          {vitals.aiAnalysis.keyFindings.map((finding, idx) => (
                            <div key={idx} className="text-sm flex items-start gap-2">
                              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                              {finding}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {vitals.alerts.filter(a => !a.acknowledged).length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          Active Alerts
                        </h4>
                        <div className="space-y-2">
                          {vitals.alerts.filter(a => !a.acknowledged).map((alert) => (
                            <div
                              key={alert.id}
                              className={`p-3 rounded-lg border ${alert.severity === "critical" ? "border-destructive bg-destructive/5" : "border-yellow-500 bg-yellow-500/5"}`}
                              data-testid={`vitals-alert-${alert.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                                      {alert.severity}
                                    </Badge>
                                    <span className="font-medium">{alert.title}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => acknowledgeAlertMutation.mutate({ patientId: vitals.patientId, alertId: alert.id })}
                                  disabled={acknowledgeAlertMutation.isPending}
                                  data-testid={`button-acknowledge-${alert.id}`}
                                >
                                  Acknowledge
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold mb-3">Current Vitals</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {vitals.currentVitals.map((vital) => (
                          <div
                            key={vital.id}
                            className={`p-3 rounded-lg border ${vital.status === "critical" ? "border-destructive" : vital.status === "warning" ? "border-yellow-500" : ""}`}
                            data-testid={`vital-${vital.type}`}
                          >
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              {getVitalIcon(vital.type)}
                              <span className="text-xs">{formatVitalType(vital.type)}</span>
                            </div>
                            <div className="text-xl font-bold">
                              {vital.value} <span className="text-sm font-normal">{vital.unit}</span>
                            </div>
                            <Badge variant={vital.status === "normal" ? "secondary" : vital.status === "warning" ? "outline" : "destructive"} className="mt-1">
                              {vital.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Trends (24h)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {vitals.trends.map((trend) => (
                          <div key={trend.vitalType} className="p-3 rounded-lg border">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{formatVitalType(trend.vitalType)}</span>
                              <div className="flex items-center gap-1">
                                {getTrendIcon(trend.direction)}
                                <span className={`text-sm ${trend.changePercentage > 0 ? "text-yellow-500" : trend.changePercentage < 0 ? "text-blue-500" : "text-green-500"}`}>
                                  {trend.changePercentage > 0 ? "+" : ""}{trend.changePercentage}%
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Avg: {trend.averageValue} | {trend.direction}
                            </div>
                            <Badge variant={trend.significance === "concerning" ? "destructive" : trend.significance === "notable" ? "secondary" : "outline"} className="mt-2">
                              {trend.significance}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a patient to view vitals monitoring</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documentation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5" />
                  Generate Documentation Summary
                </CardTitle>
                <CardDescription>
                  AI-powered clinical documentation summarization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
                    <SelectTrigger className="w-[200px]" data-testid="select-patient">
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.patientId} value={patient.patientId}>
                          {patient.patientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="w-[180px]" data-testid="select-doc-type">
                      <SelectValue placeholder="Document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="encounter_note">Encounter Note</SelectItem>
                      <SelectItem value="discharge_summary">Discharge Summary</SelectItem>
                      <SelectItem value="progress_note">Progress Note</SelectItem>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="procedure_note">Procedure Note</SelectItem>
                      <SelectItem value="history_physical">History & Physical</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={loadSampleDocument} data-testid="button-load-sample">
                    Load Sample
                  </Button>
                </div>

                <Textarea
                  placeholder="Paste clinical documentation here..."
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                  rows={12}
                  data-testid="input-document-content"
                />

                <Button
                  onClick={() => {
                    if (selectedPatientId && documentContent.length >= 50) {
                      generateSummaryMutation.mutate({
                        patientId: selectedPatientId,
                        documentContent,
                        documentType,
                      });
                    }
                  }}
                  disabled={!selectedPatientId || documentContent.length < 50 || generateSummaryMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-summary"
                >
                  {generateSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Summary...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate AI Summary
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Summaries
                </CardTitle>
                <CardDescription>
                  AI-generated documentation summaries for selected patient
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summariesLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-40 w-full" />
                    ))}
                  </div>
                ) : summaries.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4 pr-4">
                      {summaries.map((summary, idx) => (
                        <Card key={summary.id} data-testid={`summary-${idx}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{summary.documentType.replace("_", " ")}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(summary.generatedAt), "PPp")}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Progress value={summary.qualityMetrics.overallScore * 100} className="w-20 h-2" />
                                <span className="text-xs">{Math.round(summary.qualityMetrics.overallScore * 100)}%</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div>
                              <h5 className="text-sm font-semibold mb-1">Overview</h5>
                              <p className="text-sm text-muted-foreground">{summary.summary.overview}</p>
                            </div>

                            {summary.summary.keyPoints.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold mb-1">Key Points</h5>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                  {summary.summary.keyPoints.slice(0, 4).map((point, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {summary.summary.diagnoses.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold mb-1">Diagnoses</h5>
                                <div className="flex flex-wrap gap-1">
                                  {summary.summary.diagnoses.map((dx, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {dx.display}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground pt-2 border-t">
                              Compressed from {summary.metadata.originalWordCount} to {summary.metadata.summaryWordCount} words
                              ({Math.round((1 - summary.metadata.compressionRatio) * 100)}% reduction)
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No summaries generated yet. Select a patient and generate a summary.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patient-summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Patient Record Summary
              </CardTitle>
              <CardDescription>
                AI-generated comprehensive patient record overview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-patient-summary-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.patientId} value={patient.patientId}>
                        {patient.patientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (selectedPatientId) {
                      patientSummaryMutation.mutate(selectedPatientId);
                    }
                  }}
                  disabled={!selectedPatientId || patientSummaryMutation.isPending}
                  data-testid="button-generate-patient-summary"
                >
                  {patientSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Patient Summary
                    </>
                  )}
                </Button>
              </div>

              {patientSummaryMutation.isPending && (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              )}

              {patientSummaryResult && !patientSummaryMutation.isPending && (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4 pr-4">
                    <div className="p-4 bg-primary/5 rounded-lg" data-testid="section-ai-overview">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI Overview
                      </h4>
                      <p className="text-sm text-muted-foreground">{patientSummaryResult.aiSummary.overview}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" data-testid="badge-confidence-score">
                          Confidence: {Math.round(patientSummaryResult.confidenceScore * 100)}%
                        </Badge>
                        {patientSummaryResult.demographics.age && (
                          <Badge variant="outline" data-testid="badge-demographics">
                            {patientSummaryResult.demographics.age}y {patientSummaryResult.demographics.gender}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {patientSummaryResult.aiSummary.keyFindings.length > 0 && (
                      <Card data-testid="section-key-findings">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Key Findings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1">
                            {patientSummaryResult.aiSummary.keyFindings.map((finding, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2" data-testid={`text-key-finding-${idx}`}>
                                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {patientSummaryResult.aiSummary.activeIssues.length > 0 && (
                      <Card data-testid="section-active-issues">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Active Issues</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {patientSummaryResult.aiSummary.activeIssues.map((issue, idx) => (
                              <Badge key={idx} variant="destructive" data-testid={`badge-active-issue-${idx}`}>
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card data-testid="section-active-conditions">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Active Conditions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {patientSummaryResult.activeConditions.map((condition, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-lg" data-testid={`row-condition-${idx}`}>
                              <span className="text-sm font-medium">{condition.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{condition.status}</Badge>
                                {condition.onsetDate && (
                                  <span className="text-xs text-muted-foreground">Since {condition.onsetDate}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="section-medications">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Current Medications</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {patientSummaryResult.currentMedications.map((med, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-lg" data-testid={`row-medication-${idx}`}>
                              <span className="text-sm font-medium">{med.name}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{med.dosage}</Badge>
                                <span className="text-xs text-muted-foreground">{med.frequency}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="section-allergies">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Allergies</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {patientSummaryResult.allergies.map((allergy, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-lg" data-testid={`row-allergy-${idx}`}>
                              <span className="text-sm font-medium">{allergy.substance}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant={allergy.severity === "Moderate" || allergy.severity === "Severe" ? "destructive" : "outline"}>
                                  {allergy.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{allergy.reaction}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="section-recent-labs">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Recent Labs</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {patientSummaryResult.recentLabs.map((lab, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-lg" data-testid={`row-lab-${idx}`}>
                              <span className="text-sm font-medium">{lab.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{lab.value} {lab.unit}</span>
                                <Badge variant={lab.status === "Normal" ? "secondary" : "destructive"}>
                                  {lab.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{lab.date}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="section-recent-vitals">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Recent Vitals</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {patientSummaryResult.recentVitals.map((vital, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-lg" data-testid={`row-vital-summary-${idx}`}>
                              <span className="text-sm font-medium">{vital.type}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{vital.value} {vital.unit}</span>
                                <Badge variant={vital.status === "Normal" ? "secondary" : vital.status === "Warning" ? "outline" : "destructive"}>
                                  {vital.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{vital.date}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {patientSummaryResult.aiSummary.recentChanges.length > 0 && (
                      <Card data-testid="section-recent-changes">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Recent Changes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1">
                            {patientSummaryResult.aiSummary.recentChanges.map((change, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2" data-testid={`text-recent-change-${idx}`}>
                                <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                                {change}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {patientSummaryResult.aiSummary.preventiveCareGaps.length > 0 && (
                      <Card data-testid="section-preventive-gaps">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Preventive Care Gaps</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-1">
                            {patientSummaryResult.aiSummary.preventiveCareGaps.map((gap, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2" data-testid={`text-preventive-gap-${idx}`}>
                                <Shield className="h-4 w-4 shrink-0 text-yellow-500" />
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground" data-testid="text-patient-summary-disclaimer">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                AI-generated summary is for INFORMATIONAL purposes only. Verify all data with authoritative clinical sources before making any decisions.
              </p>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="referral" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Generate Referral Letter
                </CardTitle>
                <CardDescription>
                  AI-drafted referral letter for specialist consultation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="ai-provider-dashboard-en-patient" className="text-sm font-medium mb-1 block">Patient</label>
                  <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
                    <SelectTrigger id="ai-provider-dashboard-en-patient" data-testid="select-referral-patient">
                      <SelectValue placeholder="Select patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.patientId} value={patient.patientId}>
                          {patient.patientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="ai-provider-dashboard-en-target-specialty" className="text-sm font-medium mb-1 block">Target Specialty</label>
                  <Input id="ai-provider-dashboard-en-target-specialty"
                    placeholder="e.g., Endocrinology, Cardiology"
                    value={referralSpecialty}
                    onChange={(e) => setReferralSpecialty(e.target.value)}
                    data-testid="input-referral-specialty"
                  />
                </div>
                <div>
                  <label htmlFor="ai-provider-dashboard-en-referring-diagnosis" className="text-sm font-medium mb-1 block">Referring Diagnosis</label>
                  <Input id="ai-provider-dashboard-en-referring-diagnosis"
                    placeholder="e.g., Suboptimally controlled Type 2 Diabetes"
                    value={referralDiagnosis}
                    onChange={(e) => setReferralDiagnosis(e.target.value)}
                    data-testid="input-referral-diagnosis"
                  />
                </div>
                <div>
                  <label htmlFor="ai-provider-dashboard-en-urgency" className="text-sm font-medium mb-1 block">Urgency</label>
                  <Select value={referralUrgency} onValueChange={setReferralUrgency}>
                    <SelectTrigger id="ai-provider-dashboard-en-urgency" data-testid="select-referral-urgency">
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergent">Emergent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="ai-provider-dashboard-en-provider-name" className="text-sm font-medium mb-1 block">Provider Name</label>
                  <Input id="ai-provider-dashboard-en-provider-name"
                    placeholder="e.g., Dr. Smith"
                    value={referralProviderName}
                    onChange={(e) => setReferralProviderName(e.target.value)}
                    data-testid="input-referral-provider"
                  />
                </div>
                <div>
                  <label htmlFor="ai-provider-dashboard-en-additional-notes" className="text-sm font-medium mb-1 block">Additional Notes</label>
                  <Textarea id="ai-provider-dashboard-en-additional-notes"
                    placeholder="Any additional context for the referral..."
                    value={referralNotes}
                    onChange={(e) => setReferralNotes(e.target.value)}
                    rows={3}
                    data-testid="input-referral-notes"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (selectedPatientId && referralSpecialty && referralDiagnosis) {
                      referralLetterMutation.mutate(selectedPatientId);
                    }
                  }}
                  disabled={!selectedPatientId || !referralSpecialty || !referralDiagnosis || referralLetterMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-referral"
                >
                  {referralLetterMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Letter...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Generate Referral Letter
                    </>
                  )}
                </Button>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground" data-testid="text-referral-disclaimer">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  AI-drafted letter requires provider review and approval before sending.
                </p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Letter
                </CardTitle>
                <CardDescription>
                  Review and edit the AI-generated referral letter
                </CardDescription>
              </CardHeader>
              <CardContent>
                {referralLetterMutation.isPending && (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                )}
                {referralLetterResult && !referralLetterMutation.isPending ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4 pr-4" data-testid="section-referral-letter">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={referralLetterResult.urgency === "emergent" ? "destructive" : referralLetterResult.urgency === "urgent" ? "secondary" : "outline"} data-testid="badge-referral-urgency">
                            {referralLetterResult.urgency}
                          </Badge>
                          <Badge variant="outline" data-testid="badge-referral-specialty">
                            {referralLetterResult.targetSpecialty}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground" data-testid="text-referral-date">
                          {format(new Date(referralLetterResult.generatedAt), "PPp")}
                        </span>
                      </div>

                      <div className="space-y-3 text-sm" data-testid="text-referral-content">
                        <p>{referralLetterResult.letterContent.salutation}</p>
                        <p>{referralLetterResult.letterContent.introduction}</p>
                        <div>
                          <h5 className="font-semibold mb-1">Clinical History</h5>
                          <p className="text-muted-foreground">{referralLetterResult.letterContent.clinicalHistory}</p>
                        </div>
                        <div>
                          <h5 className="font-semibold mb-1">Current Findings</h5>
                          <p className="text-muted-foreground">{referralLetterResult.letterContent.currentFindings}</p>
                        </div>
                        <div>
                          <h5 className="font-semibold mb-1">Reason for Referral</h5>
                          <p className="text-muted-foreground">{referralLetterResult.letterContent.reasonForReferral}</p>
                        </div>
                        <div>
                          <h5 className="font-semibold mb-1">Requested Actions</h5>
                          <p className="text-muted-foreground">{referralLetterResult.letterContent.requestedActions}</p>
                        </div>
                        <p>{referralLetterResult.letterContent.closing}</p>
                      </div>

                      {referralLetterResult.attachmentSuggestions.length > 0 && (
                        <div data-testid="section-attachment-suggestions">
                          <h5 className="text-sm font-semibold mb-2">Suggested Attachments</h5>
                          <div className="flex flex-wrap gap-1">
                            {referralLetterResult.attachmentSuggestions.map((item, idx) => (
                              <Badge key={idx} variant="outline" data-testid={`badge-attachment-${idx}`}>
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => {
                          const content = referralLetterResult.letterContent;
                          const fullText = [
                            content.salutation,
                            content.introduction,
                            "Clinical History:",
                            content.clinicalHistory,
                            "Current Findings:",
                            content.currentFindings,
                            "Reason for Referral:",
                            content.reasonForReferral,
                            "Requested Actions:",
                            content.requestedActions,
                            content.closing,
                          ].join("\n\n");
                          navigator.clipboard.writeText(fullText);
                          toast({ title: "Copied", description: "Referral letter copied to clipboard" });
                        }}
                        data-testid="button-copy-referral"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </Button>
                    </div>
                  </ScrollArea>
                ) : !referralLetterMutation.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Fill in the referral details and generate a letter.</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="differential-dx" className="space-y-4">
          <Card className="border-yellow-500/50 bg-yellow-500/5" data-testid="card-dx-disclaimer">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <Shield className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-700 dark:text-yellow-300 text-sm">FOR INFORMATIONAL REFERENCE ONLY</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1" data-testid="text-dx-disclaimer">
                    These are conditions commonly associated with the reported symptoms in medical literature. This does NOT constitute a diagnosis. All clinical decisions must be made by qualified healthcare professionals based on comprehensive evaluation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Symptom Entry
                </CardTitle>
                <CardDescription>
                  Enter symptoms to analyze possible conditions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter a symptom..."
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && symptomInput.trim()) {
                        setSymptoms((prev) => [...prev, symptomInput.trim()]);
                        setSymptomInput("");
                      }
                    }}
                    data-testid="input-symptom"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (symptomInput.trim()) {
                        setSymptoms((prev) => [...prev, symptomInput.trim()]);
                        setSymptomInput("");
                      }
                    }}
                    data-testid="button-add-symptom"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {symptoms.length > 0 && (
                  <div className="flex flex-wrap gap-2" data-testid="section-symptom-list">
                    {symptoms.map((symptom, idx) => (
                      <Badge key={idx} variant="secondary" data-testid={`badge-symptom-${idx}`}>
                        {symptom}
                        <button
                          className="ml-1 inline-flex"
                          onClick={() => setSymptoms((prev) => prev.filter((_, i) => i !== idx))}
                          data-testid={`button-remove-symptom-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div>
                  <label htmlFor="ai-provider-dashboard-en-duration" className="text-sm font-medium mb-1 block">Duration</label>
                  <Input id="ai-provider-dashboard-en-duration"
                    placeholder="e.g., 3 days, 2 weeks"
                    value={symptomDuration}
                    onChange={(e) => setSymptomDuration(e.target.value)}
                    data-testid="input-dx-duration"
                  />
                </div>

                <div>
                  <label htmlFor="ai-provider-dashboard-en-severity" className="text-sm font-medium mb-1 block">Severity</label>
                  <Select value={symptomSeverity} onValueChange={setSymptomSeverity}>
                    <SelectTrigger id="ai-provider-dashboard-en-severity" data-testid="select-dx-severity">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={() => {
                    if (selectedPatientId && symptoms.length > 0) {
                      differentialDxMutation.mutate(selectedPatientId);
                    }
                  }}
                  disabled={symptoms.length === 0 || !selectedPatientId || differentialDxMutation.isPending}
                  className="w-full"
                  data-testid="button-analyze-dx"
                >
                  {differentialDxMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Stethoscope className="h-4 w-4 mr-2" />
                      Analyze Symptoms
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Differential Analysis Results
                </CardTitle>
                <CardDescription>
                  Possible conditions based on reported symptoms
                </CardDescription>
              </CardHeader>
              <CardContent>
                {differentialDxMutation.isPending && (
                  <div className="space-y-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                )}
                {differentialDxResult && !differentialDxMutation.isPending ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4 pr-4">
                      <div className="flex items-center gap-2 flex-wrap" data-testid="section-dx-input-symptoms">
                        <span className="text-sm font-medium">Analyzed symptoms:</span>
                        {differentialDxResult.inputSymptoms.map((s, idx) => (
                          <Badge key={idx} variant="outline" data-testid={`badge-input-symptom-${idx}`}>
                            {s}
                          </Badge>
                        ))}
                      </div>

                      {differentialDxResult.possibleConditions.map((condition, idx) => (
                        <Card key={idx} data-testid={`card-condition-${idx}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-base" data-testid={`text-condition-name-${idx}`}>{condition.name}</CardTitle>
                                {condition.icdCode && (
                                  <Badge variant="outline" data-testid={`badge-icd-${idx}`}>
                                    {condition.icdCode}
                                  </Badge>
                                )}
                              </div>
                              <Badge
                                variant={condition.likelihoodLevel === "high" ? "destructive" : condition.likelihoodLevel === "moderate" ? "secondary" : "outline"}
                                data-testid={`badge-likelihood-${idx}`}
                              >
                                {condition.likelihoodLevel} likelihood
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {condition.supportingFactors.length > 0 && (
                              <div data-testid={`section-supporting-${idx}`}>
                                <h5 className="text-sm font-semibold mb-1">Supporting Factors</h5>
                                <ul className="space-y-1">
                                  {condition.supportingFactors.map((factor, fi) => (
                                    <li key={fi} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                                      {factor}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {condition.contraindicatingFactors.length > 0 && (
                              <div data-testid={`section-contraindicating-${idx}`}>
                                <h5 className="text-sm font-semibold mb-1">Contraindicating Factors</h5>
                                <ul className="space-y-1">
                                  {condition.contraindicatingFactors.map((factor, fi) => (
                                    <li key={fi} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <X className="h-4 w-4 shrink-0 text-destructive" />
                                      {factor}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {condition.suggestedWorkup.length > 0 && (
                              <div data-testid={`section-workup-${idx}`}>
                                <h5 className="text-sm font-semibold mb-1">Suggested Workup</h5>
                                <div className="flex flex-wrap gap-1">
                                  {condition.suggestedWorkup.map((item, wi) => (
                                    <Badge key={wi} variant="outline" data-testid={`badge-workup-${idx}-${wi}`}>
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {differentialDxResult.generalRecommendations.length > 0 && (
                        <Card data-testid="section-general-recommendations">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">General Recommendations</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-1">
                              {differentialDxResult.generalRecommendations.map((rec, idx) => (
                                <li key={idx} className="text-sm flex items-start gap-2" data-testid={`text-recommendation-${idx}`}>
                                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                                  {rec}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" data-testid="badge-dx-confidence">
                          Confidence: {Math.round(differentialDxResult.confidenceScore * 100)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Generated {format(new Date(differentialDxResult.generatedAt), "PPp")}
                        </span>
                      </div>
                    </div>
                  </ScrollArea>
                ) : !differentialDxMutation.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Add symptoms and click Analyze to see differential possibilities.</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border-yellow-500/50 bg-yellow-500/5" data-testid="card-disclaimer">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-700 dark:text-yellow-300 text-sm">NO-CDS Compliance Notice</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1" data-testid="text-disclaimer">
                AI-generated insights are for INFORMATIONAL and OPERATIONAL purposes only. They do NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
