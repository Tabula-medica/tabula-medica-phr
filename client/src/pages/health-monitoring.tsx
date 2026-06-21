import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { HealthMonitoringAlert, InterventionRecommendation } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  Activity,
  Heart,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Filter,
  Bell,
  BellRing,
  Stethoscope,
  Pill,
  FileText,
  Brain,
  Target,
  Loader2,
  ChevronRight,
  AlertCircle,
  Zap,
} from "lucide-react";

interface DashboardData {
  summary: {
    totalMonitoredPatients: number;
    criticalAlerts: number;
    highPriorityAlerts: number;
    pendingInterventions: number;
    resolvedToday: number;
    avgResponseTime: number;
  };
  alertsByCategory: { category: string; count: number }[];
  alertsBySeverity: { severity: string; count: number }[];
  recentAlerts: HealthMonitoringAlert[];
  pendingInterventions: InterventionRecommendation[];
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const severityBadgeVariants: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const categoryIcons: Record<string, React.ReactNode> = {
  vital_signs: <Heart className="h-4 w-4" />,
  lab_results: <FileText className="h-4 w-4" />,
  prom_scores: <Target className="h-4 w-4" />,
  medication_adherence: <Pill className="h-4 w-4" />,
  symptom_progression: <TrendingUp className="h-4 w-4" />,
  journal_sentiment: <Brain className="h-4 w-4" />,
  composite_risk: <AlertTriangle className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  acknowledged: "bg-yellow-500",
  in_progress: "bg-purple-500",
  resolved: "bg-green-500",
  escalated: "bg-red-500",
  dismissed: "bg-gray-500",
};

function AlertCard({ alert, onAcknowledge, onResolve, onEscalate }: {
  alert: HealthMonitoringAlert;
  onAcknowledge: () => void;
  onResolve: () => void;
  onEscalate: () => void;
}) {
  return (
    <Card data-testid={`card-alert-${alert.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${severityColors[alert.severity] || "bg-gray-500"}`} />
            {categoryIcons[alert.category] || <Activity className="h-4 w-4" />}
            <CardTitle className="text-base">{alert.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={severityBadgeVariants[alert.severity]} data-testid={`badge-severity-${alert.id}`}>
              {alert.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {alert.status}
            </Badge>
          </div>
        </div>
        <CardDescription className="flex items-center gap-2 mt-1">
          <User className="h-3 w-3" />
          {alert.patientName}
          <span className="text-muted-foreground">|</span>
          <Clock className="h-3 w-3" />
          {new Date(alert.createdAt).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
        
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="analysis" className="border-none">
            <AccordionTrigger className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Analysis
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">{alert.aiAnalysis}</p>
            </AccordionContent>
          </AccordionItem>

          {alert.earlyWarningSignals.length > 0 && (
            <AccordionItem value="warnings" className="border-none">
              <AccordionTrigger className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Early Warning Signs ({alert.earlyWarningSignals.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1">
                  {alert.earlyWarningSignals.map((signal, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                      {signal}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {alert.recommendedActions.length > 0 && (
            <AccordionItem value="actions" className="border-none">
              <AccordionTrigger className="py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  Recommended Actions ({alert.recommendedActions.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1">
                  {alert.recommendedActions.map((action, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {action}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>Risk Score: {alert.riskScore}%</span>
          <span>|</span>
          <span>Confidence: {alert.confidenceScore}%</span>
        </div>
      </CardContent>
      {alert.status === "new" && (
        <CardFooter className="pt-2 flex gap-2 flex-wrap">
          <Button size="sm" onClick={onAcknowledge} data-testid={`button-acknowledge-${alert.id}`}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Acknowledge
          </Button>
          <Button size="sm" variant="outline" onClick={onResolve} data-testid={`button-resolve-${alert.id}`}>
            Resolve
          </Button>
          <Button size="sm" variant="destructive" onClick={onEscalate} data-testid={`button-escalate-${alert.id}`}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Escalate
          </Button>
        </CardFooter>
      )}
      {alert.status === "acknowledged" && (
        <CardFooter className="pt-2 flex gap-2 flex-wrap">
          <Button size="sm" onClick={onResolve} data-testid={`button-resolve-${alert.id}`}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Mark Resolved
          </Button>
          <Button size="sm" variant="destructive" onClick={onEscalate} data-testid={`button-escalate-${alert.id}`}>
            <ArrowUpRight className="h-4 w-4 mr-1" />
            Escalate
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function InterventionCard({ intervention, onApprove, onComplete }: {
  intervention: InterventionRecommendation;
  onApprove: () => void;
  onComplete: () => void;
}) {
  const priorityColors: Record<string, string> = {
    immediate: "text-red-500",
    urgent: "text-orange-500",
    routine: "text-blue-500",
    elective: "text-green-500",
  };

  return (
    <Card data-testid={`card-intervention-${intervention.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">{intervention.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={priorityColors[intervention.priority]}>
              {intervention.priority.toUpperCase()}
            </Badge>
            <Badge variant="secondary">
              {intervention.type.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
        <CardDescription>{intervention.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-1">Rationale</h4>
            <p className="text-sm text-muted-foreground">{intervention.rationale}</p>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-1">Expected Outcome</h4>
            <p className="text-sm text-muted-foreground">{intervention.expectedOutcome}</p>
          </div>

          {intervention.actionSteps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">Action Steps</h4>
              <ol className="space-y-1 list-decimal list-inside">
                {intervention.actionSteps.map((step, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {step.action}
                    <span className="text-xs ml-2 text-muted-foreground">({step.responsible})</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Risk Reduction: {intervention.estimatedImpact.riskReduction}%</span>
            <span>Time to Effect: {intervention.estimatedImpact.timeToEffect}</span>
            <span>Confidence: {intervention.estimatedImpact.confidence}%</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex gap-2 flex-wrap">
        {String(intervention.status) === "recommended" && (
          <Button size="sm" onClick={onApprove} data-testid={`button-approve-${intervention.id}`}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Approve
          </Button>
        )}
        {(String(intervention.status) === "recommended" || String(intervention.status) === "approved") && (
          <Button size="sm" variant="outline" onClick={onComplete} data-testid={`button-complete-${intervention.id}`}>
            Mark Complete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function HealthMonitoring() {
  const [activeTab, setActiveTab] = useState("overview");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [escalateTo, setEscalateTo] = useState("");

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/health-monitoring/dashboard"],
  });

  const { data: allAlerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<HealthMonitoringAlert[]>({
    queryKey: ["/api/health-monitoring/alerts"],
  });

  const { data: allInterventions, isLoading: interventionsLoading, refetch: refetchInterventions } = useQuery<InterventionRecommendation[]>({
    queryKey: ["/api/health-monitoring/interventions"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/health-monitoring/alerts/${alertId}/acknowledge`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-monitoring"] });
      refetchDashboard();
      refetchAlerts();
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/health-monitoring/alerts/${alertId}/resolve`, { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-monitoring"] });
      refetchDashboard();
      refetchAlerts();
      setResolveDialogOpen(false);
      setResolutionNotes("");
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ alertId, escalateTo }: { alertId: string; escalateTo: string }) => {
      const response = await apiRequest("POST", `/api/health-monitoring/alerts/${alertId}/escalate`, { escalateTo });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-monitoring"] });
      refetchDashboard();
      refetchAlerts();
      setEscalateDialogOpen(false);
      setEscalateTo("");
    },
  });

  const approveInterventionMutation = useMutation({
    mutationFn: async (interventionId: string) => {
      const response = await apiRequest("POST", `/api/health-monitoring/interventions/${interventionId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-monitoring"] });
      refetchInterventions();
    },
  });

  const completeInterventionMutation = useMutation({
    mutationFn: async (interventionId: string) => {
      const response = await apiRequest("POST", `/api/health-monitoring/interventions/${interventionId}/complete`, { notes: "Completed" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-monitoring"] });
      refetchInterventions();
    },
  });

  const filteredAlerts = allAlerts?.filter(alert => {
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    if (statusFilter !== "all" && alert.status !== statusFilter) return false;
    return true;
  }) || [];

  const isLoading = dashboardLoading || alertsLoading || interventionsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BellRing className="h-8 w-8 text-primary" />
            Proactive Health Monitoring
          </h1>
          <p className="text-muted-foreground">
            AI-powered early warning system for patient deterioration detection
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetchDashboard();
            refetchAlerts();
            refetchInterventions();
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-critical-alerts">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{dashboard?.summary.criticalAlerts || 0}</div>
              <p className="text-xs text-muted-foreground">Requires immediate attention</p>
            </CardContent>
          </Card>

          <Card data-testid="card-high-priority">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <Bell className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{dashboard?.summary.highPriorityAlerts || 0}</div>
              <p className="text-xs text-muted-foreground">Review within 24 hours</p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-interventions">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Interventions</CardTitle>
              <Stethoscope className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.summary.pendingInterventions || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval or action</p>
            </CardContent>
          </Card>

          <Card data-testid="card-resolved-today">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{dashboard?.summary.resolvedToday || 0}</div>
              <p className="text-xs text-muted-foreground">Alerts successfully addressed</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-monitoring" className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            All Alerts
            {filteredAlerts.length > 0 && (
              <Badge variant="secondary" className="ml-2">{filteredAlerts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="interventions" data-testid="tab-interventions">
            Interventions
            {allInterventions?.filter(i => String(i.status) === "recommended" || String(i.status) === "approved").length ? (
              <Badge variant="secondary" className="ml-2">
                {allInterventions.filter(i => String(i.status) === "recommended" || String(i.status) === "approved").length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Alerts
                </CardTitle>
                <CardDescription>Latest health monitoring alerts requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {dashboard?.recentAlerts?.slice(0, 5).map(alert => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className={`w-2 h-2 rounded-full mt-2 ${severityColors[alert.severity]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{alert.title}</span>
                            <Badge variant="outline" className="text-xs">{alert.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{alert.patientName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTab("alerts")}
                          data-testid={`button-view-alert-${alert.id}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {(!dashboard?.recentAlerts || dashboard.recentAlerts.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>No active alerts</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Pending Interventions
                </CardTitle>
                <CardDescription>Recommended interventions awaiting action</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {dashboard?.pendingInterventions?.map(intervention => (
                      <div key={intervention.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{intervention.title}</span>
                          <Badge variant="outline" className="text-xs">{intervention.priority}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{intervention.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => approveInterventionMutation.mutate(intervention.id)}
                            disabled={approveInterventionMutation.isPending}
                            data-testid={`button-quick-approve-${intervention.id}`}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!dashboard?.pendingInterventions || dashboard.pendingInterventions.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>No pending interventions</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {dashboard?.alertsByCategory && dashboard.alertsByCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alerts by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {dashboard.alertsByCategory.map(cat => (
                    <div key={cat.category} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      {categoryIcons[cat.category] || <Activity className="h-4 w-4" />}
                      <span className="text-sm font-medium">{cat.category.replace(/_/g, " ")}</span>
                      <Badge variant="secondary">{cat.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={() => acknowledgeMutation.mutate(alert.id)}
                onResolve={() => {
                  setSelectedAlertId(alert.id);
                  setResolveDialogOpen(true);
                }}
                onEscalate={() => {
                  setSelectedAlertId(alert.id);
                  setEscalateDialogOpen(true);
                }}
              />
            ))}
            {filteredAlerts.length === 0 && (
              <div className="col-span-2 text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No alerts match your filters</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="interventions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {allInterventions?.map(intervention => (
              <InterventionCard
                key={intervention.id}
                intervention={intervention}
                onApprove={() => approveInterventionMutation.mutate(intervention.id)}
                onComplete={() => completeInterventionMutation.mutate(intervention.id)}
              />
            ))}
            {(!allInterventions || allInterventions.length === 0) && (
              <div className="col-span-2 text-center py-12 text-muted-foreground">
                <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No intervention recommendations</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Alert</DialogTitle>
            <DialogDescription>
              Add notes about how this alert was resolved.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Resolution notes..."
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            className="min-h-[100px]"
            data-testid="textarea-resolution-notes"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedAlertId && resolveMutation.mutate({ alertId: selectedAlertId, notes: resolutionNotes })}
              disabled={resolveMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate Alert</DialogTitle>
            <DialogDescription>
              Specify who this alert should be escalated to.
            </DialogDescription>
          </DialogHeader>
          <Select value={escalateTo} onValueChange={setEscalateTo}>
            <SelectTrigger data-testid="select-escalate-to">
              <SelectValue placeholder="Select escalation target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="attending_physician">Attending Physician</SelectItem>
              <SelectItem value="department_head">Department Head</SelectItem>
              <SelectItem value="specialist">Specialist</SelectItem>
              <SelectItem value="emergency_team">Emergency Team</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedAlertId && escalateTo && escalateMutation.mutate({ alertId: selectedAlertId, escalateTo })}
              disabled={!escalateTo || escalateMutation.isPending}
              data-testid="button-confirm-escalate"
            >
              {escalateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Escalate Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-monitoring-disclaimer" />
    </div>
  );
}