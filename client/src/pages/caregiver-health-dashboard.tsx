import { useState, useEffect } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ClipboardList,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Heart,
  LayoutDashboard,
  Minus,
  MoreVertical,
  Pill,
  RefreshCw,
  RotateCcw,
  Scale,
  Settings,
  Stethoscope,
  Thermometer,
  TrendingDown,
  TrendingUp,
  User,
  Wind,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const SAMPLE_PATIENT_ID = "patient-001";
const SAMPLE_CAREGIVER_ID = "caregiver-michael-001";

interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
  collapsed?: boolean;
}

interface DashboardLayoutPreferences {
  caregiverId: string;
  patientId: string;
  widgets: DashboardWidget[];
  theme: string;
  refreshInterval: number;
  updatedAt: string;
}

interface PatientVitalSummary {
  type: string;
  label: string;
  value: string;
  unit: string;
  status: "normal" | "warning" | "critical";
  recordedAt: string;
  trend?: "up" | "down" | "stable";
}

interface PatientMedicationSummary {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  nextDue?: string;
  adherenceRate: number;
  refillNeeded: boolean;
  refillDueDate?: string;
}

interface PatientAppointmentSummary {
  id: string;
  date: string;
  time: string;
  provider: string;
  specialty: string;
  type: string;
  location: string;
  status: string;
  notes?: string;
}

interface PatientAlertSummary {
  id: string;
  type: string;
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  requiresAction: boolean;
}

interface TaskAssignment {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "overdue";
  dueDate?: string;
  patientName: string;
}

interface CaregiverHealthDashboard {
  patientId: string;
  patientName: string;
  relationship: string;
  lastUpdated: string;
  overallHealthScore?: number;
  medications: PatientMedicationSummary[];
  appointments: PatientAppointmentSummary[];
  vitals: PatientVitalSummary[];
  alerts: PatientAlertSummary[];
  tasks: TaskAssignment[];
  conditions: Array<{ name: string; status: string; severity?: string }>;
  recentNotes: Array<{ id: string; content: string; author: string; createdAt: string }>;
}

const VITAL_ICONS: Record<string, any> = {
  blood_pressure: Activity,
  heart_rate: Heart,
  glucose: Droplets,
  temperature: Thermometer,
  oxygen: Wind,
  weight: Scale,
};

function getTrendIcon(trend?: string) {
  if (trend === "up") return <TrendingUp className="h-3 w-3 text-amber-500" />;
  if (trend === "down") return <TrendingDown className="h-3 w-3 text-blue-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function getStatusColor(status: string) {
  if (status === "critical") return "text-red-600 bg-red-50 dark:bg-red-950/30";
  if (status === "warning") return "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
  return "text-green-600 bg-green-50 dark:bg-green-950/30";
}

