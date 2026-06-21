import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Activity, 
  AlertTriangle, 
  Bell, 
  Brain, 
  CheckCircle2, 
  ChevronRight, 
  ClipboardList, 
  Clock, 
  FileText, 
  Heart, 
  Lightbulb, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  User, 
  Users,
  Zap,
  AlertCircle,
  Info,
  Check,
  XCircle,
  Pill,
  Stethoscope,
  FlaskConical
} from "lucide-react";

interface PatientSummary {
  patientId: string;
  name: string;
  age: number;
  conditionsCount: number;
}

interface AIWorkflowInsight {
  id: string;
  patientId: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  rationale: string;
  suggestedTasks: Array<{
    id: string;
    title: string;
    description: string;
    assignee: string;
    dueInHours: number;
    automated: boolean;
  }>;
  relatedFHIRResources: Array<{
    resourceType: string;
    resourceId: string;
    display: string;
  }>;
  confidenceScore: number;
  generatedAt: string;
  expiresAt: string;
  status: string;
  aiGenerated: boolean;
  noCdsDisclaimer: string;
}

interface CriticalFHIRAlert {
  id: string;
  patientId: string;
  severity: string;
  alertType: string;
  title: string;
  description: string;
  fhirResourceType: string;
  fhirResourceId: string;
  previousValue?: string | number;
  currentValue: string | number;
  changePercentage?: number;
  detectedAt: string;
  requiredAction: string;
  status: string;
  aiAnalysis?: string;
  noCdsDisclaimer: string;
}

interface PrePopulatedFormData {
  formId: string;
  formType: string;
  patientId: string;
  generatedAt: string;
  fields: Array<{
    fieldId: string;
    fieldName: string;
    value: string | number | boolean | string[];
    source: string;
    fhirResourceType?: string;
    editable: boolean;
    required: boolean;
    validated: boolean;
  }>;
  sections: Array<{
    sectionId: string;
    sectionName: string;
    fieldIds: string[];
    collapsed: boolean;
  }>;
  metadata: {
    patientName: string;
    patientMRN: string;
  };
  aiSuggestions: Array<{
    fieldId: string;
    suggestion: string;
    confidence: number;
    rationale: string;
  }>;
  completionPercentage: number;
  noCdsDisclaimer: string;
}

interface DashboardStats {
  totalPendingInsights: number;
  criticalAlerts: number;
  highPriorityTasks: number;
  pendingFormReviews: number;
  insightsByCategory: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    patientId: string;
  }>;
}

interface FormType {
  type: string;
  label: string;
  description: string;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical": return "bg-red-600 text-white";
    case "high": return "bg-orange-500 text-white";
    case "medium": return "bg-yellow-500 text-black";
    case "low": return "bg-green-500 text-white";
    default: return "bg-muted";
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "bg-red-600 text-white";
    case "warning": return "bg-orange-500 text-white";
    case "info": return "bg-blue-500 text-white";
    default: return "bg-muted";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "lab_review": return <FlaskConical className="h-4 w-4" />;
    case "vitals_trend": return <Heart className="h-4 w-4" />;
    case "medication_review": return <Pill className="h-4 w-4" />;
    case "care_gap": return <AlertCircle className="h-4 w-4" />;
    case "follow_up": return <Clock className="h-4 w-4" />;
    case "preventive": return <Stethoscope className="h-4 w-4" />;
    case "coordination": return <Users className="h-4 w-4" />;
    case "documentation": return <FileText className="h-4 w-4" />;
    default: return <Lightbulb className="h-4 w-4" />;
  }
}

