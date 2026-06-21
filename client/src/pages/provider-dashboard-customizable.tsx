import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  GripVertical,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileText,
  Activity,
  Pill,
  Brain,
  Bell,
  ArrowRight,
  ChevronRight,
  RefreshCw,
  MoreVertical,
  Target,
  ClipboardList,
  BarChart3,
  Heart,
  Zap,
  User,
  Calendar,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
}

interface DashboardPreferences {
  widgets: WidgetConfig[];
  refreshInterval: number;
  compactMode: boolean;
}

interface AIInsight {
  id: string;
  type: "recommendation" | "alert" | "trend" | "opportunity";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  patientId?: string;
  patientName?: string;
  actionRequired: boolean;
  generatedAt: string;
  confidenceScore: number;
  relatedMetrics?: { label: string; value: string }[];
}

interface PatientPathway {
  patientId: string;
  patientName: string;
  pathwayName: string;
  currentPhase: string;
  totalPhases: number;
  currentPhaseIndex: number;
  progress: number;
  status: "on_track" | "at_risk" | "delayed" | "completed";
  nextMilestone: string;
  nextMilestoneDate: string;
  daysInCurrentPhase: number;
}

interface AdherenceSummary {
  patientId: string;
  patientName: string;
  overallAdherence: number;
  trend: "improving" | "stable" | "declining";
  medications: {
    name: string;
    adherence: number;
    missedDoses: number;
  }[];
  riskLevel: "low" | "moderate" | "high";
  lastUpdated: string;
}

interface CaseReviewAlert {
  id: string;
  caseId: string;
  patientId: string;
  patientName: string;
  alertType: "new_case" | "diagnosis_update" | "discussion_reply" | "action_needed" | "ai_insight";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  isRead: boolean;
}

interface UpcomingTask {
  id: string;
  title: string;
  description: string;
  patientId?: string;
  patientName?: string;
  category: "review" | "follow_up" | "documentation" | "appointment" | "lab_result" | "prescription";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: string;
  estimatedMinutes: number;
  status: "pending" | "in_progress" | "overdue";
  aiSuggested: boolean;
}

const defaultWidgets: WidgetConfig[] = [
  { id: "ai_insights", name: "AI-Generated Insights", enabled: true, order: 0, size: "large" },
  { id: "patient_pathways", name: "Patient Pathway Progress", enabled: true, order: 1, size: "medium" },
  { id: "adherence_summary", name: "Patient Adherence Summary", enabled: true, order: 2, size: "medium" },
  { id: "case_review_alerts", name: "AI Case Review Alerts", enabled: true, order: 3, size: "medium" },
  { id: "upcoming_tasks", name: "Upcoming Tasks", enabled: true, order: 4, size: "medium" },
  { id: "quick_stats", name: "Quick Stats", enabled: true, order: 5, size: "small" },
];

const mockAIInsights: AIInsight[] = [
  {
    id: "ins-1",
    type: "alert",
    priority: "high",
    title: "Blood Pressure Trend Alert",
    description: "3 patients show concerning BP trends over the past 2 weeks requiring review.",
    actionRequired: true,
    generatedAt: new Date(Date.now() - 3600000).toISOString(),
    confidenceScore: 0.92,
    relatedMetrics: [{ label: "Patients Affected", value: "3" }, { label: "Avg Increase", value: "+15 mmHg" }],
  },
  {
    id: "ins-2",
    type: "recommendation",
    priority: "medium",
    title: "Medication Reconciliation Opportunity",
    description: "5 patients have potential drug interactions that could be optimized.",
    patientName: "Multiple Patients",
    actionRequired: false,
    generatedAt: new Date(Date.now() - 7200000).toISOString(),
    confidenceScore: 0.87,
  },
  {
    id: "ins-3",
    type: "trend",
    priority: "low",
    title: "Positive A1C Trends",
    description: "8 diabetic patients show improved A1C levels this quarter.",
    actionRequired: false,
    generatedAt: new Date(Date.now() - 14400000).toISOString(),
    confidenceScore: 0.95,
    relatedMetrics: [{ label: "Avg Improvement", value: "-0.5%" }],
  },
  {
    id: "ins-4",
    type: "opportunity",
    priority: "medium",
    title: "Preventive Care Gap",
    description: "12 eligible patients are overdue for annual wellness visits.",
    actionRequired: true,
    generatedAt: new Date(Date.now() - 21600000).toISOString(),
    confidenceScore: 0.89,
  },
];

