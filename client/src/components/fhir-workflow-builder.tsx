import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Wand2,
  Play,
  Pause,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  Zap,
  GitBranch,
  Bell,
  Clock,
  Settings,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  ArrowRight,
  FileText,
  User,
  Pill,
  Stethoscope,
  ClipboardList,
  Mail,
  Flag,
  Globe,
  UserCheck,
  List,
  FilePlus,
  FileEdit,
  PlusCircle,
  Edit,
  TrendingUp,
  Link,
  RefreshCw,
} from "lucide-react";

interface TriggerCondition {
  id: string;
  field: string;
  operator: string;
  value: string | number | boolean | string[];
  valueType: string;
}

interface WorkflowTrigger {
  id: string;
  type: string;
  name: string;
  description: string;
  resourceType?: string;
  conditions: TriggerCondition[];
  schedule?: {
    cron?: string;
    interval?: string;
    timezone?: string;
  };
}

interface WorkflowActionConfig {
  targetResourceType?: string;
  template?: Record<string, unknown>;
  alertType?: string;
  alertRecipients?: string[];
  alertMessage?: string;
  webhookUrl?: string;
  webhookMethod?: string;
  assigneeId?: string;
  flagCode?: string;
  logLevel?: string;
}

interface WorkflowAction {
  id: string;
  type: string;
  name: string;
  description: string;
  order: number;
  config: WorkflowActionConfig;
  conditions?: TriggerCondition[];
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  version: number;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
  executionCount: number;
  lastExecutedAt?: string;
  tags: string[];
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  actionResults: Array<{
    actionId: string;
    status: string;
    result?: unknown;
    error?: string;
  }>;
}

interface AIWorkflowSuggestion {
  workflow: Partial<Workflow>;
  explanation: string;
  suggestedEnhancements?: string[];
  potentialIssues?: string[];
}

interface Statistics {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  successRate: number;
  recentExecutions: WorkflowExecution[];
}

const TRIGGER_ICONS: Record<string, typeof Zap> = {
  resource_created: PlusCircle,
  resource_updated: Edit,
  resource_deleted: Trash2,
  value_threshold: AlertTriangle,
  value_change: TrendingUp,
  schedule: Clock,
  manual: Play,
  webhook: Link,
};

const ACTION_ICONS: Record<string, typeof Bell> = {
  create_resource: FilePlus,
  update_resource: FileEdit,
  send_alert: Bell,
  send_notification: Mail,
  generate_careplan: ClipboardList,
  generate_summary: FileText,
  call_webhook: Globe,
  assign_task: UserCheck,
  update_flag: Flag,
  log_event: List,
};

const RESOURCE_ICONS: Record<string, typeof User> = {
  Patient: User,
  Observation: Activity,
  MedicationRequest: Pill,
  Condition: Stethoscope,
  CarePlan: ClipboardList,
};

