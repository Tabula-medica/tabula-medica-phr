import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  AlertTriangle,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Activity,
  FileText,
  Play,
  ArrowUpRight,
  MessageSquare,
  RefreshCw,
  Plus,
  AlertCircle,
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";

interface Incident {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  category: string;
  source: string;
  correlatedAlerts: Array<{
    alertId: string;
    alertType: string;
    severity: string;
    message: string;
    timestamp: string;
    correlationScore: number;
  }>;
  impactAnalysis: {
    affectedSystems: string[];
    affectedUsers: number;
    affectedRecords: number;
    businessImpact: string;
    regulatoryImplications: string[];
    aiAnalysis?: string;
  };
  containmentSteps: Array<{
    id: string;
    order: number;
    action: string;
    description: string;
    automated: boolean;
    status: string;
    estimatedDuration: string;
    completedAt?: string;
    result?: string;
  }>;
  aiRecommendations: string[];
  humanNotes: string[];
  timeline: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    description: string;
    actor: string;
  }>;
  assignedTo?: string;
  escalatedTo?: string;
  createdAt: string;
  detectedAt: string;
  containedAt?: string;
  resolvedAt?: string;
}

interface IncidentMetrics {
  totalIncidents: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  avgTimeToContain: number;
  avgTimeToResolve: number;
  automatedResolutions: number;
  humanEscalations: number;
}

interface Dashboard {
  metrics: IncidentMetrics;
  activeIncidents: number;
  criticalIncidents: number;
  recentIncidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    category: string;
    createdAt: string;
    alertCount: number;
  }>;
  playbooks: number;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

