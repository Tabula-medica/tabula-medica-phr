import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getStatusColor } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  Layers,
  Pill,
  Play,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Workflow,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DashboardSummary {
  totalEventsToday: number;
  pendingRiskAssessments: number;
  activeAlerts: number;
  criticalAlerts: number;
  pendingRemediationTasks: number;
  pendingSecurityActions: number;
  automationEfficiency: number;
}

interface AutomationMetrics {
  eventsProcessedToday: number;
  assessmentsTriggered: number;
  alertsGenerated: number;
  tasksCreated: number;
  tasksAutoResolved: number;
  averageResolutionTime: number;
  automationRate: number;
}

interface FHIRDataEvent {
  id: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  patientId: string;
  timestamp: string;
  sourceSystem: string;
  changeDescription: string;
  processed: boolean;
  triggeredWorkflows: string[];
}

interface RiskAssessmentTrigger {
  id: string;
  patientId: string;
  triggeredBy: string;
  triggerReason: string;
  assessmentStatus: string;
  createdAt: string;
  noCdsCompliance: string;
}

interface DrugAlert {
  id: string;
  patientId: string;
  alertType: string;
  severity: string;
  interactionDescription: string;
  status: string;
  detectedAt: string;
  noCdsCompliance: string;
}

interface CoordinationSuggestion {
  id: string;
  patientId: string;
  priority: string;
  suggestionType: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  noCdsCompliance: string;
}

interface RemediationTask {
  id: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  status: string;
  estimatedEffort: string;
  createdAt: string;
  noCdsCompliance: string;
}

interface SecurityRecommendation {
  id: string;
  findingId: string;
  findingTitle: string;
  findingSeverity: string;
  category: string;
  rationale: string;
  riskReduction: string;
  requiresApproval: boolean;
  status: string;
  createdAt: string;
  noCdsCompliance: string;
}

interface WorkflowDashboard {
  summary: DashboardSummary;
  recentEvents: FHIRDataEvent[];
  pendingAssessments: RiskAssessmentTrigger[];
  activeAlerts: DrugAlert[];
  pendingCoordinationSuggestions: CoordinationSuggestion[];
  remediationTasks: RemediationTask[];
  securityRecommendations: SecurityRecommendation[];
  automationMetrics: AutomationMetrics;
}

