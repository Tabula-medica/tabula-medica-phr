import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  Activity,
  Heart,
  Calendar,
  Clock,
  User,
  Users,
  Bell,
  CheckCircle,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
  FileText,
  MessageSquare,
  Pill,
  Stethoscope,
  Eye,
  Check,
  X,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  ThermometerIcon,
  Droplet,
  Scale,
  Timer,
  Phone,
  Video,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, isToday } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  RemoteVitalAlert,
  PendingAppointmentRequest,
  AIFollowUpPatient,
  ClinicianTask,
  ClinicianDashboardSummary,
} from "@shared/schema";

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300 dark:border-orange-800";
    case "moderate":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800";
    case "low":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800";
    default:
      return "bg-muted";
  }
}

function getVitalIcon(vitalType: string) {
  const lower = vitalType.toLowerCase();
  if (lower.includes("blood pressure")) return <Heart className="h-4 w-4" />;
  if (lower.includes("heart rate") || lower.includes("pulse")) return <Activity className="h-4 w-4" />;
  if (lower.includes("glucose") || lower.includes("blood sugar")) return <Droplet className="h-4 w-4" />;
  if (lower.includes("oxygen") || lower.includes("spo2")) return <ThermometerIcon className="h-4 w-4" />;
  if (lower.includes("weight")) return <Scale className="h-4 w-4" />;
  if (lower.includes("temperature")) return <ThermometerIcon className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
}

function getTaskTypeIcon(taskType: string) {
  switch (taskType) {
    case "review_results":
      return <FileText className="h-4 w-4" />;
    case "sign_orders":
      return <ClipboardList className="h-4 w-4" />;
    case "respond_message":
      return <MessageSquare className="h-4 w-4" />;
    case "prescription_renewal":
      return <Pill className="h-4 w-4" />;
    case "prior_authorization":
      return <FileText className="h-4 w-4" />;
    case "complete_documentation":
      return <FileText className="h-4 w-4" />;
    case "patient_callback":
      return <Phone className="h-4 w-4" />;
    default:
      return <ClipboardList className="h-4 w-4" />;
  }
}

