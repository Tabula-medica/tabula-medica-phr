import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Play, Pause, Square, Plus, Trash2, Settings, Eye, Download, GitMerge,
  CheckCircle, XCircle, Clock, ArrowRight, Sparkles, FileText, Bell,
  GitBranch, Layers, UserCheck, BarChart, Shuffle, RefreshCw, AlertTriangle,
  ChevronRight, Activity, Zap, Layout, Database, AlertCircle
} from "lucide-react";

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: string;
  order: number;
  position: { x: number; y: number };
  config: Record<string, any>;
  dependencies?: string[];
  estimatedDurationSeconds?: number;
}

interface WorkflowConnection {
  sourceStepId: string;
  targetStepId: string;
  label?: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  status: string;
  triggers: Array<{ type: string; config: Record<string, any> }>;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  autoRetry?: boolean;
  notifyOnComplete?: boolean;
  notifyOnFailure?: boolean;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  triggeredBy: string;
  triggerType: string;
  currentStepId?: string;
  steps: Array<{
    stepId: string;
    stepName: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    metrics?: Record<string, any>;
    aiAnalysis?: { summary: string; insights: string[]; recommendations: string[] };
  }>;
  progress: number;
  startedAt: string;
  completedAt?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Omit<WorkflowStep, "id">[];
  tags: string[];
}

const stepTypeIcons: Record<string, any> = {
  data_ingestion: Download,
  validation: CheckCircle,
  harmonization: GitMerge,
  transformation: Shuffle,
  enrichment: Sparkles,
  quality_check: BarChart,
  report_generation: FileText,
  notification: Bell,
  condition: GitBranch,
  parallel: Layers,
  delay: Clock,
  manual_review: UserCheck
};

const stepTypeColors: Record<string, string> = {
  data_ingestion: "bg-blue-500",
  validation: "bg-green-500",
  harmonization: "bg-purple-500",
  transformation: "bg-orange-500",
  enrichment: "bg-pink-500",
  quality_check: "bg-cyan-500",
  report_generation: "bg-indigo-500",
  notification: "bg-yellow-500",
  condition: "bg-red-500",
  parallel: "bg-teal-500",
  delay: "bg-gray-500",
  manual_review: "bg-amber-500"
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-500",
  running: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-orange-500",
  paused: "bg-yellow-500",
  skipped: "bg-gray-400"
};