const mockPatientPathways: PatientPathway[] = [
  {
    patientId: "p-1",
    patientName: "Sarah Johnson",
    pathwayName: "Diabetes Management Program",
    currentPhase: "Lifestyle Modification",
    totalPhases: 5,
    currentPhaseIndex: 2,
    progress: 45,
    status: "on_track",
    nextMilestone: "A1C Check",
    nextMilestoneDate: new Date(Date.now() + 604800000).toISOString(),
    daysInCurrentPhase: 14,
  },
  {
    patientId: "p-2",
    patientName: "Michael Chen",
    pathwayName: "Post-Surgical Recovery",
    currentPhase: "Physical Therapy",
    totalPhases: 4,
    currentPhaseIndex: 3,
    progress: 75,
    status: "on_track",
    nextMilestone: "Final Assessment",
    nextMilestoneDate: new Date(Date.now() + 1209600000).toISOString(),
    daysInCurrentPhase: 21,
  },
  {
    patientId: "p-3",
    patientName: "Emily Rodriguez",
    pathwayName: "Cardiac Rehabilitation",
    currentPhase: "Exercise Training",
    totalPhases: 6,
    currentPhaseIndex: 2,
    progress: 30,
    status: "at_risk",
    nextMilestone: "Stress Test",
    nextMilestoneDate: new Date(Date.now() + 259200000).toISOString(),
    daysInCurrentPhase: 28,
  },
];

const mockAdherenceSummaries: AdherenceSummary[] = [
  {
    patientId: "p-1",
    patientName: "Sarah Johnson",
    overallAdherence: 92,
    trend: "improving",
    medications: [
      { name: "Metformin", adherence: 95, missedDoses: 2 },
      { name: "Lisinopril", adherence: 88, missedDoses: 4 },
    ],
    riskLevel: "low",
    lastUpdated: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    patientId: "p-4",
    patientName: "James Wilson",
    overallAdherence: 68,
    trend: "declining",
    medications: [
      { name: "Atorvastatin", adherence: 72, missedDoses: 8 },
      { name: "Aspirin", adherence: 65, missedDoses: 10 },
    ],
    riskLevel: "high",
    lastUpdated: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    patientId: "p-5",
    patientName: "Linda Park",
    overallAdherence: 85,
    trend: "stable",
    medications: [
      { name: "Levothyroxine", adherence: 90, missedDoses: 3 },
      { name: "Omeprazole", adherence: 80, missedDoses: 6 },
    ],
    riskLevel: "moderate",
    lastUpdated: new Date(Date.now() - 10800000).toISOString(),
  },
];

const mockCaseReviewAlerts: CaseReviewAlert[] = [
  {
    id: "alert-1",
    caseId: "case-123",
    patientId: "p-6",
    patientName: "Robert Kim",
    alertType: "ai_insight",
    title: "AI Detected Potential Diagnosis",
    description: "New diagnostic suggestion based on latest lab results and symptoms.",
    priority: "high",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    isRead: false,
  },
  {
    id: "alert-2",
    caseId: "case-124",
    patientId: "p-7",
    patientName: "Maria Garcia",
    alertType: "discussion_reply",
    title: "Dr. Smith Added Comments",
    description: "New specialist input on treatment plan recommendation.",
    priority: "medium",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
  },
  {
    id: "alert-3",
    caseId: "case-125",
    patientId: "p-8",
    patientName: "David Lee",
    alertType: "action_needed",
    title: "Treatment Decision Required",
    description: "Awaiting provider decision on recommended intervention.",
    priority: "urgent",
    createdAt: new Date(Date.now() - 5400000).toISOString(),
    isRead: true,
  },
];

