import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import { 
  GitBranch, 
  Play, 
  Pause,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Bell,
  Settings,
  ChevronRight,
  ListTodo,
  Zap,
  Target,
  ArrowRight,
  RefreshCw,
  User,
  Calendar,
  FileText,
  Send
} from "lucide-react";

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: string;
  order: number;
  config: Record<string, any>;
  dependencies?: string[];
}

interface WorkflowTrigger {
  type: string;
  config: Record<string, any>;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  status: string;
  triggers: WorkflowTrigger[];
  steps: WorkflowStep[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  tags: string[];
  estimatedDurationMinutes?: number;
  autoRetry: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
}

interface StepInstance {
  stepId: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  assignedTo?: string;
  assignedToName?: string;
  result?: any;
  notes?: string;
  error?: string;
  retryCount: number;
}

interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  triggeredBy: string;
  triggerType: string;
  triggerContext: Record<string, any>;
  patientId?: string;
  patientName?: string;
  currentStepId?: string;
  steps: StepInstance[];
  priority: string;
  startedAt: string;
  completedAt?: string;
  dueAt?: string;
  lastActivityAt: string;
}

interface WorkflowTask {
  id: string;
  instanceId: string;
  workflowName: string;
  stepId: string;
  stepName: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  assignedRole: string;
  priority: string;
  status: string;
  patientId?: string;
  patientName?: string;
  dueAt?: string;
  createdAt: string;
  completedAt?: string;
  formData?: Record<string, any>;
  notes?: string;
}

interface DashboardData {
  summary: {
    totalWorkflows: number;
    activeWorkflows: number;
    runningInstances: number;
    completedToday: number;
    pendingTasks: number;
    overdueTasksCount: number;
  };
  recentInstances: WorkflowInstance[];
  pendingTasks: WorkflowTask[];
  performanceMetrics: {
    avgCompletionTimeMinutes: number;
    completionRate: number;
    onTimeRate: number;
  };
  noCdsDisclaimer: string;
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "active":
    case "running":
    case "completed":
    case "healthy":
      return "bg-green-500/15 text-green-700";
    case "pending":
    case "in_progress":
      return "bg-blue-500/15 text-blue-700";
    case "paused":
    case "on_hold":
      return "bg-yellow-500/15 text-yellow-700";
    case "failed":
    case "critical":
    case "overdue":
      return "bg-red-500/15 text-red-700";
    case "draft":
    case "archived":
      return "bg-gray-500/15 text-gray-700";
    default:
      return "bg-gray-500/15 text-gray-700";
  }
}

function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case "critical":
      return "bg-red-500/15 text-red-700";
    case "high":
      return "bg-orange-500/15 text-orange-700";
    case "medium":
      return "bg-yellow-500/15 text-yellow-700";
    case "low":
      return "bg-green-500/15 text-green-700";
    default:
      return "bg-gray-500/15 text-gray-700";
  }
}

function getTriggerIcon(type: string) {
  switch (type) {
    case "clinical_rule":
      return <Target className="h-4 w-4" />;
    case "ai_insight":
      return <Zap className="h-4 w-4" />;
    case "schedule":
      return <Calendar className="h-4 w-4" />;
    case "fhir_event":
      return <GitBranch className="h-4 w-4" />;
    case "alert_threshold":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Play className="h-4 w-4" />;
  }
}

function getStepTypeIcon(type: string) {
  switch (type) {
    case "task":
      return <ListTodo className="h-4 w-4" />;
    case "notification":
      return <Bell className="h-4 w-4" />;
    case "approval":
      return <CheckCircle className="h-4 w-4" />;
    case "condition":
      return <GitBranch className="h-4 w-4" />;
    case "delay":
      return <Clock className="h-4 w-4" />;
    default:
      return <ArrowRight className="h-4 w-4" />;
  }
}