export default function AIHealthcareWorkflowAutomation() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: dashboardData, refetch } = useQuery<{ dashboard: WorkflowDashboard }>({
    queryKey: ["/api/workflow-automation/dashboard"]
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/workflow-automation/remediation-tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation/dashboard"] });
      toast({ title: "Task Updated", description: "Remediation task status updated" });
    }
  });

  const updateSecRecMutation = useMutation({
    mutationFn: async ({ recId, status }: { recId: string; status: string }) => {
      return apiRequest("PATCH", `/api/workflow-automation/security-recommendations/${recId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation/dashboard"] });
      toast({ title: "Recommendation Updated", description: "Security recommendation status updated" });
    }
  });

  const processEventMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/workflow-automation/events/process", {
        eventType: "resource_created",
        resourceType: "MedicationRequest",
        resourceId: `med-${Date.now()}`,
        patientId: "patient-default",
        sourceSystem: "Sample System",
        changeDescription: "Sample medication prescription created",
        metadata: { sample: true }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation/dashboard"] });
      toast({ title: "Event Processed", description: "FHIR event triggered workflow automation" });
    }
  });

  const dashboard = dashboardData?.dashboard;
  const summary = dashboard?.summary;
  const metrics = dashboard?.automationMetrics;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };


  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-workflow-automation">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-workflow-automation">
            <Workflow className="h-8 w-8 text-primary" />
            AI Healthcare Workflow Automation
          </h1>
          <p className="text-muted-foreground mt-1">
            Intelligent automation for healthcare data governance and care coordination
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => processEventMutation.mutate()}
            disabled={processEventMutation.isPending}
            data-testid="button-simulate-event"
          >
            <Play className="h-4 w-4 mr-2" />
            Simulate Event
          </Button>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs" data-testid="alert-no-cds">
          NO-CDS COMPLIANCE: This automation is for DATA GOVERNANCE, CARE COORDINATION, and OPERATIONAL efficiency ONLY. It does NOT provide clinical decision support or medical advice.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Risk</TabsTrigger>
          <TabsTrigger value="coordination" data-testid="tab-coordination">Coordination</TabsTrigger>
          <TabsTrigger value="remediation" data-testid="tab-remediation">Remediation</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="card-events-today">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Events Today</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{summary?.totalEventsToday || 0}</div>
                <p className="text-xs text-muted-foreground">FHIR data events processed</p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-alerts">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{summary?.activeAlerts || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {summary?.criticalAlerts || 0} critical
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-pending-tasks">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                <FileText className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-500">{summary?.pendingRemediationTasks || 0}</div>
                <p className="text-xs text-muted-foreground">Remediation tasks</p>
              </CardContent>
            </Card>

            <Card data-testid="card-automation-rate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Automation Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{Math.round((metrics?.automationRate || 0) * 100)}%</div>
                <Progress value={(metrics?.automationRate || 0) * 100} className="h-2 mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-workflow-triggers">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Workflow Triggers
                </CardTitle>
                <CardDescription>Automated actions triggered by FHIR events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">Risk Assessments</div>
                      <div className="text-xs text-muted-foreground">Triggered on new FHIR data</div>
                    </div>
                  </div>
                  <Badge variant="secondary">{metrics?.assessmentsTriggered || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Pill className="h-5 w-5 text-amber-500" />
                    <div>
                      <div className="font-medium">Drug Data Alerts</div>
                      <div className="text-xs text-muted-foreground">Data quality checks</div>
                    </div>
                  </div>
                  <Badge variant="secondary">{metrics?.alertsGenerated || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium">Care Coordination</div>
                      <div className="text-xs text-muted-foreground">Suggestions generated</div>
                    </div>
                  </div>
                  <Badge variant="secondary">{dashboard?.pendingCoordinationSuggestions?.length || 0}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-red-500" />
                    <div>
                      <div className="font-medium">Security Recommendations</div>
                      <div className="text-xs text-muted-foreground">Config changes suggested</div>
                    </div>
                  </div>
                  <Badge variant="secondary">{summary?.pendingSecurityActions || 0}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-automation-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Automation Metrics
                </CardTitle>
                <CardDescription>Performance and efficiency indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Events Processed</span>
                    <span className="font-medium">{metrics?.eventsProcessedToday || 0}</span>
                  </div>
                  <Progress value={Math.min((metrics?.eventsProcessedToday || 0) * 10, 100)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tasks Auto-Resolved</span>
                    <span className="font-medium">{metrics?.tasksAutoResolved || 0}</span>
                  </div>
                  <Progress value={Math.min((metrics?.tasksAutoResolved || 0) * 20, 100)} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Avg Resolution Time</span>
                    <span className="font-medium">{metrics?.averageResolutionTime || 0} min</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Automation Efficiency</span>
                    <span className="font-medium">{summary?.automationEfficiency || 0}%</span>
                  </div>
                  <Progress value={summary?.automationEfficiency || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                FHIR Data Events
              </CardTitle>
              <CardDescription>Real-time FHIR events triggering workflow automation</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dashboard?.recentEvents?.map(event => (
                    <div key={event.id} className="p-4 rounded-lg border" data-testid={`event-${event.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.eventType}</Badge>
                          <Badge variant="secondary">{event.resourceType}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{event.changeDescription}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>Source: {event.sourceSystem}</span>
                        <span>Patient: {event.patientId}</span>
                        {event.processed && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Processed
                          </Badge>
                        )}
                      </div>
                      {event.triggeredWorkflows.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          <span className="text-xs text-muted-foreground">Triggered:</span>
                          {event.triggeredWorkflows.slice(0, 3).map(wf => (
                            <Badge key={wf} variant="outline" className="text-xs">{wf.slice(0, 15)}...</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Automated Risk Assessments
              </CardTitle>
              <CardDescription>
                Risk assessments triggered automatically by new FHIR data - for CARE COORDINATION only
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-muted/50">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  These assessments are for care coordination and operational purposes only, NOT clinical decision support.
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dashboard?.pendingAssessments?.map(assessment => (
                    <div key={assessment.id} className="p-4 rounded-lg border" data-testid={`assessment-${assessment.id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={getStatusColor(assessment.assessmentStatus)}>
                          {assessment.assessmentStatus}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(assessment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{assessment.triggerReason}</p>
                      <p className="text-xs text-muted-foreground mt-1">Patient: {assessment.patientId}</p>
                    </div>
                  ))}
                  {(!dashboard?.pendingAssessments || dashboard.pendingAssessments.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No pending risk assessments</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coordination" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Care Coordination Suggestions
              </CardTitle>
              <CardDescription>
                AI-generated suggestions for care team actions - NOT clinical recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-muted/50">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  These are administrative and coordination suggestions only. They do NOT provide clinical advice.
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dashboard?.pendingCoordinationSuggestions?.map(suggestion => (
                    <Card key={suggestion.id} data-testid={`suggestion-${suggestion.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{suggestion.title}</CardTitle>
                          <Badge variant={getSeverityColor(suggestion.priority) as any}>{suggestion.priority}</Badge>
                        </div>
                        <CardDescription>{suggestion.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Type: {suggestion.suggestionType.replace(/_/g, " ")}</span>
                          <span>Patient: {suggestion.patientId}</span>
                          <Badge className={getStatusColor(suggestion.status)}>{suggestion.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remediation" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Data Quality Remediation Tasks
              </CardTitle>
              <CardDescription>
                Automated tasks generated from AI analysis of alert correlations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dashboard?.remediationTasks?.map(task => (
                    <Card key={task.id} data-testid={`task-${task.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{task.title}</CardTitle>
                          <Badge variant={getSeverityColor(task.priority) as any}>{task.priority}</Badge>
                        </div>
                        <CardDescription>{task.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Type: {task.taskType.replace(/_/g, " ")}</span>
                          <span>Effort: {task.estimatedEffort}</span>
                          <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="gap-2">
                        {task.status === "pending" && (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "in_progress" })}
                              disabled={updateTaskMutation.isPending}
                              data-testid={`button-start-task-${task.id}`}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "completed" })}
                              disabled={updateTaskMutation.isPending}
                              data-testid={`button-complete-task-${task.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          </>
                        )}
                        {task.status === "in_progress" && (
                          <Button 
                            size="sm"
                            onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "completed" })}
                            disabled={updateTaskMutation.isPending}
                            data-testid={`button-complete-task-${task.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Security Configuration Recommendations
              </CardTitle>
              <CardDescription>
                AI-generated security improvements for critical and high-risk findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {dashboard?.securityRecommendations?.map(rec => (
                    <Card key={rec.id} data-testid={`sec-rec-${rec.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{rec.findingTitle}</CardTitle>
                          <Badge variant={getSeverityColor(rec.findingSeverity) as any}>{rec.findingSeverity}</Badge>
                        </div>
                        <CardDescription>{rec.rationale}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span>Category: {rec.category.replace(/_/g, " ")}</span>
                          <Badge className={getStatusColor(rec.status)}>{rec.status}</Badge>
                          {rec.requiresApproval && (
                            <Badge variant="outline">Requires Approval</Badge>
                          )}
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400">{rec.riskReduction}</p>
                      </CardContent>
                      <CardFooter className="gap-2">
                        {rec.status === "pending" && (
                          <>
                            <Button 
                              size="sm"
                              onClick={() => updateSecRecMutation.mutate({ recId: rec.id, status: "approved" })}
                              disabled={updateSecRecMutation.isPending}
                              data-testid={`button-approve-rec-${rec.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateSecRecMutation.mutate({ recId: rec.id, status: "rejected" })}
                              disabled={updateSecRecMutation.isPending}
                              data-testid={`button-reject-rec-${rec.id}`}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {rec.status === "approved" && (
                          <Button 
                            size="sm"
                            onClick={() => updateSecRecMutation.mutate({ recId: rec.id, status: "implemented" })}
                            disabled={updateSecRecMutation.isPending}
                            data-testid={`button-implement-rec-${rec.id}`}
                          >
                            <ArrowRight className="h-4 w-4 mr-1" />
                            Implement
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