export default function AIProviderWorkflow() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedFormType, setSelectedFormType] = useState<string>("");
  const [generatedForm, setGeneratedForm] = useState<PrePopulatedFormData | null>(null);

  const { data: dashboardData, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery<{ stats: DashboardStats }>({
    queryKey: ["/api/ai-provider-workflow/dashboard"],
  });

  const { data: patientsData } = useQuery<{ patients: PatientSummary[] }>({
    queryKey: ["/api/ai-provider-workflow/patients"],
  });

  const { data: insightsData, refetch: refetchInsights } = useQuery<{ insights: AIWorkflowInsight[] }>({
    queryKey: ["/api/ai-provider-workflow/patient", selectedPatientId, "insights"],
    enabled: !!selectedPatientId,
  });

  const { data: alertsData, refetch: refetchAlerts } = useQuery<{ alerts: CriticalFHIRAlert[] }>({
    queryKey: ["/api/ai-provider-workflow/patient", selectedPatientId, "alerts"],
    enabled: !!selectedPatientId,
  });

  const { data: formTypesData } = useQuery<{ formTypes: FormType[] }>({
    queryKey: ["/api/ai-provider-workflow/form-types"],
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/ai-provider-workflow/patient/${selectedPatientId}/insights?generate=true`);
      return res.json();
    },
    onSuccess: () => {
      refetchInsights();
      refetchDashboard();
    }
  });

  const acknowledgeInsightMutation = useMutation({
    mutationFn: async (insightId: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-workflow/patient/${selectedPatientId}/insights/acknowledge`, { insightId });
      return res.json();
    },
    onSuccess: () => {
      refetchInsights();
      refetchDashboard();
    }
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-workflow/patient/${selectedPatientId}/alerts/acknowledge`, { alertId });
      return res.json();
    },
    onSuccess: () => {
      refetchAlerts();
      refetchDashboard();
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-workflow/patient/${selectedPatientId}/alerts/resolve`, { alertId });
      return res.json();
    },
    onSuccess: () => {
      refetchAlerts();
      refetchDashboard();
    }
  });

  const prePopulateFormMutation = useMutation({
    mutationFn: async (formType: string) => {
      const res = await apiRequest("POST", `/api/ai-provider-workflow/patient/${selectedPatientId}/form/prepopulate`, { formType });
      return res.json();
    },
    onSuccess: (data: any) => {
      setGeneratedForm(data.formData);
    }
  });

  const stats = dashboardData?.stats;
  const patients = patientsData?.patients || [];
  const insights = insightsData?.insights || [];
  const alerts = alertsData?.alerts || [];
  const formTypes = formTypesData?.formTypes || [];

  const pendingInsights = insights.filter(i => i.status === "pending");
  const activeAlerts = alerts.filter(a => a.status === "active");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-7 w-7 text-primary" />
            AI Provider Workflow Automation
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered insights and automated workflows using FHIR data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchDashboard();
              if (selectedPatientId) {
                refetchInsights();
                refetchAlerts();
              }
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Alert className="border-purple-500/50 bg-purple-500/10">
        <Info className="h-4 w-4" />
        <AlertTitle>Informational View Only</AlertTitle>
        <AlertDescription className="text-sm">
          AI-generated insights are for operational purposes only and do NOT constitute clinical decision support. All clinical decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {patients.map((patient) => (
                  <Button
                    key={patient.patientId}
                    variant={selectedPatientId === patient.patientId ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setSelectedPatientId(patient.patientId)}
                    data-testid={`button-select-patient-${patient.patientId}`}
                  >
                    <User className="h-4 w-4 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {patient.age}yo - {patient.conditionsCount} conditions
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>

            {stats && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Dashboard Stats</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="text-lg font-bold" data-testid="text-pending-insights">{stats.totalPendingInsights}</div>
                      <div className="text-xs text-muted-foreground">Pending Insights</div>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-red-500" data-testid="text-critical-alerts">{stats.criticalAlerts}</div>
                      <div className="text-xs text-muted-foreground">Critical Alerts</div>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-orange-500" data-testid="text-high-priority">{stats.highPriorityTasks}</div>
                      <div className="text-xs text-muted-foreground">High Priority</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-blue-500" data-testid="text-form-reviews">{stats.pendingFormReviews}</div>
                      <div className="text-xs text-muted-foreground">Form Reviews</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                <Activity className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-insights" disabled={!selectedPatientId}>
                <Lightbulb className="h-4 w-4 mr-2" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="alerts" data-testid="tab-alerts" disabled={!selectedPatientId}>
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="forms" data-testid="tab-forms" disabled={!selectedPatientId}>
                <ClipboardList className="h-4 w-4 mr-2" />
                Pre-Fill Forms
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              {isDashboardLoading ? (
                <div className="flex items-center justify-center h-48">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Pending Insights</p>
                            <p className="text-2xl font-bold">{stats.totalPendingInsights}</p>
                          </div>
                          <Lightbulb className="h-8 w-8 text-yellow-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Critical Alerts</p>
                            <p className="text-2xl font-bold text-red-500">{stats.criticalAlerts}</p>
                          </div>
                          <AlertTriangle className="h-8 w-8 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">High Priority</p>
                            <p className="text-2xl font-bold text-orange-500">{stats.highPriorityTasks}</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Form Reviews</p>
                            <p className="text-2xl font-bold text-blue-500">{stats.pendingFormReviews}</p>
                          </div>
                          <FileText className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Activity</CardTitle>
                      <CardDescription>Latest workflow events across all patients</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {stats.recentActivity.length > 0 ? (
                        <div className="space-y-3">
                          {stats.recentActivity.slice(0, 10).map((activity) => (
                            <div key={activity.id} className="flex items-center gap-3 p-2 rounded-lg hover-elevate">
                              {activity.type === "insight" && <Lightbulb className="h-4 w-4 text-yellow-500" />}
                              {activity.type === "alert" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                              {activity.type === "form" && <FileText className="h-4 w-4 text-blue-500" />}
                              {activity.type === "task" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                              <div className="flex-1">
                                <p className="text-sm font-medium">{activity.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPatientId(activity.patientId);
                                  if (activity.type === "insight") setActiveTab("insights");
                                  if (activity.type === "alert") setActiveTab("alerts");
                                  if (activity.type === "form") setActiveTab("forms");
                                }}
                                data-testid={`button-view-activity-${activity.id}`}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No recent activity</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              {selectedPatientId ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">AI-Generated Workflow Insights</h3>
                    <Button
                      onClick={() => generateInsightsMutation.mutate()}
                      disabled={generateInsightsMutation.isPending}
                      data-testid="button-generate-insights"
                    >
                      {generateInsightsMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate New Insights
                    </Button>
                  </div>

                  {pendingInsights.length > 0 ? (
                    <div className="space-y-4">
                      {pendingInsights.map((insight) => (
                        <Card key={insight.id} className="border-l-4" style={{ borderLeftColor: insight.priority === "high" || insight.priority === "critical" ? "#f97316" : "#22c55e" }}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(insight.category)}
                                <CardTitle className="text-base">{insight.title}</CardTitle>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={getPriorityColor(insight.priority)}>
                                  {insight.priority.toUpperCase()}
                                </Badge>
                                {insight.aiGenerated && (
                                  <Badge variant="outline" className="bg-purple-500/10">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI Generated
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <CardDescription>{insight.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-sm font-medium mb-1">Rationale</p>
                              <p className="text-sm text-muted-foreground">{insight.rationale}</p>
                            </div>

                            {insight.suggestedTasks.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Suggested Tasks</p>
                                <div className="space-y-2">
                                  {insight.suggestedTasks.map((task) => (
                                    <div key={task.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                                      {task.automated ? (
                                        <Zap className="h-4 w-4 text-blue-500" />
                                      ) : (
                                        <User className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{task.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {task.assignee} - Due in {task.dueInHours}h
                                        </p>
                                      </div>
                                      {task.automated && (
                                        <Badge variant="outline" className="text-xs">Automated</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {insight.relatedFHIRResources.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Related FHIR Resources</p>
                                <div className="flex flex-wrap gap-2">
                                  {insight.relatedFHIRResources.map((resource, idx) => (
                                    <Badge key={idx} variant="outline">
                                      {resource.resourceType}: {resource.display}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>Confidence: {insight.confidenceScore}%</span>
                                <span>-</span>
                                <span>{new Date(insight.generatedAt).toLocaleString()}</span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => acknowledgeInsightMutation.mutate(insight.id)}
                                disabled={acknowledgeInsightMutation.isPending}
                                data-testid={`button-acknowledge-insight-${insight.id}`}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Acknowledge
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-lg font-medium">No Pending Insights</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Click "Generate New Insights" to analyze patient data
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-medium">Select a Patient</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a patient from the list to view AI insights
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              {selectedPatientId ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Critical FHIR Data Alerts</h3>
                    <Badge variant="outline" className="text-sm">
                      {activeAlerts.length} Active Alerts
                    </Badge>
                  </div>

                  {activeAlerts.length > 0 ? (
                    <div className="space-y-4">
                      {activeAlerts.map((alert) => (
                        <Card key={alert.id} className={`border-l-4 ${alert.severity === "critical" ? "border-l-red-500" : alert.severity === "warning" ? "border-l-orange-500" : "border-l-blue-500"}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                {alert.severity === "critical" && <AlertTriangle className="h-5 w-5 text-red-500" />}
                                {alert.severity === "warning" && <AlertCircle className="h-5 w-5 text-orange-500" />}
                                {alert.severity === "info" && <Info className="h-5 w-5 text-blue-500" />}
                                <CardTitle className="text-base">{alert.title}</CardTitle>
                              </div>
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <CardDescription>{alert.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">FHIR Resource</p>
                                <p className="text-sm font-medium">{alert.fhirResourceType}</p>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                                <p className="text-sm font-medium">{alert.currentValue}</p>
                              </div>
                            </div>

                            {alert.previousValue && (
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">Previous: {alert.previousValue}</span>
                                {alert.changePercentage && (
                                  <Badge variant="outline" className="text-red-500">
                                    +{alert.changePercentage.toFixed(1)}% change
                                  </Badge>
                                )}
                              </div>
                            )}

                            {alert.aiAnalysis && (
                              <div className="bg-purple-500/10 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <Sparkles className="h-4 w-4 text-purple-500" />
                                  <p className="text-sm font-medium">AI Analysis</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{alert.aiAnalysis}</p>
                              </div>
                            )}

                            <div className="bg-yellow-500/10 rounded-lg p-3">
                              <p className="text-sm font-medium mb-1">Required Action</p>
                              <p className="text-sm text-muted-foreground">{alert.requiredAction}</p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <span className="text-sm text-muted-foreground">
                                Detected: {new Date(alert.detectedAt).toLocaleString()}
                              </span>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                                  disabled={acknowledgeAlertMutation.isPending}
                                  data-testid={`button-acknowledge-alert-${alert.id}`}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Acknowledge
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => resolveAlertMutation.mutate(alert.id)}
                                  disabled={resolveAlertMutation.isPending}
                                  data-testid={`button-resolve-alert-${alert.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Resolve
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-lg font-medium">No Active Alerts</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          All critical FHIR data changes have been addressed
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-medium">Select a Patient</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a patient from the list to view alerts
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="forms" className="space-y-4">
              {selectedPatientId ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Pre-Populate Form with FHIR Data</CardTitle>
                      <CardDescription>
                        Select a form type to automatically fill with patient FHIR data
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-4">
                        <Select value={selectedFormType} onValueChange={setSelectedFormType}>
                          <SelectTrigger className="w-[300px]" data-testid="select-form-type">
                            <SelectValue placeholder="Select form type" />
                          </SelectTrigger>
                          <SelectContent>
                            {formTypes.map((ft) => (
                              <SelectItem key={ft.type} value={ft.type}>
                                {ft.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => prePopulateFormMutation.mutate(selectedFormType)}
                          disabled={!selectedFormType || prePopulateFormMutation.isPending}
                          data-testid="button-prepopulate-form"
                        >
                          {prePopulateFormMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4 mr-2" />
                          )}
                          Pre-Populate Form
                        </Button>
                      </div>

                      {selectedFormType && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">
                            {formTypes.find(ft => ft.type === selectedFormType)?.description}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {generatedForm && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {formTypes.find(ft => ft.type === generatedForm.formType)?.label || generatedForm.formType}
                            </CardTitle>
                            <CardDescription>
                              Pre-populated for {generatedForm.metadata.patientName} ({generatedForm.metadata.patientMRN})
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Completion:</span>
                            <Progress value={generatedForm.completionPercentage} className="w-24" />
                            <span className="text-sm font-medium">{generatedForm.completionPercentage}%</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {generatedForm.sections.map((section) => (
                          <div key={section.sectionId}>
                            <h4 className="font-medium mb-3">{section.sectionName}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {section.fieldIds.map((fieldId) => {
                                const field = generatedForm.fields.find(f => f.fieldId === fieldId);
                                if (!field) return null;
                                const suggestion = generatedForm.aiSuggestions.find(s => s.fieldId === fieldId);
                                return (
                                  <div key={fieldId} className="bg-muted/30 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        {field.fieldName}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {field.source === "fhir" ? "FHIR" : field.source === "ai_suggested" ? "AI" : "Default"}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-medium">
                                      {typeof field.value === "boolean" ? (field.value ? "Yes" : "No") : String(field.value) || "-"}
                                    </p>
                                    {suggestion && (
                                      <div className="mt-2 bg-purple-500/10 rounded p-2">
                                        <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                                          <Sparkles className="h-3 w-3" />
                                          AI Suggestion ({suggestion.confidence}%)
                                        </div>
                                        <p className="text-xs mt-1">{suggestion.suggestion}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <div className="flex justify-end gap-2 pt-4">
                          <Button variant="outline" onClick={() => setGeneratedForm(null)} data-testid="button-clear-form">
                            <XCircle className="h-4 w-4 mr-2" />
                            Clear
                          </Button>
                          <Button data-testid="button-submit-form">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Review & Submit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-lg font-medium">Select a Patient</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a patient from the list to pre-populate forms
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
