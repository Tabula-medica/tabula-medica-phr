import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  FileWarning,
  Play,
  RefreshCw,
  Settings,
  Zap,
  Activity,
  Brain,
  Pill,
  Server,
  Plus,
  Trash2,
  Edit,
  Eye,
  XCircle,
  ArrowUp,
} from "lucide-react";

interface DashboardStats {
  pendingAlerts: number;
  criticalAlerts: number;
  activeWorkflows: number;
  activeAutoSyncConfigs: number;
  analysisRequestsToday: number;
  studiesSyncedToday: number;
}

interface ClinicianAlert {
  id: string;
  patientId: string;
  patientName: string;
  studyId: string;
  alertType: string;
  riskLevel: string;
  title: string;
  message: string;
  findings: string[];
  recommendedActions: string[];
  status: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  noCdsDisclaimer: string;
  createdAt: string;
}

interface PACSAutoSyncConfig {
  id: string;
  pacsConnectionId: string;
  pacsName: string;
  enabled: boolean;
  syncFrequency: string;
  modalityFilters: string[];
  facilityFilters: string[];
  autoAIAnalysis: boolean;
  analysisTypes: string[];
  notifyOnHighRisk: boolean;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncStats: {
    totalStudiesSynced: number;
    lastSyncStudies: number;
    failedSyncs: number;
  };
}

interface WorkflowConfiguration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: string;
  priority: string;
  createdAt: string;
}

interface AIAnalysisRequest {
  id: string;
  studyId: string;
  patientId: string;
  analysisTypes: string[];
  priority: string;
  status: string;
  results?: any[];
  createdAt: string;
  completedAt?: string;
}

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated analysis is for informational purposes only and does not constitute medical advice, diagnosis, or treatment recommendations. All findings must be reviewed and validated by qualified healthcare professionals.";

