import { useState, useEffect, useCallback } from "react";
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
  AlertCircle,
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Heart,
  Layers,
  Lock,
  Network,
  Play,
  RefreshCw,
  Server,
  Shield,
  TrendingUp,
  Users,
  Wifi,
  XCircle,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RealTimeAlert {
  id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  source: string;
  patientId?: string;
  timestamp: string;
  status: string;
  escalationLevel: number;
  noCdsCompliance: string;
}

interface AutomationJob {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
  startedAt: string;
  estimatedCompletion?: string;
  completedAt?: string;
  failureReason?: string;
  retryCount: number;
  priority: string;
  metrics: {
    recordsProcessed: number;
    recordsTotal: number;
    errorsCount: number;
    warningsCount: number;
  };
}

interface SecurityVulnerability {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  cvssScore?: number;
  status: string;
  remediationProgress: number;
  dueDate?: string;
  complianceImpact: string[];
}

interface ComponentHealth {
  id: string;
  name: string;
  type: string;
  status: string;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

interface PerformanceMetrics {
  timestamp: string;
  apiLatency: { p50: number; p90: number; p99: number; avg: number; max: number };
  databaseLatency: { p50: number; p90: number; p99: number; avg: number; max: number };
  throughput: { requestsPerSecond: number; eventsProcessedPerMinute: number; alertsGeneratedPerHour: number };
  resources: { cpuUsage: number; memoryUsage: number; diskUsage: number; activeConnections: number };
  fhirOperations: { readOperations: number; writeOperations: number; searchOperations: number; validationErrors: number; syncOperations: number };
}

interface MonitoringDashboard {
  alerts: {
    active: RealTimeAlert[];
    recentlyResolved: RealTimeAlert[];
    stats: { totalActive: number; bySeverity: Record<string, number>; byCategory: Record<string, number> };
  };
  jobs: {
    running: AutomationJob[];
    recent: AutomationJob[];
    stats: { totalRunning: number; totalCompleted24h: number; totalFailed24h: number; successRate: number };
  };
  security: {
    vulnerabilities: SecurityVulnerability[];
    stats: { totalOpen: number; critical: number; high: number; complianceScore: number };
  };
  health: {
    overall: string;
    components: ComponentHealth[];
    uptime: number;
  };
  performance: PerformanceMetrics;
}

export default function RealTimeMonitoring() {
  const [activeTab, setActiveTab] = useState("overview");
  const [liveAlerts, setLiveAlerts] = useState<RealTimeAlert[]>([]);
  const { toast } = useToast();

  const { data: dashboardData, refetch, isLoading } = useQuery<MonitoringDashboard>({
    queryKey: ["/api/monitoring/dashboard"],
    refetchInterval: 5000
  });

  useEffect(() => {
    if (dashboardData?.alerts?.active) {
      setLiveAlerts(dashboardData.alerts.active);
    }
  }, [dashboardData]);

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/monitoring/alerts/${alertId}/acknowledge`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/dashboard"] });
      toast({ title: "Alert Acknowledged", description: "The alert has been acknowledged" });
    }
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/monitoring/alerts/${alertId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/dashboard"] });
      toast({ title: "Alert Resolved", description: "The alert has been marked as resolved" });
    }
  });

  const escalateAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/monitoring/alerts/${alertId}/escalate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitoring/dashboard"] });
      toast({ title: "Alert Escalated", description: "The alert has been escalated" });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };


  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "critical": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getComponentIcon = (type: string) => {
    switch (type) {
      case "api": return <Server className="h-4 w-4" />;
      case "database": return <Database className="h-4 w-4" />;
      case "fhir_endpoint": return <Network className="h-4 w-4" />;
      case "ai_service": return <Zap className="h-4 w-4" />;
      case "cache": return <Cpu className="h-4 w-4" />;
      case "storage": return <HardDrive className="h-4 w-4" />;
      default: return <Layers className="h-4 w-4" />;
    }
  };

  const health = dashboardData?.health;
  const performance = dashboardData?.performance;
  const alertStats = dashboardData?.alerts?.stats;
  const jobStats = dashboardData?.jobs?.stats;
  const securityStats = dashboardData?.security?.stats;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-real-time-monitoring">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-monitoring">
            <Activity className="h-8 w-8 text-primary" />
            Real-Time Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Live system health, alerts, and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full animate-pulse ${health?.overall === "healthy" ? "bg-green-500" : health?.overall === "degraded" ? "bg-amber-500" : "bg-red-500"}`} />
            <span className="text-sm font-medium capitalize">{health?.overall || "Unknown"}</span>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            Alerts {(alertStats?.totalActive || 0) > 0 && <Badge variant="destructive" className="ml-1">{alertStats?.totalActive}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">Jobs</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card data-testid="card-active-alerts">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <BellRing className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{alertStats?.totalActive || 0}</div>
                <div className="flex gap-2 mt-2 text-xs">
                  <Badge variant="destructive">{alertStats?.bySeverity?.critical || 0} Critical</Badge>
                  <Badge variant="secondary">{alertStats?.bySeverity?.high || 0} High</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-running-jobs">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Running Jobs</CardTitle>
                <Play className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{jobStats?.totalRunning || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((jobStats?.successRate || 0) * 100)}% success rate
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-security-score">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{securityStats?.complianceScore || 0}%</div>
                <div className="flex gap-2 mt-2 text-xs">
                  <Badge variant="destructive">{securityStats?.critical || 0} Critical</Badge>
                  <Badge variant="secondary">{securityStats?.high || 0} High</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-uptime">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{health?.uptime || 0}%</div>
                <Progress value={health?.uptime || 0} className="h-2 mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  System Components
                </CardTitle>
                <CardDescription>Real-time health status of all components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {health?.components?.map(component => (
                  <div key={component.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {getComponentIcon(component.type)}
                      <div>
                        <div className="font-medium">{component.name}</div>
                        <div className="text-xs text-muted-foreground">{component.responseTime}ms latency</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getHealthIcon(component.status)}
                      <Badge className={getStatusColor(component.status)}>{component.status}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-live-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Live Metrics
                </CardTitle>
                <CardDescription>Current system performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><Cpu className="h-4 w-4" /> CPU Usage</span>
                    <span className="font-medium">{Math.round(performance?.resources?.cpuUsage || 0)}%</span>
                  </div>
                  <Progress value={performance?.resources?.cpuUsage || 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><Layers className="h-4 w-4" /> Memory Usage</span>
                    <span className="font-medium">{Math.round(performance?.resources?.memoryUsage || 0)}%</span>
                  </div>
                  <Progress value={performance?.resources?.memoryUsage || 0} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Disk Usage</span>
                    <span className="font-medium">{Math.round(performance?.resources?.diskUsage || 0)}%</span>
                  </div>
                  <Progress value={performance?.resources?.diskUsage || 0} className="h-2" />
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">API Latency (p50)</div>
                    <div className="text-lg font-medium">{Math.round(performance?.apiLatency?.p50 || 0)}ms</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Requests/sec</div>
                    <div className="text-lg font-medium">{Math.round(performance?.throughput?.requestsPerSecond || 0)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">FHIR Ops/min</div>
                    <div className="text-lg font-medium">{(performance?.fhirOperations?.readOperations || 0) + (performance?.fhirOperations?.writeOperations || 0)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Active Connections</div>
                    <div className="text-lg font-medium">{performance?.resources?.activeConnections || 0}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <Alert className="bg-muted/50">
            <Bell className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Real-time alerts from all monitoring systems. Critical alerts are automatically escalated.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5" />
                Active Alerts ({liveAlerts.length})
              </CardTitle>
              <CardDescription>Click to acknowledge or resolve alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {liveAlerts.map(alert => (
                    <Card key={alert.id} className={`${alert.severity === "critical" || alert.severity === "high" ? "ring-2 ring-destructive/50" : ""}`} data-testid={`alert-${alert.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className={`h-4 w-4 ${alert.severity === "critical" || alert.severity === "high" ? "text-destructive" : "text-amber-500"}`} />
                            <CardTitle className="text-base">{alert.title}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(alert.severity) as any}>{alert.severity}</Badge>
                            <Badge className={getStatusColor(alert.status)}>{alert.status}</Badge>
                          </div>
                        </div>
                        <CardDescription>{alert.message}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Source: {alert.source}</span>
                          <span>Time: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                          {alert.patientId && <span>Patient: {alert.patientId}</span>}
                          {alert.escalationLevel > 0 && (
                            <Badge variant="outline">Level {alert.escalationLevel} Escalation</Badge>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="gap-2">
                        {alert.status === "active" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                              disabled={acknowledgeAlertMutation.isPending}
                              data-testid={`button-ack-${alert.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Acknowledge
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => resolveAlertMutation.mutate(alert.id)}
                              disabled={resolveAlertMutation.isPending}
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => escalateAlertMutation.mutate(alert.id)}
                              disabled={escalateAlertMutation.isPending}
                              data-testid={`button-escalate-${alert.id}`}
                            >
                              Escalate
                            </Button>
                          </>
                        )}
                        {alert.status === "acknowledged" && (
                          <Button
                            size="sm"
                            onClick={() => resolveAlertMutation.mutate(alert.id)}
                            disabled={resolveAlertMutation.isPending}
                            data-testid={`button-resolve-${alert.id}`}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                  {liveAlerts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p className="text-lg font-medium">No Active Alerts</p>
                      <p className="text-sm">All systems are operating normally</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Automation Jobs
              </CardTitle>
              <CardDescription>Status of running and recent automation jobs</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {dashboardData?.jobs?.recent?.map(job => (
                    <Card key={job.id} data-testid={`job-${job.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{job.name}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(job.status)}>{job.status}</Badge>
                            <Badge variant="outline">{job.type.replace(/_/g, " ")}</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-2 space-y-2">
                        <Progress value={job.progress} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{job.progress}% complete</span>
                          <span>{job.metrics.recordsProcessed} / {job.metrics.recordsTotal} records</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Started: {new Date(job.startedAt).toLocaleTimeString()}</span>
                          {job.failureReason && (
                            <span className="text-destructive">Error: {job.failureReason}</span>
                          )}
                          {job.metrics.errorsCount > 0 && (
                            <Badge variant="destructive">{job.metrics.errorsCount} errors</Badge>
                          )}
                          {job.metrics.warningsCount > 0 && (
                            <Badge variant="secondary">{job.metrics.warningsCount} warnings</Badge>
                          )}
                        </div>
                      </CardContent>
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
                <Lock className="h-5 w-5" />
                Security Vulnerabilities
              </CardTitle>
              <CardDescription>Active security findings and remediation progress</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {dashboardData?.security?.vulnerabilities?.map(vuln => (
                    <Card key={vuln.id} data-testid={`vuln-${vuln.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{vuln.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={getSeverityColor(vuln.severity) as any}>{vuln.severity}</Badge>
                            {vuln.cvssScore && <Badge variant="outline">CVSS {vuln.cvssScore}</Badge>}
                            <Badge className={getStatusColor(vuln.status)}>{vuln.status.replace(/_/g, " ")}</Badge>
                          </div>
                        </div>
                        <CardDescription>{vuln.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Remediation Progress</span>
                          <span className="font-medium">{vuln.remediationProgress}%</span>
                        </div>
                        <Progress value={vuln.remediationProgress} className="h-2" />
                        <div className="flex flex-wrap gap-1 mt-2">
                          {vuln.complianceImpact.map((impact, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{impact}</Badge>
                          ))}
                        </div>
                        {vuln.dueDate && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due: {new Date(vuln.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-api-latency">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  API Latency
                </CardTitle>
                <CardDescription>Response time percentiles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">P50 (Median)</span>
                    <span className="text-lg font-bold text-green-500">{Math.round(performance?.apiLatency?.p50 || 0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">P90</span>
                    <span className="text-lg font-bold text-amber-500">{Math.round(performance?.apiLatency?.p90 || 0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">P99</span>
                    <span className="text-lg font-bold text-red-500">{Math.round(performance?.apiLatency?.p99 || 0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Max</span>
                    <span className="text-lg font-bold">{Math.round(performance?.apiLatency?.max || 0)}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-db-latency">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Latency
                </CardTitle>
                <CardDescription>Query response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">P50 (Median)</span>
                    <span className="text-lg font-bold text-green-500">{Math.round(performance?.databaseLatency?.p50 || 0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">P90</span>
                    <span className="text-lg font-bold text-amber-500">{Math.round(performance?.databaseLatency?.p90 || 0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">P99</span>
                    <span className="text-lg font-bold text-red-500">{Math.round(performance?.databaseLatency?.p99 || 0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Max</span>
                    <span className="text-lg font-bold">{Math.round(performance?.databaseLatency?.max || 0)}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-fhir-ops">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  FHIR Operations
                </CardTitle>
                <CardDescription>Healthcare data operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Read Operations</span>
                    <span className="text-lg font-bold">{performance?.fhirOperations?.readOperations || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Write Operations</span>
                    <span className="text-lg font-bold">{performance?.fhirOperations?.writeOperations || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Search Operations</span>
                    <span className="text-lg font-bold">{performance?.fhirOperations?.searchOperations || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Validation Errors</span>
                    <span className={`text-lg font-bold ${(performance?.fhirOperations?.validationErrors || 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                      {performance?.fhirOperations?.validationErrors || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-throughput">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  System Throughput
                </CardTitle>
                <CardDescription>Processing capacity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Requests/sec</span>
                    <span className="text-lg font-bold">{Math.round(performance?.throughput?.requestsPerSecond || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Events/min</span>
                    <span className="text-lg font-bold">{Math.round(performance?.throughput?.eventsProcessedPerMinute || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alerts/hour</span>
                    <span className="text-lg font-bold">{Math.round(performance?.throughput?.alertsGeneratedPerHour || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Connections</span>
                    <span className="text-lg font-bold">{performance?.resources?.activeConnections || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