const statusColors: Record<string, string> = {
  detected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  investigating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  containing: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  contained: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  remediating: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

function formatDuration(ms: number): string {
  if (ms < 60000) return "< 1 min";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

export default function IncidentDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "operational",
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ dashboard: Dashboard }>({
    queryKey: ["/api/incident-response/dashboard"],
  });

  const { data: incidentsData, isLoading: incidentsLoading } = useQuery<{ incidents: Incident[] }>({
    queryKey: ["/api/incident-response/incidents"],
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (data: typeof newIncident) => {
      return apiRequest("POST", "/api/incident-response/incidents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incident-response/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incident-response/dashboard"] });
      setShowCreateDialog(false);
      setNewIncident({ title: "", description: "", severity: "medium", category: "operational" });
      toast({ title: "Incident created", description: "The incident has been logged." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create incident", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/incident-response/incidents/${id}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incident-response/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incident-response/dashboard"] });
      toast({ title: "Status updated" });
    },
  });

  const executeStepMutation = useMutation({
    mutationFn: async ({ incidentId, stepId, result }: { incidentId: string; stepId: string; result: string }) => {
      return apiRequest("POST", `/api/incident-response/incidents/${incidentId}/containment/${stepId}/execute`, { result });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incident-response/incidents"] });
      toast({ title: "Step completed" });
    },
  });

  const dashboard = dashboardData?.dashboard;
  const incidents = incidentsData?.incidents || [];

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="loading-dashboard">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Incident Response Center</h1>
          <p className="text-muted-foreground">AI-powered incident detection, correlation, and response</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/incident-response"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-incident">
                <Plus className="w-4 h-4 mr-2" />
                Report Incident
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report New Incident</DialogTitle>
                <DialogDescription>Manually report a security or compliance incident</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="incident-dashboard-title">Title</Label>
                  <Input id="incident-dashboard-title"
                    value={newIncident.title}
                    onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                    placeholder="Brief incident title"
                    data-testid="input-incident-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident-dashboard-description">Description</Label>
                  <Textarea id="incident-dashboard-description"
                    value={newIncident.description}
                    onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                    placeholder="Describe the incident..."
                    data-testid="input-incident-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="incident-dashboard-severity">Severity</Label>
                    <Select
                      value={newIncident.severity}
                      onValueChange={(v) => setNewIncident({ ...newIncident, severity: v })}
                    >
                      <SelectTrigger id="incident-dashboard-severity" data-testid="select-severity">
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
                  <div className="space-y-2">
                    <Label htmlFor="incident-dashboard-category">Category</Label>
                    <Select
                      value={newIncident.category}
                      onValueChange={(v) => setNewIncident({ ...newIncident, category: v })}
                    >
                      <SelectTrigger id="incident-dashboard-category" data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="phi_breach">PHI Breach</SelectItem>
                        <SelectItem value="data_quality">Data Quality</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-incident">
                  Cancel
                </Button>
                <Button
                  onClick={() => createIncidentMutation.mutate(newIncident)}
                  disabled={!newIncident.title || !newIncident.description || createIncidentMutation.isPending}
                  data-testid="button-submit-incident"
                >
                  Create Incident
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-incidents">{dashboard?.activeIncidents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.criticalIncidents || 0} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time to Contain</CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-contain-time">
              {formatDuration(dashboard?.metrics?.avgTimeToContain || 0)}
            </div>
            <p className="text-xs text-muted-foreground">From detection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Automated Resolutions</CardTitle>
            <Zap className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-automated-resolutions">
              {dashboard?.metrics?.automatedResolutions || 0}
            </div>
            <p className="text-xs text-muted-foreground">No human escalation needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Response Playbooks</CardTitle>
            <FileText className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-playbooks">{dashboard?.playbooks || 0}</div>
            <p className="text-xs text-muted-foreground">Automated workflows</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Incidents
            </CardTitle>
            <CardDescription>AI-detected and manually reported incidents</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {incidentsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : incidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Shield className="w-10 h-10 mb-2" />
                  <p>No incidents detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-4 border rounded-lg hover-elevate cursor-pointer"
                      {...clickable(() => setSelectedIncident(incident))}
                      data-testid={`card-incident-${incident.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={severityColors[incident.severity]}>
                              {incident.severity}
                            </Badge>
                            <Badge variant="outline">{incident.category}</Badge>
                            <Badge className={statusColors[incident.status]}>
                              {incident.status}
                            </Badge>
                          </div>
                          <h4 className="font-medium truncate">{incident.title}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {incident.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(incident.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {incident.correlatedAlerts.length} alerts
                            </span>
                          </div>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["critical", "high", "medium", "low"].map((sev) => {
              const count = dashboard?.metrics?.bySeverity?.[sev] || 0;
              const total = dashboard?.metrics?.totalIncidents || 1;
              const pct = Math.round((count / total) * 100) || 0;
              return (
                <div key={sev} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{sev}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">By Category</h4>
              <div className="space-y-2">
                {Object.entries(dashboard?.metrics?.byCategory || {}).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                    <Badge variant="outline">{count as number}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedIncident && (
        <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge className={severityColors[selectedIncident.severity]}>
                  {selectedIncident.severity}
                </Badge>
                <Badge variant="outline">{selectedIncident.category}</Badge>
                <Badge className={statusColors[selectedIncident.status]}>
                  {selectedIncident.status}
                </Badge>
              </div>
              <DialogTitle>{selectedIncident.title}</DialogTitle>
              <DialogDescription>{selectedIncident.description}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="containment">Containment</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="alerts">Alerts ({selectedIncident.correlatedAlerts.length})</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-auto">
                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Impact Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Business Impact:</span>
                          <Badge variant="outline" className="capitalize">
                            {selectedIncident.impactAnalysis.businessImpact}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Affected Users:</span>
                          <span>{selectedIncident.impactAnalysis.affectedUsers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Affected Records:</span>
                          <span>{selectedIncident.impactAnalysis.affectedRecords}</span>
                        </div>
                        {selectedIncident.impactAnalysis.regulatoryImplications.length > 0 && (
                          <div className="pt-2">
                            <span className="text-muted-foreground block mb-1">Regulatory:</span>
                            <div className="flex gap-1 flex-wrap">
                              {selectedIncident.impactAnalysis.regulatoryImplications.map((reg) => (
                                <Badge key={reg} variant="secondary">{reg}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">AI Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          {selectedIncident.aiRecommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  {selectedIncident.impactAnalysis.aiAnalysis && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          AI Impact Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{selectedIncident.impactAnalysis.aiAnalysis}</p>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-2">
                    <Select
                      onValueChange={(status) => {
                        updateStatusMutation.mutate({ id: selectedIncident.id, status });
                      }}
                    >
                      <SelectTrigger className="w-48" data-testid="select-update-status">
                        <SelectValue placeholder="Update Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="containing">Containing</SelectItem>
                        <SelectItem value="contained">Contained</SelectItem>
                        <SelectItem value="remediating">Remediating</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="containment" className="mt-4">
                  <div className="space-y-3">
                    {selectedIncident.containmentSteps.map((step) => (
                      <Card key={step.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-medium">
                                {step.order}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{step.action.replace(/_/g, " ")}</span>
                                  {step.automated && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Zap className="w-3 h-3 mr-1" />
                                      Auto
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{step.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.status === "completed" ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : step.status === "failed" ? (
                                <XCircle className="w-5 h-5 text-red-500" />
                              ) : step.status === "in_progress" ? (
                                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                              ) : !step.automated ? (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    executeStepMutation.mutate({
                                      incidentId: selectedIncident.id,
                                      stepId: step.id,
                                      result: "Completed manually",
                                    });
                                  }}
                                  data-testid={`button-execute-step-${step.id}`}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Execute
                                </Button>
                              ) : (
                                <Badge variant="outline">Pending</Badge>
                              )}
                            </div>
                          </div>
                          {step.result && (
                            <p className="mt-2 text-sm text-muted-foreground ml-11">
                              Result: {step.result}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="relative pl-6 border-l-2 border-muted space-y-4">
                      {selectedIncident.timeline.map((event) => (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-primary" />
                          <div className="ml-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {event.eventType.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(event.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm">{event.description}</p>
                            <p className="text-xs text-muted-foreground">by {event.actor}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="alerts" className="mt-4">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {selectedIncident.correlatedAlerts.map((alert) => (
                        <Card key={alert.alertId}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={severityColors[alert.severity]}>
                                    {alert.severity}
                                  </Badge>
                                  <Badge variant="outline">{alert.alertType}</Badge>
                                </div>
                                <p className="text-sm">{alert.message}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatTimestamp(alert.timestamp)}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">{alert.correlationScore}%</div>
                                <div className="text-xs text-muted-foreground">correlation</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