export default function DICOMWorkflowAutomation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedAlert, setSelectedAlert] = useState<ClinicianAlert | null>(null);
  const [showNewSyncConfig, setShowNewSyncConfig] = useState(false);

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dicom-workflow/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dicom-workflow/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: alertsData } = useQuery<{ alerts: ClinicianAlert[] }>({
    queryKey: ["/api/dicom-workflow/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/dicom-workflow/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: syncConfigsData } = useQuery<{ configs: PACSAutoSyncConfig[] }>({
    queryKey: ["/api/dicom-workflow/pacs-sync-configs"],
    queryFn: async () => {
      const res = await fetch("/api/dicom-workflow/pacs-sync-configs");
      if (!res.ok) throw new Error("Failed to fetch sync configs");
      return res.json();
    },
  });

  const { data: workflowsData } = useQuery<{ workflows: WorkflowConfiguration[] }>({
    queryKey: ["/api/dicom-workflow/workflows"],
    queryFn: async () => {
      const res = await fetch("/api/dicom-workflow/workflows");
      if (!res.ok) throw new Error("Failed to fetch workflows");
      return res.json();
    },
  });

  const { data: analysisRequestsData } = useQuery<{ requests: AIAnalysisRequest[] }>({
    queryKey: ["/api/dicom-workflow/analysis-requests"],
    queryFn: async () => {
      const res = await fetch("/api/dicom-workflow/analysis-requests");
      if (!res.ok) throw new Error("Failed to fetch analysis requests");
      return res.json();
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("PATCH", `/api/dicom-workflow/alerts/${alertId}/acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/dashboard"] });
      toast({ title: "Alert acknowledged" });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("PATCH", `/api/dicom-workflow/alerts/${alertId}/resolve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/dashboard"] });
      toast({ title: "Alert resolved" });
      setSelectedAlert(null);
    },
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (configId: string) => {
      const res = await apiRequest("POST", `/api/dicom-workflow/pacs-sync-configs/${configId}/sync`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/pacs-sync-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/dashboard"] });
      toast({ title: "Sync completed", description: data.message });
    },
  });

  const toggleSyncConfigMutation = useMutation({
    mutationFn: async ({ configId, enabled }: { configId: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/dicom-workflow/pacs-sync-configs/${configId}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/pacs-sync-configs"] });
      toast({ title: "Configuration updated" });
    },
  });

  const toggleWorkflowMutation = useMutation({
    mutationFn: async ({ workflowId, enabled }: { workflowId: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/dicom-workflow/workflows/${workflowId}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dicom-workflow/workflows"] });
      toast({ title: "Workflow updated" });
    },
  });

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "critical":
        return <Badge variant="destructive" data-testid="badge-risk-critical">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500 hover:bg-orange-600" data-testid="badge-risk-high">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600" data-testid="badge-risk-medium">Medium</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-risk-low">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" data-testid="badge-status-pending">Pending</Badge>;
      case "acknowledged":
        return <Badge className="bg-blue-500" data-testid="badge-status-acknowledged">Acknowledged</Badge>;
      case "resolved":
        return <Badge className="bg-green-500" data-testid="badge-status-resolved">Resolved</Badge>;
      case "escalated":
        return <Badge className="bg-purple-500" data-testid="badge-status-escalated">Escalated</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case "drug_interaction":
        return <Pill className="w-4 h-4" />;
      case "deterioration":
        return <Activity className="w-4 h-4" />;
      case "critical_finding":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="dicom-workflow-automation-page">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">DICOM Workflow Automation</h1>
        <p className="text-muted-foreground">
          Configure automated AI analysis triggers, PACS auto-sync, and clinician alerts
        </p>
      </div>

      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">NO-CDS Compliance</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          {NO_CDS_DISCLAIMER}
        </AlertDescription>
      </Alert>

      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card data-testid="card-stat-pending-alerts">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.pendingAlerts}</p>
                  <p className="text-xs text-muted-foreground">Pending Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-critical-alerts">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.criticalAlerts}</p>
                  <p className="text-xs text-muted-foreground">Critical Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-active-workflows">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.activeWorkflows}</p>
                  <p className="text-xs text-muted-foreground">Active Workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-auto-sync">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.activeAutoSyncConfigs}</p>
                  <p className="text-xs text-muted-foreground">Auto-Sync Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-analysis-today">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.analysisRequestsToday}</p>
                  <p className="text-xs text-muted-foreground">AI Analyses Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-synced-today">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-500" />
                <div>
                  <p className="text-2xl font-bold">{dashboardStats.studiesSyncedToday}</p>
                  <p className="text-xs text-muted-foreground">Studies Synced Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-workflow-sections">
          <TabsTrigger value="dashboard" data-testid="tab-alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="pacs-sync" data-testid="tab-pacs-sync">
            <Server className="w-4 h-4 mr-2" />
            PACS Auto-Sync
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            <Zap className="w-4 h-4 mr-2" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="analysis" data-testid="tab-analysis">
            <Brain className="w-4 h-4 mr-2" />
            AI Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Clinician Alerts</CardTitle>
                <CardDescription>High-risk findings requiring clinical attention</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {alertsData?.alerts && alertsData.alerts.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {alertsData.alerts.map((alert) => (
                      <Card 
                        key={alert.id} 
                        className={`cursor-pointer hover-elevate ${alert.riskLevel === "critical" ? "border-red-500" : alert.riskLevel === "high" ? "border-orange-500" : ""}`}
                        onClick={() => setSelectedAlert(alert)}
                        data-testid={`card-alert-${alert.id}`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-full ${alert.riskLevel === "critical" ? "bg-red-100 dark:bg-red-900" : alert.riskLevel === "high" ? "bg-orange-100 dark:bg-orange-900" : "bg-gray-100 dark:bg-gray-800"}`}>
                                {getAlertTypeIcon(alert.alertType)}
                              </div>
                              <div>
                                <h4 className="font-medium">{alert.title}</h4>
                                <p className="text-sm text-muted-foreground">{alert.patientName} • Study: {alert.studyId.slice(0, 8)}...</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(alert.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getRiskBadge(alert.riskLevel)}
                              {getStatusBadge(alert.status)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending alerts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pacs-sync" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>PACS Auto-Sync Configurations</CardTitle>
                <CardDescription>Configure automatic study synchronization from PACS systems</CardDescription>
              </div>
              <Button onClick={() => setShowNewSyncConfig(true)} data-testid="button-add-sync-config">
                <Plus className="w-4 h-4 mr-2" />
                Add Configuration
              </Button>
            </CardHeader>
            <CardContent>
              {syncConfigsData?.configs && syncConfigsData.configs.length > 0 ? (
                <div className="space-y-4">
                  {syncConfigsData.configs.map((config) => (
                    <Card key={config.id} data-testid={`card-sync-config-${config.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Server className="w-5 h-5" />
                              <h4 className="font-medium">{config.pacsName}</h4>
                              <Badge variant={config.enabled ? "default" : "secondary"}>
                                {config.enabled ? "Active" : "Disabled"}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Frequency</p>
                                <p className="font-medium capitalize">{config.syncFrequency}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Modalities</p>
                                <p className="font-medium">{config.modalityFilters.length > 0 ? config.modalityFilters.join(", ") : "All"}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Total Synced</p>
                                <p className="font-medium">{config.syncStats.totalStudiesSynced}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Last Sync</p>
                                <p className="font-medium">{config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "Never"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-3">
                              {config.autoAIAnalysis && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Brain className="w-3 h-3" />
                                  Auto AI Analysis
                                </Badge>
                              )}
                              {config.notifyOnHighRisk && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Bell className="w-3 h-3" />
                                  High-Risk Alerts
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={(enabled) => toggleSyncConfigMutation.mutate({ configId: config.id, enabled })}
                              data-testid={`switch-sync-enabled-${config.id}`}
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => triggerSyncMutation.mutate(config.id)}
                              disabled={!config.enabled || triggerSyncMutation.isPending}
                              data-testid={`button-trigger-sync-${config.id}`}
                            >
                              <RefreshCw className={`w-4 h-4 mr-1 ${triggerSyncMutation.isPending ? "animate-spin" : ""}`} />
                              Sync Now
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No PACS sync configurations</p>
                  <Button variant="outline" className="mt-4" onClick={() => setShowNewSyncConfig(true)} data-testid="button-add-first-sync">
                    Add Configuration
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Automation Workflows</CardTitle>
                <CardDescription>Configure triggers for AI analysis on study ingestion</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {workflowsData?.workflows && workflowsData.workflows.length > 0 ? (
                <div className="space-y-4">
                  {workflowsData.workflows.map((workflow) => (
                    <Card key={workflow.id} data-testid={`card-workflow-${workflow.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Zap className={`w-5 h-5 ${workflow.enabled ? "text-yellow-500" : "text-gray-400"}`} />
                              <h4 className="font-medium">{workflow.name}</h4>
                              <Badge variant={workflow.enabled ? "default" : "secondary"}>
                                {workflow.enabled ? "Active" : "Disabled"}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{workflow.priority}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{workflow.description}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground">Trigger: <span className="font-medium capitalize">{workflow.triggerType}</span></span>
                            </div>
                          </div>
                          <Switch
                            checked={workflow.enabled}
                            onCheckedChange={(enabled) => toggleWorkflowMutation.mutate({ workflowId: workflow.id, enabled })}
                            data-testid={`switch-workflow-enabled-${workflow.id}`}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No workflow configurations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Analysis Requests</CardTitle>
              <CardDescription>Recent AI-triggered analysis for deterioration risk and drug interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {analysisRequestsData?.requests && analysisRequestsData.requests.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {analysisRequestsData.requests.map((request) => (
                      <Card key={request.id} data-testid={`card-analysis-${request.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Brain className="w-4 h-4" />
                                <span className="font-medium">Study: {request.studyId.slice(0, 12)}...</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mb-2">
                                {request.analysisTypes.map((type) => (
                                  <Badge key={type} variant="outline" className="text-xs capitalize">
                                    {type.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(request.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge className={
                                request.status === "completed" ? "bg-green-500" :
                                request.status === "processing" ? "bg-blue-500" :
                                request.status === "failed" ? "bg-red-500" : ""
                              }>
                                {request.status}
                              </Badge>
                              <Badge variant="outline" className="capitalize">{request.priority}</Badge>
                            </div>
                          </div>
                          {request.results && request.results.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm font-medium mb-2">Results:</p>
                              {request.results.map((result: any, idx: number) => (
                                <div key={idx} className="text-sm mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="capitalize">{result.analysisType.replace(/_/g, " ")}</span>
                                    {getRiskBadge(result.riskLevel)}
                                  </div>
                                  {result.findings && result.findings.length > 0 && (
                                    <ul className="list-disc list-inside text-muted-foreground mt-1">
                                      {result.findings.slice(0, 2).map((f: string, i: number) => (
                                        <li key={i} className="text-xs">{f}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No AI analysis requests yet</p>
                  <p className="text-sm">Analysis will trigger automatically based on workflow configurations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAlert && getAlertTypeIcon(selectedAlert.alertType)}
              {selectedAlert?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedAlert?.patientName} • Study: {selectedAlert?.studyId}
            </DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getRiskBadge(selectedAlert.riskLevel)}
                {getStatusBadge(selectedAlert.status)}
              </div>
              <p className="text-sm">{selectedAlert.message}</p>
              
              <div>
                <h4 className="font-medium mb-2">Findings:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {selectedAlert.findings.map((finding, idx) => (
                    <li key={idx} className="text-sm">{finding}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Recommended Actions:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {selectedAlert.recommendedActions.map((action, idx) => (
                    <li key={idx} className="text-sm">{action}</li>
                  ))}
                </ul>
              </div>
              
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {selectedAlert.noCdsDisclaimer}
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            {selectedAlert?.status === "pending" && (
              <Button
                onClick={() => acknowledgeAlertMutation.mutate(selectedAlert.id)}
                disabled={acknowledgeAlertMutation.isPending}
                data-testid="button-acknowledge-alert"
              >
                <Eye className="w-4 h-4 mr-2" />
                Acknowledge
              </Button>
            )}
            {selectedAlert?.status !== "resolved" && (
              <Button
                variant="outline"
                onClick={() => selectedAlert && resolveAlertMutation.mutate(selectedAlert.id)}
                disabled={resolveAlertMutation.isPending}
                data-testid="button-resolve-alert"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Resolved
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