function WorkflowCard({ 
  workflow, 
  onView 
}: { 
  workflow: WorkflowDefinition; 
  onView: () => void;
}) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onView} data-testid={`card-workflow-${workflow.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{workflow.name}</CardTitle>
          </div>
          <Badge className={getStatusColor(workflow.status)}>
            {workflow.status}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">{workflow.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <ListTodo className="h-3 w-3" />
            <span>{workflow.steps.length} steps</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>{workflow.triggers.length} trigger(s)</span>
          </div>
          <Badge variant="outline">{workflow.category}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {workflow.triggers.map((trigger, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {getTriggerIcon(trigger.type)}
              <span className="ml-1">{trigger.type.replace(/_/g, " ")}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ 
  task, 
  onComplete,
  isCompleting
}: { 
  task: WorkflowTask; 
  onComplete: (taskId: string, notes?: string) => void;
  isCompleting: boolean;
}) {
  const [notes, setNotes] = useState("");
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();

  return (
    <Card className={isOverdue ? "border-red-300" : ""} data-testid={`card-task-${task.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{task.stepName}</CardTitle>
            <CardDescription className="text-sm">{task.workflowName}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
            <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{task.description}</p>
        
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{task.assignedToName}</span>
          </div>
          {task.patientName && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>Patient: {task.patientName}</span>
            </div>
          )}
          {task.dueAt && (
            <div className={`flex items-center gap-1 ${isOverdue ? "text-red-600" : ""}`}>
              <Clock className="h-3 w-3" />
              <span>Due: {new Date(task.dueAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {task.status !== "completed" && (
          <div className="space-y-2 pt-2">
            <Textarea 
              placeholder="Add notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
              data-testid={`textarea-notes-${task.id}`}
            />
            <Button 
              size="sm" 
              onClick={() => onComplete(task.id, notes)}
              disabled={isCompleting}
              data-testid={`button-complete-task-${task.id}`}
            >
              {isCompleting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Complete Task
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InstanceProgress({ instance, workflow }: { instance: WorkflowInstance; workflow?: WorkflowDefinition }) {
  const completedSteps = instance.steps.filter(s => s.status === "completed").length;
  const totalSteps = instance.steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <Card data-testid={`card-instance-${instance.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{instance.workflowName}</CardTitle>
            {instance.patientName && (
              <CardDescription>Patient: {instance.patientName}</CardDescription>
            )}
          </div>
          <div className="flex gap-2">
            <Badge className={getPriorityColor(instance.priority)}>{instance.priority}</Badge>
            <Badge className={getStatusColor(instance.status)}>{instance.status}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>Progress</span>
            <span>{completedSteps} / {totalSteps} steps</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="space-y-2">
          {instance.steps.map((step, idx) => {
            const stepDef = workflow?.steps.find(s => s.id === step.stepId);
            return (
              <div 
                key={step.stepId}
                className={`flex items-center gap-3 rounded-md p-2 ${
                  step.status === "completed" ? "bg-green-500/10" :
                  step.status === "in_progress" ? "bg-blue-500/10" :
                  "bg-muted/50"
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  step.status === "completed" ? "bg-green-500 text-white" :
                  step.status === "in_progress" ? "bg-blue-500 text-white" :
                  "bg-muted-foreground/20"
                }`}>
                  {step.status === "completed" ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{stepDef?.name || `Step ${idx + 1}`}</p>
                  {step.assignedToName && (
                    <p className="text-xs text-muted-foreground">Assigned to: {step.assignedToName}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {getStepTypeIcon(stepDef?.type || "task")}
                  <span className="ml-1">{stepDef?.type || "task"}</span>
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Started: {new Date(instance.startedAt).toLocaleString()}</span>
          <span>Trigger: {instance.triggerType.replace(/_/g, " ")}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClinicalWorkflowAutomation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/workflow-orchestrator/dashboard"]
  });

  const { data: workflowsData } = useQuery<{ workflows: WorkflowDefinition[] }>({
    queryKey: ["/api/workflow-orchestrator/workflows"]
  });

  const { data: instancesData } = useQuery<{ instances: WorkflowInstance[] }>({
    queryKey: ["/api/workflow-orchestrator/instances"]
  });

  const { data: tasksData } = useQuery<{ tasks: WorkflowTask[] }>({
    queryKey: ["/api/workflow-orchestrator/tasks"]
  });

  const triggerMutation = useMutation({
    mutationFn: async ({ workflowId, context }: { workflowId: string; context: any }) => {
      return apiRequest("POST", `/api/workflow-orchestrator/workflows/${workflowId}/trigger`, {
        triggerType: "manual",
        context
      });
    },
    onSuccess: () => {
      toast({ title: "Workflow triggered", description: "A new workflow instance has been started" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-orchestrator"] });
    },
    onError: () => {
      toast({ title: "Failed to trigger workflow", variant: "destructive" });
    }
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/workflow-orchestrator/tasks/${taskId}`, {
        status: "completed",
        notes
      });
    },
    onSuccess: () => {
      toast({ title: "Task completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-orchestrator"] });
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    }
  });

  if (dashboardLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-7xl space-y-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Clinical Workflow Automation</h1>
          <p className="text-muted-foreground">
            Design, manage, and monitor multi-step clinical workflows with automated task assignment and notifications
          </p>
        </div>

        {dashboard?.noCdsDisclaimer && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Operational Tool Notice</AlertTitle>
            <AlertDescription className="text-sm">
              {dashboard.noCdsDisclaimer}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-workflow-automation" className="flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="workflows" data-testid="tab-workflows">
              <GitBranch className="mr-1 h-4 w-4" />
              Workflows
            </TabsTrigger>
            <TabsTrigger value="instances" data-testid="tab-instances">
              <Play className="mr-1 h-4 w-4" />
              Active Instances
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">
              <ListTodo className="mr-1 h-4 w-4" />
              Tasks
              {dashboard && dashboard.summary.pendingTasks > 0 && (
                <Badge className="ml-2 bg-blue-500/15 text-blue-700">
                  {dashboard.summary.pendingTasks}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Workflows</CardDescription>
                  <CardTitle className="text-3xl" data-testid="text-total-workflows">
                    {dashboard?.summary.totalWorkflows || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Workflows</CardDescription>
                  <CardTitle className="text-3xl text-green-600">
                    {dashboard?.summary.activeWorkflows || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Running Instances</CardDescription>
                  <CardTitle className="text-3xl text-blue-600">
                    {dashboard?.summary.runningInstances || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Completed Today</CardDescription>
                  <CardTitle className="text-3xl text-green-600">
                    {dashboard?.summary.completedToday || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending Tasks</CardDescription>
                  <CardTitle className="text-3xl text-yellow-600">
                    {dashboard?.summary.pendingTasks || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Overdue Tasks</CardDescription>
                  <CardTitle className="text-3xl text-red-600">
                    {dashboard?.summary.overdueTasksCount || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Running Workflows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard?.recentInstances.filter(i => i.status === "running").slice(0, 5).map((instance) => (
                      <div 
                        key={instance.id} 
                        className="flex items-center justify-between rounded-lg border p-3 hover-elevate cursor-pointer"
                        {...clickable(() => {
                          setSelectedInstance(instance);
                          setActiveTab("instances");
                        })}
                      >
                        <div>
                          <p className="font-medium">{instance.workflowName}</p>
                          <p className="text-sm text-muted-foreground">
                            {instance.patientName || "No patient"} - Started {new Date(instance.startedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(instance.priority)}>{instance.priority}</Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                    {(!dashboard?.recentInstances || dashboard.recentInstances.filter(i => i.status === "running").length === 0) && (
                      <p className="text-center text-muted-foreground">No running workflows</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    Pending Tasks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard?.pendingTasks.slice(0, 5).map((task) => (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between rounded-lg border p-3 hover-elevate cursor-pointer"
                        {...clickable(() => setActiveTab("tasks"))}
                      >
                        <div>
                          <p className="font-medium">{task.stepName}</p>
                          <p className="text-sm text-muted-foreground">
                            {task.assignedToName} - {task.workflowName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          {task.dueAt && new Date(task.dueAt) < new Date() && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!dashboard?.pendingTasks || dashboard.pendingTasks.length === 0) && (
                      <p className="text-center text-muted-foreground">No pending tasks</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-3xl font-bold text-primary">
                      {dashboard?.performanceMetrics.avgCompletionTimeMinutes || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg. Completion Time (min)</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {((dashboard?.performanceMetrics.completionRate || 0) * 100).toFixed(0)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {((dashboard?.performanceMetrics.onTimeRate || 0) * 100).toFixed(0)}%
                    </p>
                    <p className="text-sm text-muted-foreground">On-Time Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6">
            {selectedWorkflow ? (
              <div className="space-y-6">
                <Button variant="ghost" onClick={() => setSelectedWorkflow(null)} data-testid="button-back-to-workflows">
                  <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                  Back to Workflows
                </Button>

                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <GitBranch className="h-5 w-5" />
                          {selectedWorkflow.name}
                        </CardTitle>
                        <CardDescription className="mt-1">{selectedWorkflow.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(selectedWorkflow.status)}>{selectedWorkflow.status}</Badge>
                        <Badge variant="outline">v{selectedWorkflow.version}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{selectedWorkflow.category}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Steps</p>
                        <p className="font-medium">{selectedWorkflow.steps.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Est. Duration</p>
                        <p className="font-medium">{selectedWorkflow.estimatedDurationMinutes || "N/A"} min</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Published</p>
                        <p className="font-medium">
                          {selectedWorkflow.publishedAt 
                            ? new Date(selectedWorkflow.publishedAt).toLocaleDateString() 
                            : "Not published"}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="mb-3 font-medium">Triggers</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedWorkflow.triggers.map((trigger, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1">
                            {getTriggerIcon(trigger.type)}
                            {trigger.type.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="mb-3 font-medium">Workflow Steps</h4>
                      <div className="space-y-3">
                        {selectedWorkflow.steps.sort((a, b) => a.order - b.order).map((step, idx) => (
                          <div key={step.id} className="flex items-start gap-3 rounded-lg border p-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{step.name}</p>
                                <Badge variant="outline" className="gap-1">
                                  {getStepTypeIcon(step.type)}
                                  {step.type}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                              {step.config.assigneeRole && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Assigned to: {step.config.assigneeRole}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedWorkflow.status === "active" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button data-testid="button-trigger-workflow">
                            <Play className="mr-2 h-4 w-4" />
                            Trigger Workflow
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Trigger Workflow</DialogTitle>
                            <DialogDescription>
                              Start a new instance of {selectedWorkflow.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                              <Label htmlFor="patientId">Patient ID (optional)</Label>
                              <Input id="patientId" placeholder="Enter patient ID" data-testid="input-patient-id" />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="patientName">Patient Name (optional)</Label>
                              <Input id="patientName" placeholder="Enter patient name" data-testid="input-patient-name" />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="clinical-workflow-automa-priority">Priority</Label>
                              <Select defaultValue="medium">
                                <SelectTrigger id="clinical-workflow-automa-priority" data-testid="select-priority">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="critical">Critical</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              onClick={() => triggerMutation.mutate({ 
                                workflowId: selectedWorkflow.id, 
                                context: { priority: "medium" } 
                              })}
                              disabled={triggerMutation.isPending}
                              data-testid="button-confirm-trigger"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start Workflow
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {workflowsData?.workflows.map((workflow) => (
                  <WorkflowCard 
                    key={workflow.id} 
                    workflow={workflow} 
                    onView={() => setSelectedWorkflow(workflow)}
                  />
                ))}
                {(!workflowsData?.workflows || workflowsData.workflows.length === 0) && (
                  <div className="col-span-full text-center text-muted-foreground">
                    No workflows defined
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="instances" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {instancesData?.instances.map((instance) => (
                <InstanceProgress 
                  key={instance.id} 
                  instance={instance}
                  workflow={workflowsData?.workflows.find(w => w.id === instance.workflowId)}
                />
              ))}
              {(!instancesData?.instances || instancesData.instances.length === 0) && (
                <div className="col-span-full text-center text-muted-foreground">
                  No workflow instances
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {tasksData?.tasks.map((task) => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  onComplete={(taskId, notes) => completeTaskMutation.mutate({ taskId, notes })}
                  isCompleting={completeTaskMutation.isPending}
                />
              ))}
              {(!tasksData?.tasks || tasksData.tasks.length === 0) && (
                <div className="col-span-full text-center text-muted-foreground">
                  No tasks assigned
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