export default function AIFHIRWorkflowBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("builder");
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const { data: metadata } = useQuery<any>({
    queryKey: ["/api/fhir-workflow-orchestrator/metadata"]
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<any>({
    queryKey: ["/api/fhir-workflow-orchestrator/dashboard"]
  });

  const { data: workflowsData, isLoading: workflowsLoading } = useQuery<any>({
    queryKey: ["/api/fhir-workflow-orchestrator/workflows"]
  });

  const { data: templatesData } = useQuery<any>({
    queryKey: ["/api/fhir-workflow-orchestrator/templates"]
  });

  const { data: executionsData, isLoading: executionsLoading } = useQuery<any>({
    queryKey: ["/api/fhir-workflow-orchestrator/executions"]
  });

  const triggerWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest("POST", `/api/fhir-workflow-orchestrator/workflows/${workflowId}/trigger`, { triggeredBy: "user", context: {} });
    },
    onSuccess: () => {
      toast({ title: "Workflow Started", description: "The workflow has been triggered successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/executions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to trigger workflow.", variant: "destructive" });
    }
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async ({ templateId, name }: { templateId: string; name: string }) => {
      return apiRequest("POST", `/api/fhir-workflow-orchestrator/templates/${templateId}/create-workflow`, { name, createdBy: "user" });
    },
    onSuccess: () => {
      toast({ title: "Workflow Created", description: "New workflow created from template." });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/dashboard"] });
      setIsCreateDialogOpen(false);
      setNewWorkflowName("");
      setSelectedTemplateId("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create workflow.", variant: "destructive" });
    }
  });

  const activateWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest("PATCH", `/api/fhir-workflow-orchestrator/workflows/${workflowId}`, { status: "active" });
    },
    onSuccess: () => {
      toast({ title: "Workflow Activated", description: "The workflow is now active." });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/dashboard"] });
    }
  });

  const workflows = workflowsData?.workflows || [];
  const templates = templatesData?.templates || [];
  const executions = executionsData?.executions || [];
  const dashboard = dashboardData;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Zap className="h-8 w-8 text-primary" />
              AI FHIR Workflow Orchestrator
            </h1>
            <p className="text-muted-foreground mt-1">
              Build, monitor, and automate complex FHIR data workflows with AI-powered orchestration
            </p>
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
              <AlertCircle className="h-3 w-3 inline mr-1" />
              NO-CDS COMPLIANCE: This tool is for data governance and operational purposes only. Not for clinical decision-making.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/workflows"] });
                queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/templates"] });
                queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/executions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-orchestrator/dashboard"] });
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-workflow">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Workflow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Workflow</DialogTitle>
                  <DialogDescription>
                    Start from a template or create a blank workflow
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Workflow Name</Label>
                    <Input
                      value={newWorkflowName}
                      onChange={(e) => setNewWorkflowName(e.target.value)}
                      placeholder="Enter workflow name..."
                      data-testid="input-workflow-name"
                    />
                  </div>
                  <div>
                    <Label>Start from Template</Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template: WorkflowTemplate) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTemplateId && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Template Preview</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        {templates.find((t: WorkflowTemplate) => t.id === selectedTemplateId) && (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              {templates.find((t: WorkflowTemplate) => t.id === selectedTemplateId)?.description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {templates.find((t: WorkflowTemplate) => t.id === selectedTemplateId)?.tags.map((tag: string) => (
                                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedTemplateId && newWorkflowName) {
                        createFromTemplateMutation.mutate({ templateId: selectedTemplateId, name: newWorkflowName });
                      }
                    }}
                    disabled={!selectedTemplateId || !newWorkflowName || createFromTemplateMutation.isPending}
                    data-testid="button-confirm-create"
                  >
                    {createFromTemplateMutation.isPending ? "Creating..." : "Create Workflow"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Workflows</p>
                    <p className="text-2xl font-bold" data-testid="text-total-workflows">{dashboard.summary?.totalWorkflows || 0}</p>
                  </div>
                  <Layout className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-active-workflows">{dashboard.summary?.activeWorkflows || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Running</p>
                    <p className="text-2xl font-bold text-blue-600" data-testid="text-running-executions">{dashboard.summary?.runningExecutions || 0}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Completed Today</p>
                    <p className="text-2xl font-bold" data-testid="text-completed-today">{dashboard.summary?.completedToday || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Failed Today</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-failed-today">{dashboard.summary?.failedToday || 0}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold" data-testid="text-avg-duration">{dashboard.summary?.avgExecutionTime?.toFixed(1) || 0}m</p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="builder" data-testid="tab-builder">
              <Layout className="h-4 w-4 mr-2" />
              Workflow Builder
            </TabsTrigger>
            <TabsTrigger value="monitoring" data-testid="tab-monitoring">
              <Activity className="h-4 w-4 mr-2" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Workflows</CardTitle>
                  <CardDescription>Select a workflow to view or edit</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {workflowsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading workflows...</p>
                      ) : workflows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No workflows yet. Create one from a template.</p>
                      ) : (
                        workflows.map((workflow: WorkflowDefinition) => (
                          <div
                            key={workflow.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors hover-elevate ${
                              selectedWorkflow?.id === workflow.id ? "border-primary bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedWorkflow(workflow)}
                            data-testid={`workflow-item-${workflow.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{workflow.name}</p>
                                <p className="text-xs text-muted-foreground">{workflow.category}</p>
                              </div>
                              <Badge variant={workflow.status === "active" ? "default" : "secondary"}>
                                {workflow.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">
                                {workflow.steps?.length || 0} steps
                              </span>
                              <span className="text-xs text-muted-foreground">v{workflow.version}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {selectedWorkflow ? selectedWorkflow.name : "Workflow Canvas"}
                      </CardTitle>
                      <CardDescription>
                        {selectedWorkflow ? selectedWorkflow.description : "Select a workflow to view its steps"}
                      </CardDescription>
                    </div>
                    {selectedWorkflow && (
                      <div className="flex items-center gap-2">
                        {selectedWorkflow.status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => activateWorkflowMutation.mutate(selectedWorkflow.id)}
                            data-testid="button-activate-workflow"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        {selectedWorkflow.status === "active" && (
                          <Button
                            size="sm"
                            onClick={() => triggerWorkflowMutation.mutate(selectedWorkflow.id)}
                            disabled={triggerWorkflowMutation.isPending}
                            data-testid="button-run-workflow"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Run Now
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedWorkflow ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedWorkflow.tags?.map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>

                      <div className="bg-muted/30 rounded-lg p-4 min-h-[300px] overflow-x-auto">
                        <div className="flex items-center gap-4 flex-nowrap">
                          {selectedWorkflow.steps?.map((step, index) => {
                            const StepIcon = stepTypeIcons[step.type] || Database;
                            const colorClass = stepTypeColors[step.type] || "bg-gray-500";
                            
                            return (
                              <div key={step.id} className="flex items-center gap-4">
                                <div className="flex flex-col items-center gap-2 min-w-[140px]">
                                  <div
                                    className={`${colorClass} w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-md`}
                                  >
                                    <StepIcon className="h-6 w-6" />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-sm font-medium">{step.name}</p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                      {step.type.replace(/_/g, " ")}
                                    </p>
                                    {step.estimatedDurationSeconds && (
                                      <p className="text-xs text-muted-foreground">
                                        ~{Math.round(step.estimatedDurationSeconds / 60)}min
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {index < selectedWorkflow.steps.length - 1 && (
                                  <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Triggers</Label>
                          <div className="mt-1 space-y-1">
                            {selectedWorkflow.triggers?.map((trigger, i) => (
                              <Badge key={i} variant="secondary" className="mr-1">
                                {trigger.type}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Settings</Label>
                          <div className="mt-1 text-sm text-muted-foreground">
                            <p>Auto-retry: {selectedWorkflow.autoRetry ? "Yes" : "No"}</p>
                            <p>Notify on complete: {selectedWorkflow.notifyOnComplete ? "Yes" : "No"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <Layout className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Select a workflow from the list or create a new one
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {metadata?.stepTypes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Available Step Types</CardTitle>
                  <CardDescription>Drag these into your workflow canvas to build automation pipelines</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {metadata.stepTypes.map((stepType: any) => {
                      const StepIcon = stepTypeIcons[stepType.type] || Database;
                      const colorClass = stepTypeColors[stepType.type] || "bg-gray-500";
                      return (
                        <div
                          key={stepType.type}
                          className="p-3 border rounded-lg hover-elevate cursor-grab"
                          data-testid={`step-type-${stepType.type}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`${colorClass} w-8 h-8 rounded flex items-center justify-center text-white`}>
                              <StepIcon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium">{stepType.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{stepType.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Executions</CardTitle>
                  <CardDescription>Track workflow execution progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {executionsLoading ? (
                        <p className="text-sm text-muted-foreground">Loading executions...</p>
                      ) : executions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No executions yet.</p>
                      ) : (
                        executions.map((execution: WorkflowExecution) => (
                          <div
                            key={execution.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors hover-elevate ${
                              selectedExecution?.id === execution.id ? "border-primary bg-primary/5" : ""
                            }`}
                            onClick={() => setSelectedExecution(execution)}
                            data-testid={`execution-item-${execution.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{execution.workflowName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Triggered: {new Date(execution.startedAt).toLocaleString()}
                                </p>
                              </div>
                              <Badge className={statusColors[execution.status]}>
                                {execution.status}
                              </Badge>
                            </div>
                            <div className="mt-2">
                              <Progress value={execution.progress} className="h-2" />
                              <p className="text-xs text-muted-foreground mt-1">{execution.progress}% complete</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Execution Details</CardTitle>
                  <CardDescription>
                    {selectedExecution ? selectedExecution.workflowName : "Select an execution to view details"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedExecution ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge className={statusColors[selectedExecution.status]} variant="outline">
                          {selectedExecution.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {selectedExecution.progress}% complete
                        </span>
                      </div>

                      <Progress value={selectedExecution.progress} />

                      <Separator />

                      <ScrollArea className="h-[350px]">
                        <div className="space-y-3">
                          {selectedExecution.steps.map((step, index) => {
                            const StepIcon = statusColors[step.status] ? CheckCircle : Clock;
                            return (
                              <div key={step.stepId} className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 ${statusColors[step.status] || "bg-gray-400"}`}>
                                  {step.status === "completed" ? (
                                    <CheckCircle className="h-4 w-4" />
                                  ) : step.status === "running" ? (
                                    <Activity className="h-4 w-4 animate-pulse" />
                                  ) : step.status === "failed" ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : (
                                    <span className="text-xs">{index + 1}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">{step.stepName}</p>
                                  {step.metrics && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                      {step.metrics.recordsProcessed && (
                                        <p>Records: {step.metrics.recordsProcessed.toLocaleString()}</p>
                                      )}
                                      {step.metrics.qualityScore && (
                                        <p>Quality: {step.metrics.qualityScore.toFixed(1)}%</p>
                                      )}
                                      {step.metrics.durationMs && (
                                        <p>Duration: {(step.metrics.durationMs / 1000).toFixed(1)}s</p>
                                      )}
                                    </div>
                                  )}
                                  {step.aiAnalysis && (
                                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                                      <p className="font-medium flex items-center gap-1">
                                        <Sparkles className="h-3 w-3" /> AI Analysis
                                      </p>
                                      <p className="mt-1">{step.aiAnalysis.summary}</p>
                                      {step.aiAnalysis.insights?.length > 0 && (
                                        <ul className="mt-1 list-disc list-inside text-muted-foreground">
                                          {step.aiAnalysis.insights.slice(0, 2).map((insight, i) => (
                                            <li key={i}>{insight}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[400px] text-center">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Select an execution from the list to view details
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template: WorkflowTemplate) => (
                <Card key={template.id} className="hover-elevate">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1">{template.category}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>{template.steps?.length || 0} steps</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setIsCreateDialogOpen(true);
                      }}
                      data-testid={`button-use-template-${template.id}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Use Template
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Important Compliance Notice</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1">
                  This AI-driven FHIR workflow automation is for DATA QUALITY, GOVERNANCE, and OPERATIONAL purposes ONLY. 
                  It does NOT provide clinical decision support, treatment recommendations, or medical advice. 
                  All outputs must be reviewed by qualified personnel.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
