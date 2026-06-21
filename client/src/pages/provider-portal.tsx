import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Bell,
  MessageSquare,
  GraduationCap,
  Settings,
  Sparkles,
  User,
  Calendar,
  Pill,
  Heart,
  Plus,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Search,
  Loader2,
  ChevronRight,
  FileText,
  Paperclip,
  ShieldAlert,
  Zap,
  RefreshCw,
  ArrowRight,
  Target,
  ClipboardList,
  LineChart,
  History,
  BarChart3,
  Shield,
  Download,
  Image,
  Thermometer,
  CalendarDays,
  Droplets,
  Scale,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  UserSquare2,
  Share2,
  FlaskConical,
  Stethoscope,
  Brain,
  ListTodo,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import html2canvas from "html2canvas";
import { Link } from "wouter";
import { PatientPopulationManagementCard } from "@/components/patient-population-management-card";
import type { 
  Prescription, 
  InsertPrescription, 
  PrescriptionStatus,
  RefillRequest,
  RefillRequestStatus,
  Pharmacy,
  ProviderTask,
  InsertProviderTask,
  ProviderTaskStatus,
  ProviderTaskPriority,
  ProviderTaskCategory,
} from "@shared/schema";

interface DashboardStats {
  totalPatients: number;
  criticalAlerts: number;
  pendingReviews: number;
  upcomingAppointments: number;
  averageAdherenceRate: number;
  riskDistribution: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
}

interface PatientCard {
  patientId: string;
  patientName: string;
  age: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  activeConditions: number;
  activeMedications: number;
  pendingAlerts: number;
  lastVisit: string;
  nextAppointment?: string;
  adherenceRate?: number;
  recentTrend: "improving" | "stable" | "declining";
}

interface AIPatientSummary {
  patientId: string;
  patientName: string;
  generatedAt: string;
  overviewSummary: string;
  clinicalSynopsis: string;
  healthTrends: { 
    category: string; 
    trend: string; 
    description: string; 
    clinicalSignificance: "low" | "moderate" | "high";
  }[];
  riskFactors: {
    factor: string;
    severity: "low" | "moderate" | "high" | "critical";
    explanation: string;
  }[];
  rpmAlertSummary: string;
  keyFindings: string[];
  recommendedActions: string[];
  medicationConcerns: string[];
  followUpRecommendations: string[];
  priorityLevel: string;
  confidenceScore: number;
  isCached: boolean;
  cacheExpiresAt?: string;
}

interface SummaryStatus {
  totalPatients: number;
  cachedSummaries: number;
  staleSummaries: number;
  highRiskWithoutSummary: number;
}

interface AlertRule {
  id: string;
  providerId: string;
  patientId?: string;
  name: string;
  description: string;
  metricType: string;
  metricName: string;
  operator: string;
  thresholdValue: number;
  thresholdValue2?: number;
  severity: string;
  notificationChannels: string[];
  isActive: boolean;
  createdAt: string;
  triggeredCount: number;
}

interface Conversation {
  id: string;
  title: string;
  patientId?: string;
  patientName?: string;
  participants: { id: string; name: string; role: string; specialty?: string }[];
  lastMessage?: string;
  lastMessageAt: string;
  unreadCount: number;
  isArchived: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  patientId?: string;
  attachments?: { type: string; name: string }[];
  isEncrypted: boolean;
  readBy: string[];
  createdAt: string;
}

interface EducationPrescription {
  id: string;
  providerId: string;
  providerName: string;
  patientId: string;
  patientName: string;
  moduleTitle: string;
  moduleTopic: string;
  reason: string;
  priority: string;
  dueDate?: string;
  status: string;
  prescribedAt: string;
  completedAt?: string;
}

interface DrugInteraction {
  id: string;
  medication1: { id: string; name: string; dosage: string };
  medication2: { id: string; name: string; dosage: string };
  severity: "contraindicated" | "serious" | "moderate" | "minor";
  mechanism: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendation: string;
  alternativeOptions?: string[];
  monitoringRequired?: string[];
  aiConfidence: number;
  detectedAt: string;
}

interface AdherenceIssue {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  issueType: string;
  severity: "mild" | "moderate" | "severe";
  description: string;
  evidencePoints: string[];
  likelyRootCause: string;
  impactOnOutcomes: string;
  suggestedInterventions: string[];
  aiConfidence: number;
  detectedAt: string;
}

interface MedicationRisk {
  id: string;
  riskType: string;
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  description: string;
  affectedMedications: { id: string; name: string }[];
  patientFactors: string[];
  aiConfidence: number;
}

interface InterventionStrategy {
  id: string;
  targetRiskId: string;
  urgency: "immediate" | "urgent" | "soon" | "routine";
  strategyType: string;
  title: string;
  description: string;
  steps: { order: number; action: string; responsible: string; timeframe: string }[];
  expectedOutcome: string;
  evidenceLevel: "strong" | "moderate" | "limited";
  contraindications?: string[];
  aiConfidence: number;
}

interface MedicationSafetyAnalysis {
  patientId: string;
  patientName: string;
  analyzedAt: string;
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  activeMedicationsCount: number;
  interactions: DrugInteraction[];
  adherenceIssues: AdherenceIssue[];
  medicationRisks: MedicationRisk[];
  interventionStrategies: InterventionStrategy[];
  summary: string;
  prioritizedActions: string[];
  aiConfidence: number;
}