const mockUpcomingTasks: UpcomingTask[] = [
  {
    id: "task-1",
    title: "Review Lab Results",
    description: "Comprehensive metabolic panel for Sarah Johnson",
    patientId: "p-1",
    patientName: "Sarah Johnson",
    category: "lab_result",
    priority: "high",
    dueDate: new Date(Date.now() + 3600000).toISOString(),
    estimatedMinutes: 10,
    status: "pending",
    aiSuggested: true,
  },
  {
    id: "task-2",
    title: "Follow-up Call",
    description: "Post-procedure check-in",
    patientId: "p-2",
    patientName: "Michael Chen",
    category: "follow_up",
    priority: "medium",
    dueDate: new Date(Date.now() + 7200000).toISOString(),
    estimatedMinutes: 15,
    status: "pending",
    aiSuggested: false,
  },
  {
    id: "task-3",
    title: "Prescription Refill Review",
    description: "Approve pending refill requests",
    category: "prescription",
    priority: "high",
    dueDate: new Date(Date.now() - 1800000).toISOString(),
    estimatedMinutes: 5,
    status: "overdue",
    aiSuggested: false,
  },
  {
    id: "task-4",
    title: "Document Visit Notes",
    description: "Complete notes for morning appointments",
    category: "documentation",
    priority: "medium",
    dueDate: new Date(Date.now() + 14400000).toISOString(),
    estimatedMinutes: 30,
    status: "in_progress",
    aiSuggested: false,
  },
];

function getPreferences(): DashboardPreferences {
  const stored = localStorage.getItem("provider_dashboard_preferences");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { widgets: defaultWidgets, refreshInterval: 60, compactMode: false };
    }
  }
  return { widgets: defaultWidgets, refreshInterval: 60, compactMode: false };
}

function savePreferences(prefs: DashboardPreferences) {
  localStorage.setItem("provider_dashboard_preferences", JSON.stringify(prefs));
}