function VitalAlertCard({ alert, onAcknowledge }: { alert: RemoteVitalAlert; onAcknowledge: (id: string) => void }) {
  const isAbnormalHigh = alert.value > alert.normalRange.max;
  const isAbnormalLow = alert.value < alert.normalRange.min;

  return (
    <div className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`} data-testid={`vital-alert-${alert.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-background">
            {getVitalIcon(alert.vitalType)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{alert.patientName}</span>
              <StatusBadge status={alert.severity} className="text-xs" />
              {alert.status === "new" && (
                <Badge variant="outline" className="text-xs">New</Badge>
              )}
            </div>
            <p className="text-sm mt-1">
              <span className="font-medium">{alert.vitalType}:</span>{" "}
              <span className={isAbnormalHigh || isAbnormalLow ? "font-bold" : ""}>
                {alert.value} {alert.unit}
              </span>
              {" "}
              <span className="text-muted-foreground">
                (Normal: {alert.normalRange.min}-{alert.normalRange.max})
              </span>
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(parseISO(alert.triggeredAt), { addSuffix: true })}
              </span>
              {alert.deviceType && (
                <span>{alert.deviceType}</span>
              )}
              {alert.trendDirection && (
                <span className="flex items-center gap-1">
                  {alert.trendDirection === "increasing" && <TrendingUp className="h-3 w-3 text-red-500" />}
                  {alert.trendDirection === "decreasing" && <TrendingDown className="h-3 w-3 text-blue-500" />}
                  {alert.trendDirection === "stable" && <Minus className="h-3 w-3" />}
                  {alert.trendDirection}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {alert.status === "new" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAcknowledge(alert.id)}
              data-testid={`button-acknowledge-${alert.id}`}
            >
              <Check className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
          )}
          <Button size="sm" variant="ghost" data-testid={`button-view-patient-${alert.patientId}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppointmentRequestCard({ 
  request, 
  onApprove, 
  onDecline 
}: { 
  request: PendingAppointmentRequest;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "emergency":
        return "destructive";
      case "urgent":
        return "destructive";
      case "soon":
        return "default";
      default:
        return "secondary";
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case "telehealth":
        return <Video className="h-4 w-4" />;
      case "new_patient":
        return <User className="h-4 w-4" />;
      case "follow_up":
        return <RefreshCw className="h-4 w-4" />;
      case "urgent":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-4 rounded-lg border bg-card" data-testid={`appointment-request-${request.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-muted">
            {getRequestTypeIcon(request.requestType)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{request.patientName}</span>
              <Badge variant={getUrgencyColor(request.urgencyLevel)} className="text-xs">
                {request.urgencyLevel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {request.requestType.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {request.reason}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Requested: {format(parseISO(request.requestedDate), "MMM d, yyyy")}
              </span>
              {request.requestedTimeSlot && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {request.requestedTimeSlot}
                </span>
              )}
              {request.insuranceVerified && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Insurance verified
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => onApprove(request.id)}
            data-testid={`button-approve-${request.id}`}
          >
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDecline(request.id)}
            data-testid={`button-decline-${request.id}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FollowUpPatientCard({ 
  patient, 
  onSchedule, 
  onDismiss 
}: { 
  patient: AIFollowUpPatient;
  onSchedule: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 rounded-lg border bg-card" data-testid={`followup-patient-${patient.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-muted">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{patient.patientName}</span>
              <StatusBadge status={patient.priority} className="text-xs" />
              <Badge variant="outline" className="text-xs">
                {patient.followUpReason.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {patient.age} y/o • {patient.conditions.slice(0, 2).join(", ")}
              {patient.conditions.length > 2 && ` +${patient.conditions.length - 2}`}
            </p>
            <div className="mt-2 p-2 rounded bg-muted/50 text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-xs text-primary mb-1">AI Analysis</p>
                  <p className="text-xs">{patient.aiRationale}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Suggested: {patient.suggestedTimeframe}
              </span>
              {patient.daysSinceLastVisit !== undefined && (
                <span>Last visit: {patient.daysSinceLastVisit} days ago</span>
              )}
              <span className="flex items-center gap-1">
                AI Confidence: {Math.round(patient.aiConfidenceScore * 100)}%
              </span>
            </div>

            {expanded && patient.relevantMetrics && patient.relevantMetrics.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-medium mb-2">Relevant Metrics</p>
                <div className="flex flex-wrap gap-2">
                  {patient.relevantMetrics.map((metric, i) => (
                    <Badge
                      key={i}
                      variant={metric.status === "abnormal" ? "destructive" : metric.status === "borderline" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {metric.name}: {metric.value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => onSchedule(patient.id)}
            data-testid={`button-schedule-${patient.id}`}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Schedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-${patient.id}`}
          >
            {expanded ? "Less" : "More"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ 
  task, 
  onComplete, 
  onUpdate 
}: { 
  task: ClinicianTask;
  onComplete: (id: string) => void;
  onUpdate: (id: string, status: string) => void;
}) {
  const isDueToday = task.dueDate && isToday(parseISO(task.dueDate));
  const isOverdue = task.dueDate && parseISO(task.dueDate) < new Date() && task.status === "pending";

  return (
    <div 
      className={`p-4 rounded-lg border bg-card ${isOverdue ? "border-red-300 dark:border-red-800" : ""}`} 
      data-testid={`task-${task.id}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={(checked) => {
            if (checked) onComplete(task.id);
          }}
          className="mt-1"
          data-testid={`checkbox-task-${task.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {getTaskTypeIcon(task.taskType)}
            <span className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </span>
            <StatusBadge status={task.priority} className="text-xs" />
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">Overdue</Badge>
            )}
            {isDueToday && !isOverdue && (
              <Badge variant="secondary" className="text-xs">Due today</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          {task.patientName && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.patientName}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Due: {format(parseISO(task.dueDate), "MMM d")}
              </span>
            )}
            {task.tags && task.tags.length > 0 && (
              <div className="flex gap-1">
                {task.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button size="sm" variant="ghost" data-testid={`button-view-task-${task.id}`}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  variant = "default" 
}: { 
  title: string;
  value: number;
  subValue?: string;
  icon: any;
  variant?: "default" | "warning" | "danger";
}) {
  const bgClass = variant === "danger" 
    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
    : variant === "warning"
    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
    : "bg-card";

  return (
    <Card className={bgClass} data-testid={`summary-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${
            variant === "danger" ? "bg-red-100 dark:bg-red-900" :
            variant === "warning" ? "bg-amber-100 dark:bg-amber-900" :
            "bg-muted"
          }`}>
            <Icon className={`h-5 w-5 ${
              variant === "danger" ? "text-red-600 dark:text-red-400" :
              variant === "warning" ? "text-amber-600 dark:text-amber-400" :
              "text-muted-foreground"
            }`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClinicianDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: summary, isLoading: summaryLoading } = useQuery<ClinicianDashboardSummary>({
    queryKey: ["/api/clinician-dashboard/summary"],
    queryFn: async () => {
      const res = await fetch("/api/clinician-dashboard/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: vitalAlerts, isLoading: alertsLoading } = useQuery<RemoteVitalAlert[]>({
    queryKey: ["/api/clinician-dashboard/vital-alerts"],
    queryFn: async () => {
      const res = await fetch("/api/clinician-dashboard/vital-alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
  });

  const { data: appointmentRequests, isLoading: requestsLoading } = useQuery<PendingAppointmentRequest[]>({
    queryKey: ["/api/clinician-dashboard/appointment-requests"],
    queryFn: async () => {
      const res = await fetch("/api/clinician-dashboard/appointment-requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });

  const { data: followUpPatients, isLoading: followUpLoading } = useQuery<AIFollowUpPatient[]>({
    queryKey: ["/api/clinician-dashboard/follow-up-patients"],
    queryFn: async () => {
      const res = await fetch("/api/clinician-dashboard/follow-up-patients");
      if (!res.ok) throw new Error("Failed to fetch follow-up patients");
      return res.json();
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<ClinicianTask[]>({
    queryKey: ["/api/clinician-dashboard/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/clinician-dashboard/tasks");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/clinician-dashboard/vital-alerts/${alertId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/vital-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/summary"] });
      toast({ title: "Alert acknowledged" });
    },
  });

  const appointmentActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "decline" }) => {
      return apiRequest("POST", `/api/clinician-dashboard/appointment-requests/${id}/action`, { action });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/appointment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/summary"] });
      toast({ title: action === "approve" ? "Appointment approved" : "Appointment declined" });
    },
  });

  const followUpActionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "schedule" | "dismiss" }) => {
      return apiRequest("POST", `/api/clinician-dashboard/follow-up-patients/${id}/action`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/follow-up-patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/summary"] });
      toast({ title: "Follow-up action recorded" });
    },
  });

  const taskUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/clinician-dashboard/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-dashboard/summary"] });
      toast({ title: "Task updated" });
    },
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl" data-testid="page-clinician-dashboard">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Stethoscope className="h-6 w-6" />
          Clinician Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage patient alerts, appointments, and clinical tasks
        </p>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            title="Vital Alerts"
            value={summary.vitalAlerts.total}
            subValue={`${summary.vitalAlerts.critical} critical, ${summary.vitalAlerts.newCount} new`}
            icon={AlertTriangle}
            variant={summary.vitalAlerts.critical > 0 ? "danger" : summary.vitalAlerts.total > 0 ? "warning" : "default"}
          />
          <SummaryCard
            title="Appointment Requests"
            value={summary.appointmentRequests.total}
            subValue={summary.appointmentRequests.urgent > 0 ? `${summary.appointmentRequests.urgent} urgent` : "No urgent requests"}
            icon={Calendar}
            variant={summary.appointmentRequests.urgent > 0 ? "warning" : "default"}
          />
          <SummaryCard
            title="Follow-up Needed"
            value={summary.followUpPatients.total}
            subValue={`${summary.followUpPatients.criticalPriority} critical priority`}
            icon={Users}
            variant={summary.followUpPatients.criticalPriority > 0 ? "danger" : "default"}
          />
          <SummaryCard
            title="Tasks"
            value={summary.tasks.pendingCount}
            subValue={summary.tasks.overdue > 0 ? `${summary.tasks.overdue} overdue` : `${summary.tasks.dueTodayCount} due today`}
            icon={ClipboardList}
            variant={summary.tasks.overdue > 0 ? "danger" : "default"}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start flex-wrap" data-testid="tabs-dashboard">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="vital-alerts" data-testid="tab-vital-alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Vital Alerts
            {summary && summary.vitalAlerts.newCount > 0 && (
              <Badge variant="destructive" className="ml-2">{summary.vitalAlerts.newCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Appointments
            {summary && summary.appointmentRequests.total > 0 && (
              <Badge variant="secondary" className="ml-2">{summary.appointmentRequests.total}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="follow-ups" data-testid="tab-follow-ups">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Follow-ups
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ClipboardList className="h-4 w-4 mr-2" />
            Tasks
            {summary && summary.tasks.overdue > 0 && (
              <Badge variant="destructive" className="ml-2">{summary.tasks.overdue}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Recent Vital Alerts
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("vital-alerts")}>
                    View all <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  {alertsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
                    </div>
                  ) : vitalAlerts && vitalAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {vitalAlerts.slice(0, 3).map((alert) => (
                        <VitalAlertCard
                          key={alert.id}
                          alert={alert}
                          onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>No active vital alerts</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Priority Tasks
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("tasks")}>
                    View all <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  {tasksLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : tasks && tasks.length > 0 ? (
                    <div className="space-y-3">
                      {tasks.filter(t => t.status !== "completed").slice(0, 4).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={(id) => taskUpdateMutation.mutate({ id, status: "completed" })}
                          onUpdate={(id, status) => taskUpdateMutation.mutate({ id, status })}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>All tasks completed</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Identified Follow-up Patients
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("follow-ups")}>
                  View all <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <CardDescription>
                Patients identified by AI analysis as requiring clinical attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followUpLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : followUpPatients && followUpPatients.length > 0 ? (
                <div className="space-y-3">
                  {followUpPatients.filter(p => p.priority === "critical" || p.priority === "high").slice(0, 2).map((patient) => (
                    <FollowUpPatientCard
                      key={patient.id}
                      patient={patient}
                      onSchedule={(id) => followUpActionMutation.mutate({ id, action: "schedule" })}
                      onDismiss={(id) => followUpActionMutation.mutate({ id, action: "dismiss" })}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No patients require immediate follow-up</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vital-alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Remote Vital Sign Alerts
              </CardTitle>
              <CardDescription>
                Real-time alerts from patient remote monitoring devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {alertsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                  </div>
                ) : vitalAlerts && vitalAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {vitalAlerts.map((alert) => (
                      <VitalAlertCard
                        key={alert.id}
                        alert={alert}
                        onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-lg">No active vital alerts</p>
                    <p className="text-sm">All patient vitals are within normal ranges</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pending Appointment Requests
              </CardTitle>
              <CardDescription>
                Review and approve patient appointment requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {requestsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
                  </div>
                ) : appointmentRequests && appointmentRequests.length > 0 ? (
                  <div className="space-y-3">
                    {appointmentRequests.map((request) => (
                      <AppointmentRequestCard
                        key={request.id}
                        request={request}
                        onApprove={(id) => appointmentActionMutation.mutate({ id, action: "approve" })}
                        onDecline={(id) => appointmentActionMutation.mutate({ id, action: "decline" })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-lg">No pending appointment requests</p>
                    <p className="text-sm">All requests have been processed</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="follow-ups">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI-Identified Follow-up Patients
              </CardTitle>
              <CardDescription>
                Patients identified by AI analysis as requiring clinical attention based on health trends, lab results, and care gaps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">For Educational Purposes Only</p>
                    <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                      AI suggestions are data summaries only. NOT clinical recommendations. 
                      Clinical judgment must be applied to all patient care decisions.
                    </p>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[550px] pr-4">
                {followUpLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
                  </div>
                ) : followUpPatients && followUpPatients.length > 0 ? (
                  <div className="space-y-3">
                    {followUpPatients.map((patient) => (
                      <FollowUpPatientCard
                        key={patient.id}
                        patient={patient}
                        onSchedule={(id) => followUpActionMutation.mutate({ id, action: "schedule" })}
                        onDismiss={(id) => followUpActionMutation.mutate({ id, action: "dismiss" })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-lg">No patients require follow-up</p>
                    <p className="text-sm">All identified care needs have been addressed</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Clinical Task List
                  </CardTitle>
                  <CardDescription>
                    Manage your pending clinical tasks and documentation
                  </CardDescription>
                </div>
                <Button data-testid="button-add-task">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {tasksLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : tasks && tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={(id) => taskUpdateMutation.mutate({ id, status: "completed" })}
                        onUpdate={(id, status) => taskUpdateMutation.mutate({ id, status })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p className="text-lg">No pending tasks</p>
                    <p className="text-sm">You're all caught up!</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}