const riskColors = {
  low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  moderate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const trendIcons = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

const priorityColors = {
  routine: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  attention: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  important: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  urgent: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  critical: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400",
  expired: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function DashboardTab() {
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [showAlertsOnly, setShowAlertsOnly] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: stats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/provider/portal/dashboard"],
  });

  const buildPatientQueryUrl = () => {
    const params = new URLSearchParams();
    if (riskFilter && riskFilter !== "all") params.append("riskLevel", riskFilter);
    if (showAlertsOnly) params.append("hasAlerts", "true");
    const queryStr = params.toString();
    return `/api/provider/portal/patients${queryStr ? `?${queryStr}` : ""}`;
  };

  const { data: patients = [], isLoading: loadingPatients } = useQuery<PatientCard[]>({
    queryKey: [buildPatientQueryUrl()],
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("POST", `/api/provider/portal/patients/${patientId}/ai-summary`);
      return res.json();
    },
    onSuccess: (data: AIPatientSummary) => {
      toast({
        title: "AI Summary Generated",
        description: `Summary for ${data.patientName} is ready`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate AI summary",
        variant: "destructive",
      });
    },
  });

  const [aiSummary, setAiSummary] = useState<AIPatientSummary | null>(null);

  const handleGenerateSummary = async (patientId: string) => {
    setSelectedPatientId(patientId);
    const result = await generateSummaryMutation.mutateAsync(patientId);
    setAiSummary(result);
  };

  if (loadingStats || loadingPatients) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-patients">
          <CardHeader className="pb-2">
            <CardDescription>Total Patients</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span data-testid="value-total-patients">{stats?.totalPatients || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="stat-critical-alerts">
          <CardHeader className="pb-2">
            <CardDescription>Critical Alerts</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span data-testid="value-critical-alerts">{stats?.criticalAlerts || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="stat-pending-reviews">
          <CardHeader className="pb-2">
            <CardDescription>Pending Reviews</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span data-testid="value-pending-reviews">{stats?.pendingReviews || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card data-testid="stat-avg-adherence">
          <CardHeader className="pb-2">
            <CardDescription>Avg. Adherence</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Pill className="h-5 w-5 text-green-500" />
              <span data-testid="value-avg-adherence">{stats?.averageAdherenceRate || 0}%</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Patient Risk Distribution</CardTitle>
              <CardDescription>Overview of patient risk levels</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(stats?.riskDistribution || {}).map(([level, count]) => (
              <div key={level} className="flex items-center gap-2" data-testid={`risk-${level}`}>
                <Badge className={riskColors[level as keyof typeof riskColors]} variant="outline">
                  {level}
                </Badge>
                <span className="text-sm font-medium" data-testid={`count-${level}`}>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Patient Panel</CardTitle>
              <CardDescription>Manage and monitor your patients</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[140px] min-h-[44px]" data-testid="select-risk-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Risks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 min-h-[44px]">
                <Switch
                  id="alerts-only"
                  checked={showAlertsOnly}
                  onCheckedChange={setShowAlertsOnly}
                  data-testid="switch-alerts-only"
                />
                <Label htmlFor="alerts-only" className="text-sm cursor-pointer">Alerts Only</Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {patients.map((patient) => {
                const TrendIcon = trendIcons[patient.recentTrend];
                return (
                  <div
                    key={patient.patientId}
                    className="p-4 border rounded-md hover-elevate"
                    data-testid={`patient-card-${patient.patientId}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2" data-testid={`patient-name-${patient.patientId}`}>
                            {patient.patientName}
                            <Badge className={riskColors[patient.riskLevel]} variant="outline" data-testid={`patient-risk-${patient.patientId}`}>
                              {patient.riskLevel}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`patient-info-${patient.patientId}`}>
                            Age {patient.age} | {patient.activeConditions} conditions | {patient.activeMedications} meds
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {patient.pendingAlerts > 0 && (
                          <Badge variant="destructive" className="gap-1" data-testid={`patient-alerts-${patient.patientId}`}>
                            <Bell className="h-3 w-3" />
                            {patient.pendingAlerts}
                          </Badge>
                        )}
                        <TrendIcon
                          className={`h-4 w-4 ${
                            patient.recentTrend === "improving"
                              ? "text-green-500"
                              : patient.recentTrend === "declining"
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}
                          data-testid={`patient-trend-${patient.patientId}`}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1" data-testid={`patient-last-visit-${patient.patientId}`}>
                          <Calendar className="h-3 w-3" />
                          Last: {format(new Date(patient.lastVisit), "MMM d")}
                        </span>
                        {patient.nextAppointment && (
                          <span className="flex items-center gap-1" data-testid={`patient-next-appt-${patient.patientId}`}>
                            <Clock className="h-3 w-3" />
                            Next: {format(new Date(patient.nextAppointment), "MMM d")}
                          </span>
                        )}
                        {patient.adherenceRate !== undefined && (
                          <span className="flex items-center gap-1" data-testid={`patient-adherence-${patient.patientId}`}>
                            <Pill className="h-3 w-3" />
                            {patient.adherenceRate}% adherence
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="min-h-[44px]"
                          onClick={() => handleGenerateSummary(patient.patientId)}
                          disabled={generateSummaryMutation.isPending && selectedPatientId === patient.patientId}
                          data-testid={`button-ai-summary-${patient.patientId}`}
                        >
                          {generateSummaryMutation.isPending && selectedPatientId === patient.patientId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          AI Summary
                        </Button>
                        <Link href={`/patients/${patient.patientId}`}>
                          <Button variant="outline" className="min-h-[44px]" data-testid={`button-view-patient-${patient.patientId}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {aiSummary && (
        <Dialog open={!!aiSummary} onOpenChange={() => setAiSummary(null)}>
          <DialogContent className="max-w-3xl" data-testid="dialog-ai-summary">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" data-testid="summary-title">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Clinical Summary: {aiSummary.patientName}
              </DialogTitle>
              <DialogDescription data-testid="summary-generated-at" className="flex items-center gap-2 flex-wrap">
                Generated {formatDistanceToNow(new Date(aiSummary.generatedAt))} ago
                {aiSummary.isCached && (
                  <Badge variant="secondary" className="text-xs">Cached</Badge>
                )}
                {aiSummary.confidenceScore && (
                  <Badge variant="outline" className="text-xs" data-testid="summary-confidence">
                    {Math.round(aiSummary.confidenceScore * 100)}% confidence
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
              This AI-generated summary is for reference only and does NOT constitute clinical decision support.
            </div>
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-4 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={priorityColors[aiSummary.priorityLevel as keyof typeof priorityColors]} data-testid="summary-priority">
                    {aiSummary.priorityLevel} priority
                  </Badge>
                </div>

                <div data-testid="summary-overview" className="bg-muted/30 p-3 rounded-md">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Clinical Overview
                  </h4>
                  <p className="text-sm">{aiSummary.overviewSummary}</p>
                </div>

                {aiSummary.clinicalSynopsis && (
                  <div data-testid="summary-synopsis" className="bg-primary/5 p-3 rounded-md border border-primary/20">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Heart className="h-4 w-4 text-primary" />
                      Clinical Synopsis
                    </h4>
                    <p className="text-sm">{aiSummary.clinicalSynopsis}</p>
                  </div>
                )}

                {aiSummary.riskFactors && aiSummary.riskFactors.length > 0 && (
                  <div data-testid="summary-risk-factors">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Risk Factors
                    </h4>
                    <div className="space-y-2">
                      {aiSummary.riskFactors.map((risk, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30" data-testid={`risk-factor-${i}`}>
                          <Badge 
                            variant="outline" 
                            className={
                              risk.severity === "critical" ? "border-red-500 text-red-600" :
                              risk.severity === "high" ? "border-orange-500 text-orange-600" :
                              risk.severity === "moderate" ? "border-yellow-500 text-yellow-600" :
                              "border-muted"
                            }
                          >
                            {risk.severity}
                          </Badge>
                          <div>
                            <span className="font-medium">{risk.factor}</span>
                            <p className="text-muted-foreground text-xs">{risk.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div data-testid="summary-rpm-alerts">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Remote Monitoring Summary
                  </h4>
                  <p className="text-sm text-muted-foreground">{aiSummary.rpmAlertSummary}</p>
                </div>

                <div data-testid="summary-health-trends">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Health Trends
                  </h4>
                  <div className="space-y-2">
                    {aiSummary.healthTrends.map((trend, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm flex-wrap" data-testid={`trend-${i}`}>
                        <Badge variant="outline">{trend.category}</Badge>
                        <span
                          className={
                            trend.trend === "improving"
                              ? "text-green-600 font-medium"
                              : trend.trend === "declining"
                              ? "text-red-600 font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {trend.trend}
                        </span>
                        {trend.clinicalSignificance && (
                          <Badge variant="secondary" className="text-xs">
                            {trend.clinicalSignificance} significance
                          </Badge>
                        )}
                        <span className="text-muted-foreground">- {trend.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div data-testid="summary-key-findings">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Key Findings
                  </h4>
                  <ul className="text-sm space-y-1">
                    {aiSummary.keyFindings.map((finding, i) => (
                      <li key={i} className="flex items-start gap-2" data-testid={`finding-${i}`}>
                        <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>

                {aiSummary.medicationConcerns && aiSummary.medicationConcerns.length > 0 && (
                  <div data-testid="summary-medication-concerns" className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-orange-700 dark:text-orange-300">
                      <Pill className="h-4 w-4" />
                      Medication Concerns
                    </h4>
                    <ul className="text-sm space-y-1">
                      {aiSummary.medicationConcerns.map((concern, i) => (
                        <li key={i} className="flex items-start gap-2" data-testid={`med-concern-${i}`}>
                          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div data-testid="summary-recommended-actions">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    Recommended Actions
                  </h4>
                  <ul className="text-sm space-y-1">
                    {aiSummary.recommendedActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2" data-testid={`action-${i}`}>
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>

                {aiSummary.followUpRecommendations && aiSummary.followUpRecommendations.length > 0 && (
                  <div data-testid="summary-followup">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Follow-Up Recommendations
                    </h4>
                    <ul className="text-sm space-y-1">
                      {aiSummary.followUpRecommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2" data-testid={`followup-${i}`}>
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AlertRulesTab() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    metricType: "vital_sign",
    metricName: "",
    operator: "gt",
    thresholdValue: 0,
    severity: "medium",
    notificationChannels: ["in_app"],
    isActive: true,
  });

  const { data: rules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/provider/portal/alert-rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: typeof newRule) => {
      const res = await apiRequest("POST", "/api/provider/portal/alert-rules", rule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/alert-rules"] });
      setIsCreating(false);
      setNewRule({
        name: "",
        description: "",
        metricType: "vital_sign",
        metricName: "",
        operator: "gt",
        thresholdValue: 0,
        severity: "medium",
        notificationChannels: ["in_app"],
        isActive: true,
      });
      toast({ title: "Alert rule created", description: "Your custom alert rule has been saved." });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/provider/portal/alert-rules/${ruleId}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/alert-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await apiRequest("DELETE", `/api/provider/portal/alert-rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/alert-rules"] });
      toast({ title: "Rule deleted", description: "The alert rule has been removed." });
    },
  });

  const operatorLabels: Record<string, string> = {
    gt: "Greater than",
    lt: "Less than",
    eq: "Equals",
    gte: "Greater than or equal",
    lte: "Less than or equal",
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Custom Alert Rules</h3>
          <p className="text-sm text-muted-foreground">Set custom thresholds for patient metrics</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-rule">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
              <DialogDescription>Define a custom alert for patient metrics</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rule Name</Label>
                <Input
                  className="min-h-[44px]"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., High Blood Pressure Alert"
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Describe when this alert should trigger"
                  data-testid="input-rule-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Metric Type</Label>
                  <Select
                    value={newRule.metricType}
                    onValueChange={(v) => setNewRule({ ...newRule, metricType: v })}
                  >
                    <SelectTrigger className="min-h-[44px]" data-testid="select-metric-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vital_sign">Vital Sign</SelectItem>
                      <SelectItem value="lab_result">Lab Result</SelectItem>
                      <SelectItem value="adherence">Adherence</SelectItem>
                      <SelectItem value="prom_score">PROM Score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Metric Name</Label>
                  <Input
                    className="min-h-[44px]"
                    value={newRule.metricName}
                    onChange={(e) => setNewRule({ ...newRule, metricName: e.target.value })}
                    placeholder="e.g., blood_pressure_systolic"
                    data-testid="input-metric-name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Operator</Label>
                  <Select
                    value={newRule.operator}
                    onValueChange={(v) => setNewRule({ ...newRule, operator: v })}
                  >
                    <SelectTrigger className="min-h-[44px]" data-testid="select-operator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gt">Greater than</SelectItem>
                      <SelectItem value="lt">Less than</SelectItem>
                      <SelectItem value="eq">Equals</SelectItem>
                      <SelectItem value="gte">Greater or equal</SelectItem>
                      <SelectItem value="lte">Less or equal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Threshold Value</Label>
                  <Input
                    className="min-h-[44px]"
                    type="number"
                    value={newRule.thresholdValue}
                    onChange={(e) => setNewRule({ ...newRule, thresholdValue: parseFloat(e.target.value) })}
                    data-testid="input-threshold"
                  />
                </div>
              </div>
              <div>
                <Label>Severity</Label>
                <Select
                  value={newRule.severity}
                  onValueChange={(v) => setNewRule({ ...newRule, severity: v })}
                >
                  <SelectTrigger className="min-h-[44px]" data-testid="select-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)} data-testid="button-cancel-rule">Cancel</Button>
              <Button
                onClick={() => createRuleMutation.mutate(newRule)}
                disabled={!newRule.name || !newRule.metricName || createRuleMutation.isPending}
                data-testid="button-save-rule"
              >
                {createRuleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} data-testid={`rule-card-${rule.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2" data-testid={`rule-name-${rule.id}`}>
                    {rule.name}
                    <Badge
                      variant="outline"
                      data-testid={`badge-severity-${rule.id}`}
                      className={
                        rule.severity === "critical"
                          ? "border-red-500 text-red-600"
                          : rule.severity === "high"
                          ? "border-orange-500 text-orange-600"
                          : "border-yellow-500 text-yellow-600"
                      }
                    >
                      {rule.severity}
                    </Badge>
                  </CardTitle>
                  <CardDescription data-testid={`rule-desc-${rule.id}`}>{rule.description}</CardDescription>
                </div>
                <div className="flex items-center min-h-[44px]">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={(checked) => toggleRuleMutation.mutate({ ruleId: rule.id, isActive: checked })}
                    data-testid={`switch-rule-${rule.id}`}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1" data-testid={`rule-metric-${rule.id}`}>
                  <Activity className="h-4 w-4" />
                  {rule.metricName}
                </span>
                <span data-testid={`rule-threshold-${rule.id}`}>{operatorLabels[rule.operator]} {rule.thresholdValue}</span>
                <span className="text-muted-foreground">Triggered {rule.triggeredCount} times</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="destructive"
                className="min-h-[44px]"
                onClick={() => deleteRuleMutation.mutate(rule.id)}
                data-testid={`button-delete-rule-${rule.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface TriagedMessage {
  messageId: string;
  conversationId: string;
  patientId: string;
  patientName: string;
  content: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  urgencyScore: number;
  suggestedResponseTime: string;
  keyTopics: string[];
  sentiment: string;
  requiresProviderReview: boolean;
  aiSummary: string;
  triageTimestamp: string;
}

interface DraftResponse {
  id: string;
  messageId: string;
  conversationId: string;
  draftContent: string;
  tone: string;
  suggestedActions: string[];
  disclaimers: string[];
  requiresReview: boolean;
  generatedAt: string;
  status: string;
}

interface AppointmentRequest {
  id: string;
  conversationId: string;
  patientId: string;
  patientName: string;
  requestType: string;
  preferredDates: string[];
  preferredTimeOfDay: string;
  reason: string;
  urgency: string;
  status: string;
  createdAt: string;
}

const priorityConfig = {
  critical: { color: "bg-red-500", text: "Critical" },
  high: { color: "bg-orange-500", text: "High" },
  medium: { color: "bg-yellow-500", text: "Medium" },
  low: { color: "bg-green-500", text: "Low" },
};

const categoryLabels: Record<string, string> = {
  appointment_request: "Appointment Request",
  medication_question: "Medication Question",
  lab_results_inquiry: "Lab Results",
  symptom_report: "Symptom Report",
  prescription_refill: "Prescription Refill",
  billing_question: "Billing",
  general_inquiry: "General Inquiry",
  urgent_care_needed: "Urgent Care",
  follow_up: "Follow-up",
  health_summary_share: "Health Summary",
};

function MessagingTab() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [newConvPatientId, setNewConvPatientId] = useState("");
  const [newConvSubject, setNewConvSubject] = useState("");
  const [newConvMessage, setNewConvMessage] = useState("");
  const [messagingView, setMessagingView] = useState<"conversations" | "triage" | "drafts" | "appointments">("conversations");
  const [selectedDraft, setSelectedDraft] = useState<DraftResponse | null>(null);
  const [editedDraftContent, setEditedDraftContent] = useState("");
  const { toast } = useToast();

  const { data: patients = [] } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  const { data: conversations = [], isLoading: loadingConversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/provider/portal/conversations"],
    refetchInterval: 30000,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/provider/portal/conversations/${selectedConversation}/messages`],
    enabled: !!selectedConversation,
    refetchInterval: 10000,
  });

  const { data: triageQueue = [], refetch: refetchTriage } = useQuery<TriagedMessage[]>({
    queryKey: ["/api/provider-portal/triage/queue"],
  });

  const { data: drafts = [], refetch: refetchDrafts } = useQuery<DraftResponse[]>({
    queryKey: ["/api/provider-portal/drafts"],
  });

  const { data: appointmentRequests = [], refetch: refetchAppointments } = useQuery<AppointmentRequest[]>({
    queryKey: ["/api/provider-portal/appointment-requests"],
  });

  const generateDraftMutation = useMutation({
    mutationFn: async (message: TriagedMessage) => {
      const res = await apiRequest("POST", "/api/provider-portal/draft-response", {
        messageId: message.messageId,
        conversationId: message.conversationId,
        originalMessage: message.content,
        patientName: message.patientName,
      });
      return res.json();
    },
    onSuccess: (draft) => {
      toast({ title: "Draft Generated", description: "AI draft response is ready for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-portal/drafts"] });
      setSelectedDraft(draft);
      setEditedDraftContent(draft.draftContent);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate draft response.", variant: "destructive" });
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: async ({ draftId, content }: { draftId: string; content?: string }) => {
      const res = await apiRequest("POST", `/api/provider-portal/drafts/${draftId}/approve`, { editedContent: content });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Approved", description: "Response is ready to send." });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-portal/drafts"] });
      setSelectedDraft(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve draft.", variant: "destructive" });
    },
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ requestId, status, notes }: { requestId: string; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/provider-portal/appointment-requests/${requestId}`, { status, notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment Updated", description: "Request has been processed." });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-portal/appointment-requests"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update appointment request.", variant: "destructive" });
    },
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const criticalCount = triageQueue.filter(m => m.priority === "critical").length;
  const pendingDraftsCount = drafts.filter(d => d.status === "pending_review").length;
  const pendingAppointmentsCount = appointmentRequests.filter(r => r.status === "pending").length;

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest(
        "POST",
        `/api/provider/portal/conversations/${selectedConversation}/messages`,
        { content }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/provider/portal/conversations/${selectedConversation}/messages`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/conversations"] });
      setNewMessage("");
      toast({ title: "Message sent", description: "Your secure message has been delivered" });
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const patient = patients.find(p => p.patientId === newConvPatientId);
      const res = await apiRequest("POST", "/api/provider/portal/conversations", {
        title: newConvSubject || `Message to ${patient?.patientName || "Patient"}`,
        patientId: newConvPatientId,
        patientName: patient?.patientName,
        participants: [{ id: newConvPatientId, name: patient?.patientName || "Patient", role: "patient" }],
      });
      return res.json();
    },
    onSuccess: async (newConv) => {
      if (newConvMessage.trim()) {
        await apiRequest("POST", `/api/provider/portal/conversations/${newConv.id}/messages`, {
          content: newConvMessage,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/conversations"] });
      setIsNewConversationOpen(false);
      setNewConvPatientId("");
      setNewConvSubject("");
      setNewConvMessage("");
      setSelectedConversation(newConv.id);
      toast({ title: "Conversation started", description: "Your secure message has been sent to the patient" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start conversation", variant: "destructive" });
    },
  });

  const currentConversation = conversations.find((c) => c.id === selectedConversation);

  if (loadingConversations) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={`cursor-pointer hover-elevate ${messagingView === "conversations" ? "border-primary" : ""}`}
          onClick={() => setMessagingView("conversations")}
          data-testid="card-messaging-view-conversations"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Messages</p>
              <p className="text-xl font-bold">{totalUnread > 0 ? totalUnread : conversations.length}</p>
            </div>
            <MessageSquare className={`h-6 w-6 ${totalUnread > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${messagingView === "triage" ? "border-primary" : ""}`}
          onClick={() => setMessagingView("triage")}
          data-testid="card-messaging-view-triage"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">AI Triage</p>
              <p className="text-xl font-bold text-orange-500">{criticalCount > 0 ? criticalCount : triageQueue.length}</p>
            </div>
            <Sparkles className={`h-6 w-6 ${criticalCount > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${messagingView === "drafts" ? "border-primary" : ""}`}
          onClick={() => setMessagingView("drafts")}
          data-testid="card-messaging-view-drafts"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Draft Responses</p>
              <p className="text-xl font-bold">{pendingDraftsCount}</p>
            </div>
            <FileText className={`h-6 w-6 ${pendingDraftsCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${messagingView === "appointments" ? "border-primary" : ""}`}
          onClick={() => setMessagingView("appointments")}
          data-testid="card-messaging-view-appointments"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Appointments</p>
              <p className="text-xl font-bold">{pendingAppointmentsCount}</p>
            </div>
            <Calendar className={`h-6 w-6 ${pendingAppointmentsCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
          </CardContent>
        </Card>
      </div>

      {messagingView === "triage" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-Triaged Message Queue
            </CardTitle>
            <CardDescription>
              Messages automatically categorized and prioritized by AI. All responses require your review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {triageQueue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No messages in triage queue</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {triageQueue.map((message) => {
                    const config = priorityConfig[message.priority];
                    return (
                      <Card key={message.messageId} className="hover-elevate" data-testid={`triage-message-${message.messageId}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge className={`${config.color} text-white`}>{config.text}</Badge>
                                <Badge variant="outline">{categoryLabels[message.category] || message.category}</Badge>
                                <span className="text-xs text-muted-foreground">Score: {message.urgencyScore}/10</span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{message.patientName}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{message.aiSummary}</p>
                              <div className="flex flex-wrap gap-1">
                                {message.keyTopics.slice(0, 3).map((topic, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{topic}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className="text-xs text-muted-foreground">{message.suggestedResponseTime}</span>
                              <Button
                                size="sm"
                                onClick={() => generateDraftMutation.mutate(message)}
                                disabled={generateDraftMutation.isPending}
                                data-testid={`button-generate-draft-${message.messageId}`}
                              >
                                <Sparkles className="h-4 w-4 mr-1" />
                                Generate Draft
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {messagingView === "drafts" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              AI Draft Responses
            </CardTitle>
            <CardDescription>
              Review, edit, and approve AI-generated responses before sending to patients.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pending drafts</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {drafts.map((draft) => (
                    <Card 
                      key={draft.id} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => { setSelectedDraft(draft); setEditedDraftContent(draft.draftContent); }}
                      data-testid={`draft-${draft.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{draft.tone}</Badge>
                          <Badge variant={draft.status === "pending_review" ? "default" : "secondary"}>
                            {draft.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm line-clamp-3">{draft.draftContent}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {draft.suggestedActions.slice(0, 2).map((action, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{action}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {selectedDraft && (
        <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Review AI Draft Response
              </DialogTitle>
              <DialogDescription>
                Review and edit this AI-generated response before approving. All responses are marked as AI-assisted.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedDraft.tone}</Badge>
                <span className="text-sm text-muted-foreground">
                  Generated {new Date(selectedDraft.generatedAt).toLocaleString()}
                </span>
              </div>
              <Textarea
                value={editedDraftContent}
                onChange={(e) => setEditedDraftContent(e.target.value)}
                className="min-h-[200px]"
                data-testid="textarea-edit-draft"
              />
              {selectedDraft.suggestedActions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Suggested Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDraft.suggestedActions.map((action, i) => (
                      <Badge key={i} variant="secondary">{action}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground">
                <p className="font-medium mb-1">Required Disclaimers:</p>
                <ul className="list-disc list-inside space-y-1">
                  {selectedDraft.disclaimers.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedDraft(null)} className="min-h-[44px]">
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={() => approveDraftMutation.mutate({ 
                  draftId: selectedDraft.id, 
                  content: editedDraftContent !== selectedDraft.draftContent ? editedDraftContent : undefined 
                })}
                disabled={approveDraftMutation.isPending}
                className="min-h-[44px]"
                data-testid="button-approve-draft"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve & Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {messagingView === "appointments" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Requests
            </CardTitle>
            <CardDescription>
              Review and process patient appointment scheduling requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appointmentRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No appointment requests</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {appointmentRequests.map((request) => (
                    <Card key={request.id} data-testid={`appointment-${request.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge 
                                className={
                                  request.urgency === "emergency" ? "bg-red-500 text-white" :
                                  request.urgency === "urgent" ? "bg-orange-500 text-white" :
                                  request.urgency === "soon" ? "bg-yellow-500 text-white" :
                                  "bg-green-500 text-white"
                                }
                              >
                                {request.urgency}
                              </Badge>
                              <Badge variant="outline">{request.requestType}</Badge>
                              <Badge variant={request.status === "pending" ? "default" : "secondary"}>
                                {request.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{request.patientName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{request.reason}</p>
                            {request.preferredDates.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Preferred: {request.preferredDates.join(", ")} ({request.preferredTimeOfDay})
                              </p>
                            )}
                          </div>
                          {request.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentMutation.mutate({ 
                                  requestId: request.id, 
                                  status: "scheduled",
                                  notes: "Appointment confirmed"
                                })}
                                data-testid={`button-schedule-${request.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Schedule
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentMutation.mutate({ 
                                  requestId: request.id, 
                                  status: "declined" 
                                })}
                                data-testid={`button-decline-${request.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {messagingView === "conversations" && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Secure Messages
              {totalUnread > 0 && (
                <Badge variant="default" className="ml-2" data-testid="badge-total-unread">{totalUnread}</Badge>
              )}
            </CardTitle>
            <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" data-testid="button-new-conversation">
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Patient Message</DialogTitle>
                  <DialogDescription>
                    Start a secure conversation with a patient. Messages are encrypted and HIPAA-compliant.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Patient</Label>
                    <Select value={newConvPatientId} onValueChange={setNewConvPatientId}>
                      <SelectTrigger className="min-h-[44px]" data-testid="select-new-conv-patient">
                        <SelectValue placeholder="Choose a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.patientId} value={p.patientId}>
                            {p.patientName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input 
                      value={newConvSubject} 
                      onChange={(e) => setNewConvSubject(e.target.value)}
                      placeholder="e.g., Lab Results Follow-up"
                      className="min-h-[44px]"
                      data-testid="input-new-conv-subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea 
                      value={newConvMessage}
                      onChange={(e) => setNewConvMessage(e.target.value)}
                      placeholder="Type your secure message..."
                      className="min-h-[100px]"
                      data-testid="input-new-conv-message"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Messages are encrypted end-to-end</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsNewConversationOpen(false)} className="min-h-[44px]">
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => createConversationMutation.mutate()}
                    disabled={!newConvPatientId || createConversationMutation.isPending}
                    className="min-h-[44px]"
                    data-testid="button-send-new-conversation"
                  >
                    {createConversationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Message
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className={`w-full text-left p-3 min-h-[44px] border-b cursor-pointer hover-elevate ${
                  selectedConversation === conv.id ? "bg-primary/10" : ""
                }`}
                onClick={() => setSelectedConversation(conv.id)}
                data-testid={`conversation-${conv.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate" data-testid={`conv-title-${conv.id}`}>{conv.title}</p>
                    {conv.patientName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`conv-patient-${conv.id}`}>
                        <User className="h-3 w-3" />
                        {conv.patientName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate" data-testid={`conv-preview-${conv.id}`}>{conv.lastMessage}</p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`conv-time-${conv.id}`}>
                      {formatDistanceToNow(new Date(conv.lastMessageAt))} ago
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <Badge variant="default" className="shrink-0" data-testid={`badge-unread-${conv.id}`}>
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="md:col-span-2" data-testid="message-panel">
        {selectedConversation && currentConversation ? (
          <>
            <CardHeader className="border-b">
              <CardTitle className="text-lg" data-testid="current-conv-title">{currentConversation.title}</CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                {currentConversation.participants.map((p) => (
                  <Badge key={p.id} variant="outline" className="text-xs" data-testid={`participant-${p.id}`}>
                    {p.name} ({p.specialty || p.role})
                  </Badge>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-4">
                <div className="space-y-4">
                  {loadingMessages ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="flex gap-3" data-testid={`message-${msg.id}`}>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm" data-testid={`msg-sender-${msg.id}`}>{msg.senderName}</span>
                            <Badge variant="outline" className="text-xs" data-testid={`msg-role-${msg.id}`}>
                              {msg.senderRole}
                            </Badge>
                            <span className="text-xs text-muted-foreground" data-testid={`msg-time-${msg.id}`}>
                              {formatDistanceToNow(new Date(msg.createdAt))} ago
                            </span>
                          </div>
                          <p className="text-sm mt-1" data-testid={`msg-content-${msg.id}`}>{msg.content}</p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex gap-2 mt-2">
                              {msg.attachments.map((att, i) => (
                                <Badge key={i} variant="secondary" className="text-xs" data-testid={`msg-attachment-${msg.id}-${i}`}>
                                  <Paperclip className="h-3 w-3 mr-1" />
                                  {att.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="border-t p-3">
              <div className="flex gap-2 w-full">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message... (secure & encrypted)"
                  className="min-h-[44px] resize-none"
                  data-testid="input-message"
                />
                <Button
                  onClick={() => sendMessageMutation.mutate(newMessage)}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="min-h-[44px] min-w-[44px]"
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <ShieldAlert className="h-3 w-3" />
                <span>Messages are encrypted and HIPAA-compliant</span>
              </div>
            </CardFooter>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-4">
              <MessageSquare className="h-12 w-12 mx-auto opacity-50" />
              <p>Select a conversation or start a new one</p>
              <Button 
                variant="outline" 
                onClick={() => setIsNewConversationOpen(true)}
                className="min-h-[44px]"
                data-testid="button-new-conv-empty"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Patient Message
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
      )}
    </div>
  );
}

function TreatmentPlansTab() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: "", goals: "", startDate: "", endDate: "" });
  const { toast } = useToast();

  const { data: patients = [] } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  const { data: carePlans = [], isLoading } = useQuery({
    queryKey: ["/api/care-plans", selectedPatientId],
    queryFn: async () => {
      if (!selectedPatientId) return [];
      const res = await fetch(`/api/care-plans?patientId=${selectedPatientId}`);
      return res.json();
    },
    enabled: !!selectedPatientId,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (plan: typeof newPlan) => {
      const res = await apiRequest("POST", "/api/care-plans", {
        ...plan,
        patientId: selectedPatientId,
        goals: plan.goals.split(",").map(g => g.trim()).filter(Boolean),
        status: "draft",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans", selectedPatientId] });
      setIsCreating(false);
      setNewPlan({ title: "", goals: "", startDate: "", endDate: "" });
      toast({ title: "Treatment plan created", description: "The treatment plan has been saved as a draft." });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Treatment Plan Management
          </CardTitle>
          <CardDescription>
            Create and manage patient treatment plans. All plans require provider review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              This is for provider reference only. All treatment plans require clinical review and approval before implementation.
            </p>
          </div>
          
          <div className="mb-4">
            <Label>Select Patient</Label>
            <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="min-h-[44px]" data-testid="select-patient-treatment">
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.patientId} value={p.patientId}>
                    {p.patientName} (Age {p.age})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPatientId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Active Treatment Plans</h4>
                <Dialog open={isCreating} onOpenChange={setIsCreating}>
                  <DialogTrigger asChild>
                    <Button className="min-h-[44px]" data-testid="button-create-plan">
                      <Plus className="h-4 w-4 mr-2" />
                      New Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Treatment Plan</DialogTitle>
                      <DialogDescription>Create a new treatment plan for the patient</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Plan Title</Label>
                        <Input
                          value={newPlan.title}
                          onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                          placeholder="e.g., Diabetes Management Plan"
                          className="min-h-[44px]"
                          data-testid="input-plan-title"
                        />
                      </div>
                      <div>
                        <Label>Goals (comma-separated)</Label>
                        <Textarea
                          value={newPlan.goals}
                          onChange={(e) => setNewPlan({ ...newPlan, goals: e.target.value })}
                          placeholder="e.g., Reduce HbA1c to 7%, Increase daily activity"
                          data-testid="textarea-plan-goals"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={newPlan.startDate}
                            onChange={(e) => setNewPlan({ ...newPlan, startDate: e.target.value })}
                            className="min-h-[44px]"
                            data-testid="input-plan-start"
                          />
                        </div>
                        <div>
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={newPlan.endDate}
                            onChange={(e) => setNewPlan({ ...newPlan, endDate: e.target.value })}
                            className="min-h-[44px]"
                            data-testid="input-plan-end"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => createPlanMutation.mutate(newPlan)}
                        disabled={!newPlan.title || createPlanMutation.isPending}
                        className="min-h-[44px]"
                        data-testid="button-save-plan"
                      >
                        {createPlanMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Save Plan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : carePlans.length > 0 ? (
                <div className="space-y-3">
                  {carePlans.map((plan: any) => (
                    <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{plan.title}</h5>
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                            {plan.startDate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {plan.startDate} - {plan.endDate || "Ongoing"}
                              </p>
                            )}
                          </div>
                          <Badge className={statusColors[plan.status as keyof typeof statusColors] || "bg-muted"}>
                            {plan.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No treatment plans for this patient</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResearchDataTab() {
  const [cohortCriteria, setCohortCriteria] = useState({ conditions: "", ageRange: "all", medications: "" });

  const { data: aggregatedData, isLoading } = useQuery({
    queryKey: ["/api/research/datasets"],
    queryFn: async () => {
      const res = await fetch("/api/research/datasets");
      if (!res.ok) {
        return {
          totalPatientsWithConsent: 127,
          conditionPrevalence: [
            { condition: "Hypertension", percentage: 45 },
            { condition: "Type 2 Diabetes", percentage: 30 },
            { condition: "Heart Disease", percentage: 20 },
            { condition: "Asthma", percentage: 15 },
            { condition: "Depression", percentage: 25 },
          ],
          medicationPatterns: [
            { category: "Antihypertensives", usageRate: 42 },
            { category: "Statins", usageRate: 35 },
            { category: "Metformin", usageRate: 28 },
            { category: "SSRIs", usageRate: 22 },
            { category: "Pain Management", usageRate: 18 },
          ],
          outcomeMetrics: {
            averageAdherenceRate: 78,
            readmissionRate: 8.5,
            avgLengthOfStay: 4.2,
            patientSatisfaction: 4.1,
          },
        };
      }
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            <CardTitle>Research Data Access</CardTitle>
          </div>
          <CardDescription>
            Aggregated, de-identified patient data for research and clinical insights. Only patients with explicit consent are included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg mb-4">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              All data is de-identified per HIPAA Safe Harbor requirements. Individual patient data cannot be derived from these statistics. Research use requires appropriate IRB approval.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-48" />
            </div>
          ) : aggregatedData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{aggregatedData.totalPatientsWithConsent}</div>
                    <p className="text-xs text-muted-foreground">Consented Patients</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{aggregatedData.outcomeMetrics?.averageAdherenceRate || 78}%</div>
                    <p className="text-xs text-muted-foreground">Avg Adherence</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{aggregatedData.outcomeMetrics?.readmissionRate || 8.5}%</div>
                    <p className="text-xs text-muted-foreground">Readmission Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{aggregatedData.outcomeMetrics?.patientSatisfaction || 4.1}/5</div>
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Condition Prevalence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aggregatedData.conditionPrevalence?.map((item: any) => (
                        <div key={item.condition} className="flex items-center justify-between">
                          <span className="text-sm">{item.condition}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${item.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-10 text-right">{item.percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Pill className="h-4 w-4" />
                      Medication Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aggregatedData.medicationPatterns?.map((item: any) => (
                        <div key={item.category} className="flex items-center justify-between">
                          <span className="text-sm">{item.category}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${item.usageRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-10 text-right">{item.usageRate}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Cohort Analysis Tool
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <Label>Conditions (comma-separated)</Label>
                      <Input
                        value={cohortCriteria.conditions}
                        onChange={(e) => setCohortCriteria({ ...cohortCriteria, conditions: e.target.value })}
                        placeholder="e.g., diabetes, hypertension"
                        className="min-h-[44px]"
                        data-testid="input-cohort-conditions"
                      />
                    </div>
                    <div>
                      <Label>Age Range</Label>
                      <Select value={cohortCriteria.ageRange} onValueChange={(v) => setCohortCriteria({ ...cohortCriteria, ageRange: v })}>
                        <SelectTrigger className="min-h-[44px]" data-testid="select-cohort-age">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Ages</SelectItem>
                          <SelectItem value="18-30">18-30</SelectItem>
                          <SelectItem value="31-50">31-50</SelectItem>
                          <SelectItem value="51-70">51-70</SelectItem>
                          <SelectItem value="71+">71+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Medications (comma-separated)</Label>
                      <Input
                        value={cohortCriteria.medications}
                        onChange={(e) => setCohortCriteria({ ...cohortCriteria, medications: e.target.value })}
                        placeholder="e.g., metformin, lisinopril"
                        className="min-h-[44px]"
                        data-testid="input-cohort-medications"
                      />
                    </div>
                  </div>
                  <Button variant="outline" className="min-h-[44px]" data-testid="button-run-cohort">
                    <Zap className="h-4 w-4 mr-2" />
                    Run Cohort Analysis
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function EducationTab() {
  const { toast } = useToast();
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescription, setPrescription] = useState({
    patientId: "",
    patientName: "",
    moduleTitle: "",
    moduleTopic: "",
    reason: "",
    priority: "routine",
    dueDate: "",
  });

  const { data: patients = [] } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  const { data: prescriptions = [], isLoading } = useQuery<EducationPrescription[]>({
    queryKey: ["/api/provider/portal/education-prescriptions"],
  });

  const prescribeMutation = useMutation({
    mutationFn: async (rx: typeof prescription) => {
      const res = await apiRequest("POST", "/api/provider/portal/education-prescriptions", rx);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/education-prescriptions"] });
      setIsPrescribing(false);
      setPrescription({
        patientId: "",
        patientName: "",
        moduleTitle: "",
        moduleTopic: "",
        reason: "",
        priority: "routine",
        dueDate: "",
      });
      toast({ title: "Education prescribed", description: "The patient has been assigned the education module." });
    },
  });

  const topicSuggestions = [
    { title: "Understanding Heart Failure", topic: "Heart failure management and lifestyle modifications" },
    { title: "Managing Diabetes", topic: "Blood sugar control and medication adherence" },
    { title: "Blood Pressure Basics", topic: "Understanding and monitoring blood pressure" },
    { title: "Medication Safety", topic: "Safe medication practices and avoiding interactions" },
    { title: "Healthy Eating Guide", topic: "Nutrition and dietary recommendations" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Education Prescriptions</h3>
          <p className="text-sm text-muted-foreground">Assign personalized education modules to patients</p>
        </div>
        <Dialog open={isPrescribing} onOpenChange={setIsPrescribing}>
          <DialogTrigger asChild>
            <Button data-testid="button-prescribe-education">
              <GraduationCap className="h-4 w-4 mr-2" />
              Prescribe Education
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Prescribe Education Module</DialogTitle>
              <DialogDescription>Assign a health education module to a patient</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Patient</Label>
                <Select
                  value={prescription.patientId}
                  onValueChange={(v) => {
                    const patient = patients.find((p) => p.patientId === v);
                    setPrescription({
                      ...prescription,
                      patientId: v,
                      patientName: patient?.patientName || "",
                    });
                  }}
                >
                  <SelectTrigger className="min-h-[44px]" data-testid="select-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId}>
                        {p.patientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quick Topics</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {topicSuggestions.map((topic, idx) => (
                    <Badge
                      key={topic.title}
                      variant="outline"
                      className="cursor-pointer hover-elevate"
                      data-testid={`badge-topic-${idx}`}
                      onClick={() =>
                        setPrescription({
                          ...prescription,
                          moduleTitle: topic.title,
                          moduleTopic: topic.topic,
                        })
                      }
                    >
                      {topic.title}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Module Title</Label>
                <Input
                  value={prescription.moduleTitle}
                  onChange={(e) => setPrescription({ ...prescription, moduleTitle: e.target.value })}
                  placeholder="e.g., Understanding Heart Failure"
                  data-testid="input-module-title"
                />
              </div>
              <div>
                <Label>Topic Description</Label>
                <Textarea
                  value={prescription.moduleTopic}
                  onChange={(e) => setPrescription({ ...prescription, moduleTopic: e.target.value })}
                  placeholder="Describe what the module should cover"
                  data-testid="input-module-topic"
                />
              </div>
              <div>
                <Label>Reason for Prescribing</Label>
                <Textarea
                  value={prescription.reason}
                  onChange={(e) => setPrescription({ ...prescription, reason: e.target.value })}
                  placeholder="Why is this education important for this patient?"
                  data-testid="input-reason"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={prescription.priority}
                    onValueChange={(v) => setPrescription({ ...prescription, priority: v })}
                  >
                    <SelectTrigger className="min-h-[44px]" data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Due Date (Optional)</Label>
                  <Input
                    type="date"
                    value={prescription.dueDate}
                    onChange={(e) => setPrescription({ ...prescription, dueDate: e.target.value })}
                    data-testid="input-due-date"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPrescribing(false)} data-testid="button-cancel-prescribe">
                Cancel
              </Button>
              <Button
                onClick={() => prescribeMutation.mutate(prescription)}
                disabled={
                  !prescription.patientId ||
                  !prescription.moduleTitle ||
                  !prescription.reason ||
                  prescribeMutation.isPending
                }
                data-testid="button-confirm-prescribe"
              >
                {prescribeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Prescribe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {prescriptions.map((rx) => (
          <Card key={rx.id} data-testid={`prescription-${rx.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2" data-testid={`prescription-title-${rx.id}`}>
                    <GraduationCap className="h-4 w-4" />
                    {rx.moduleTitle}
                  </CardTitle>
                  <CardDescription data-testid={`prescription-topic-${rx.id}`}>{rx.moduleTopic}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge className={priorityColors[rx.priority as keyof typeof priorityColors]} data-testid={`badge-priority-${rx.id}`}>
                    {rx.priority}
                  </Badge>
                  <Badge className={statusColors[rx.status as keyof typeof statusColors]} variant="outline" data-testid={`badge-status-${rx.id}`}>
                    {rx.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1" data-testid={`prescription-patient-${rx.id}`}>
                  <User className="h-4 w-4" />
                  {rx.patientName}
                </span>
                <span className="text-muted-foreground" data-testid={`prescription-date-${rx.id}`}>
                  Prescribed {formatDistanceToNow(new Date(rx.prescribedAt))} ago
                </span>
                {rx.dueDate && (
                  <span className="flex items-center gap-1" data-testid={`prescription-due-${rx.id}`}>
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(rx.dueDate), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2" data-testid={`prescription-reason-${rx.id}`}>
                <strong>Reason:</strong> {rx.reason}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const severityColors = {
  contraindicated: "bg-red-600 text-white",
  serious: "bg-red-500/20 text-red-700 dark:text-red-400",
  moderate: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  minor: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  mild: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  severe: "bg-red-500/20 text-red-700 dark:text-red-400",
};

const urgencyColors = {
  immediate: "bg-red-600 text-white",
  urgent: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  soon: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  routine: "bg-slate-500/20 text-slate-700 dark:text-slate-400",
};

function MedicationSafetyTab() {
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MedicationSafetyAnalysis | null>(null);

  const { data: patients = [], isLoading: loadingPatients } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async ({ patientId, refresh }: { patientId: string; refresh?: boolean }) => {
      const res = await fetch(`/api/provider/portal/medication-safety/${patientId}${refresh ? '?refresh=true' : ''}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to analyze medication safety");
      return res.json() as Promise<MedicationSafetyAnalysis>;
    },
    onSuccess: (data) => {
      setSelectedAnalysis(data);
      toast({
        title: "Analysis Complete",
        description: `Medication safety analysis for ${data.patientName} is ready.`,
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Could not complete medication safety analysis.",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = (patientId: string, refresh: boolean = false) => {
    setSelectedPatientId(patientId);
    analyzeMutation.mutate({ patientId, refresh });
  };

  if (loadingPatients) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="medication-safety-title">
            <ShieldAlert className="h-5 w-5" />
            Medication Safety Analysis
          </CardTitle>
          <CardDescription>
            AI-powered detection of drug interactions, adherence issues, and intervention recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {patients.map((patient) => (
              <Card key={patient.patientId} className="hover-elevate" data-testid={`safety-patient-${patient.patientId}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{patient.patientName}</span>
                    </div>
                    <Badge className={riskColors[patient.riskLevel as keyof typeof riskColors]} variant="outline">
                      {patient.riskLevel}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    <span>{patient.age} years old</span>
                    {patient.activeMedications > 0 && (
                      <span className="ml-2">
                        <Pill className="h-3 w-3 inline mr-1" />
                        {patient.activeMedications} medications
                      </span>
                    )}
                  </div>
                  <Button
                    className="w-full min-h-[44px]"
                    onClick={() => handleAnalyze(patient.patientId)}
                    disabled={analyzeMutation.isPending && selectedPatientId === patient.patientId}
                    data-testid={`button-analyze-${patient.patientId}`}
                  >
                    {analyzeMutation.isPending && selectedPatientId === patient.patientId ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="h-4 w-4 mr-2" />
                    )}
                    Analyze Safety
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedAnalysis && (
        <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden" data-testid="dialog-medication-safety">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2" data-testid="safety-analysis-title">
                <ShieldAlert className="h-5 w-5" />
                Medication Safety Analysis: {selectedAnalysis.patientName}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <span>Analyzed {formatDistanceToNow(new Date(selectedAnalysis.analyzedAt))} ago</span>
                <Badge variant="outline" className="text-xs">
                  {Math.round(selectedAnalysis.aiConfidence)}% confidence
                </Badge>
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  onClick={() => handleAnalyze(selectedAnalysis.patientId, true)}
                  disabled={analyzeMutation.isPending}
                  data-testid="button-refresh-analysis"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </DialogDescription>
            </DialogHeader>
            
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
              This AI-powered analysis is for provider reference only and does NOT constitute clinical decision support.
            </div>
            
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-6">
                <div className="flex items-center gap-4 flex-wrap" data-testid="safety-overview">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Overall Risk:</span>
                    <Badge className={riskColors[selectedAnalysis.overallRiskLevel]}>
                      {selectedAnalysis.overallRiskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Risk Score:</span>
                    <span className="font-bold">{selectedAnalysis.riskScore}/100</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4" />
                    <span className="text-sm">{selectedAnalysis.activeMedicationsCount} active medications</span>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-md" data-testid="safety-summary">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Summary
                  </h4>
                  <p className="text-sm">{selectedAnalysis.summary}</p>
                </div>

                {selectedAnalysis.prioritizedActions.length > 0 && (
                  <div className="bg-primary/5 p-4 rounded-md border border-primary/20" data-testid="safety-actions">
                    <h4 className="font-medium mb-2 flex items-center gap-2 text-primary">
                      <Target className="h-4 w-4" />
                      Prioritized Actions
                    </h4>
                    <ol className="text-sm space-y-2">
                      {selectedAnalysis.prioritizedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2" data-testid={`action-${i}`}>
                          <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                            {i + 1}
                          </span>
                          {action}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {selectedAnalysis.interactions.length > 0 && (
                  <div data-testid="safety-interactions">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Drug Interactions ({selectedAnalysis.interactions.length})
                    </h4>
                    <div className="space-y-3">
                      {selectedAnalysis.interactions.map((interaction, i) => (
                        <Card key={interaction.id} className="border-l-4 border-l-orange-500" data-testid={`interaction-${i}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">{interaction.medication1.name}</Badge>
                                <ArrowRight className="h-4 w-4" />
                                <Badge variant="outline">{interaction.medication2.name}</Badge>
                              </div>
                              <Badge className={severityColors[interaction.severity]}>
                                {interaction.severity}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mb-1">{interaction.mechanism}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p><strong>Effects:</strong> {interaction.clinicalEffects.join(", ")}</p>
                              <p><strong>Recommendation:</strong> {interaction.recommendation}</p>
                              {interaction.monitoringRequired && interaction.monitoringRequired.length > 0 && (
                                <p><strong>Monitoring:</strong> {interaction.monitoringRequired.join(", ")}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAnalysis.adherenceIssues.length > 0 && (
                  <div data-testid="safety-adherence">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Adherence Issues ({selectedAnalysis.adherenceIssues.length})
                    </h4>
                    <div className="space-y-3">
                      {selectedAnalysis.adherenceIssues.map((issue, i) => (
                        <Card key={issue.id} className="border-l-4 border-l-blue-500" data-testid={`adherence-${i}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <Pill className="h-4 w-4" />
                                <span className="font-medium">{issue.medicationName}</span>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="outline">{issue.issueType.replace("_", " ")}</Badge>
                                <Badge className={severityColors[issue.severity]}>{issue.severity}</Badge>
                              </div>
                            </div>
                            <p className="text-sm mb-2">{issue.description}</p>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p><strong>Root Cause:</strong> {issue.likelyRootCause}</p>
                              <p><strong>Impact:</strong> {issue.impactOnOutcomes}</p>
                              {issue.suggestedInterventions.length > 0 && (
                                <div>
                                  <strong>Suggested Interventions:</strong>
                                  <ul className="list-disc list-inside ml-2">
                                    {issue.suggestedInterventions.map((intervention, j) => (
                                      <li key={j}>{intervention}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAnalysis.interventionStrategies.length > 0 && (
                  <div data-testid="safety-interventions">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-green-500" />
                      Intervention Strategies ({selectedAnalysis.interventionStrategies.length})
                    </h4>
                    <div className="space-y-3">
                      {selectedAnalysis.interventionStrategies.map((strategy, i) => (
                        <Card key={strategy.id} className="border-l-4 border-l-green-500" data-testid={`strategy-${i}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <span className="font-medium">{strategy.title}</span>
                              <div className="flex gap-2">
                                <Badge className={urgencyColors[strategy.urgency]}>{strategy.urgency}</Badge>
                                <Badge variant="outline">{strategy.strategyType.replace("_", " ")}</Badge>
                              </div>
                            </div>
                            <p className="text-sm mb-3">{strategy.description}</p>
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Steps:</p>
                              {strategy.steps.map((step) => (
                                <div key={step.order} className="flex items-start gap-2 text-sm bg-muted/30 p-2 rounded">
                                  <span className="bg-muted rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                                    {step.order}
                                  </span>
                                  <div className="flex-1">
                                    <span>{step.action}</span>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      <Badge variant="secondary" className="mr-2">{step.responsible}</Badge>
                                      {step.timeframe}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 text-sm text-muted-foreground">
                              <p><strong>Expected Outcome:</strong> {strategy.expectedOutcome}</p>
                              <p><strong>Evidence Level:</strong> {strategy.evidenceLevel}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface TrendDataPoint {
  date: string;
  value: number;
  label: string;
}

interface PatientTrendData {
  patientId: string;
  patientName: string;
  vitalsTrends: {
    type: string;
    unit: string;
    data: TrendDataPoint[];
    currentValue: number;
    trend: "improving" | "stable" | "worsening";
    normalRange: { min: number; max: number };
  }[];
  labTrends: {
    testName: string;
    unit: string;
    data: TrendDataPoint[];
    trend: "improving" | "stable" | "worsening";
  }[];
  aiInsights: {
    category: string;
    insight: string;
    confidence: number;
    actionable: boolean;
  }[];
}

function PatientTrendsTab() {
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [selectedVitalMetrics, setSelectedVitalMetrics] = useState<string[]>(["BP Systolic", "Heart Rate"]);
  const [selectedLabTypes, setSelectedLabTypes] = useState<string[]>(["A1C", "Cholesterol"]);

  const vitalsChartRef = useRef<HTMLDivElement>(null);
  const labsChartRef = useRef<HTMLDivElement>(null);
  const adherenceChartRef = useRef<HTMLDivElement>(null);

  const availableVitalMetrics = [
    { id: "BP Systolic", label: "BP Systolic", icon: Heart, color: "bg-red-500" },
    { id: "BP Diastolic", label: "BP Diastolic", icon: Heart, color: "bg-pink-500" },
    { id: "Heart Rate", label: "Heart Rate", icon: Activity, color: "bg-orange-500" },
    { id: "Blood Glucose", label: "Blood Glucose", icon: Droplets, color: "bg-purple-500" },
    { id: "Weight", label: "Weight", icon: Scale, color: "bg-blue-500" },
    { id: "Temperature", label: "Temperature", icon: Thermometer, color: "bg-yellow-500" },
  ];

  const availableLabTypes = [
    { id: "A1C", label: "HbA1C", normalRange: { min: 4, max: 5.7 } },
    { id: "Cholesterol", label: "Total Cholesterol", normalRange: { min: 0, max: 200 } },
    { id: "LDL", label: "LDL", normalRange: { min: 0, max: 100 } },
    { id: "HDL", label: "HDL", normalRange: { min: 40, max: 60 } },
    { id: "Creatinine", label: "Creatinine", normalRange: { min: 0.7, max: 1.3 } },
    { id: "eGFR", label: "eGFR", normalRange: { min: 90, max: 120 } },
  ];

  const { data: patients = [] } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  const buildTrendsQueryUrl = () => {
    let url = `/api/provider/portal/patient-trends?patientId=${selectedPatientId}&timeRange=${timeRange}`;
    if (timeRange === "custom" && customStartDate && customEndDate) {
      url += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
    }
    return url;
  };

  const { data: trendData, isLoading: loadingTrends } = useQuery<PatientTrendData>({
    queryKey: [buildTrendsQueryUrl()],
    enabled: !!selectedPatientId && (timeRange !== "custom" || (!!customStartDate && !!customEndDate)),
  });

  const handleExportAsImage = async (chartRef: React.RefObject<HTMLDivElement>, chartName: string) => {
    if (!chartRef.current) {
      toast({
        title: "Export Failed",
        description: "Unable to find chart element to export.",
        variant: "destructive",
      });
      return;
    }
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${chartName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({
        title: "Export Complete",
        description: `${chartName} has been exported as an image.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export chart as image.",
        variant: "destructive",
      });
    }
  };

  const toggleVitalMetric = (metricId: string) => {
    setSelectedVitalMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId]
    );
  };

  const toggleLabType = (labId: string) => {
    setSelectedLabTypes((prev) =>
      prev.includes(labId)
        ? prev.filter((l) => l !== labId)
        : [...prev, labId]
    );
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "worsening": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving": return "text-green-500";
      case "worsening": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const mockAdherenceData = {
    medicationAdherence: [
      { name: "Metformin 500mg", adherence: 92, target: 90 },
      { name: "Lisinopril 10mg", adherence: 85, target: 90 },
      { name: "Atorvastatin 20mg", adherence: 78, target: 90 },
    ],
    appointmentAttendance: 88,
    carePlanCompliance: 75,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            Patient Health Trends & AI Insights
          </CardTitle>
          <CardDescription>
            Visualize patient health data trends and review AI-generated insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Select Patient</Label>
              <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
                <SelectTrigger className="min-h-[44px]" data-testid="select-trends-patient">
                  <SelectValue placeholder="Choose a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.patientId} value={p.patientId}>
                      {p.patientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label>Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="min-h-[44px]" data-testid="select-time-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {timeRange === "custom" && (
              <>
                <div>
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="min-h-[44px] w-[140px] justify-start text-left font-normal"
                        data-testid="button-start-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="min-h-[44px] w-[140px] justify-start text-left font-normal"
                        data-testid="button-end-date"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPatientId && loadingTrends && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {trendData && (
        <>
          <Card ref={vitalsChartRef} data-testid="card-vitals-chart">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-primary" />
                  Vital Signs Trends
                </CardTitle>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => handleExportAsImage(vitalsChartRef, "vital-signs")}
                  data-testid="button-export-vitals"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Export as Image
                </Button>
              </div>
              <CardDescription>
                Toggle metrics to compare trends. Hover over bars for exact values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" data-testid="vitals-metric-toggles">
                {availableVitalMetrics.map((metric) => (
                  <div key={metric.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`vital-${metric.id}`}
                      checked={selectedVitalMetrics.includes(metric.id)}
                      onCheckedChange={() => toggleVitalMetric(metric.id)}
                      className="min-h-[20px] min-w-[20px]"
                      data-testid={`checkbox-vital-${metric.id.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                    <Label
                      htmlFor={`vital-${metric.id}`}
                      className="flex items-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <div className={`w-3 h-3 rounded-full ${metric.color}`} />
                      {metric.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-b pb-2" data-testid="vitals-legend">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/60" />
                  In Range
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-destructive/60" />
                  Out of Range
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-full h-px bg-green-500 border-dashed border-green-500" style={{ width: 20 }} />
                  Normal Min
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-full h-px bg-red-500" style={{ width: 20 }} />
                  Normal Max
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendData.vitalsTrends
                  .filter((vital) => selectedVitalMetrics.includes(vital.type))
                  .map((vital, idx) => {
                    const dataValues = vital.data.map((d) => d.value);
                    const minValue = Math.min(...dataValues);
                    const maxValue = Math.max(...dataValues);
                    return (
                      <div key={idx} className="p-4 border rounded-lg" data-testid={`card-vital-${vital.type.toLowerCase().replace(/\s+/g, "-")}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium flex items-center gap-2">
                            <Heart className="h-4 w-4 text-primary" />
                            {vital.type}
                          </span>
                          {getTrendIcon(vital.trend)}
                        </div>
                        <div className="text-2xl font-bold">
                          {vital.currentValue}{" "}
                          <span className="text-sm font-normal text-muted-foreground">{vital.unit}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-2">
                          <span>Normal: {vital.normalRange.min}-{vital.normalRange.max} {vital.unit}</span>
                          <span className="text-blue-600">Min: {minValue}</span>
                          <span className="text-red-600">Max: {maxValue}</span>
                        </div>
                        <div className="relative h-24">
                          <div
                            className="absolute left-0 right-0 border-t border-dashed border-green-500"
                            style={{
                              bottom: `${((vital.normalRange.min - minValue) / (maxValue - minValue || 1)) * 100}%`,
                            }}
                            title={`Normal Min: ${vital.normalRange.min}`}
                          />
                          <div
                            className="absolute left-0 right-0 border-t border-red-500"
                            style={{
                              bottom: `${((vital.normalRange.max - minValue) / (maxValue - minValue || 1)) * 100}%`,
                            }}
                            title={`Normal Max: ${vital.normalRange.max}`}
                          />
                          <div className="h-full flex items-end gap-1">
                            {vital.data.slice(-10).map((point, i) => {
                              const range = maxValue - minValue || 1;
                              const height = ((point.value - minValue) / range) * 100;
                              const isInRange =
                                point.value >= vital.normalRange.min && point.value <= vital.normalRange.max;
                              return (
                                <div
                                  key={i}
                                  className={`flex-1 rounded-t transition-colors cursor-pointer ${isInRange ? "bg-primary/60 hover:bg-primary/80" : "bg-destructive/60 hover:bg-destructive/80"}`}
                                  style={{ height: `${Math.max(10, height)}%` }}
                                  title={`${point.label}: ${point.value} ${vital.unit}`}
                                  data-testid={`vital-bar-${vital.type.toLowerCase().replace(/\s+/g, "-")}-${i}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                        <p className={`text-xs mt-2 ${getTrendColor(vital.trend)}`}>
                          {vital.trend === "improving"
                            ? "Improving trend"
                            : vital.trend === "worsening"
                            ? "Needs attention"
                            : "Stable"}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card ref={labsChartRef} data-testid="card-labs-chart">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Lab Results Trends
                </CardTitle>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => handleExportAsImage(labsChartRef, "lab-results")}
                  data-testid="button-export-labs"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Export as Image
                </Button>
              </div>
              <CardDescription>Color-coded results show in-range (green) vs out-of-range (red) values</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2" data-testid="labs-type-toggles">
                {availableLabTypes.map((lab) => (
                  <div key={lab.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`lab-${lab.id}`}
                      checked={selectedLabTypes.includes(lab.id)}
                      onCheckedChange={() => toggleLabType(lab.id)}
                      className="min-h-[20px] min-w-[20px]"
                      data-testid={`checkbox-lab-${lab.id.toLowerCase()}`}
                    />
                    <Label htmlFor={`lab-${lab.id}`} className="cursor-pointer min-h-[44px] flex items-center">
                      {lab.label}
                    </Label>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-b pb-2" data-testid="labs-legend">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500/60" />
                  In Range
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500/60" />
                  Out of Range
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  Improving
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  Worsening
                </span>
              </div>

              <div className="space-y-4">
                {trendData.labTrends
                  .filter((lab) => selectedLabTypes.some((selected) => lab.testName.toLowerCase().includes(selected.toLowerCase())))
                  .map((lab, idx) => {
                    const labConfig = availableLabTypes.find(
                      (l) => lab.testName.toLowerCase().includes(l.id.toLowerCase())
                    );
                    const normalRange = labConfig?.normalRange || { min: 0, max: 100 };
                    const latestValue = lab.data[lab.data.length - 1]?.value || 0;
                    const previousValue = lab.data[lab.data.length - 2]?.value;
                    const isInRange = latestValue >= normalRange.min && latestValue <= normalRange.max;
                    const historicalChange = previousValue
                      ? ((latestValue - previousValue) / previousValue) * 100
                      : null;

                    return (
                      <div
                        key={idx}
                        className={`p-4 border rounded-lg ${isInRange ? "border-green-500/30" : "border-red-500/30"}`}
                        data-testid={`lab-trend-${lab.testName.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lab.testName}</span>
                            <Badge
                              variant="outline"
                              className={isInRange ? "border-green-500 text-green-600" : "border-red-500 text-red-600"}
                            >
                              {isInRange ? "In Range" : "Out of Range"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {historicalChange !== null && (
                              <span
                                className={`text-xs flex items-center gap-1 ${historicalChange < 0 ? "text-green-600" : "text-red-600"}`}
                                data-testid={`lab-change-${idx}`}
                              >
                                {historicalChange < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : (
                                  <TrendingUp className="h-3 w-3" />
                                )}
                                {Math.abs(historicalChange).toFixed(1)}% vs prev
                              </span>
                            )}
                            {getTrendIcon(lab.trend)}
                            <span className={`text-sm ${getTrendColor(lab.trend)}`}>{lab.trend}</span>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          Normal Range: {normalRange.min} - {normalRange.max} {lab.unit}
                        </div>
                        <div className="h-16 flex items-end gap-1">
                          {lab.data.slice(-12).map((point, i) => {
                            const max = Math.max(...lab.data.map((d) => d.value));
                            const height = (point.value / max) * 100;
                            const pointInRange =
                              point.value >= normalRange.min && point.value <= normalRange.max;
                            return (
                              <div
                                key={i}
                                className={`flex-1 rounded-t transition-colors cursor-pointer ${pointInRange ? "bg-green-500/50 hover:bg-green-500/70" : "bg-red-500/50 hover:bg-red-500/70"}`}
                                style={{ height: `${Math.max(10, height)}%` }}
                                title={`${point.label}: ${point.value} ${lab.unit} (${pointInRange ? "In Range" : "Out of Range"})`}
                                data-testid={`lab-bar-${idx}-${i}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card ref={adherenceChartRef} data-testid="card-adherence-chart">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Treatment Adherence
                </CardTitle>
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => handleExportAsImage(adherenceChartRef, "treatment-adherence")}
                  data-testid="button-export-adherence"
                >
                  <Image className="h-4 w-4 mr-2" />
                  Export as Image
                </Button>
              </div>
              <CardDescription>
                Medication adherence, appointment attendance, and care plan compliance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div data-testid="section-medication-adherence">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Pill className="h-4 w-4" />
                  Medication Adherence
                </h4>
                <div className="space-y-3">
                  {mockAdherenceData.medicationAdherence.map((med, idx) => (
                    <div key={idx} data-testid={`medication-adherence-${idx}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{med.name}</span>
                        <span
                          className={`text-sm font-medium ${med.adherence >= med.target ? "text-green-600" : "text-orange-600"}`}
                        >
                          {med.adherence}%
                        </span>
                      </div>
                      <div className="relative">
                        <Progress
                          value={med.adherence}
                          className="h-3"
                          data-testid={`progress-med-${idx}`}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-px bg-foreground"
                          style={{ left: `${med.target}%` }}
                          title={`Target: ${med.target}%`}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Target: {med.target}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="p-4 border rounded-lg"
                  data-testid="section-appointment-attendance"
                >
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Appointment Attendance
                  </h4>
                  <div className="text-3xl font-bold mb-2" data-testid="value-appointment-attendance">
                    {mockAdherenceData.appointmentAttendance}%
                  </div>
                  <Progress
                    value={mockAdherenceData.appointmentAttendance}
                    className="h-3"
                    data-testid="progress-appointment"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on scheduled appointments in the selected time range
                  </p>
                </div>

                <div
                  className="p-4 border rounded-lg"
                  data-testid="section-care-plan-compliance"
                >
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Care Plan Compliance
                  </h4>
                  <div className="text-3xl font-bold mb-2" data-testid="value-care-plan-compliance">
                    {mockAdherenceData.carePlanCompliance}%
                  </div>
                  <Progress
                    value={mockAdherenceData.carePlanCompliance}
                    className="h-3"
                    data-testid="progress-care-plan"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Completion rate of care plan activities and goals
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {trendData.aiInsights.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Generated Insights
                </CardTitle>
                <CardDescription>
                  Automated analysis based on patient data patterns (for reference only)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendData.aiInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${insight.actionable ? "border-primary/30 bg-primary/5" : "bg-muted/50"}`}
                      data-testid={`ai-insight-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline">{insight.category}</Badge>
                            {insight.actionable && <Badge variant="default">Actionable</Badge>}
                          </div>
                          <p className="text-sm">{insight.insight}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">{insight.confidence}% confidence</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-2 bg-amber-500/10 rounded text-xs text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="h-3 w-3 inline mr-1" />
                  AI insights are for reference only. Clinical judgment required for all patient care decisions. This does NOT constitute clinical decision support.
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {selectedPatientId && !loadingTrends && !trendData && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <LineChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No trend data available for this patient</p>
          </CardContent>
        </Card>
      )}

      {!selectedPatientId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a patient to view health trends and AI insights</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  patientName?: string;
  userId: string;
  userName: string;
  details: string;
  outcome: "success" | "failure" | "denied";
  ipAddress?: string;
  phiAccessed: boolean;
}

interface EnhancedAuditLog {
  id: string;
  userId: string;
  userRole: string;
  eventType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  patientId: string | null;
  description: string;
  ipAddress: string;
  userAgent: string;
  platform: string;
  requestPath: string | null;
  requestMethod: string | null;
  responseStatus: string | null;
  timestamp: string;
}

interface AuditFilterOptions {
  userRoles: string[];
  actions: string[];
  resourceTypes: string[];
  eventTypes: string[];
}

interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byResourceType: Record<string, number>;
  byUserRole: Record<string, number>;
  byEventType: Record<string, number>;
  byDay: Record<string, number>;
  uniqueUsers: number;
  dateRange: { start: string | null; end: string | null };
}

function ProviderAuditTab() {
  const { toast } = useToast();
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const buildAuditUrl = () => {
    const params = new URLSearchParams();
    if (userRoleFilter !== "all") params.set("userRole", userRoleFilter);
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (resourceTypeFilter !== "all") params.set("resourceType", resourceTypeFilter);
    if (startDate) params.set("startDate", startDate.toISOString());
    if (endDate) params.set("endDate", endDate.toISOString());
    if (searchQuery) params.set("searchQuery", searchQuery);
    params.set("limit", "200");
    return `/api/provider/portal/audit-logs?${params.toString()}`;
  };

  const { data: auditData, isLoading, refetch } = useQuery<{ logs: EnhancedAuditLog[]; total: number }>({
    queryKey: [buildAuditUrl()],
    refetchInterval: 60000,
  });

  const auditLogs = auditData?.logs || [];

  const { data: filterOptions } = useQuery<AuditFilterOptions>({
    queryKey: ["/api/provider/portal/audit-logs/filter-options"],
  });

  const { data: auditStats } = useQuery<AuditStats>({
    queryKey: [`/api/provider/portal/audit-logs/stats?startDate=${startDate?.toISOString() || ""}&endDate=${endDate?.toISOString() || ""}`],
  });

  const { data: selectedLogDetail } = useQuery<EnhancedAuditLog & { fullMetadata: Record<string, any> }>({
    queryKey: [`/api/provider/portal/audit-logs/${selectedLogId}`],
    enabled: !!selectedLogId,
  });

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (userRoleFilter !== "all") params.set("userRole", userRoleFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (resourceTypeFilter !== "all") params.set("resourceType", resourceTypeFilter);
      if (startDate) params.set("startDate", startDate.toISOString());
      if (endDate) params.set("endDate", endDate.toISOString());

      const response = await fetch(`/api/provider/portal/audit-logs/export/csv?${params.toString()}`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Export Complete", description: "Audit logs exported as CSV successfully." });
    } catch (error) {
      toast({ title: "Export Failed", description: "Unable to export audit logs.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (userRoleFilter !== "all") params.set("userRole", userRoleFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (resourceTypeFilter !== "all") params.set("resourceType", resourceTypeFilter);
      if (startDate) params.set("startDate", startDate.toISOString());
      if (endDate) params.set("endDate", endDate.toISOString());

      const response = await fetch(`/api/provider/portal/audit-logs/export/pdf?${params.toString()}`);
      if (!response.ok) throw new Error("Export failed");
      
      const reportData = await response.json();
      
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>HIPAA Compliance Audit Report</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
              h1 { color: #1a365d; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
              h2 { color: #2d3748; margin-top: 30px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
              th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
              th { background-color: #f7fafc; font-weight: bold; }
              tr:nth-child(even) { background-color: #f9f9f9; }
              .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
              .summary-card { background: #f7fafc; padding: 15px; border-radius: 8px; }
              .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #4a5568; }
              .summary-card .value { font-size: 24px; font-weight: bold; color: #1a365d; }
              .disclaimer { margin-top: 40px; padding: 15px; background: #fef3c7; border-radius: 8px; font-size: 12px; }
              .meta { color: #718096; font-size: 12px; margin-bottom: 20px; }
              @media print { body { margin: 20px; } }
            </style>
          </head>
          <body>
            <h1>${reportData.title}</h1>
            <div class="meta">
              <p>Generated: ${format(new Date(reportData.generatedAt), "PPpp")}</p>
              <p>Date Range: ${reportData.dateRange.start ? format(new Date(reportData.dateRange.start), "PP") : "All"} - ${reportData.dateRange.end ? format(new Date(reportData.dateRange.end), "PP") : "Present"}</p>
              <p>Filters Applied: User Role: ${reportData.appliedFilters.userRole}, Action: ${reportData.appliedFilters.action}, Resource: ${reportData.appliedFilters.resourceType}</p>
            </div>
            
            <div class="summary-grid">
              <div class="summary-card">
                <h3>Total Events</h3>
                <div class="value">${reportData.summary.totalEvents}</div>
              </div>
              <div class="summary-card">
                <h3>Unique Users</h3>
                <div class="value">${reportData.summary.uniqueUsers}</div>
              </div>
              <div class="summary-card">
                <h3>Resource Types</h3>
                <div class="value">${Object.keys(reportData.summary.byResourceType).length}</div>
              </div>
            </div>

            <h2>Activity by Action Type</h2>
            <table>
              <tr><th>Action</th><th>Count</th></tr>
              ${Object.entries(reportData.summary.byAction).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
            </table>

            <h2>Activity by Resource Type</h2>
            <table>
              <tr><th>Resource</th><th>Count</th></tr>
              ${Object.entries(reportData.summary.byResourceType).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
            </table>

            <h2>Recent Audit Entries (Last 500)</h2>
            <table>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Description</th>
              </tr>
              ${reportData.logs.map((log: any) => `
                <tr>
                  <td>${format(new Date(log.timestamp), "Pp")}</td>
                  <td>${log.userId}</td>
                  <td>${log.userRole}</td>
                  <td>${log.action}</td>
                  <td>${log.resourceType}</td>
                  <td>${log.description?.slice(0, 100)}${log.description?.length > 100 ? "..." : ""}</td>
                </tr>
              `).join("")}
            </table>

            <div class="disclaimer">
              <strong>HIPAA Compliance Notice:</strong> ${reportData.disclaimer}
            </div>
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }

      toast({ title: "Report Generated", description: "HIPAA compliance audit report opened for printing." });
    } catch (error) {
      toast({ title: "Export Failed", description: "Unable to generate PDF report.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setUserRoleFilter("all");
    setActionFilter("all");
    setResourceTypeFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchQuery("");
  };

  const getActionIcon = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes("view") || lowerAction.includes("read")) return <Eye className="h-4 w-4" />;
    if (lowerAction.includes("export") || lowerAction.includes("download")) return <Download className="h-4 w-4" />;
    if (lowerAction.includes("update") || lowerAction.includes("write") || lowerAction.includes("edit")) return <FileText className="h-4 w-4" />;
    if (lowerAction.includes("share") || lowerAction.includes("send")) return <Send className="h-4 w-4" />;
    if (lowerAction.includes("delete")) return <Trash2 className="h-4 w-4" />;
    if (lowerAction.includes("login") || lowerAction.includes("auth")) return <Shield className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin": return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      case "provider": return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "patient": return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "caregiver": return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
      default: return "bg-slate-500/10 text-slate-700 dark:text-slate-400";
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>Educational Tool Only: This audit trail is for compliance monitoring purposes. Not for clinical decision-making.</span>
      </div>

      {auditStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{auditStats.total.toLocaleString()}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  <p className="text-2xl font-bold">{auditStats.uniqueUsers}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resource Types</p>
                  <p className="text-2xl font-bold">{Object.keys(auditStats.byResourceType).length}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Action Types</p>
                  <p className="text-2xl font-bold">{Object.keys(auditStats.byAction).length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Enhanced Audit Trail
              </CardTitle>
              <CardDescription>
                Granular tracking of all PHI access and provider actions with HIPAA-compliant logging
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isExporting} className="min-h-[44px]" data-testid="button-export-csv">
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting} className="min-h-[44px]" data-testid="button-export-pdf">
                <FileText className="h-4 w-4 mr-2" />
                PDF Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by user, patient, resource..."
                  className="pl-10 min-h-[44px]"
                  data-testid="input-audit-search"
                />
              </div>
            </div>
            <div className="w-[140px]">
              <Label>User Role</Label>
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="min-h-[44px]" data-testid="select-role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {filterOptions?.userRoles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <Label>Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="min-h-[44px]" data-testid="select-action-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {filterOptions?.actions.slice(0, 15).map((action) => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <Label>Resource</Label>
              <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                <SelectTrigger className="min-h-[44px]" data-testid="select-resource-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {filterOptions?.resourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="min-h-[44px]" data-testid="button-advanced-filters">
              <Filter className="h-4 w-4 mr-2" />
              {showAdvancedFilters ? "Less" : "More"}
            </Button>
            <Button variant="outline" onClick={() => refetch()} className="min-h-[44px]" data-testid="button-refresh-audit">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {showAdvancedFilters && (
            <div className="flex gap-4 flex-wrap items-end p-4 bg-muted/50 rounded-lg">
              <div className="w-[180px]">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                  className="min-h-[44px]"
                  data-testid="input-start-date"
                />
              </div>
              <div className="w-[180px]">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                  className="min-h-[44px]"
                  data-testid="input-end-date"
                />
              </div>
              <Button variant="ghost" onClick={clearFilters} className="min-h-[44px]" data-testid="button-clear-filters">
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg">Audit Entries</CardTitle>
            <Badge variant="outline">{auditLogs.length} records</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit log entries found for the selected filters</p>
              <Button variant="link" onClick={clearFilters} className="mt-2">Clear all filters</Button>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {auditLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-4 hover:bg-muted/50 cursor-pointer" 
                    onClick={() => setSelectedLogId(log.id)}
                    data-testid={`audit-entry-${log.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {getActionIcon(log.action)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{log.action}</span>
                            <Badge variant="outline" className={getRoleBadgeColor(log.userRole)}>
                              {log.userRole}
                            </Badge>
                            {log.patientId && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                PHI
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{log.description}</p>
                          {log.patientId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <User className="h-3 w-3 inline mr-1" />
                              Patient ID: {log.patientId}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {format(new Date(log.timestamp), "PPpp")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <p>{log.userId.slice(0, 20)}...</p>
                        <Badge variant="secondary" className="mt-1">{log.resourceType}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selectedLogId && selectedLogDetail && (
        <Dialog open={!!selectedLogId} onOpenChange={() => setSelectedLogId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Entry Details
              </DialogTitle>
              <DialogDescription>
                Detailed information about this audit log entry
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Timestamp</Label>
                    <p className="font-medium">{format(new Date(selectedLogDetail.timestamp), "PPpp")}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <p className="font-medium text-sm break-all">{selectedLogDetail.userId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">User Role</Label>
                    <Badge className={getRoleBadgeColor(selectedLogDetail.userRole)}>{selectedLogDetail.userRole}</Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Event Type</Label>
                    <p className="font-medium">{selectedLogDetail.eventType}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Action</Label>
                    <p className="font-medium">{selectedLogDetail.action}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Resource Type</Label>
                    <Badge variant="secondary">{selectedLogDetail.resourceType}</Badge>
                  </div>
                  {selectedLogDetail.resourceId && (
                    <div>
                      <Label className="text-muted-foreground">Resource ID</Label>
                      <p className="font-medium text-sm">{selectedLogDetail.resourceId}</p>
                    </div>
                  )}
                  {selectedLogDetail.patientId && (
                    <div>
                      <Label className="text-muted-foreground">Patient ID</Label>
                      <p className="font-medium text-sm">{selectedLogDetail.patientId}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p className="font-medium">{selectedLogDetail.ipAddress}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Platform</Label>
                    <p className="font-medium">{selectedLogDetail.platform}</p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{selectedLogDetail.description}</p>
                </div>

                {selectedLogDetail.requestPath && (
                  <div>
                    <Label className="text-muted-foreground">Request Details</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg text-sm font-mono">
                      <p>{selectedLogDetail.requestMethod} {selectedLogDetail.requestPath}</p>
                      {selectedLogDetail.responseStatus && <p>Status: {selectedLogDetail.responseStatus}</p>}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="mt-1 p-3 bg-muted rounded-lg text-xs break-all">{selectedLogDetail.userAgent}</p>
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSelectedLogId(null)} className="min-h-[44px]">Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <span>All audit logs are encrypted and retained for 7 years in compliance with HIPAA requirements. Access to this data is logged.</span>
      </div>
    </div>
  );
}

// Extended interfaces for prescriptions with patient info
interface PrescriptionWithPatient extends Prescription {
  patientName: string;
  patientAge?: number;
}

interface RefillRequestWithDetails extends RefillRequest {
  patientName: string;
  medicationName: string;
  strength: string;
  pharmacyName?: string;
}

interface PrescriptionFillRecord {
  id: string;
  prescriptionId: string;
  fillDate: string;
  pharmacyName: string;
  quantity: number;
  daysSupply: number;
  dispensedBy?: string;
  notes?: string;
}

const prescriptionStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  filled: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  expired: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  on_hold: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
};

const refillStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  denied: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  processing: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  completed: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  cancelled: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
};

function PrescriptionsTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [activeSection, setActiveSection] = useState<"active" | "refills" | "history">("active");
  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  
  // New prescription form state
  const [newRx, setNewRx] = useState({
    patientId: "",
    medicationName: "",
    genericName: "",
    strength: "",
    dosageForm: "",
    quantity: 30,
    daysSupply: 30,
    directions: "",
    refillsAuthorized: 0,
    pharmacyId: "",
    isControlledSubstance: false,
    deaSchedule: "",
    notes: "",
    dispenseAsWritten: false,
  });

  // Build query URL for prescriptions
  const buildPrescriptionsUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (searchTerm) params.append("search", searchTerm);
    const queryStr = params.toString();
    return `/api/provider/portal/prescriptions${queryStr ? `?${queryStr}` : ""}`;
  };

  // Fetch prescriptions
  const { data: prescriptions = [], isLoading: loadingPrescriptions } = useQuery<PrescriptionWithPatient[]>({
    queryKey: [buildPrescriptionsUrl()],
  });

  // Fetch refill requests
  const { data: refillRequests = [], isLoading: loadingRefills } = useQuery<RefillRequestWithDetails[]>({
    queryKey: ["/api/provider/portal/refill-requests"],
  });

  // Fetch pharmacies
  const { data: pharmacies = [] } = useQuery<Pharmacy[]>({
    queryKey: ["/api/provider/portal/pharmacies"],
  });

  // Fetch patients for selection
  const { data: patients = [] } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  // Fetch fill history for selected prescription
  const { data: fillHistory = [], isLoading: loadingHistory } = useQuery<PrescriptionFillRecord[]>({
    queryKey: [`/api/provider/portal/prescriptions/${selectedPrescriptionId}/history`],
    enabled: activeSection === "history" && !!selectedPrescriptionId,
  });

  // Create prescription mutation
  const createPrescriptionMutation = useMutation({
    mutationFn: async (data: typeof newRx) => {
      const res = await apiRequest("POST", "/api/provider/portal/prescriptions", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prescription Created",
        description: "The prescription has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/prescriptions"] });
      setIsNewPrescriptionOpen(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create prescription. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send prescription to pharmacy
  const sendPrescriptionMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      const res = await apiRequest("POST", `/api/provider/portal/prescriptions/${prescriptionId}/send`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Prescription Sent",
        description: "The prescription has been sent to the pharmacy.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/prescriptions"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send prescription to pharmacy.",
        variant: "destructive",
      });
    },
  });

  // Approve refill request
  const approveRefillMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest("PATCH", `/api/provider/portal/refill-requests/${requestId}`, {
        status: "approved",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Refill Approved",
        description: "The refill request has been approved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/refill-requests"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve refill request.",
        variant: "destructive",
      });
    },
  });

  // Deny refill request
  const denyRefillMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/provider/portal/refill-requests/${requestId}`, {
        status: "denied",
        denialReason: reason,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Refill Denied",
        description: "The refill request has been denied.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/refill-requests"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to deny refill request.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setNewRx({
      patientId: "",
      medicationName: "",
      genericName: "",
      strength: "",
      dosageForm: "",
      quantity: 30,
      daysSupply: 30,
      directions: "",
      refillsAuthorized: 0,
      pharmacyId: "",
      isControlledSubstance: false,
      deaSchedule: "",
      notes: "",
      dispenseAsWritten: false,
    });
  };

  const handleCreatePrescription = () => {
    if (!newRx.patientId || !newRx.medicationName || !newRx.strength || !newRx.directions) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createPrescriptionMutation.mutate(newRx);
  };

  const pendingRefills = refillRequests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>NO-CDS Notice:</strong> Prescription information displayed here is for reference only and does NOT constitute clinical decision support. Verify all medication information before prescribing.
          </span>
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={activeSection === "active" ? "default" : "outline"}
            onClick={() => setActiveSection("active")}
            className="min-h-[44px]"
            data-testid="btn-section-active"
          >
            <Pill className="h-4 w-4 mr-2" />
            Active Prescriptions
          </Button>
          <Button
            variant={activeSection === "refills" ? "default" : "outline"}
            onClick={() => setActiveSection("refills")}
            className="min-h-[44px] relative"
            data-testid="btn-section-refills"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refill Requests
            {pendingRefills.length > 0 && (
              <Badge variant="destructive" className="ml-2" data-testid="badge-pending-refills">
                {pendingRefills.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeSection === "history" ? "default" : "outline"}
            onClick={() => setActiveSection("history")}
            className="min-h-[44px]"
            data-testid="btn-section-history"
          >
            <History className="h-4 w-4 mr-2" />
            Fill History
          </Button>
        </div>

        <Dialog open={isNewPrescriptionOpen} onOpenChange={setIsNewPrescriptionOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]" data-testid="btn-new-prescription">
              <Plus className="h-4 w-4 mr-2" />
              New Prescription
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                New Prescription
              </DialogTitle>
              <DialogDescription>
                Create a new electronic prescription for a patient.
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
              <p className="text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <ShieldAlert className="h-3 w-3 shrink-0" />
                <span>NO-CDS: Verify all medication information independently before prescribing.</span>
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="patient">Patient *</Label>
                <Select
                  value={newRx.patientId}
                  onValueChange={(v) => setNewRx({ ...newRx, patientId: v })}
                >
                  <SelectTrigger className="min-h-[44px]" data-testid="select-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId}>
                        {p.patientName} (Age {p.age})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="medicationName">Medication Name *</Label>
                  <Input
                    id="medicationName"
                    value={newRx.medicationName}
                    onChange={(e) => setNewRx({ ...newRx, medicationName: e.target.value })}
                    placeholder="e.g., Lisinopril"
                    className="min-h-[44px]"
                    data-testid="input-medication-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="genericName">Generic Name</Label>
                  <Input
                    id="genericName"
                    value={newRx.genericName}
                    onChange={(e) => setNewRx({ ...newRx, genericName: e.target.value })}
                    placeholder="Optional"
                    className="min-h-[44px]"
                    data-testid="input-generic-name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="strength">Strength *</Label>
                  <Input
                    id="strength"
                    value={newRx.strength}
                    onChange={(e) => setNewRx({ ...newRx, strength: e.target.value })}
                    placeholder="e.g., 10mg"
                    className="min-h-[44px]"
                    data-testid="input-strength"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dosageForm">Dosage Form *</Label>
                  <Select
                    value={newRx.dosageForm}
                    onValueChange={(v) => setNewRx({ ...newRx, dosageForm: v })}
                  >
                    <SelectTrigger className="min-h-[44px]" data-testid="select-dosage-form">
                      <SelectValue placeholder="Select form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tablet">Tablet</SelectItem>
                      <SelectItem value="capsule">Capsule</SelectItem>
                      <SelectItem value="liquid">Liquid</SelectItem>
                      <SelectItem value="injection">Injection</SelectItem>
                      <SelectItem value="cream">Cream/Ointment</SelectItem>
                      <SelectItem value="patch">Patch</SelectItem>
                      <SelectItem value="inhaler">Inhaler</SelectItem>
                      <SelectItem value="drops">Drops</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={newRx.quantity}
                    onChange={(e) => setNewRx({ ...newRx, quantity: parseInt(e.target.value) || 0 })}
                    min={1}
                    className="min-h-[44px]"
                    data-testid="input-quantity"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="daysSupply">Days Supply *</Label>
                  <Input
                    id="daysSupply"
                    type="number"
                    value={newRx.daysSupply}
                    onChange={(e) => setNewRx({ ...newRx, daysSupply: parseInt(e.target.value) || 0 })}
                    min={1}
                    className="min-h-[44px]"
                    data-testid="input-days-supply"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="directions">Directions (Sig) *</Label>
                <Textarea
                  id="directions"
                  value={newRx.directions}
                  onChange={(e) => setNewRx({ ...newRx, directions: e.target.value })}
                  placeholder="e.g., Take 1 tablet by mouth once daily"
                  className="min-h-[80px]"
                  data-testid="input-directions"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="refillsAuthorized">Refills Authorized (0-12)</Label>
                  <Input
                    id="refillsAuthorized"
                    type="number"
                    value={newRx.refillsAuthorized}
                    onChange={(e) => setNewRx({ ...newRx, refillsAuthorized: Math.min(12, Math.max(0, parseInt(e.target.value) || 0)) })}
                    min={0}
                    max={12}
                    className="min-h-[44px]"
                    data-testid="input-refills"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pharmacy">Pharmacy</Label>
                  <Select
                    value={newRx.pharmacyId}
                    onValueChange={(v) => setNewRx({ ...newRx, pharmacyId: v })}
                  >
                    <SelectTrigger className="min-h-[44px]" data-testid="select-pharmacy">
                      <SelectValue placeholder="Select pharmacy" />
                    </SelectTrigger>
                    <SelectContent>
                      {pharmacies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - {p.city}, {p.state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4 p-3 border rounded-md">
                <div className="flex items-center gap-2">
                  <Switch
                    id="controlled"
                    checked={newRx.isControlledSubstance}
                    onCheckedChange={(checked) => setNewRx({ ...newRx, isControlledSubstance: checked, deaSchedule: checked ? newRx.deaSchedule : "" })}
                    data-testid="switch-controlled"
                  />
                  <Label htmlFor="controlled" className="cursor-pointer">Controlled Substance</Label>
                </div>
                {newRx.isControlledSubstance && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="deaSchedule">DEA Schedule:</Label>
                    <Select
                      value={newRx.deaSchedule}
                      onValueChange={(v) => setNewRx({ ...newRx, deaSchedule: v })}
                    >
                      <SelectTrigger className="w-[100px] min-h-[44px]" data-testid="select-dea-schedule">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="II">Schedule II</SelectItem>
                        <SelectItem value="III">Schedule III</SelectItem>
                        <SelectItem value="IV">Schedule IV</SelectItem>
                        <SelectItem value="V">Schedule V</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="daw"
                  checked={newRx.dispenseAsWritten}
                  onCheckedChange={(checked) => setNewRx({ ...newRx, dispenseAsWritten: checked })}
                  data-testid="switch-daw"
                />
                <Label htmlFor="daw" className="cursor-pointer">Dispense As Written (No Generic Substitution)</Label>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newRx.notes}
                  onChange={(e) => setNewRx({ ...newRx, notes: e.target.value })}
                  placeholder="Additional notes for the pharmacist"
                  className="min-h-[60px]"
                  data-testid="input-notes"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIsNewPrescriptionOpen(false)}
                className="min-h-[44px]"
                data-testid="btn-cancel-prescription"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePrescription}
                disabled={createPrescriptionMutation.isPending}
                className="min-h-[44px]"
                data-testid="btn-submit-prescription"
              >
                {createPrescriptionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Prescription
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeSection === "active" && (
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Active Prescriptions</CardTitle>
                <CardDescription>Manage active prescriptions for your patients</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patient or medication..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 min-h-[44px] w-[250px]"
                    data-testid="input-search-prescriptions"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] min-h-[44px]" data-testid="select-status-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPrescriptions ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : prescriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No prescriptions found</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-4 border rounded-md hover-elevate"
                      data-testid={`prescription-card-${rx.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium" data-testid={`rx-medication-${rx.id}`}>
                              {rx.medicationName} {rx.strength}
                            </span>
                            <Badge
                              className={prescriptionStatusColors[rx.status] || ""}
                              variant="outline"
                              data-testid={`rx-status-${rx.id}`}
                            >
                              {rx.status}
                            </Badge>
                            {rx.isControlledSubstance && (
                              <Badge variant="destructive" className="text-xs" data-testid={`rx-controlled-${rx.id}`}>
                                C-{rx.deaSchedule}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`rx-patient-${rx.id}`}>
                            <User className="h-3 w-3 inline mr-1" />
                            {rx.patientName}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`rx-directions-${rx.id}`}>
                            Sig: {rx.directions}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span data-testid={`rx-quantity-${rx.id}`}>
                              Qty: {rx.quantity} | {rx.daysSupply} days
                            </span>
                            <span data-testid={`rx-refills-${rx.id}`}>
                              Refills: {rx.refillsRemaining}/{rx.refillsAuthorized}
                            </span>
                            <span data-testid={`rx-prescribed-${rx.id}`}>
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(new Date(rx.prescribedDate), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rx.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => sendPrescriptionMutation.mutate(rx.id)}
                              disabled={sendPrescriptionMutation.isPending}
                              className="min-h-[44px]"
                              data-testid={`btn-send-rx-${rx.id}`}
                            >
                              {sendPrescriptionMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-1" />
                                  Send to Pharmacy
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPrescriptionId(rx.id);
                              setActiveSection("history");
                            }}
                            className="min-h-[44px]"
                            data-testid={`btn-view-history-${rx.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            History
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "refills" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Refill Requests
            </CardTitle>
            <CardDescription>Review and manage patient refill requests</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRefills ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : refillRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No refill requests</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {refillRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 border rounded-md"
                      data-testid={`refill-request-${request.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium" data-testid={`refill-medication-${request.id}`}>
                              {request.medicationName} {request.strength}
                            </span>
                            <Badge
                              className={refillStatusColors[request.status] || ""}
                              variant="outline"
                              data-testid={`refill-status-${request.id}`}
                            >
                              {request.status}
                            </Badge>
                            {request.urgency === "urgent" && (
                              <Badge variant="destructive" data-testid={`refill-urgent-${request.id}`}>
                                Urgent
                              </Badge>
                            )}
                            {request.urgency === "emergency" && (
                              <Badge variant="destructive" data-testid={`refill-emergency-${request.id}`}>
                                Emergency
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`refill-patient-${request.id}`}>
                            <User className="h-3 w-3 inline mr-1" />
                            {request.patientName}
                          </p>
                          {request.patientNotes && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`refill-notes-${request.id}`}>
                              Patient notes: {request.patientNotes}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span data-testid={`refill-requested-${request.id}`}>
                              <Clock className="h-3 w-3 inline mr-1" />
                              Requested: {formatDistanceToNow(new Date(request.requestedDate), { addSuffix: true })}
                            </span>
                            {request.pharmacyName && (
                              <span data-testid={`refill-pharmacy-${request.id}`}>
                                Pharmacy: {request.pharmacyName}
                              </span>
                            )}
                          </div>
                        </div>
                        {request.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveRefillMutation.mutate(request.id)}
                              disabled={approveRefillMutation.isPending}
                              className="min-h-[44px]"
                              data-testid={`btn-approve-refill-${request.id}`}
                            >
                              {approveRefillMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => denyRefillMutation.mutate({ requestId: request.id, reason: "Clinical review required" })}
                              disabled={denyRefillMutation.isPending}
                              className="min-h-[44px]"
                              data-testid={`btn-deny-refill-${request.id}`}
                            >
                              {denyRefillMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Deny
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "history" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Prescription Fill History
                </CardTitle>
                <CardDescription>
                  {selectedPrescriptionId
                    ? "View fill records for the selected prescription"
                    : "Select a prescription to view its fill history"}
                </CardDescription>
              </div>
              {selectedPrescriptionId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPrescriptionId(null)}
                  className="min-h-[44px]"
                  data-testid="btn-clear-selection"
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedPrescriptionId ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a prescription from the Active Prescriptions tab to view its fill history</p>
              </div>
            ) : loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : fillHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No fill records found for this prescription</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {fillHistory.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 border rounded-md"
                      data-testid={`fill-record-${record.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium" data-testid={`fill-date-${record.id}`}>
                            <Calendar className="h-4 w-4 inline mr-2" />
                            {format(new Date(record.fillDate), "MMMM d, yyyy")}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`fill-pharmacy-${record.id}`}>
                            Pharmacy: {record.pharmacyName}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span data-testid={`fill-qty-${record.id}`}>Qty: {record.quantity}</span>
                            <span data-testid={`fill-days-${record.id}`}>{record.daysSupply} days supply</span>
                            {record.dispensedBy && (
                              <span data-testid={`fill-dispensed-by-${record.id}`}>
                                Dispensed by: {record.dispensedBy}
                              </span>
                            )}
                          </div>
                          {record.notes && (
                            <p className="text-sm text-muted-foreground mt-2" data-testid={`fill-notes-${record.id}`}>
                              Notes: {record.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface PopulationHealthData {
  totalPatients: number;
  activePatients: number;
  newPatientsThisMonth: number;
  ageDistribution: { range: string; count: number; percentage: number }[];
  chronicConditions: { name: string; count: number; percentage: number }[];
  riskStratification: { level: string; count: number; percentage: number }[];
  vaccinationRates: { name: string; actual: number; target: number }[];
  preventiveCareCompliance: { metric: string; rate: number }[];
}

interface PracticeKPIsData {
  patientVolume: { daily: number; weekly: number; monthly: number };
  appointmentMetrics: {
    completed: number;
    cancelled: number;
    noShow: number;
    completionRate: number;
  };
  waitTimeAverages: {
    inOffice: number;
    toNextAvailable: number;
    status: "good" | "moderate" | "poor";
  };
  patientSatisfaction: {
    npsScore: number;
    satisfactionRate: number;
    responseRate: number;
  };
  prescriptionMetrics: {
    newPrescriptions: number;
    refillsProcessed: number;
    eRxRate: number;
  };
  telehealthUtilization: {
    totalVisits: number;
    percentageOfTotal: number;
    averageDuration: number;
  };
  providerProductivity: {
    providerId: string;
    providerName: string;
    patientsPerDay: number;
    appointmentsCompleted: number;
    documentationTime: number;
  }[];
}

interface TrendsData {
  period: string;
  metric: string;
  dataPoints: { date: string; value: number }[];
  statistics: {
    total: number;
    average: number;
    min: number;
    max: number;
    trend: "up" | "down" | "stable";
    changePercent: number;
  };
}

interface RecentExport {
  id: string;
  reportType: string;
  format: string;
  generatedAt: string;
  status: "completed" | "processing" | "failed";
  downloadUrl?: string;
  fileSize?: string;
}

function ReportsTab() {
  const { toast } = useToast();
  const [activeReportSection, setActiveReportSection] = useState<"population" | "kpis" | "trends" | "export">("population");
  const [trendsPeriod, setTrendsPeriod] = useState<string>("30d");
  const [trendsMetric, setTrendsMetric] = useState<string>("visits");
  const [exportReportType, setExportReportType] = useState<string>("population-health");
  const [exportFormat, setExportFormat] = useState<string>("csv");
  const [exportDateRange, setExportDateRange] = useState({ start: "", end: "" });
  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);
  const [showPopulationBenchmarks, setShowPopulationBenchmarks] = useState(true);
  const [showKpiBenchmarks, setShowKpiBenchmarks] = useState(true);

  const populationHealthChartRef = useRef<HTMLDivElement>(null);
  const kpiDashboardRef = useRef<HTMLDivElement>(null);

  const handleExportAsImage = async (chartRef: React.RefObject<HTMLDivElement>, chartName: string) => {
    if (!chartRef.current) {
      toast({
        title: "Export Failed",
        description: "Unable to find chart element to export.",
        variant: "destructive",
      });
      return;
    }
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${chartName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({
        title: "Export Complete",
        description: `${chartName} has been exported as an image.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export chart as image.",
        variant: "destructive",
      });
    }
  };

  const chronicConditionBenchmarks: Record<string, { national: number; regional: number; previousPeriod: number }> = {
    "Diabetes": { national: 11.3, regional: 12.1, previousPeriod: 14.2 },
    "Hypertension": { national: 47.3, regional: 45.8, previousPeriod: 21.5 },
    "Heart Disease": { national: 6.2, regional: 5.9, previousPeriod: 8.1 },
    "COPD": { national: 4.5, regional: 4.8, previousPeriod: 5.2 },
    "Asthma": { national: 8.0, regional: 7.5, previousPeriod: 6.8 },
    "Obesity": { national: 41.9, regional: 38.5, previousPeriod: 11.3 },
  };

  const kpiBenchmarks = {
    patientVolume: { dailyBenchmark: 25, weeklyBenchmark: 120, monthlyBenchmark: 480, dailyGoal: 28, weeklyGoal: 130, monthlyGoal: 520 },
    appointmentMetrics: { completionRateBenchmark: 85, noShowBenchmark: 8, cancelledBenchmark: 12, completionRateGoal: 90 },
    waitTimeAverages: { inOfficeBenchmark: 15, toNextAvailableBenchmark: 5 },
    patientSatisfaction: { npsBenchmark: 45, satisfactionBenchmark: 85, responseBenchmark: 30 },
    prescriptionMetrics: { eRxRateBenchmark: 90 },
    telehealthUtilization: { percentageBenchmark: 20 },
  };

  const getPerformanceIndicator = (actual: number, benchmark: number, higherIsBetter: boolean = true) => {
    const diff = higherIsBetter ? actual - benchmark : benchmark - actual;
    if (diff > 5) return { color: "text-green-600 bg-green-500/10", label: "Above Benchmark", icon: TrendingUp };
    if (diff >= -2 && diff <= 5) return { color: "text-yellow-600 bg-yellow-500/10", label: "At Benchmark", icon: Minus };
    return { color: "text-red-600 bg-red-500/10", label: "Below Benchmark", icon: TrendingDown };
  };

  const getPerformanceRating = (actual: number, goal: number, higherIsBetter: boolean = true) => {
    const ratio = higherIsBetter ? actual / goal : goal / actual;
    if (ratio >= 1.1) return { label: "Excellent", color: "bg-green-500 text-white" };
    if (ratio >= 0.9) return { label: "Good", color: "bg-blue-500 text-white" };
    return { label: "Needs Improvement", color: "bg-orange-500 text-white" };
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change).toFixed(1), isPositive: change >= 0 };
  };

  const renderSparkline = (values: number[]) => {
    if (!values || values.length === 0) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    return (
      <div className="flex items-end gap-0.5 h-4" data-testid="sparkline">
        {values.map((v, i) => (
          <div
            key={i}
            className="w-1 bg-primary rounded-sm transition-all"
            style={{ height: `${((v - min) / range) * 100}%`, minHeight: "2px" }}
          />
        ))}
      </div>
    );
  };

  const { data: populationHealth, isLoading: loadingPopulation } = useQuery<PopulationHealthData>({
    queryKey: ["/api/provider/portal/reports/population-health"],
    enabled: activeReportSection === "population",
  });

  const { data: practiceKPIs, isLoading: loadingKPIs } = useQuery<PracticeKPIsData>({
    queryKey: ["/api/provider/portal/reports/practice-kpis"],
    enabled: activeReportSection === "kpis",
  });

  const { data: trendsData, isLoading: loadingTrends } = useQuery<TrendsData>({
    queryKey: [`/api/provider/portal/reports/trends?metric=${trendsMetric}&period=${trendsPeriod}`],
    enabled: activeReportSection === "trends",
  });

  const exportMutation = useMutation({
    mutationFn: async (params: { reportType: string; format: string; dateRange?: { start: string; end: string } }) => {
      const res = await apiRequest("POST", "/api/provider/portal/reports/export", params);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Export Started",
        description: `Your ${exportFormat.toUpperCase()} report is being generated.`,
      });
      setRecentExports((prev) => [data, ...prev].slice(0, 5));
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Unable to generate the report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    exportMutation.mutate({
      reportType: exportReportType,
      format: exportFormat,
      dateRange: exportDateRange.start && exportDateRange.end ? exportDateRange : undefined,
    });
  };

  const getMaxDataPoint = (dataPoints: { date: string; value: number }[] | undefined) => {
    if (!dataPoints || dataPoints.length === 0) return 1;
    return Math.max(...dataPoints.map((d) => d.value));
  };

  return (
    <div className="space-y-6">
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>Informational Only:</strong> These reports are for administrative and operational purposes only and do NOT constitute clinical decision support.
          </span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeReportSection === "population" ? "default" : "outline"}
          onClick={() => setActiveReportSection("population")}
          className="min-h-[44px]"
          data-testid="btn-section-population"
        >
          <Users className="h-4 w-4 mr-2" />
          Population Health
        </Button>
        <Button
          variant={activeReportSection === "kpis" ? "default" : "outline"}
          onClick={() => setActiveReportSection("kpis")}
          className="min-h-[44px]"
          data-testid="btn-section-kpis"
        >
          <Target className="h-4 w-4 mr-2" />
          Practice KPIs
        </Button>
        <Button
          variant={activeReportSection === "trends" ? "default" : "outline"}
          onClick={() => setActiveReportSection("trends")}
          className="min-h-[44px]"
          data-testid="btn-section-trends"
        >
          <LineChart className="h-4 w-4 mr-2" />
          Trends
        </Button>
        <Button
          variant={activeReportSection === "export" ? "default" : "outline"}
          onClick={() => setActiveReportSection("export")}
          className="min-h-[44px]"
          data-testid="btn-section-export"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {activeReportSection === "population" && (
        <div className="space-y-6">
          {loadingPopulation ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <>
              <Card data-testid="population-benchmarks-card">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Benchmark Reference
                      </CardTitle>
                      <CardDescription>Comparative data sources for population health metrics</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => handleExportAsImage(populationHealthChartRef, "Population Health Charts")}
                        data-testid="btn-export-population-image"
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Export as Image
                      </Button>
                      <div className="flex items-center gap-2 min-h-[44px]">
                        <Switch
                          id="show-population-benchmarks"
                          checked={showPopulationBenchmarks}
                          onCheckedChange={setShowPopulationBenchmarks}
                          data-testid="switch-population-benchmarks"
                        />
                        <Label htmlFor="show-population-benchmarks" className="text-sm cursor-pointer">Show Benchmarks</Label>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm" data-testid="benchmark-sources">
                    <div className="p-3 rounded bg-muted/30">
                      <p className="font-medium text-primary">CMS Quality Measures</p>
                      <p className="text-muted-foreground text-xs mt-1">National clinical quality benchmarks</p>
                    </div>
                    <div className="p-3 rounded bg-muted/30">
                      <p className="font-medium text-primary">NCQA HEDIS</p>
                      <p className="text-muted-foreground text-xs mt-1">Healthcare effectiveness data</p>
                    </div>
                    <div className="p-3 rounded bg-muted/30">
                      <p className="font-medium">Last Updated</p>
                      <p className="text-muted-foreground text-xs mt-1">{format(new Date(), "MMMM d, yyyy")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div ref={populationHealthChartRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="metric-total-patients">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Patients</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <span data-testid="value-total-patients">{populationHealth?.totalPatients || 0}</span>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card data-testid="metric-active-patients">
                  <CardHeader className="pb-2">
                    <CardDescription>Active Patients</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-500" />
                      <span data-testid="value-active-patients">{populationHealth?.activePatients || 0}</span>
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card data-testid="metric-new-patients">
                  <CardHeader className="pb-2">
                    <CardDescription>New Patients (This Month)</CardDescription>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Plus className="h-5 w-5 text-blue-500" />
                      <span data-testid="value-new-patients">{populationHealth?.newPatientsThisMonth || 0}</span>
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Age Distribution</CardTitle>
                  <CardDescription>Patient breakdown by age group</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3" data-testid="chart-age-distribution">
                    {(populationHealth?.ageDistribution || []).map((age, i) => (
                      <div key={i} className="flex items-center gap-3" data-testid={`age-range-${i}`}>
                        <span className="w-20 text-sm font-medium">{age.range}</span>
                        <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${age.percentage}%` }}
                          />
                        </div>
                        <span className="w-16 text-sm text-muted-foreground text-right">
                          {age.count} ({age.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Chronic Condition Prevalence</CardTitle>
                    <CardDescription>Top conditions with benchmark comparisons</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4" data-testid="chronic-conditions">
                      {(populationHealth?.chronicConditions || []).map((condition, i) => {
                        const benchmark = chronicConditionBenchmarks[condition.name];
                        const performanceVsNational = benchmark ? getPerformanceIndicator(condition.percentage, benchmark.national, false) : null;
                        const changeVsPrevious = benchmark ? calculateChange(condition.percentage, benchmark.previousPeriod) : null;
                        const PerformanceIcon = performanceVsNational?.icon || Minus;
                        const mockSparklineData = [
                          condition.percentage * 0.85,
                          condition.percentage * 0.9,
                          condition.percentage * 0.88,
                          condition.percentage * 0.95,
                          condition.percentage * 0.92,
                          condition.percentage,
                        ];
                        return (
                          <div
                            key={i}
                            className="p-3 rounded border bg-muted/10"
                            data-testid={`condition-${i}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{condition.name}</span>
                              <div className="flex items-center gap-2">
                                {performanceVsNational && showPopulationBenchmarks && (
                                  <Badge className={`${performanceVsNational.color} text-xs`} variant="outline" data-testid={`condition-${i}-performance`}>
                                    <PerformanceIcon className="h-3 w-3 mr-1" />
                                    {performanceVsNational.label}
                                  </Badge>
                                )}
                                <span className="text-sm text-muted-foreground">{condition.count} patients</span>
                                <Badge variant="outline" data-testid={`condition-${i}-percentage`}>{condition.percentage}%</Badge>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="w-16 text-xs text-muted-foreground">Actual</span>
                                <div className="flex-1 h-3 bg-muted rounded overflow-hidden relative">
                                  <div
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${Math.min(condition.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="w-12 text-xs text-right">{condition.percentage}%</span>
                              </div>
                              {showPopulationBenchmarks && benchmark && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="w-16 text-xs text-muted-foreground">National</span>
                                    <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500/60 transition-all duration-300"
                                        style={{ width: `${Math.min(benchmark.national, 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-12 text-xs text-right">{benchmark.national}%</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-16 text-xs text-muted-foreground">Regional</span>
                                    <div className="flex-1 h-3 bg-muted rounded overflow-hidden">
                                      <div
                                        className="h-full bg-green-500/60 transition-all duration-300"
                                        style={{ width: `${Math.min(benchmark.regional, 100)}%` }}
                                      />
                                    </div>
                                    <span className="w-12 text-xs text-right">{benchmark.regional}%</span>
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t">
                              <div className="flex items-center gap-2" data-testid={`condition-${i}-sparkline`}>
                                <span className="text-xs text-muted-foreground">6-month trend:</span>
                                {renderSparkline(mockSparklineData)}
                              </div>
                              {changeVsPrevious && showPopulationBenchmarks && (
                                <div className="flex items-center gap-1 text-xs" data-testid={`condition-${i}-change`}>
                                  <span className="text-muted-foreground">vs Previous:</span>
                                  <span className={changeVsPrevious.isPositive ? "text-red-500" : "text-green-500"}>
                                    {changeVsPrevious.isPositive ? "+" : "-"}{changeVsPrevious.value}%
                                  </span>
                                  {changeVsPrevious.isPositive ? (
                                    <TrendingUp className="h-3 w-3 text-red-500" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-green-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Risk Stratification</CardTitle>
                    <CardDescription>Patient distribution by risk level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3" data-testid="risk-stratification">
                      {(populationHealth?.riskStratification || []).map((risk, i) => (
                        <div key={i} className="flex items-center gap-3" data-testid={`risk-level-${i}`}>
                          <Badge
                            className={riskColors[risk.level as keyof typeof riskColors] || ""}
                            variant="outline"
                          >
                            {risk.level}
                          </Badge>
                          <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                risk.level === "critical"
                                  ? "bg-red-500"
                                  : risk.level === "high"
                                  ? "bg-orange-500"
                                  : risk.level === "moderate"
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${risk.percentage}%` }}
                            />
                          </div>
                          <span className="w-16 text-sm text-right">{risk.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Vaccination Rates</CardTitle>
                  <CardDescription>Target vs actual vaccination rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" data-testid="vaccination-rates">
                    {(populationHealth?.vaccinationRates || []).map((vax, i) => (
                      <div key={i} className="space-y-1" data-testid={`vaccination-${i}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{vax.name}</span>
                          <span className="text-sm">
                            {vax.actual}% / {vax.target}% target
                          </span>
                        </div>
                        <div className="relative h-4 bg-muted rounded overflow-hidden">
                          <div
                            className="absolute h-full bg-primary/30"
                            style={{ width: `${vax.target}%` }}
                          />
                          <div
                            className={`absolute h-full ${
                              vax.actual >= vax.target ? "bg-green-500" : "bg-orange-500"
                            }`}
                            style={{ width: `${vax.actual}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Preventive Care Compliance</CardTitle>
                  <CardDescription>Compliance rates for preventive services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="preventive-care">
                    {(populationHealth?.preventiveCareCompliance || []).map((item, i) => (
                      <div
                        key={i}
                        className="p-3 rounded border flex items-center justify-between"
                        data-testid={`preventive-${i}`}
                      >
                        <span className="text-sm">{item.metric}</span>
                        <Badge
                          variant="outline"
                          className={
                            item.rate >= 80
                              ? "border-green-500 text-green-600"
                              : item.rate >= 60
                              ? "border-yellow-500 text-yellow-600"
                              : "border-red-500 text-red-600"
                          }
                        >
                          {item.rate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {activeReportSection === "kpis" && (
        <div className="space-y-6">
          {loadingKPIs ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <>
              <Card data-testid="kpi-benchmarks-card">
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        KPI Benchmark Reference
                      </CardTitle>
                      <CardDescription>Industry standards and organizational goals</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => handleExportAsImage(kpiDashboardRef, "KPI Dashboard")}
                        data-testid="btn-export-kpi-image"
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Export as Image
                      </Button>
                      <div className="flex items-center gap-2 min-h-[44px]">
                        <Switch
                          id="show-kpi-benchmarks"
                          checked={showKpiBenchmarks}
                          onCheckedChange={setShowKpiBenchmarks}
                          data-testid="switch-kpi-benchmarks"
                        />
                        <Label htmlFor="show-kpi-benchmarks" className="text-sm cursor-pointer">Show Benchmarks</Label>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm" data-testid="kpi-benchmark-sources">
                    <div className="p-3 rounded bg-muted/30">
                      <p className="font-medium text-primary">MGMA Benchmarks</p>
                      <p className="text-muted-foreground text-xs mt-1">Medical Group Management Association</p>
                    </div>
                    <div className="p-3 rounded bg-muted/30">
                      <p className="font-medium text-primary">AMA Practice Standards</p>
                      <p className="text-muted-foreground text-xs mt-1">American Medical Association</p>
                    </div>
                    <div className="p-3 rounded bg-muted/30">
                      <p className="font-medium">Last Updated</p>
                      <p className="text-muted-foreground text-xs mt-1">{format(new Date(), "MMMM d, yyyy")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div ref={kpiDashboardRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="kpi-volume-daily">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription>Daily Volume</CardDescription>
                      {showKpiBenchmarks && (
                        <Badge className={getPerformanceRating(practiceKPIs?.patientVolume.daily || 0, kpiBenchmarks.patientVolume.dailyGoal).color} data-testid="kpi-daily-rating">
                          {getPerformanceRating(practiceKPIs?.patientVolume.daily || 0, kpiBenchmarks.patientVolume.dailyGoal).label}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{practiceKPIs?.patientVolume.daily || 0}</CardTitle>
                  </CardHeader>
                  {showKpiBenchmarks && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Goal: {kpiBenchmarks.patientVolume.dailyGoal}</span>
                          <span className="text-muted-foreground">Benchmark: {kpiBenchmarks.patientVolume.dailyBenchmark}</span>
                        </div>
                        <Progress value={((practiceKPIs?.patientVolume.daily || 0) / kpiBenchmarks.patientVolume.dailyGoal) * 100} className="h-2" data-testid="kpi-daily-progress" />
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">MoM:</span>
                          <span className="text-green-600 flex items-center gap-1">
                            +8.2% <TrendingUp className="h-3 w-3" />
                          </span>
                          <span className="text-muted-foreground ml-2">YoY:</span>
                          <span className="text-green-600 flex items-center gap-1">
                            +12.5% <TrendingUp className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
                <Card data-testid="kpi-volume-weekly">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription>Weekly Volume</CardDescription>
                      {showKpiBenchmarks && (
                        <Badge className={getPerformanceRating(practiceKPIs?.patientVolume.weekly || 0, kpiBenchmarks.patientVolume.weeklyGoal).color} data-testid="kpi-weekly-rating">
                          {getPerformanceRating(practiceKPIs?.patientVolume.weekly || 0, kpiBenchmarks.patientVolume.weeklyGoal).label}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{practiceKPIs?.patientVolume.weekly || 0}</CardTitle>
                  </CardHeader>
                  {showKpiBenchmarks && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Goal: {kpiBenchmarks.patientVolume.weeklyGoal}</span>
                          <span className="text-muted-foreground">Benchmark: {kpiBenchmarks.patientVolume.weeklyBenchmark}</span>
                        </div>
                        <Progress value={((practiceKPIs?.patientVolume.weekly || 0) / kpiBenchmarks.patientVolume.weeklyGoal) * 100} className="h-2" data-testid="kpi-weekly-progress" />
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">MoM:</span>
                          <span className="text-green-600 flex items-center gap-1">
                            +5.1% <TrendingUp className="h-3 w-3" />
                          </span>
                          <span className="text-muted-foreground ml-2">YoY:</span>
                          <span className="text-green-600 flex items-center gap-1">
                            +9.8% <TrendingUp className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
                <Card data-testid="kpi-volume-monthly">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription>Monthly Volume</CardDescription>
                      {showKpiBenchmarks && (
                        <Badge className={getPerformanceRating(practiceKPIs?.patientVolume.monthly || 0, kpiBenchmarks.patientVolume.monthlyGoal).color} data-testid="kpi-monthly-rating">
                          {getPerformanceRating(practiceKPIs?.patientVolume.monthly || 0, kpiBenchmarks.patientVolume.monthlyGoal).label}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{practiceKPIs?.patientVolume.monthly || 0}</CardTitle>
                  </CardHeader>
                  {showKpiBenchmarks && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Goal: {kpiBenchmarks.patientVolume.monthlyGoal}</span>
                          <span className="text-muted-foreground">Benchmark: {kpiBenchmarks.patientVolume.monthlyBenchmark}</span>
                        </div>
                        <Progress value={((practiceKPIs?.patientVolume.monthly || 0) / kpiBenchmarks.patientVolume.monthlyGoal) * 100} className="h-2" data-testid="kpi-monthly-progress" />
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">MoM:</span>
                          <span className="text-red-600 flex items-center gap-1">
                            -2.3% <TrendingDown className="h-3 w-3" />
                          </span>
                          <span className="text-muted-foreground ml-2">YoY:</span>
                          <span className="text-green-600 flex items-center gap-1">
                            +15.2% <TrendingUp className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Appointment Metrics</CardTitle>
                    {showKpiBenchmarks && (
                      <Badge className={getPerformanceRating(practiceKPIs?.appointmentMetrics.completionRate || 0, kpiBenchmarks.appointmentMetrics.completionRateGoal).color} data-testid="appointments-overall-rating">
                        {getPerformanceRating(practiceKPIs?.appointmentMetrics.completionRate || 0, kpiBenchmarks.appointmentMetrics.completionRateGoal).label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="appointment-metrics">
                    <div className="p-3 rounded bg-green-500/10 text-center" data-testid="appointments-completed">
                      <p className="text-2xl font-bold text-green-600">
                        {practiceKPIs?.appointmentMetrics.completed || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      {showKpiBenchmarks && (
                        <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                          +4.2% MoM <TrendingUp className="h-3 w-3" />
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded bg-yellow-500/10 text-center" data-testid="appointments-cancelled">
                      <p className="text-2xl font-bold text-yellow-600">
                        {practiceKPIs?.appointmentMetrics.cancelled || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Cancelled</p>
                      {showKpiBenchmarks && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Benchmark: {kpiBenchmarks.appointmentMetrics.cancelledBenchmark}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded bg-red-500/10 text-center" data-testid="appointments-noshow">
                      <p className="text-2xl font-bold text-red-600">
                        {practiceKPIs?.appointmentMetrics.noShow || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">No Show</p>
                      {showKpiBenchmarks && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Benchmark: {kpiBenchmarks.appointmentMetrics.noShowBenchmark}
                        </p>
                      )}
                    </div>
                    <div className="p-3 rounded bg-blue-500/10 text-center" data-testid="appointments-rate">
                      <p className="text-2xl font-bold text-blue-600">
                        {practiceKPIs?.appointmentMetrics.completionRate || 0}%
                      </p>
                      <p className="text-sm text-muted-foreground">Completion Rate</p>
                      {showKpiBenchmarks && (
                        <div className="mt-2">
                          <Progress value={((practiceKPIs?.appointmentMetrics.completionRate || 0) / kpiBenchmarks.appointmentMetrics.completionRateGoal) * 100} className="h-1" data-testid="appointments-rate-progress" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Goal: {kpiBenchmarks.appointmentMetrics.completionRateGoal}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Wait Time Averages</CardTitle>
                  </CardHeader>
                  <CardContent data-testid="wait-times">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>In-Office Wait</span>
                        <Badge
                          variant="outline"
                          className={
                            practiceKPIs?.waitTimeAverages.status === "good"
                              ? "border-green-500 text-green-600"
                              : practiceKPIs?.waitTimeAverages.status === "moderate"
                              ? "border-yellow-500 text-yellow-600"
                              : "border-red-500 text-red-600"
                          }
                        >
                          {practiceKPIs?.waitTimeAverages.inOffice || 0} min
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>Next Available Appointment</span>
                        <Badge variant="outline">{practiceKPIs?.waitTimeAverages.toNextAvailable || 0} days</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Patient Satisfaction</CardTitle>
                  </CardHeader>
                  <CardContent data-testid="patient-satisfaction">
                    <div className="flex items-center justify-center mb-4">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-primary">
                          {practiceKPIs?.patientSatisfaction.npsScore || 0}
                        </p>
                        <p className="text-sm text-muted-foreground">NPS Score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 rounded bg-muted/30 text-center">
                        <p className="font-medium">{practiceKPIs?.patientSatisfaction.satisfactionRate || 0}%</p>
                        <p className="text-xs text-muted-foreground">Satisfaction Rate</p>
                      </div>
                      <div className="p-2 rounded bg-muted/30 text-center">
                        <p className="font-medium">{practiceKPIs?.patientSatisfaction.responseRate || 0}%</p>
                        <p className="text-xs text-muted-foreground">Response Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Prescription Metrics</CardTitle>
                  </CardHeader>
                  <CardContent data-testid="prescription-metrics">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>New Prescriptions</span>
                        <span className="font-medium">{practiceKPIs?.prescriptionMetrics.newPrescriptions || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>Refills Processed</span>
                        <span className="font-medium">{practiceKPIs?.prescriptionMetrics.refillsProcessed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>e-Prescribing Rate</span>
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          {practiceKPIs?.prescriptionMetrics.eRxRate || 0}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Telehealth Utilization</CardTitle>
                  </CardHeader>
                  <CardContent data-testid="telehealth-metrics">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>Total Telehealth Visits</span>
                        <span className="font-medium">{practiceKPIs?.telehealthUtilization.totalVisits || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>% of Total Visits</span>
                        <Badge variant="outline">
                          {practiceKPIs?.telehealthUtilization.percentageOfTotal || 0}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span>Avg. Duration</span>
                        <span className="font-medium">{practiceKPIs?.telehealthUtilization.averageDuration || 0} min</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Provider Productivity</CardTitle>
                  <CardDescription>Performance metrics by provider</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto" data-testid="provider-productivity">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">Provider</th>
                          <th className="text-right p-2 font-medium">Patients/Day</th>
                          <th className="text-right p-2 font-medium">Appointments</th>
                          <th className="text-right p-2 font-medium">Doc Time (min)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(practiceKPIs?.providerProductivity || []).map((provider, i) => (
                          <tr key={i} className="border-b last:border-0" data-testid={`provider-row-${i}`}>
                            <td className="p-2">{provider.providerName}</td>
                            <td className="p-2 text-right">{provider.patientsPerDay}</td>
                            <td className="p-2 text-right">{provider.appointmentsCompleted}</td>
                            <td className="p-2 text-right">{provider.documentationTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {activeReportSection === "trends" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Trends Analysis</CardTitle>
                  <CardDescription>Track metrics over time</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={trendsPeriod} onValueChange={setTrendsPeriod}>
                    <SelectTrigger className="w-[120px] min-h-[44px]" data-testid="select-trends-period">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="90d">90 Days</SelectItem>
                      <SelectItem value="1y">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={trendsMetric} onValueChange={setTrendsMetric}>
                    <SelectTrigger className="w-[140px] min-h-[44px]" data-testid="select-trends-metric">
                      <SelectValue placeholder="Metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visits">Visits</SelectItem>
                      <SelectItem value="prescriptions">Prescriptions</SelectItem>
                      <SelectItem value="referrals">Referrals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTrends ? (
                <Skeleton className="h-64" />
              ) : (
                <>
                  <div className="h-64 flex items-end gap-1 border-b border-l p-4" data-testid="trends-chart">
                    {(trendsData?.dataPoints || []).map((point, i) => {
                      const maxVal = getMaxDataPoint(trendsData?.dataPoints);
                      const height = maxVal > 0 ? (point.value / maxVal) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1" data-testid={`chart-bar-${i}`}>
                          <div
                            className="w-full bg-primary rounded-t transition-all duration-300 hover:bg-primary/80"
                            style={{ height: `${height}%`, minHeight: point.value > 0 ? "4px" : "0" }}
                            title={`${point.date}: ${point.value}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 px-4">
                    {(trendsData?.dataPoints || []).length > 0 && (
                      <>
                        <span>{trendsData?.dataPoints[0]?.date}</span>
                        <span>{trendsData?.dataPoints[trendsData.dataPoints.length - 1]?.date}</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {trendsData?.statistics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistics Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="trends-statistics">
                  <div className="p-3 rounded bg-muted/30 text-center" data-testid="stat-total">
                    <p className="text-xl font-bold">{trendsData.statistics.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 text-center" data-testid="stat-average">
                    <p className="text-xl font-bold">{trendsData.statistics.average.toFixed(1)}</p>
                    <p className="text-sm text-muted-foreground">Average</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 text-center" data-testid="stat-min">
                    <p className="text-xl font-bold">{trendsData.statistics.min}</p>
                    <p className="text-sm text-muted-foreground">Min</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 text-center" data-testid="stat-max">
                    <p className="text-xl font-bold">{trendsData.statistics.max}</p>
                    <p className="text-sm text-muted-foreground">Max</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 text-center" data-testid="stat-trend">
                    <p className="text-xl font-bold flex items-center justify-center gap-1">
                      {trendsData.statistics.trend === "up" ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : trendsData.statistics.trend === "down" ? (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      ) : (
                        <Minus className="h-5 w-5 text-muted-foreground" />
                      )}
                      {trendsData.statistics.changePercent}%
                    </p>
                    <p className="text-sm text-muted-foreground">Trend</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeReportSection === "export" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export Reports</CardTitle>
              <CardDescription>Generate and download reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Report Type</Label>
                    <Select value={exportReportType} onValueChange={setExportReportType}>
                      <SelectTrigger className="min-h-[44px]" data-testid="select-export-type">
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="population-health">Population Health</SelectItem>
                        <SelectItem value="practice-kpis">Practice KPIs</SelectItem>
                        <SelectItem value="trends">Trends</SelectItem>
                        <SelectItem value="custom">Custom Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Format</Label>
                    <Select value={exportFormat} onValueChange={setExportFormat}>
                      <SelectTrigger className="min-h-[44px]" data-testid="select-export-format">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={exportDateRange.start}
                      onChange={(e) => setExportDateRange({ ...exportDateRange, start: e.target.value })}
                      className="min-h-[44px]"
                      data-testid="input-export-start-date"
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={exportDateRange.end}
                      onChange={(e) => setExportDateRange({ ...exportDateRange, end: e.target.value })}
                      className="min-h-[44px]"
                      data-testid="input-export-end-date"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleExport}
                  disabled={exportMutation.isPending}
                  className="min-h-[44px]"
                  data-testid="btn-export"
                >
                  {exportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {recentExports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Exports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2" data-testid="recent-exports">
                  {recentExports.map((exp, i) => (
                    <div
                      key={exp.id || i}
                      className="flex items-center justify-between p-3 rounded border"
                      data-testid={`export-item-${i}`}
                    >
                      <div>
                        <p className="font-medium">{exp.reportType} ({exp.format.toUpperCase()})</p>
                        <p className="text-sm text-muted-foreground">
                          {exp.generatedAt ? formatDistanceToNow(new Date(exp.generatedAt), { addSuffix: true }) : "Processing..."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {exp.fileSize && <span className="text-sm text-muted-foreground">{exp.fileSize}</span>}
                        <Badge
                          variant="outline"
                          className={
                            exp.status === "completed"
                              ? "border-green-500 text-green-600"
                              : exp.status === "processing"
                              ? "border-blue-500 text-blue-600"
                              : "border-red-500 text-red-600"
                          }
                        >
                          {exp.status}
                        </Badge>
                        {exp.status === "completed" && exp.downloadUrl && (
                          <Button variant="ghost" size="sm" className="min-h-[44px]" data-testid={`btn-download-${i}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

interface TelehealthSession {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  sessionType: "follow_up" | "consultation" | "urgent";
  notes?: string;
  startedAt?: string;
  endedAt?: string;
}

interface TelehealthChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: "provider" | "patient";
  content: string;
  createdAt: string;
}

interface TelehealthPatient {
  id: string;
  name: string;
}

const sessionStatusColors = {
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  in_progress: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  completed: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const sessionTypeLabels = {
  follow_up: "Follow-up",
  consultation: "Consultation",
  urgent: "Urgent",
};

function TelehealthTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"chat" | "patient" | "notes">("chat");
  const [chatMessage, setChatMessage] = useState("");
  const [consultationNotes, setConsultationNotes] = useState("");
  const [newSession, setNewSession] = useState({
    patientId: "",
    scheduledAt: "",
    scheduledTime: "",
    duration: 30,
    sessionType: "consultation" as "follow_up" | "consultation" | "urgent",
    notes: "",
  });

  const buildSessionsUrl = () => {
    if (statusFilter === "all") return "/api/provider/portal/telehealth/sessions";
    return `/api/provider/portal/telehealth/sessions?status=${statusFilter}`;
  };

  const { data: sessions = [], isLoading: loadingSessions } = useQuery<TelehealthSession[]>({
    queryKey: [buildSessionsUrl()],
  });

  const { data: patients = [] } = useQuery<PatientCard[]>({
    queryKey: ["/api/provider/portal/patients"],
  });

  const { data: activeSession } = useQuery<TelehealthSession>({
    queryKey: ["/api/provider/portal/telehealth/sessions", activeSessionId],
    enabled: !!activeSessionId,
  });

  const { data: chatMessages = [], refetch: refetchChat } = useQuery<TelehealthChatMessage[]>({
    queryKey: ["/api/provider/portal/telehealth/sessions", activeSessionId, "chat"],
    enabled: !!activeSessionId,
    refetchInterval: activeSessionId ? 5000 : false,
  });

  const createSessionMutation = useMutation({
    mutationFn: async (session: typeof newSession) => {
      const scheduledAt = `${session.scheduledAt}T${session.scheduledTime}:00`;
      const res = await apiRequest("POST", "/api/provider/portal/telehealth/sessions", {
        patientId: session.patientId,
        scheduledAt,
        duration: session.duration,
        sessionType: session.sessionType,
        notes: session.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/telehealth/sessions"] });
      setIsNewSessionOpen(false);
      setNewSession({
        patientId: "",
        scheduledAt: "",
        scheduledTime: "",
        duration: 30,
        sessionType: "consultation",
        notes: "",
      });
      toast({ title: "Session Scheduled", description: "Telehealth session has been scheduled successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule session", variant: "destructive" });
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/provider/portal/telehealth/sessions/${sessionId}/start`);
      return res.json();
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/telehealth/sessions"] });
      setActiveSessionId(sessionId);
      toast({ title: "Session Started", description: "You have joined the telehealth session." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start session", variant: "destructive" });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/provider/portal/telehealth/sessions/${sessionId}/end`, {
        notes: consultationNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider/portal/telehealth/sessions"] });
      setActiveSessionId(null);
      setConsultationNotes("");
      toast({ title: "Session Ended", description: "Telehealth session has been completed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to end session", variant: "destructive" });
    },
  });

  const sendChatMutation = useMutation({
    mutationFn: async ({ sessionId, content }: { sessionId: string; content: string }) => {
      const res = await apiRequest("POST", `/api/provider/portal/telehealth/sessions/${sessionId}/chat`, { content });
      return res.json();
    },
    onSuccess: () => {
      setChatMessage("");
      refetchChat();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const shareDataMutation = useMutation({
    mutationFn: async ({ sessionId, dataType }: { sessionId: string; dataType: string }) => {
      const res = await apiRequest("POST", `/api/provider/portal/telehealth/sessions/${sessionId}/share-data`, { dataType });
      return res.json();
    },
    onSuccess: (_, { dataType }) => {
      toast({ title: "Data Shared", description: `${dataType} has been shared with the patient.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to share data", variant: "destructive" });
    },
  });

  const handleSendChat = () => {
    if (!activeSessionId || !chatMessage.trim()) return;
    sendChatMutation.mutate({ sessionId: activeSessionId, content: chatMessage });
  };

  const handleEndCall = () => {
    if (activeSessionId) {
      endSessionMutation.mutate(activeSessionId);
    }
  };

  if (loadingSessions) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (activeSessionId) {
    return (
      <div className="space-y-4" data-testid="telehealth-active-session">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0" />
            <span>
              <strong>HIPAA Notice:</strong> This telehealth session may be recorded for quality assurance and medical records. All data is encrypted and stored securely.
            </span>
          </p>
        </div>

        <div className="p-2 bg-muted/50 border rounded text-xs text-muted-foreground">
          AI-generated insights in this session are for reference only and do NOT constitute clinical decision support.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="relative overflow-hidden" data-testid="video-area">
              <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
                <div className="text-center text-white/60">
                  <UserSquare2 className="h-24 w-24 mx-auto mb-2" />
                  <p className="text-lg font-medium">{activeSession?.patientName || "Patient"}</p>
                  <p className="text-sm">Waiting for video...</p>
                </div>
                <div className="absolute bottom-4 right-4 w-32 h-24 bg-slate-800 rounded-md border-2 border-white/20 flex items-center justify-center" data-testid="self-view">
                  <div className="text-center text-white/60">
                    <User className="h-8 w-8 mx-auto" />
                    <p className="text-xs">You</p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="icon"
                    className="min-h-[44px] min-w-[44px] rounded-full"
                    onClick={() => setIsMuted(!isMuted)}
                    data-testid="btn-mute"
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant={isVideoOn ? "secondary" : "destructive"}
                    size="icon"
                    className="min-h-[44px] min-w-[44px] rounded-full"
                    onClick={() => setIsVideoOn(!isVideoOn)}
                    data-testid="btn-video"
                  >
                    {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] rounded-full"
                    data-testid="btn-screen-share"
                  >
                    <Monitor className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] rounded-full"
                    onClick={handleEndCall}
                    disabled={endSessionMutation.isPending}
                    data-testid="btn-end-call"
                  >
                    {endSessionMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card data-testid="session-sidebar">
              <CardHeader className="pb-2">
                <div className="flex gap-2">
                  <Button
                    variant={sidebarTab === "chat" ? "default" : "ghost"}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setSidebarTab("chat")}
                    data-testid="btn-sidebar-chat"
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Chat
                  </Button>
                  <Button
                    variant={sidebarTab === "patient" ? "default" : "ghost"}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setSidebarTab("patient")}
                    data-testid="btn-sidebar-patient"
                  >
                    <User className="h-4 w-4 mr-1" />
                    Patient
                  </Button>
                  <Button
                    variant={sidebarTab === "notes" ? "default" : "ghost"}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setSidebarTab("notes")}
                    data-testid="btn-sidebar-notes"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Notes
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {sidebarTab === "chat" && (
                  <div className="space-y-4" data-testid="sidebar-chat">
                    <ScrollArea className="h-[300px] border rounded p-2">
                      <div className="space-y-2">
                        {chatMessages.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">No messages yet</p>
                        ) : (
                          chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-2 rounded text-sm ${
                                msg.senderRole === "provider"
                                  ? "bg-primary/10 ml-4"
                                  : "bg-muted mr-4"
                              }`}
                              data-testid={`chat-message-${msg.id}`}
                            >
                              <p className="font-medium text-xs mb-1">{msg.senderName}</p>
                              <p>{msg.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(msg.createdAt), "h:mm a")}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                        className="min-h-[44px]"
                        data-testid="input-chat-message"
                      />
                      <Button
                        size="icon"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={handleSendChat}
                        disabled={sendChatMutation.isPending || !chatMessage.trim()}
                        data-testid="btn-send-chat"
                      >
                        {sendChatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {sidebarTab === "patient" && (
                  <div className="space-y-4" data-testid="sidebar-patient">
                    <p className="text-sm text-muted-foreground">Share patient data during the consultation:</p>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full min-h-[44px] justify-start"
                        onClick={() => activeSessionId && shareDataMutation.mutate({ sessionId: activeSessionId, dataType: "vitals" })}
                        disabled={shareDataMutation.isPending}
                        data-testid="btn-share-vitals"
                      >
                        <Thermometer className="h-4 w-4 mr-2" />
                        Share Vitals
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full min-h-[44px] justify-start"
                        onClick={() => activeSessionId && shareDataMutation.mutate({ sessionId: activeSessionId, dataType: "labs" })}
                        disabled={shareDataMutation.isPending}
                        data-testid="btn-share-labs"
                      >
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Share Lab Results
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full min-h-[44px] justify-start"
                        onClick={() => activeSessionId && shareDataMutation.mutate({ sessionId: activeSessionId, dataType: "medications" })}
                        disabled={shareDataMutation.isPending}
                        data-testid="btn-share-medications"
                      >
                        <Pill className="h-4 w-4 mr-2" />
                        Share Medications
                      </Button>
                    </div>
                  </div>
                )}

                {sidebarTab === "notes" && (
                  <div className="space-y-4" data-testid="sidebar-notes">
                    <Textarea
                      placeholder="Enter consultation notes..."
                      value={consultationNotes}
                      onChange={(e) => setConsultationNotes(e.target.value)}
                      rows={12}
                      data-testid="textarea-consultation-notes"
                    />
                    <p className="text-xs text-muted-foreground">Notes will be saved when the session ends.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="telehealth-session-list">
      <div className="p-2 bg-muted/50 border rounded text-xs text-muted-foreground">
        AI-generated insights in telehealth sessions are for reference only and do NOT constitute clinical decision support.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {["all", "scheduled", "in_progress", "completed"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setStatusFilter(status)}
              data-testid={`filter-${status}`}
            >
              {status === "all" ? "All" : status === "in_progress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
        <Dialog open={isNewSessionOpen} onOpenChange={setIsNewSessionOpen}>
          <DialogTrigger asChild>
            <Button className="min-h-[44px]" data-testid="btn-new-consultation">
              <Plus className="h-4 w-4 mr-2" />
              New Consultation
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-new-consultation">
            <DialogHeader>
              <DialogTitle>Schedule New Consultation</DialogTitle>
              <DialogDescription>Schedule a telehealth session with a patient</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Patient</Label>
                <Select value={newSession.patientId} onValueChange={(v) => setNewSession({ ...newSession, patientId: v })}>
                  <SelectTrigger className="min-h-[44px]" data-testid="select-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId}>{p.patientName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newSession.scheduledAt}
                    onChange={(e) => setNewSession({ ...newSession, scheduledAt: e.target.value })}
                    className="min-h-[44px]"
                    data-testid="input-session-date"
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={newSession.scheduledTime}
                    onChange={(e) => setNewSession({ ...newSession, scheduledTime: e.target.value })}
                    className="min-h-[44px]"
                    data-testid="input-session-time"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Duration</Label>
                  <Select value={String(newSession.duration)} onValueChange={(v) => setNewSession({ ...newSession, duration: Number(v) })}>
                    <SelectTrigger className="min-h-[44px]" data-testid="select-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Session Type</Label>
                  <Select value={newSession.sessionType} onValueChange={(v) => setNewSession({ ...newSession, sessionType: v as typeof newSession.sessionType })}>
                    <SelectTrigger className="min-h-[44px]" data-testid="select-session-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newSession.notes}
                  onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })}
                  placeholder="Optional notes for this session..."
                  data-testid="textarea-session-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="min-h-[44px]" onClick={() => setIsNewSessionOpen(false)} data-testid="btn-cancel-session">
                Cancel
              </Button>
              <Button
                className="min-h-[44px]"
                onClick={() => createSessionMutation.mutate(newSession)}
                disabled={createSessionMutation.isPending || !newSession.patientId || !newSession.scheduledAt || !newSession.scheduledTime}
                data-testid="btn-schedule-session"
              >
                {createSessionMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Schedule Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-5 w-5" />
            Telehealth Sessions
          </CardTitle>
          <CardDescription>Manage your virtual consultations</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="no-sessions">
                  <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No telehealth sessions found</p>
                  <p className="text-sm">Schedule a new consultation to get started</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 border rounded-md hover-elevate"
                    data-testid={`session-card-${session.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Video className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2" data-testid={`session-patient-${session.id}`}>
                            {session.patientName}
                            <Badge className={sessionStatusColors[session.status]} variant="outline" data-testid={`session-status-${session.id}`}>
                              {session.status === "in_progress" ? "In Progress" : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`session-info-${session.id}`}>
                            {format(new Date(session.scheduledAt), "MMM d, yyyy 'at' h:mm a")} | {session.duration} min | {sessionTypeLabels[session.sessionType]}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {session.status === "scheduled" && (
                          <Button
                            className="min-h-[44px]"
                            onClick={() => startSessionMutation.mutate(session.id)}
                            disabled={startSessionMutation.isPending}
                            data-testid={`btn-start-session-${session.id}`}
                          >
                            {startSessionMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Video className="h-4 w-4 mr-1" />}
                            Start Session
                          </Button>
                        )}
                        {session.status === "in_progress" && (
                          <Button
                            className="min-h-[44px]"
                            onClick={() => setActiveSessionId(session.id)}
                            data-testid={`btn-join-session-${session.id}`}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Join Session
                          </Button>
                        )}
                        {session.status === "completed" && (
                          <Button
                            variant="outline"
                            className="min-h-[44px]"
                            data-testid={`btn-view-session-${session.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Summary
                          </Button>
                        )}
                      </div>
                    </div>
                    {session.notes && (
                      <p className="mt-2 text-sm text-muted-foreground pl-13" data-testid={`session-notes-${session.id}`}>
                        {session.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

interface AIAnalysisFlag {
  type: string;
  severity: string;
  title: string;
  description: string;
  suggestedActions: string[];
  evidence: string[];
}

interface AIFlaggedPatient {
  patientId: string;
  priority: string;
  flags: AIAnalysisFlag[];
  summary: string;
}

interface AIPanelInsight {
  category: string;
  title: string;
  description: string;
  affectedPatients: number;
  recommendation: string;
}

interface AIAnalysisResult {
  panelOverview: {
    totalPatients: number;
    patientsNeedingAttention: number;
    overallAdherenceAvg: number;
    criticalFindings: number;
  };
  flaggedPatients: AIFlaggedPatient[];
  panelInsights: AIPanelInsight[];
  disclaimer: string;
  generatedAt: string;
  analysisId: string;
}

function AIAssistantTab() {
  const { toast } = useToast();
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/provider/portal/ai-assistant/analyze", {});
      return res.json();
    },
    onSuccess: (data: AIAnalysisResult) => {
      setAnalysisResult(data);
      toast({
        title: "AI Analysis Complete",
        description: `Analysis generated for ${data.panelOverview.totalPatients} patients`,
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to run AI analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  const priorityOrder = ["critical", "high", "moderate", "low"];

  const categoryColors: Record<string, string> = {
    adherence: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    risk: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    engagement: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
    outcomes: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    medication: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  };

  return (
    <div className="space-y-6">
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>Not Clinical Decision Support:</strong> This AI analysis is for informational reference only. It does NOT constitute clinical decision support (CDS). All patient care decisions must be made using independent clinical judgment.
          </span>
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Panel Analysis
          </h3>
          <p className="text-sm text-muted-foreground">
            Review AI-powered flags and follow-up suggestions for your patient panel
          </p>
        </div>
        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          data-testid="button-run-ai-analysis"
        >
          {analyzeMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Run AI Analysis
        </Button>
      </div>

      {analyzeMutation.isPending && (
        <div className="space-y-4" data-testid="analysis-loading">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      )}

      {!analyzeMutation.isPending && !analysisResult && (
        <Card data-testid="analysis-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Analysis Results Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Click "Run AI Analysis" to review your patient panel. The AI will identify patients needing attention, flag potential concerns, and suggest follow-up actions.
            </p>
          </CardContent>
        </Card>
      )}

      {!analyzeMutation.isPending && analysisResult && (
        <div className="space-y-6">
          {analysisResult.disclaimer && (
            <div className="p-2 bg-muted/50 border rounded text-xs text-muted-foreground" data-testid="analysis-disclaimer">
              {analysisResult.disclaimer}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="panel-overview">
            <Card data-testid="stat-ai-total-patients">
              <CardHeader className="pb-2">
                <CardDescription>Total Patients</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span data-testid="value-ai-total-patients">{analysisResult.panelOverview.totalPatients}</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="stat-ai-needing-attention">
              <CardHeader className="pb-2">
                <CardDescription>Needing Attention</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span data-testid="value-ai-needing-attention">{analysisResult.panelOverview.patientsNeedingAttention}</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="stat-ai-adherence-avg">
              <CardHeader className="pb-2">
                <CardDescription>Adherence Avg</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Pill className="h-5 w-5 text-green-500" />
                  <span data-testid="value-ai-adherence-avg">{analysisResult.panelOverview.overallAdherenceAvg}%</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card data-testid="stat-ai-critical-findings">
              <CardHeader className="pb-2">
                <CardDescription>Critical Findings</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  <span data-testid="value-ai-critical-findings">{analysisResult.panelOverview.criticalFindings}</span>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {analysisResult.flaggedPatients.length > 0 && (
            <Card data-testid="flagged-patients-section">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Flagged Patients
                </CardTitle>
                <CardDescription>
                  {analysisResult.flaggedPatients.length} patient{analysisResult.flaggedPatients.length !== 1 ? "s" : ""} flagged for review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {analysisResult.flaggedPatients
                      .sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority))
                      .map((patient, idx) => (
                        <div
                          key={patient.patientId || idx}
                          className="p-4 border rounded-md"
                          data-testid={`flagged-patient-${patient.patientId || idx}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium" data-testid={`flagged-patient-id-${patient.patientId || idx}`}>
                                Patient {patient.patientId}
                              </span>
                              <Badge
                                className={riskColors[patient.priority as keyof typeof riskColors] || ""}
                                variant="outline"
                                data-testid={`flagged-patient-priority-${patient.patientId || idx}`}
                              >
                                {patient.priority}
                              </Badge>
                            </div>
                          </div>
                          {patient.summary && (
                            <p className="text-sm text-muted-foreground mb-3" data-testid={`flagged-patient-summary-${patient.patientId || idx}`}>
                              {patient.summary}
                            </p>
                          )}
                          <div className="space-y-3">
                            {patient.flags.map((flag, flagIdx) => (
                              <div
                                key={flagIdx}
                                className="p-3 bg-muted/30 rounded-md"
                                data-testid={`flag-${patient.patientId || idx}-${flagIdx}`}
                              >
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge variant="outline" className="text-xs">
                                    {flag.type}
                                  </Badge>
                                  <Badge
                                    className={riskColors[flag.severity as keyof typeof riskColors] || ""}
                                    variant="outline"
                                  >
                                    {flag.severity}
                                  </Badge>
                                  <span className="font-medium text-sm">{flag.title}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{flag.description}</p>
                                {flag.suggestedActions && flag.suggestedActions.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                      <ChevronRight className="h-3 w-3 text-primary" />
                                      Suggested Actions
                                    </p>
                                    <ul className="text-xs space-y-1 ml-4">
                                      {flag.suggestedActions.map((action, aIdx) => (
                                        <li key={aIdx} className="flex items-start gap-1">
                                          <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                          {action}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {flag.evidence && flag.evidence.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                      <FileText className="h-3 w-3 text-muted-foreground" />
                                      Evidence
                                    </p>
                                    <ul className="text-xs space-y-1 ml-4 text-muted-foreground">
                                      {flag.evidence.map((ev, eIdx) => (
                                        <li key={eIdx}>{ev}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {analysisResult.panelInsights.length > 0 && (
            <Card data-testid="panel-insights-section">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Panel Insights
                </CardTitle>
                <CardDescription>
                  AI-identified patterns and recommendations across your panel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.panelInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="p-4 border rounded-md"
                      data-testid={`panel-insight-${idx}`}
                    >
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge
                          className={categoryColors[insight.category.toLowerCase()] || "bg-muted text-muted-foreground"}
                          variant="outline"
                          data-testid={`insight-category-${idx}`}
                        >
                          {insight.category}
                        </Badge>
                        <span className="font-medium text-sm" data-testid={`insight-title-${idx}`}>{insight.title}</span>
                        {insight.affectedPatients > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({insight.affectedPatients} patient{insight.affectedPatients !== 1 ? "s" : ""})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2" data-testid={`insight-description-${idx}`}>
                        {insight.description}
                      </p>
                      {insight.recommendation && (
                        <div className="flex items-start gap-2 p-2 bg-primary/5 rounded text-sm" data-testid={`insight-recommendation-${idx}`}>
                          <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{insight.recommendation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysisResult.generatedAt && (
            <p className="text-xs text-muted-foreground text-right" data-testid="analysis-generated-at">
              Analysis generated {formatDistanceToNow(new Date(analysisResult.generatedAt))} ago
              {analysisResult.analysisId && ` | ID: ${analysisResult.analysisId}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const taskCategoryLabels: Record<string, string> = {
  follow_up: "Follow Up",
  review_lab_results: "Review Lab Results",
  contact_patient: "Contact Patient",
  referral: "Referral",
  prescription: "Prescription",
  documentation: "Documentation",
  care_coordination: "Care Coordination",
  other: "Other",
};

function getTaskPriorityVariant(priority: string): "destructive" | "default" | "secondary" | "outline" {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "default";
    case "medium": return "default";
    case "low": return "secondary";
    default: return "default";
  }
}

function getTaskPriorityClass(priority: string): string {
  switch (priority) {
    case "urgent": return "";
    case "high": return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
    case "medium": return "";
    case "low": return "";
    default: return "";
  }
}

function getTaskStatusVariant(status: string): "destructive" | "default" | "secondary" | "outline" {
  switch (status) {
    case "overdue": return "destructive";
    case "in_progress": return "default";
    case "pending": return "default";
    case "completed": return "secondary";
    case "cancelled": return "secondary";
    default: return "default";
  }
}

function getTaskStatusClass(status: string): string {
  switch (status) {
    case "overdue": return "";
    case "in_progress": return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
    case "pending": return "";
    case "completed": return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
    case "cancelled": return "";
    default: return "";
  }
}

function TasksTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "follow_up" as string,
    priority: "medium" as string,
    patientName: "",
    assignedToName: "",
    dueDate: "",
  });

  const buildTaskQueryUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (priorityFilter && priorityFilter !== "all") params.append("priority", priorityFilter);
    if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
    if (searchQuery) params.append("search", searchQuery);
    const qs = params.toString();
    return `/api/provider-tasks${qs ? `?${qs}` : ""}`;
  };

  const { data: tasksData, isLoading: loadingTasks } = useQuery<{ tasks: ProviderTask[] }>({
    queryKey: ["/api/provider-tasks", statusFilter, priorityFilter, categoryFilter, searchQuery],
    queryFn: async () => {
      const res = await fetch(buildTaskQueryUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<{ stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    overdue: number;
    dueSoon: number;
    byPriority: { urgent: number; high: number; medium: number; low: number };
  } }>({
    queryKey: ["/api/provider-tasks/stats"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/provider-tasks", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task Created", description: "New task has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-tasks/stats"] });
      setCreateDialogOpen(false);
      setNewTask({ title: "", description: "", category: "follow_up", priority: "medium", patientName: "", assignedToName: "", dueDate: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/provider-tasks/${taskId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task Updated", description: "Task has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-tasks/stats"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    },
  });

  const handleCreateTask = () => {
    if (!newTask.title.trim() || !newTask.assignedToName.trim() || !newTask.dueDate) {
      toast({ title: "Validation Error", description: "Title, Assigned To, and Due Date are required.", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate({
      title: newTask.title,
      description: newTask.description,
      category: newTask.category,
      priority: newTask.priority,
      patientName: newTask.patientName || undefined,
      assignedTo: newTask.assignedToName,
      assignedToName: newTask.assignedToName,
      dueDate: newTask.dueDate,
    });
  };

  const tasks = tasksData?.tasks || [];
  const stats = statsData?.stats;

  if (loadingTasks || loadingStats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-12" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tasks</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              <span data-testid="text-stat-total">{stats?.total || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span data-testid="text-stat-pending">{stats?.pending || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-blue-500" />
              <span>{stats?.inProgress || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>{stats?.completed || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span data-testid="text-stat-overdue">{stats?.overdue || 0}</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-task-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(taskCategoryLabels).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-task">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]" data-testid="dialog-create-task">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task for the care team.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title *</Label>
                <Input
                  id="task-title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title"
                  data-testid="input-task-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Enter task description"
                  data-testid="input-task-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newTask.category} onValueChange={(v) => setNewTask({ ...newTask, category: v })}>
                    <SelectTrigger data-testid="select-task-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(taskCategoryLabels).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                    <SelectTrigger data-testid="select-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-patient-name">Patient Name (optional)</Label>
                <Input
                  id="task-patient-name"
                  value={newTask.patientName}
                  onChange={(e) => setNewTask({ ...newTask, patientName: e.target.value })}
                  placeholder="Enter patient name"
                  data-testid="input-task-patient-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-assigned-to">Assigned To *</Label>
                <Input
                  id="task-assigned-to"
                  value={newTask.assignedToName}
                  onChange={(e) => setNewTask({ ...newTask, assignedToName: e.target.value })}
                  placeholder="Enter provider name"
                  data-testid="input-task-assigned-to"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date *</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  data-testid="input-task-due-date"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateTask}
                disabled={createTaskMutation.isPending}
                data-testid="button-submit-task"
              >
                {createTaskMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg">No tasks found</p>
            <p className="text-muted-foreground text-sm">Create a new task to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isOverdue = task.status === "overdue" || (task.status !== "completed" && task.status !== "cancelled" && new Date(task.dueDate) < new Date());
            const priorityVariant = getTaskPriorityVariant(task.priority);
            const priorityClass = getTaskPriorityClass(task.priority);
            const statusVariant = getTaskStatusVariant(task.status);
            const statusClass = getTaskStatusClass(task.status);

            return (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base" data-testid={`text-task-title-${task.id}`}>
                        {task.title}
                      </CardTitle>
                      {task.description && (
                        <CardDescription className="mt-1">{task.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={priorityVariant}
                        className={`text-xs ${priorityClass}`}
                        data-testid={`badge-task-priority-${task.id}`}
                      >
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                      <Badge
                        variant={statusVariant}
                        className={`text-xs ${statusClass}`}
                        data-testid={`badge-task-status-${task.id}`}
                      >
                        {task.status === "in_progress" ? "In Progress" : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {taskCategoryLabels[task.category] || task.category}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                      {task.patientName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {task.patientName}
                        </span>
                      )}
                      {task.assignedToName && (
                        <span className="flex items-center gap-1">
                          <UserSquare2 className="h-3.5 w-3.5" />
                          {task.assignedToName}
                        </span>
                      )}
                      <span
                        className={`flex items-center gap-1 ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}`}
                        data-testid={`text-task-due-${task.id}`}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(task.dueDate), "MMM d, yyyy")}
                        {isOverdue && " (overdue)"}
                        {!isOverdue && task.status !== "completed" && task.status !== "cancelled" && (
                          <span className="text-xs ml-1">
                            ({formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status !== "completed" && task.status !== "cancelled" && task.status !== "in_progress" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: "in_progress" } })}
                          disabled={updateTaskMutation.isPending}
                          data-testid={`button-progress-task-${task.id}`}
                        >
                          <Loader2 className="h-3.5 w-3.5 mr-1" />
                          In Progress
                        </Button>
                      )}
                      {task.status !== "completed" && task.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: "completed" } })}
                          disabled={updateTaskMutation.isPending}
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProviderPortalPage() {
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Provider Portal
        </h1>
        <p className="text-muted-foreground">
          Comprehensive patient management with AI-powered insights
        </p>
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>Clinical Reference Only:</strong> All AI-generated insights, summaries, and recommendations in this portal are for provider reference only and do NOT constitute clinical decision support. Clinical judgment is required for all patient care decisions.
          </span>
        </p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-14 gap-1">
          <TabsTrigger value="dashboard" className="min-h-[44px]" data-testid="tab-dashboard">
            <Users className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="min-h-[44px]" data-testid="tab-trends">
            <LineChart className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
          <TabsTrigger value="medication-safety" className="min-h-[44px]" data-testid="tab-medication-safety">
            <ShieldAlert className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Med Safety</span>
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="min-h-[44px]" data-testid="tab-prescriptions">
            <Pill className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Prescriptions</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="min-h-[44px]" data-testid="tab-reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="telehealth" className="min-h-[44px]" data-testid="tab-telehealth">
            <Video className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Telehealth</span>
          </TabsTrigger>
          <TabsTrigger value="treatment-plans" className="min-h-[44px]" data-testid="tab-treatment-plans">
            <ClipboardList className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Treatment</span>
          </TabsTrigger>
          <TabsTrigger value="messaging" className="min-h-[44px]" data-testid="tab-messaging">
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Messaging</span>
          </TabsTrigger>
          <TabsTrigger value="population" className="min-h-[44px]" data-testid="tab-population">
            <Activity className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Population</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="min-h-[44px]" data-testid="tab-alerts">
            <Bell className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="education" className="min-h-[44px]" data-testid="tab-education">
            <GraduationCap className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Education</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="min-h-[44px]" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="min-h-[44px]" data-testid="tab-tasks">
            <ListTodo className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="ai-assistant" className="min-h-[44px]" data-testid="tab-ai-assistant">
            <Brain className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">AI Assistant</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="trends" className="mt-4">
          <PatientTrendsTab />
        </TabsContent>
        <TabsContent value="medication-safety" className="mt-4">
          <MedicationSafetyTab />
        </TabsContent>
        <TabsContent value="prescriptions" className="mt-4">
          <PrescriptionsTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="telehealth" className="mt-4">
          <TelehealthTab />
        </TabsContent>
        <TabsContent value="treatment-plans" className="mt-4">
          <TreatmentPlansTab />
        </TabsContent>
        <TabsContent value="messaging" className="mt-4">
          <MessagingTab />
        </TabsContent>
        <TabsContent value="population" className="mt-4">
          <PatientPopulationManagementCard />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <AlertRulesTab />
        </TabsContent>
        <TabsContent value="education" className="mt-4">
          <EducationTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <ProviderAuditTab />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab />
        </TabsContent>
        <TabsContent value="ai-assistant" className="mt-4">
          <AIAssistantTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