function InsightBadge({ type, priority }: { type: AIInsight["type"]; priority: AIInsight["priority"] }) {
  const colors = {
    recommendation: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    alert: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    trend: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    opportunity: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  };
  
  return (
    <Badge className={colors[type]}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  
  return (
    <Badge className={colors[priority] || colors.medium}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

function StatusIndicator({ status }: { status: PatientPathway["status"] }) {
  const config = {
    on_track: { color: "bg-green-500", label: "On Track" },
    at_risk: { color: "bg-yellow-500", label: "At Risk" },
    delayed: { color: "bg-red-500", label: "Delayed" },
    completed: { color: "bg-blue-500", label: "Completed" },
  };
  
  const { color, label } = config[status];
  
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: "improving" | "stable" | "declining" }) {
  if (trend === "improving") {
    return <TrendingUp className="w-4 h-4 text-green-500" aria-label="Improving" />;
  }
  if (trend === "declining") {
    return <TrendingDown className="w-4 h-4 text-red-500" aria-label="Declining" />;
  }
  return <Minus className="w-4 h-4 text-muted-foreground" aria-label="Stable" />;
}

function AIInsightsWidget() {
  return (
    <Card data-testid="widget-ai-insights">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">AI-Generated Insights</CardTitle>
        </div>
        <Button variant="ghost" size="icon" data-testid="button-refresh-insights" aria-label="Refresh insights">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800" role="note" aria-label="NO-CDS Compliance Notice">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-3 h-3 inline-block mr-1" aria-hidden="true" />
            <strong>NO-CDS Notice:</strong> AI insights are informational only and do not constitute clinical decision support. Provider verification required.
          </p>
        </div>
        <ScrollArea className="h-56">
          <div className="space-y-3">
            {mockAIInsights.map((insight) => (
              <button 
                key={insight.id}
                type="button"
                className="w-full text-left p-3 bg-muted/30 rounded-lg hover-elevate cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                data-testid={`insight-${insight.id}`}
                aria-label={`${insight.type} insight: ${insight.title}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <InsightBadge type={insight.type} priority={insight.priority} />
                    <PriorityBadge priority={insight.priority} />
                    {insight.actionRequired && (
                      <Badge variant="outline" className="border-primary text-primary">
                        Action Required
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(insight.generatedAt), { addSuffix: true })}
                  </span>
                </div>
                <h4 className="font-medium text-sm mb-1">{insight.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{insight.description}</p>
                {insight.relatedMetrics && (
                  <div className="flex gap-4">
                    {insight.relatedMetrics.map((metric, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-muted-foreground">{metric.label}: </span>
                        <span className="font-medium">{metric.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Confidence: {Math.round(insight.confidenceScore * 100)}%
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href="/ai-provider-dashboard-enhanced">
          <Button variant="ghost" size="sm" className="w-full" data-testid="link-view-all-insights">
            View All Insights <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function PatientPathwaysWidget() {
  return (
    <Card data-testid="widget-patient-pathways">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">Patient Pathway Progress</CardTitle>
        </div>
        <Badge variant="secondary">{mockPatientPathways.length} Active</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockPatientPathways.map((pathway) => (
            <div 
              key={pathway.patientId}
              className="p-3 bg-muted/30 rounded-lg"
              data-testid={`pathway-${pathway.patientId}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-sm">{pathway.patientName}</h4>
                  <p className="text-xs text-muted-foreground">{pathway.pathwayName}</p>
                </div>
                <StatusIndicator status={pathway.status} />
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{pathway.currentPhase}</span>
                  <span>Phase {pathway.currentPhaseIndex + 1} of {pathway.totalPhases}</span>
                </div>
                <Progress value={pathway.progress} className="h-2" />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Next: {pathway.nextMilestone}</span>
                <span>{format(new Date(pathway.nextMilestoneDate), "MMM d")}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href="/patient-pathways">
          <Button variant="ghost" size="sm" className="w-full" data-testid="link-view-all-pathways">
            View All Pathways <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function AdherenceSummaryWidget() {
  return (
    <Card data-testid="widget-adherence-summary">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">Patient Adherence Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockAdherenceSummaries.map((summary) => (
            <div 
              key={summary.patientId}
              className="p-3 bg-muted/30 rounded-lg"
              data-testid={`adherence-${summary.patientId}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <h4 className="font-medium text-sm">{summary.patientName}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <TrendIndicator trend={summary.trend} />
                  <Badge className={
                    summary.riskLevel === "low" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                    summary.riskLevel === "moderate" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  }>
                    {summary.riskLevel}
                  </Badge>
                </div>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Overall Adherence</span>
                  <span className="font-medium">{summary.overallAdherence}%</span>
                </div>
                <Progress 
                  value={summary.overallAdherence} 
                  className={`h-2 ${summary.overallAdherence < 70 ? "[&>div]:bg-red-500" : summary.overallAdherence < 85 ? "[&>div]:bg-yellow-500" : ""}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {summary.medications.slice(0, 2).map((med, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground truncate">{med.name}</span>
                    <span className={med.adherence < 70 ? "text-red-500" : med.adherence < 85 ? "text-yellow-500" : "text-green-500"}>
                      {med.adherence}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href="/medication-adherence">
          <Button variant="ghost" size="sm" className="w-full" data-testid="link-view-all-adherence">
            View All Patients <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function CaseReviewAlertsWidget() {
  return (
    <Card data-testid="widget-case-review-alerts">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">AI Case Review Alerts</CardTitle>
        </div>
        <Badge variant="destructive">
          {mockCaseReviewAlerts.filter(a => !a.isRead).length} New
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800" role="note" aria-label="NO-CDS Compliance Notice">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-3 h-3 inline-block mr-1" aria-hidden="true" />
            <strong>NO-CDS:</strong> AI case insights require clinical verification before action.
          </p>
        </div>
        <div className="space-y-3">
          {mockCaseReviewAlerts.map((alert) => (
            <button 
              key={alert.id}
              type="button"
              className={`w-full text-left p-3 rounded-lg cursor-pointer hover-elevate focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                alert.isRead ? "bg-muted/20" : "bg-muted/40 border-l-2 border-primary"
              }`}
              data-testid={`case-alert-${alert.id}`}
              aria-label={`${alert.alertType.replace('_', ' ')} alert: ${alert.title} for ${alert.patientName}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {alert.alertType === "ai_insight" && <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />}
                  {alert.alertType === "discussion_reply" && <FileText className="w-4 h-4 text-blue-500" aria-hidden="true" />}
                  {alert.alertType === "action_needed" && <AlertTriangle className="w-4 h-4 text-orange-500" aria-hidden="true" />}
                  <span className="font-medium text-sm">{alert.title}</span>
                </div>
                <PriorityBadge priority={alert.priority} />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{alert.description}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{alert.patientName}</span>
                <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href="/ai-case-review">
          <Button variant="ghost" size="sm" className="w-full" data-testid="link-view-all-cases">
            View All Cases <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function UpcomingTasksWidget() {
  const getCategoryIcon = (category: UpcomingTask["category"]) => {
    const icons = {
      review: FileText,
      follow_up: Clock,
      documentation: ClipboardList,
      appointment: Calendar,
      lab_result: Activity,
      prescription: Pill,
    };
    const Icon = icons[category] || FileText;
    return <Icon className="w-4 h-4" aria-hidden="true" />;
  };

  return (
    <Card data-testid="widget-upcoming-tasks">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">
            {mockUpcomingTasks.filter(t => t.status === "overdue").length} Overdue
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockUpcomingTasks.map((task) => (
            <button 
              key={task.id}
              type="button"
              aria-label={`${task.category.replace('_', ' ')} task: ${task.title}${task.status === 'overdue' ? ' - Overdue' : ''}`}
              className={`w-full text-left p-3 rounded-lg hover-elevate cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                task.status === "overdue" ? "bg-red-50 dark:bg-red-900/10 border-l-2 border-red-500" :
                task.status === "in_progress" ? "bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-500" :
                "bg-muted/30"
              }`}
              data-testid={`task-${task.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(task.category)}
                  <h4 className="font-medium text-sm">{task.title}</h4>
                  {task.aiSuggested && (
                    <Sparkles className="w-3 h-3 text-primary" aria-label="AI Suggested" />
                  )}
                </div>
                <PriorityBadge priority={task.priority} />
              </div>
              <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>{task.estimatedMinutes} min</span>
                </div>
                <span className={task.status === "overdue" ? "text-red-500 font-medium" : "text-muted-foreground"}>
                  {task.status === "overdue" ? "Overdue" : format(new Date(task.dueDate), "h:mm a")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Link href="/tasks">
          <Button variant="ghost" size="sm" className="w-full" data-testid="link-view-all-tasks">
            View All Tasks <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function QuickStatsWidget() {
  const stats = [
    { label: "Total Patients", value: "156", icon: Users, trend: "+3 this week" },
    { label: "Critical Alerts", value: "4", icon: AlertTriangle, trend: "-2 from yesterday" },
    { label: "Pending Reviews", value: "12", icon: FileText, trend: "5 due today" },
    { label: "Avg Adherence", value: "84%", icon: Heart, trend: "+2% this month" },
  ];

  return (
    <Card data-testid="widget-quick-stats">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">Quick Stats</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="p-3 bg-muted/30 rounded-lg" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-4 h-4 text-primary" aria-hidden="true" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.trend}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetCustomizer({ 
  preferences, 
  onUpdate 
}: { 
  preferences: DashboardPreferences; 
  onUpdate: (prefs: DashboardPreferences) => void;
}) {
  const moveWidget = (id: string, direction: "up" | "down") => {
    const widgets = [...preferences.widgets];
    const index = widgets.findIndex(w => w.id === id);
    if (index === -1) return;
    
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;
    
    [widgets[index], widgets[newIndex]] = [widgets[newIndex], widgets[index]];
    widgets.forEach((w, i) => w.order = i);
    
    onUpdate({ ...preferences, widgets });
  };

  const toggleWidget = (id: string) => {
    const widgets = preferences.widgets.map(w => 
      w.id === id ? { ...w, enabled: !w.enabled } : w
    );
    onUpdate({ ...preferences, widgets });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-customize-dashboard">
          <Settings className="w-4 h-4 mr-2" />
          Customize
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Customize Dashboard</SheetTitle>
          <SheetDescription>
            Show, hide, and reorder widgets to personalize your dashboard.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Widgets</h4>
            <div className="space-y-2">
              {preferences.widgets
                .sort((a, b) => a.order - b.order)
                .map((widget, index) => (
                  <div 
                    key={widget.id}
                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                    data-testid={`widget-config-${widget.id}`}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{widget.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        disabled={index === 0}
                        onClick={() => moveWidget(widget.id, "up")}
                        aria-label="Move up"
                      >
                        <ChevronRight className="w-4 h-4 -rotate-90" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        disabled={index === preferences.widgets.length - 1}
                        onClick={() => moveWidget(widget.id, "down")}
                        aria-label="Move down"
                      >
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </Button>
                      <Switch
                        checked={widget.enabled}
                        onCheckedChange={() => toggleWidget(widget.id)}
                        aria-label={`Toggle ${widget.name}`}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Compact Mode</h4>
                <p className="text-xs text-muted-foreground">Reduce spacing for more content</p>
              </div>
              <Switch
                checked={preferences.compactMode}
                onCheckedChange={(checked) => onUpdate({ ...preferences, compactMode: checked })}
                data-testid="switch-compact-mode"
              />
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => onUpdate({ widgets: defaultWidgets, refreshInterval: 60, compactMode: false })}
            data-testid="button-reset-defaults"
          >
            Reset to Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function ProviderDashboardCustomizable() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(getPreferences);
  const { toast } = useToast();

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const enabledWidgets = preferences.widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case "ai_insights":
        return <AIInsightsWidget />;
      case "patient_pathways":
        return <PatientPathwaysWidget />;
      case "adherence_summary":
        return <AdherenceSummaryWidget />;
      case "case_review_alerts":
        return <CaseReviewAlertsWidget />;
      case "upcoming_tasks":
        return <UpcomingTasksWidget />;
      case "quick_stats":
        return <QuickStatsWidget />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="provider-dashboard-customizable">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Zap className="w-7 h-7 text-primary" aria-hidden="true" />
              Provider Dashboard
            </h1>
            <p className="text-muted-foreground">
              Consolidated AI insights and patient management
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" data-testid="button-refresh-all">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <WidgetCustomizer preferences={preferences} onUpdate={setPreferences} />
          </div>
        </header>

        <div 
          className={`grid gap-4 ${
            preferences.compactMode ? "gap-3" : "gap-6"
          } md:grid-cols-2 lg:grid-cols-3`}
        >
          {enabledWidgets.map((widget) => (
            <div 
              key={widget.id}
              className={
                widget.size === "large" ? "md:col-span-2 lg:col-span-3" :
                widget.size === "small" ? "" :
                "lg:col-span-1"
              }
            >
              {renderWidget(widget.id)}
            </div>
          ))}
        </div>

        {enabledWidgets.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <EyeOff className="w-12 h-12 text-muted-foreground" />
              <div>
                <h3 className="font-medium text-lg">No Widgets Enabled</h3>
                <p className="text-muted-foreground">
                  Click "Customize" to enable widgets for your dashboard.
                </p>
              </div>
              <WidgetCustomizer preferences={preferences} onUpdate={setPreferences} />
            </div>
          </Card>
        )}

        <div className="text-center text-xs text-muted-foreground">
          <p>
            All AI-generated insights are for informational purposes only and require clinical verification.
          </p>
        </div>
      </div>
    </div>
  );
}