function getPriorityBadge(priority: string) {
  const colors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    normal: "bg-blue-500",
    low: "bg-gray-400",
  };
  return (
    <Badge className={`${colors[priority] || colors.normal} text-white`} data-testid={`badge-priority-${priority}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

function getTaskStatusBadge(status: string) {
  const config: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-yellow-500", label: "Pending" },
    in_progress: { color: "bg-blue-500", label: "In Progress" },
    completed: { color: "bg-green-500", label: "Completed" },
    overdue: { color: "bg-red-500", label: "Overdue" },
  };
  const { color, label } = config[status] || config.pending;
  return (
    <Badge className={`${color} text-white`} data-testid={`badge-status-${status}`}>
      {label}
    </Badge>
  );
}

function VitalsWidget({ vitals, collapsed }: { vitals: PatientVitalSummary[]; collapsed?: boolean }) {
  if (collapsed) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="widget-vitals-content">
      {vitals.slice(0, 6).map((vital) => {
        const Icon = VITAL_ICONS[vital.type] || Activity;
        return (
          <div
            key={vital.type}
            className={`p-3 rounded-lg ${getStatusColor(vital.status)}`}
            data-testid={`vital-${vital.type}`}
          >
            <div className="flex items-center justify-between mb-1">
              <Icon className="h-4 w-4" />
              {getTrendIcon(vital.trend)}
            </div>
            <p className="text-xs text-muted-foreground">{vital.label}</p>
            <p className="text-lg font-semibold">
              {vital.value}
              <span className="text-xs font-normal ml-1">{vital.unit}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(vital.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MedicationsWidget({ medications, collapsed }: { medications: PatientMedicationSummary[]; collapsed?: boolean }) {
  if (collapsed) return null;

  return (
    <div className="space-y-3" data-testid="widget-medications-content">
      {medications.map((med) => (
        <div
          key={med.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
          data-testid={`medication-${med.id}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Pill className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">{med.name}</p>
              <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
              {med.nextDue && (
                <p className="text-xs text-muted-foreground mt-1">
                  Next: {new Date(med.nextDue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1">
              <Progress value={med.adherenceRate} className="w-16 h-2" />
              <span className="text-xs">{med.adherenceRate}%</span>
            </div>
            {med.refillNeeded && (
              <Badge variant="destructive" className="text-xs" data-testid={`refill-badge-${med.id}`}>
                Refill Needed
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppointmentsWidget({ appointments, collapsed }: { appointments: PatientAppointmentSummary[]; collapsed?: boolean }) {
  if (collapsed) return null;

  return (
    <div className="space-y-3" data-testid="widget-appointments-content">
      {appointments.slice(0, 4).map((apt) => (
        <div
          key={apt.id}
          className="flex items-start gap-3 p-3 rounded-lg border bg-card"
          data-testid={`appointment-${apt.id}`}
        >
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium">{apt.type}</p>
              <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>
                {apt.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{apt.provider} - {apt.specialty}</p>
            <p className="text-sm">{apt.location}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(apt.date).toLocaleDateString()} at {apt.time}
            </div>
            {apt.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">{apt.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlertsWidget({
  alerts,
  collapsed,
  onAcknowledge,
}: {
  alerts: PatientAlertSummary[];
  collapsed?: boolean;
  onAcknowledge: (alertId: string) => void;
}) {
  if (collapsed) return null;

  const unreadAlerts = alerts.filter(a => !a.isRead);
  const urgentAlerts = alerts.filter(a => a.priority === "urgent" || a.priority === "high");

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 text-muted-foreground" data-testid="no-alerts">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <p>No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="widget-alerts-content">
      {urgentAlerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {urgentAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border-l-4 ${
                alert.priority === "urgent"
                  ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                  : "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20"
              }`}
              data-testid={`alert-${alert.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                    alert.priority === "urgent" ? "text-red-600" : "text-orange-600"
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                {alert.requiresAction && !alert.isRead && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAcknowledge(alert.id)}
                    data-testid={`acknowledge-${alert.id}`}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Acknowledge
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {alerts.filter(a => a.priority !== "urgent" && a.priority !== "high").map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
          data-testid={`alert-${alert.id}`}
        >
          <Bell className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="text-sm">{alert.title}</p>
            <p className="text-xs text-muted-foreground">{alert.message}</p>
          </div>
          {!alert.isRead && (
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          )}
        </div>
      ))}
    </div>
  );
}

function TasksWidget({
  tasks,
  collapsed,
  onUpdateStatus,
}: {
  tasks: TaskAssignment[];
  collapsed?: boolean;
  onUpdateStatus: (taskId: string, status: string) => void;
}) {
  if (collapsed) return null;

  if (tasks.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 text-muted-foreground" data-testid="no-tasks">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <p>No pending tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="widget-tasks-content">
      {tasks.filter(t => t.status !== "completed").slice(0, 5).map((task) => (
        <div
          key={task.id}
          className="flex items-start justify-between p-3 rounded-lg border bg-card"
          data-testid={`task-${task.id}`}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${
              task.status === "overdue" ? "bg-red-100 dark:bg-red-900/30" : "bg-primary/10"
            }`}>
              <ClipboardList className={`h-4 w-4 ${
                task.status === "overdue" ? "text-red-600" : "text-primary"
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{task.title}</p>
                {getPriorityBadge(task.priority)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
              {task.dueDate && (
                <p className={`text-xs mt-1 ${
                  task.status === "overdue" ? "text-red-600" : "text-muted-foreground"
                }`}>
                  <Clock className="h-3 w-3 inline mr-1" />
                  Due: {new Date(task.dueDate).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`task-menu-${task.id}`}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {task.status !== "in_progress" && (
                <DropdownMenuItem onClick={() => onUpdateStatus(task.id, "in_progress")}>
                  Start Task
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onUpdateStatus(task.id, "completed")}>
                Mark Complete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}

function ConditionsWidget({ conditions, collapsed }: { conditions: Array<{ name: string; status: string; severity?: string }>; collapsed?: boolean }) {
  if (collapsed) return null;

  return (
    <div className="space-y-2" data-testid="widget-conditions-content">
      {conditions.map((condition, idx) => (
        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{condition.name}</span>
          </div>
          <Badge variant="outline">{condition.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function NotesWidget({ notes, collapsed }: { notes: Array<{ id: string; content: string; author: string; createdAt: string }>; collapsed?: boolean }) {
  if (collapsed) return null;

  return (
    <div className="space-y-2" data-testid="widget-notes-content">
      {notes.slice(0, 3).map((note) => (
        <div key={note.id} className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm">{note.content}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{note.author}</span>
            <span>-</span>
            <span>{new Date(note.createdAt).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CustomizeLayoutDialog({
  preferences,
  onSave,
  onReset,
  isLoading,
}: {
  preferences: DashboardLayoutPreferences;
  onSave: (widgets: DashboardWidget[]) => void;
  onReset: () => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>(preferences.widgets);

  useEffect(() => {
    setLocalWidgets(preferences.widgets);
  }, [preferences.widgets]);

  const toggleWidget = (widgetId: string) => {
    setLocalWidgets(widgets =>
      widgets.map(w => w.id === widgetId ? { ...w, enabled: !w.enabled } : w)
    );
  };

  const moveWidget = (widgetId: string, direction: "up" | "down") => {
    setLocalWidgets(widgets => {
      const idx = widgets.findIndex(w => w.id === widgetId);
      if (idx === -1) return widgets;
      if (direction === "up" && idx === 0) return widgets;
      if (direction === "down" && idx === widgets.length - 1) return widgets;

      const newWidgets = [...widgets];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [newWidgets[idx].order, newWidgets[swapIdx].order] = [newWidgets[swapIdx].order, newWidgets[idx].order];
      [newWidgets[idx], newWidgets[swapIdx]] = [newWidgets[swapIdx], newWidgets[idx]];
      return newWidgets;
    });
  };

  const changeSize = (widgetId: string, size: "small" | "medium" | "large") => {
    setLocalWidgets(widgets =>
      widgets.map(w => w.id === widgetId ? { ...w, size } : w)
    );
  };

  const handleSave = () => {
    onSave(localWidgets);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-customize-layout">
          <Settings className="h-4 w-4 mr-2" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Customize Dashboard Layout</DialogTitle>
          <DialogDescription>
            Enable, disable, or reorder widgets based on your priorities.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {localWidgets.sort((a, b) => a.order - b.order).map((widget, idx) => (
              <div
                key={widget.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    checked={widget.enabled}
                    onCheckedChange={() => toggleWidget(widget.id)}
                    data-testid={`toggle-widget-${widget.id}`}
                  />
                  <span className={widget.enabled ? "" : "text-muted-foreground"}>
                    {widget.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={widget.size}
                    onValueChange={(val) => changeSize(widget.id, val as any)}
                  >
                    <SelectTrigger className="w-24 h-8" data-testid={`size-select-${widget.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveWidget(widget.id, "up")}
                    disabled={idx === 0}
                    data-testid={`move-up-${widget.id}`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveWidget(widget.id, "down")}
                    disabled={idx === localWidgets.length - 1}
                    data-testid={`move-down-${widget.id}`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onReset} disabled={isLoading} data-testid="button-reset-layout">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isLoading} data-testid="button-save-layout">
            Save Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CaregiverHealthDashboard() {
  const [patientId] = useState(SAMPLE_PATIENT_ID);
  const { toast } = useToast();

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<CaregiverHealthDashboard>({
    queryKey: [`/api/caregiver/health-dashboard/${patientId}`, { caregiverId: SAMPLE_CAREGIVER_ID }],
  });

  const { data: layoutData, isLoading: layoutLoading } = useQuery<DashboardLayoutPreferences>({
    queryKey: [`/api/caregiver/health-dashboard/${patientId}/layout`, { caregiverId: SAMPLE_CAREGIVER_ID }],
  });

  const updateLayoutMutation = useMutation({
    mutationFn: async (widgets: DashboardWidget[]) => {
      const res = await apiRequest("PUT", `/api/caregiver/health-dashboard/${patientId}/layout?caregiverId=${SAMPLE_CAREGIVER_ID}`, { widgets });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/caregiver/health-dashboard/${patientId}/layout`] });
      toast({ title: "Layout Saved", description: "Your dashboard layout has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save layout.", variant: "destructive" });
    },
  });

  const resetLayoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/caregiver/health-dashboard/${patientId}/layout/reset?caregiverId=${SAMPLE_CAREGIVER_ID}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/caregiver/health-dashboard/${patientId}/layout`] });
      toast({ title: "Layout Reset", description: "Dashboard layout has been reset to defaults." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reset layout.", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const res = await apiRequest("PUT", `/api/caregiver/health-dashboard/tasks/${taskId}?caregiverId=${SAMPLE_CAREGIVER_ID}`, { status });
      return res.json();
    },
    onSuccess: () => {
      refetchDashboard();
      toast({ title: "Task Updated", description: "Task status has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/caregiver/health-dashboard/${patientId}/alerts/${alertId}/acknowledge?caregiverId=${SAMPLE_CAREGIVER_ID}`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchDashboard();
      toast({ title: "Alert Acknowledged", description: "The alert has been marked as read." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to acknowledge alert.", variant: "destructive" });
    },
  });

  const [collapsedWidgets, setCollapsedWidgets] = useState<Record<string, boolean>>({});

  const toggleCollapse = (widgetId: string) => {
    setCollapsedWidgets(prev => ({ ...prev, [widgetId]: !prev[widgetId] }));
  };

  if (dashboardLoading || layoutLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" data-testid="dashboard-loading">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const dashboard = dashboardData;
  const layout = layoutData;

  if (!dashboard || !layout) {
    return (
      <div className="container mx-auto p-6" data-testid="dashboard-error">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Unable to load dashboard data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enabledWidgets = layout.widgets
    .filter(w => w.enabled)
    .sort((a, b) => a.order - b.order);

  const renderWidget = (widget: DashboardWidget) => {
    const isCollapsed = collapsedWidgets[widget.id];

    const widgetContent = () => {
      switch (widget.type) {
        case "vitals":
          return <VitalsWidget vitals={dashboard.vitals} collapsed={isCollapsed} />;
        case "medications":
          return <MedicationsWidget medications={dashboard.medications} collapsed={isCollapsed} />;
        case "appointments":
          return <AppointmentsWidget appointments={dashboard.appointments} collapsed={isCollapsed} />;
        case "alerts":
          return (
            <AlertsWidget
              alerts={dashboard.alerts}
              collapsed={isCollapsed}
              onAcknowledge={(alertId) => acknowledgeAlertMutation.mutate(alertId)}
            />
          );
        case "tasks":
          return (
            <TasksWidget
              tasks={dashboard.tasks}
              collapsed={isCollapsed}
              onUpdateStatus={(taskId, status) => updateTaskMutation.mutate({ taskId, status })}
            />
          );
        case "conditions":
          return <ConditionsWidget conditions={dashboard.conditions} collapsed={isCollapsed} />;
        case "notes":
          return <NotesWidget notes={dashboard.recentNotes} collapsed={isCollapsed} />;
        default:
          return <p className="text-muted-foreground">Widget not available</p>;
      }
    };

    const sizeClass = widget.size === "large" ? "lg:col-span-2" : widget.size === "small" ? "" : "";

    return (
      <Card key={widget.id} className={sizeClass} data-testid={`widget-${widget.id}`}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-lg">{widget.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleCollapse(widget.id)}
            data-testid={`toggle-collapse-${widget.id}`}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent>{widgetContent()}</CardContent>
      </Card>
    );
  };

  const urgentAlertCount = dashboard.alerts.filter(a => a.priority === "urgent" || a.priority === "high").length;
  const pendingTaskCount = dashboard.tasks.filter(t => t.status === "pending" || t.status === "overdue").length;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="caregiver-health-dashboard">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="patient-name">{dashboard.patientName}</h1>
              <p className="text-muted-foreground">{dashboard.relationship}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {urgentAlertCount > 0 && (
            <Badge variant="destructive" className="gap-1" data-testid="urgent-alert-badge">
              <BellRing className="h-3 w-3" />
              {urgentAlertCount} Urgent Alert{urgentAlertCount > 1 ? "s" : ""}
            </Badge>
          )}
          {pendingTaskCount > 0 && (
            <Badge variant="secondary" className="gap-1" data-testid="pending-task-badge">
              <ClipboardList className="h-3 w-3" />
              {pendingTaskCount} Pending Task{pendingTaskCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => refetchDashboard()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <CustomizeLayoutDialog
            preferences={layout}
            onSave={(widgets) => updateLayoutMutation.mutate(widgets)}
            onReset={() => resetLayoutMutation.mutate()}
            isLoading={updateLayoutMutation.isPending || resetLayoutMutation.isPending}
          />
        </div>
      </div>

      {dashboard.overallHealthScore !== undefined && (
        <Card data-testid="health-score-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Health Score</p>
                <p className="text-3xl font-bold">{dashboard.overallHealthScore}</p>
              </div>
              <div className="w-32">
                <Progress value={dashboard.overallHealthScore} className="h-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {enabledWidgets.map(renderWidget)}
      </div>

      <div className="text-xs text-muted-foreground text-center" data-testid="last-updated">
        Last updated: {new Date(dashboard.lastUpdated).toLocaleString()}
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-caregiver-health-dashboard-disclaimer" />
    </div>
  );
}