export function FHIRWorkflowBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("workflows");
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [aiDescription, setAiDescription] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<AIWorkflowSuggestion | null>(null);

  const { data: workflows = [], refetch: refetchWorkflows } = useQuery<Workflow[]>({
    queryKey: ["/api/fhir-workflow-builder/workflows"],
  });

  const { data: statistics } = useQuery<Statistics>({
    queryKey: ["/api/fhir-workflow-builder/statistics"],
  });

  const { data: executions = [] } = useQuery<WorkflowExecution[]>({
    queryKey: ["/api/fhir-workflow-builder/executions"],
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/fhir-workflow-builder/workflows/${id}/toggle`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/statistics"] });
      toast({ title: "Workflow Updated", description: "Workflow status toggled successfully" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/fhir-workflow-builder/workflows/${id}/execute`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/executions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/statistics"] });
      toast({ title: "Workflow Executed", description: "Workflow execution started" });
    },
    onError: (error: Error) => {
      toast({ title: "Execution Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-workflow-builder/workflows/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/statistics"] });
      toast({ title: "Workflow Deleted", description: "Workflow removed successfully" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await apiRequest("POST", "/api/fhir-workflow-builder/ai/generate", {
        description,
        context: {
          existingWorkflows: workflows.map(w => w.name),
        },
      });
      return response.json();
    },
    onSuccess: (data: AIWorkflowSuggestion) => {
      setAiSuggestion(data);
      toast({ title: "Workflow Generated", description: "AI has created a workflow suggestion" });
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const createFromSuggestionMutation = useMutation({
    mutationFn: async (suggestion: AIWorkflowSuggestion) => {
      const response = await apiRequest("POST", "/api/fhir-workflow-builder/workflows", {
        ...suggestion.workflow,
        isEnabled: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/statistics"] });
      setAiSuggestion(null);
      setAiDescription("");
      setActiveTab("workflows");
      toast({ title: "Workflow Created", description: "New workflow has been created from AI suggestion" });
    },
  });

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedWorkflows(newExpanded);
  };

  const getTriggerIcon = (type: string) => {
    const Icon = TRIGGER_ICONS[type] || Zap;
    return <Icon className="h-4 w-4" />;
  };

  const getActionIcon = (type: string) => {
    const Icon = ACTION_ICONS[type] || Settings;
    return <Icon className="h-4 w-4" />;
  };

  const getResourceIcon = (type: string) => {
    const Icon = RESOURCE_ICONS[type] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "running":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">FHIR Workflow Builder</h1>
          <p className="text-muted-foreground">
            Create automated workflows for FHIR resource management with AI assistance
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Sparkles className="h-3 w-3" />
          AI-Powered
        </Badge>
      </div>

      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <GitBranch className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalWorkflows}</p>
                  <p className="text-sm text-muted-foreground">Total Workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.activeWorkflows}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalExecutions}</p>
                  <p className="text-sm text-muted-foreground">Executions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.successRate}%</p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            <GitBranch className="h-4 w-4 mr-2" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="ai-builder" data-testid="tab-ai-builder">
            <Wand2 className="h-4 w-4 mr-2" />
            AI Builder
          </TabsTrigger>
          <TabsTrigger value="executions" data-testid="tab-executions">
            <Activity className="h-4 w-4 mr-2" />
            Executions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground">
              Manage your automated FHIR workflows
            </p>
            <Button onClick={() => setActiveTab("ai-builder")} data-testid="btn-create-workflow">
              <Plus className="h-4 w-4 mr-2" />
              Create with AI
            </Button>
          </div>

          {workflows.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No workflows created yet</p>
                <Button onClick={() => setActiveTab("ai-builder")}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Create Your First Workflow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <Collapsible
                  key={workflow.id}
                  open={expandedWorkflows.has(workflow.id)}
                  onOpenChange={() => toggleExpand(workflow.id)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover-elevate">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            {expandedWorkflows.has(workflow.id) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{workflow.name}</CardTitle>
                                <Badge variant={workflow.isEnabled ? "default" : "secondary"}>
                                  {workflow.isEnabled ? "Active" : "Disabled"}
                                </Badge>
                                <Badge variant="outline">v{workflow.version}</Badge>
                              </div>
                              <CardDescription>{workflow.description}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={workflow.isEnabled}
                              onCheckedChange={() => toggleMutation.mutate(workflow.id)}
                              data-testid={`switch-workflow-${workflow.id}`}
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => executeMutation.mutate(workflow.id)}
                              disabled={!workflow.isEnabled || executeMutation.isPending}
                              data-testid={`btn-execute-${workflow.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => deleteMutation.mutate(workflow.id)}
                              data-testid={`btn-delete-${workflow.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="space-y-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <span>Executions: {workflow.executionCount}</span>
                          {workflow.lastExecutedAt && (
                            <>
                              <span>|</span>
                              <span>Last run: {new Date(workflow.lastExecutedAt).toLocaleString()}</span>
                            </>
                          )}
                          {workflow.tags.length > 0 && (
                            <>
                              <span>|</span>
                              {workflow.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                              ))}
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-500" />
                              Triggers ({workflow.triggers.length})
                            </h4>
                            {workflow.triggers.map((trigger) => (
                              <Card key={trigger.id} className="bg-amber-500/5 border-amber-500/20">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    {getTriggerIcon(trigger.type)}
                                    <div className="flex-1">
                                      <p className="font-medium">{trigger.name}</p>
                                      <p className="text-sm text-muted-foreground">{trigger.description}</p>
                                      {trigger.resourceType && (
                                        <div className="flex items-center gap-1 mt-2">
                                          {getResourceIcon(trigger.resourceType)}
                                          <Badge variant="outline">{trigger.resourceType}</Badge>
                                        </div>
                                      )}
                                      {trigger.conditions.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {trigger.conditions.map((cond) => (
                                            <div key={cond.id} className="text-xs bg-muted rounded px-2 py-1">
                                              {cond.field} {cond.operator} {String(cond.value)}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <Settings className="h-4 w-4 text-blue-500" />
                              Actions ({workflow.actions.length})
                            </h4>
                            {workflow.actions.sort((a, b) => a.order - b.order).map((action, index) => (
                              <Card key={action.id} className="bg-blue-500/5 border-blue-500/20">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="h-6 w-6 p-0 justify-center">
                                        {index + 1}
                                      </Badge>
                                      {getActionIcon(action.type)}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-medium">{action.name}</p>
                                      <p className="text-sm text-muted-foreground">{action.description}</p>
                                      {action.config.targetResourceType && (
                                        <Badge variant="outline" className="mt-2">
                                          {action.config.targetResourceType}
                                        </Badge>
                                      )}
                                      {action.config.alertType && (
                                        <Badge variant="outline" className="mt-2">
                                          {action.config.alertType}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-builder" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                AI Workflow Generator
              </CardTitle>
              <CardDescription>
                Describe your workflow in natural language and let AI build it for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-description">Describe your workflow</Label>
                <Textarea
                  id="ai-description"
                  placeholder="Example: When a patient's blood pressure reading exceeds 180/120, send an urgent alert to the care team and create a follow-up task for the nurse..."
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  rows={4}
                  data-testid="textarea-ai-description"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => generateMutation.mutate(aiDescription)}
                  disabled={!aiDescription.trim() || generateMutation.isPending}
                  data-testid="btn-generate-workflow"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Workflow
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                <Card className="cursor-pointer hover-elevate" onClick={() => setAiDescription("When a new patient is registered, automatically create a personalized care plan and schedule an initial consultation appointment")}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-sm">Patient Onboarding</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Auto-create care plans for new patients</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover-elevate" onClick={() => setAiDescription("When vital signs show abnormal values (high blood pressure, irregular heart rate), immediately alert the care team and log the event for review")}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">Critical Alerts</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Monitor and alert on abnormal vitals</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover-elevate" onClick={() => setAiDescription("When a new medication is prescribed, check for potential drug interactions and notify the pharmacist for review if any are found")}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Pill className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">Medication Safety</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Check drug interactions automatically</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {aiSuggestion && (
            <Card className="border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    <CardTitle>AI Suggested Workflow</CardTitle>
                  </div>
                  <Button
                    onClick={() => createFromSuggestionMutation.mutate(aiSuggestion)}
                    disabled={createFromSuggestionMutation.isPending}
                    data-testid="btn-create-from-suggestion"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                </div>
                <CardDescription>{aiSuggestion.explanation}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Triggers
                    </h4>
                    {aiSuggestion.workflow.triggers?.map((trigger, i) => (
                      <Card key={i} className="bg-amber-500/5 border-amber-500/20 mb-2">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            {getTriggerIcon(trigger.type || "manual")}
                            <div>
                              <p className="font-medium text-sm">{trigger.name}</p>
                              <p className="text-xs text-muted-foreground">{trigger.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-500" />
                      Actions
                    </h4>
                    {aiSuggestion.workflow.actions?.map((action, i) => (
                      <Card key={i} className="bg-blue-500/5 border-blue-500/20 mb-2">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-xs">
                              {i + 1}
                            </Badge>
                            {getActionIcon(action.type || "log_event")}
                            <div>
                              <p className="font-medium text-sm">{action.name}</p>
                              <p className="text-xs text-muted-foreground">{action.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {aiSuggestion.suggestedEnhancements && aiSuggestion.suggestedEnhancements.length > 0 && (
                  <div className="bg-green-500/10 rounded-lg p-4">
                    <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-green-500" />
                      Suggested Enhancements
                    </h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {aiSuggestion.suggestedEnhancements.map((e, i) => (
                        <li key={i}>- {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSuggestion.potentialIssues && aiSuggestion.potentialIssues.length > 0 && (
                  <div className="bg-amber-500/10 rounded-lg p-4">
                    <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Potential Issues
                    </h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {aiSuggestion.potentialIssues.map((issue, i) => (
                        <li key={i}>- {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <p className="text-muted-foreground">
            Recent workflow execution history
          </p>

          {executions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No executions yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {executions.slice(0, 20).map((execution) => {
                const workflow = workflows.find(w => w.id === execution.workflowId);
                return (
                  <Card key={execution.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <Activity className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{workflow?.name || "Unknown Workflow"}</p>
                            <p className="text-sm text-muted-foreground">
                              Started: {new Date(execution.startedAt).toLocaleString()}
                              {execution.completedAt && ` | Completed: ${new Date(execution.completedAt).toLocaleString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(execution.status)}
                          <Badge variant="outline">
                            {execution.actionResults.filter(r => r.status === "completed").length}/{execution.actionResults.length} actions
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FHIRWorkflowBuilder;
