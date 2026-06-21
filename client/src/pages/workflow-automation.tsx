import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Pill,
  Play,
  RefreshCw,
  Shield,
  Zap,
  Settings,
  ChevronRight,
  ListTodo,
  TrendingUp,
  Lock,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataQualityIssue {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedResources: string[];
  suggestedAction: string;
}

interface DataQualityAssessment {
  id: string;
  patientId: string;
  triggeredBy: string;
  assessmentType: string;
  score: number;
  issues: DataQualityIssue[];
  recommendations: string[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface MedicationDataIssue {
  medicationId: string;
  medicationName: string;
  issueDescription: string;
  sourceConflicts: { source: string; value: unknown }[];
}

interface MedicationDataAlert {
  id: string;
  alertType: string;
  severity: "critical" | "high" | "medium" | "low";
  patientId: string;
  medications: MedicationDataIssue[];
  dataQualityImpact: string;
  suggestedDataRemediation: string;
  generatedAt: string;
  noCdsCompliance: string;
}

interface RemediationTask {
  id: string;
  taskType: string;
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedResources: string[];
  suggestedActions: string[];
  estimatedEffort: string;
  assignedTo?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  dueDate?: string;
  correlatedAlerts: string[];
  noCdsCompliance: string;
}

interface SecurityRecommendation {
  id: string;
  findingId: string;
  findingSeverity: "critical" | "high" | "medium" | "low";
  category: string;
  currentConfiguration: Record<string, unknown>;
  recommendedConfiguration: Record<string, unknown>;
  rationale: string;
  implementationSteps: string[];
  riskReduction: string;
  complianceImpact: string[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface WorkflowStats {
  totalEventsProcessed: number;
  assessmentsGenerated: number;
  medicationAlertsGenerated: number;
  remediationTasksCreated: number;
  securityRecommendations: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
}

export default function WorkflowAutomation() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTask, setSelectedTask] = useState<RemediationTask | null>(null);
  const { toast } = useToast();

  const { data: statsData, refetch: refetchStats } = useQuery<{ stats: WorkflowStats }>({
    queryKey: ["/api/workflow-automation/stats"]
  });

  const { data: assessmentsData, refetch: refetchAssessments } = useQuery<{ assessments: DataQualityAssessment[] }>({
    queryKey: ["/api/workflow-automation/assessments"]
  });

  const { data: medicationAlertsData, refetch: refetchMedicationAlerts } = useQuery<{ alerts: MedicationDataAlert[] }>({
    queryKey: ["/api/workflow-automation/medication-alerts"]
  });

  const { data: tasksData, refetch: refetchTasks } = useQuery<{ tasks: RemediationTask[]; byPriority: Record<string, number> }>({
    queryKey: ["/api/workflow-automation/tasks"]
  });

  const { data: securityRecsData, refetch: refetchSecurityRecs } = useQuery<{ recommendations: SecurityRecommendation[] }>({
    queryKey: ["/api/workflow-automation/security-recommendations"]
  });

  const simulateEventMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/workflow-automation/process-event", {
        eventType: "resource_created",
        resourceType: "Observation",
        patientId: "patient-001",
        resourceId: `obs-${Date.now()}`,
        sourceSystem: "Fasten Health"
      });
    },
    onSuccess: () => {
      toast({ title: "Event Processed", description: "FHIR event triggered workflow automation" });
      refetchStats();
      refetchAssessments();
      refetchTasks();
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/workflow-automation/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Task Updated", description: "Task status has been updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-automation/tasks"] });
      refetchStats();
    }
  });

  const stats = statsData?.stats;
  const assessments = assessmentsData?.assessments || [];
  const medicationAlerts = medicationAlertsData?.alerts || [];
  const tasks = tasksData?.tasks || [];
  const securityRecs = securityRecsData?.recommendations || [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      case "urgent": return "bg-red-600";
      default: return "bg-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline">Pending</Badge>;
      case "in_progress": return <Badge className="bg-blue-500">In Progress</Badge>;
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "cancelled": return <Badge variant="secondary">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchAssessments();
    refetchMedicationAlerts();
    refetchTasks();
    refetchSecurityRecs();
    toast({ title: "Refreshed", description: "All workflow data refreshed" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            Workflow Automation
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-driven automation for data governance and operational workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => simulateEventMutation.mutate()}
            disabled={simulateEventMutation.isPending}
            data-testid="button-simulate-event"
          >
            <Play className="h-4 w-4 mr-2" />
            Simulate Event
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          NO-CDS COMPLIANCE: All workflow automation is for DATA GOVERNANCE and OPERATIONAL purposes only. This system does NOT provide clinical decision support, treatment recommendations, or medical advice.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Events Processed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEventsProcessed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Assessments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.assessmentsGenerated || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Medication Alerts</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.medicationAlertsGenerated || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Tasks Created</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.remediationTasksCreated || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Security Recs</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.securityRecommendations || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
          <TabsTrigger value="medication" data-testid="tab-medication">Med Alerts</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Issues by Severity</CardTitle>
                <CardDescription>Distribution of detected issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Critical</span>
                    </div>
                    <span className="font-medium">{stats?.bySeverity?.critical || 0}</span>
                  </div>
                  <Progress value={(stats?.bySeverity?.critical || 0) * 10} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>High</span>
                    </div>
                    <span className="font-medium">{stats?.bySeverity?.high || 0}</span>
                  </div>
                  <Progress value={(stats?.bySeverity?.high || 0) * 10} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Medium</span>
                    </div>
                    <span className="font-medium">{stats?.bySeverity?.medium || 0}</span>
                  </div>
                  <Progress value={(stats?.bySeverity?.medium || 0) * 10} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Low</span>
                    </div>
                    <span className="font-medium">{stats?.bySeverity?.low || 0}</span>
                  </div>
                  <Progress value={(stats?.bySeverity?.low || 0) * 10} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest automated actions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {assessments.slice(0, 5).map((assessment) => (
                      <div key={assessment.id} className="flex items-start gap-3 p-2 rounded-lg border">
                        <FileText className="h-4 w-4 mt-1 text-blue-500" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">Data Quality Assessment</div>
                          <div className="text-xs text-muted-foreground">
                            Patient {assessment.patientId} - Score: {assessment.score}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(assessment.generatedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {medicationAlerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg border">
                        <Pill className="h-4 w-4 mt-1 text-orange-500" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">Medication Data Alert</div>
                          <div className="text-xs text-muted-foreground">
                            {alert.alertType.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(alert.generatedAt).toLocaleString()}
                          </div>
                        </div>
                        <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Priority Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-600">Urgent: {tasksData?.byPriority?.urgent || 0}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-500">High: {tasksData?.byPriority?.high || 0}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-500">Medium: {tasksData?.byPriority?.medium || 0}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500">Low: {tasksData?.byPriority?.low || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <Card key={assessment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        {assessment.assessmentType.charAt(0).toUpperCase() + assessment.assessmentType.slice(1)} Assessment
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          assessment.score >= 90 ? "text-green-600" :
                          assessment.score >= 75 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {assessment.score}%
                        </span>
                      </div>
                    </div>
                    <CardDescription>
                      Patient: {assessment.patientId} | Triggered by: {assessment.triggeredBy}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{assessment.noCdsCompliance}</AlertDescription>
                    </Alert>

                    {assessment.issues.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Issues Detected</h4>
                        <div className="space-y-2">
                          {assessment.issues.map((issue) => (
                            <div key={issue.id} className="p-3 rounded-lg border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{issue.category.replace(/_/g, " ")}</span>
                                <Badge className={getSeverityColor(issue.severity)}>{issue.severity}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{issue.description}</p>
                              <p className="text-sm mt-1"><strong>Action:</strong> {issue.suggestedAction}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {assessment.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {assessment.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="medication" className="space-y-4 mt-4">
          <Alert variant="default" className="mb-4">
            <Pill className="h-4 w-4" />
            <AlertTitle>Medication DATA QUALITY Alerts</AlertTitle>
            <AlertDescription className="text-xs">
              These alerts identify DATA QUALITY issues in medication records (inconsistencies, missing information, format differences). They are NOT clinical drug interaction warnings or treatment recommendations.
            </AlertDescription>
          </Alert>

          <ScrollArea className="h-[450px]">
            <div className="space-y-4">
              {medicationAlerts.map((alert) => (
                <Card key={alert.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertTriangle className={`h-5 w-5 ${
                          alert.severity === "critical" || alert.severity === "high"
                            ? "text-red-500" : "text-yellow-500"
                        }`} />
                        {alert.alertType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </CardTitle>
                      <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                    </div>
                    <CardDescription>Patient: {alert.patientId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{alert.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div>
                      <h4 className="font-medium mb-2">Affected Medications</h4>
                      {alert.medications.map((med) => (
                        <div key={med.medicationId} className="p-3 rounded-lg border mb-2">
                          <div className="font-medium">{med.medicationName}</div>
                          <p className="text-sm text-muted-foreground">{med.issueDescription}</p>
                          {med.sourceConflicts.length > 0 && (
                            <div className="mt-2">
                              <span className="text-sm font-medium">Source Values:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {med.sourceConflicts.map((conflict, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {conflict.source}: {String(conflict.value)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm"><strong>Data Quality Impact:</strong> {alert.dataQualityImpact}</p>
                      <p className="text-sm mt-1"><strong>Suggested Remediation:</strong> {alert.suggestedDataRemediation}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Remediation Tasks</CardTitle>
                <CardDescription>Data quality remediation work items</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors hover-elevate ${
                          selectedTask?.id === task.id ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => setSelectedTask(task)}
                        data-testid={`card-task-${task.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={getSeverityColor(task.priority)}>{task.priority}</Badge>
                          {getStatusBadge(task.status)}
                        </div>
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {task.estimatedEffort}
                          <ChevronRight className="h-3 w-3 ml-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Task Details</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedTask ? (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a task to view details</p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      <Alert className="bg-muted/50">
                        <Shield className="h-4 w-4" />
                        <AlertDescription className="text-xs">{selectedTask.noCdsCompliance}</AlertDescription>
                      </Alert>

                      <div className="flex items-center justify-between">
                        <Badge className={getSeverityColor(selectedTask.priority)}>{selectedTask.priority}</Badge>
                        {getStatusBadge(selectedTask.status)}
                      </div>

                      <div>
                        <h4 className="font-medium">{selectedTask.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {selectedTask.estimatedEffort}
                        </div>
                        {selectedTask.dueDate && (
                          <div className="text-muted-foreground">
                            Due: {new Date(selectedTask.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">Suggested Actions</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {selectedTask.suggestedActions.map((action, idx) => (
                            <li key={idx}>{action}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Affected Resources</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.affectedResources.map((res, idx) => (
                            <Badge key={idx} variant="outline">{res}</Badge>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        {selectedTask.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => updateTaskMutation.mutate({ taskId: selectedTask.id, status: "in_progress" })}
                            disabled={updateTaskMutation.isPending}
                            data-testid="button-start-task"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start Task
                          </Button>
                        )}
                        {selectedTask.status === "in_progress" && (
                          <Button
                            size="sm"
                            onClick={() => updateTaskMutation.mutate({ taskId: selectedTask.id, status: "completed" })}
                            disabled={updateTaskMutation.isPending}
                            data-testid="button-complete-task"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {securityRecs.map((rec) => (
                <Card key={rec.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        {rec.category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Configuration
                      </CardTitle>
                      <Badge className={getSeverityColor(rec.findingSeverity)}>{rec.findingSeverity}</Badge>
                    </div>
                    <CardDescription>Finding: {rec.findingId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{rec.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <p className="text-sm">{rec.rationale}</p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Current Configuration</h4>
                        <div className="p-3 rounded-lg bg-muted/50 text-sm">
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(rec.currentConfiguration, null, 2)}
                          </pre>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Recommended Configuration</h4>
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(rec.recommendedConfiguration, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Implementation Steps</h4>
                      <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                        {rec.implementationSteps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{rec.riskReduction}</span>
                      </div>
                    </div>

                    {rec.complianceImpact.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Compliance Impact</h4>
                        <div className="flex flex-wrap gap-2">
                          {rec.complianceImpact.map((impact, idx) => (
                            <Badge key={idx} variant="outline">{impact}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
