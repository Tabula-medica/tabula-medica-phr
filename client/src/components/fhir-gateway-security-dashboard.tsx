import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  Ban,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  Key,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Timer,
  TrendingUp,
  User,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

interface SMARTApp {
  id: string;
  clientId: string;
  name: string;
  description: string;
  status: "active" | "suspended" | "revoked";
  trustLevel: "trusted" | "standard" | "restricted";
  registeredAt: string;
  lastAccessedAt?: string;
  totalRequests: number;
  metadata: {
    vendor?: string;
    version?: string;
    category?: string;
  };
}

interface ThreatEvent {
  id: string;
  timestamp: string;
  patternName: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  appName?: string;
  description: string;
  mitigationApplied: string;
  resolved: boolean;
  aiAnalysis?: string;
}

interface GatewayAuditLog {
  id: string;
  timestamp: string;
  appName?: string;
  username?: string;
  resourceType?: string;
  operation: string;
  responseStatus: number;
  responseTimeMs: number;
  accessDecision: {
    allowed: boolean;
    reason: string;
    riskScore: number;
  };
  threatDetection: {
    threatLevel: string;
    threats: string[];
  };
}

interface AIThreatAnalysis {
  id: string;
  timestamp: string;
  findings: {
    threatLevel: string;
    anomaliesDetected: number;
    suspiciousPatterns: string[];
    recommendations: string[];
  };
  detailedAnalysis: string;
  confidenceScore: number;
}

interface SecurityDashboard {
  summary: {
    totalApps: number;
    activeApps: number;
    suspendedApps: number;
    totalUsers: number;
    activeTokens: number;
    totalRequestsToday: number;
    blockedRequestsToday: number;
    threatEventsToday: number;
  };
  rateLimiting: {
    currentlyBlocked: number;
    violationsLast24h: number;
    topViolators: { identifier: string; type: string; violations: number }[];
  };
  threats: {
    activeThreats: number;
    threatsByLevel: Record<string, number>;
    recentEvents: ThreatEvent[];
  };
  accessPatterns: {
    requestsByApp: Record<string, number>;
    requestsByUser: Record<string, number>;
    requestsByResourceType: Record<string, number>;
    peakHourDistribution: number[];
  };
  compliance: {
    auditLogsToday: number;
    phiAccessCount: number;
    sensitiveAccessCount: number;
    complianceViolations: number;
  };
}

export function FHIRGatewaySecurityDashboard() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [threatFilter, setThreatFilter] = useState<string>("all");
  const [logFilter, setLogFilter] = useState<string>("all");

  const { data: dashboard, isLoading } = useQuery<SecurityDashboard>({
    queryKey: ["/api/fhir-gateway-security/dashboard"],
  });

  const { data: apps } = useQuery<SMARTApp[]>({
    queryKey: ["/api/fhir-gateway-security/apps"],
  });

  const threatQueryUrl = threatFilter === "all" 
    ? "/api/fhir-gateway-security/threat-events" 
    : `/api/fhir-gateway-security/threat-events?severity=${threatFilter}`;
  
  const { data: threatEvents } = useQuery<ThreatEvent[]>({
    queryKey: [threatQueryUrl],
  });

  const auditQueryUrl = logFilter === "all" 
    ? "/api/fhir-gateway-security/audit-logs" 
    : logFilter === "blocked" 
      ? "/api/fhir-gateway-security/audit-logs?blocked=true"
      : "/api/fhir-gateway-security/audit-logs?threatLevel=high";
  
  const { data: auditLogs } = useQuery<GatewayAuditLog[]>({
    queryKey: [auditQueryUrl],
  });

  const { data: aiAnalyses } = useQuery<AIThreatAnalysis[]>({
    queryKey: ["/api/fhir-gateway-security/ai-analyses"],
  });

  const updateAppStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/fhir-gateway-security/apps/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-gateway-security/apps"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-gateway-security/dashboard"] });
      toast({ title: "App Status Updated", description: "SMART app status has been changed." });
    },
    onError: () => {
      toast({ title: "Update Failed", description: "Could not update app status.", variant: "destructive" });
    },
  });

  const generateAIReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-gateway-security/ai-threat-report");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-gateway-security/ai-analyses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-gateway-security/dashboard"] });
      toast({ title: "AI Report Generated", description: "Security threat analysis complete." });
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not generate AI report.", variant: "destructive" });
    },
  });

  const resolveThreatMutation = useMutation({
    mutationFn: async ({ id, falsePositive }: { id: string; falsePositive: boolean }) => {
      const response = await apiRequest("POST", `/api/fhir-gateway-security/threat-events/${id}/resolve`, {
        resolvedBy: "admin",
        falsePositive,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-gateway-security/threat-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-gateway-security/dashboard"] });
      toast({ title: "Threat Resolved", description: "The threat event has been marked as resolved." });
    },
  });

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={variants[severity] || variants.low}>{severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: typeof CheckCircle }> = {
      active: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
      suspended: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
      revoked: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
    };
    const { color, icon: Icon } = variants[status] || variants.active;
    return (
      <Badge className={`${color} gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getTrustBadge = (level: string) => {
    const variants: Record<string, string> = {
      trusted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      standard: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      restricted: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return <Badge className={variants[level] || variants.standard}>{level}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = dashboard?.summary;
  const threats = dashboard?.threats;
  const rateLimiting = dashboard?.rateLimiting;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-security-title">
            FHIR API Gateway Security
          </h2>
          <p className="text-muted-foreground">
            Manage SMART app access controls, rate limiting, and threat detection
          </p>
        </div>
        <Button
          onClick={() => generateAIReportMutation.mutate()}
          disabled={generateAIReportMutation.isPending}
          data-testid="button-generate-ai-report"
        >
          <Brain className="mr-2 h-4 w-4" />
          {generateAIReportMutation.isPending ? "Analyzing..." : "Generate AI Report"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SMART Apps</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-apps">
              {summary?.activeApps || 0} / {summary?.totalApps || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.suspendedApps || 0} suspended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-requests-today">
              {summary?.totalRequestsToday || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.blockedRequestsToday || 0} blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-threats">
              {threats?.activeThreats || 0}
            </div>
            <div className="flex gap-1 mt-1">
              {threats?.threatsByLevel?.critical ? (
                <Badge variant="destructive" className="text-xs">{threats.threatsByLevel.critical} critical</Badge>
              ) : null}
              {threats?.threatsByLevel?.high ? (
                <Badge className="bg-orange-500 text-white text-xs">{threats.threatsByLevel.high} high</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limited</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-rate-limited">
              {rateLimiting?.currentlyBlocked || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {rateLimiting?.violationsLast24h || 0} violations (24h)
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Shield className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="apps" data-testid="tab-apps">
            <Smartphone className="mr-2 h-4 w-4" />
            SMART Apps
          </TabsTrigger>
          <TabsTrigger value="threats" data-testid="tab-threats">
            <ShieldAlert className="mr-2 h-4 w-4" />
            Threats
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="mr-2 h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="ai-insights" data-testid="tab-ai-insights">
            <Brain className="mr-2 h-4 w-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Threats</CardTitle>
                <CardDescription>Latest security events detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-recent-threats">
                  {threats?.recentEvents?.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{event.patternName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{event.appName || "Unknown app"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(event.severity)}
                        {event.resolved ? (
                          <Badge variant="outline" className="text-xs">Resolved</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {(!threats?.recentEvents || threats.recentEvents.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      <ShieldCheck className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No recent threats detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Rate Limit Violators</CardTitle>
                <CardDescription>Apps/users with most violations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-violators">
                  {rateLimiting?.topViolators?.map((violator, index) => (
                    <div key={index} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {violator.type === "app" ? (
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{violator.identifier}</span>
                        <Badge variant="outline" className="text-xs">{violator.type}</Badge>
                      </div>
                      <Badge variant="destructive">{violator.violations} violations</Badge>
                    </div>
                  ))}
                  {(!rateLimiting?.topViolators || rateLimiting.topViolators.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No rate limit violations</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Compliance Metrics</CardTitle>
              <CardDescription>HIPAA and security compliance status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4" data-testid="compliance-metrics">
                <div className="text-center p-4 rounded-lg border">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboard?.compliance?.auditLogsToday || 0}</div>
                  <p className="text-xs text-muted-foreground">Audit Logs Today</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboard?.compliance?.phiAccessCount || 0}</div>
                  <p className="text-xs text-muted-foreground">PHI Access Events</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{summary?.activeTokens || 0}</div>
                  <p className="text-xs text-muted-foreground">Active Tokens</p>
                </div>
                <div className="text-center p-4 rounded-lg border">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{dashboard?.compliance?.complianceViolations || 0}</div>
                  <p className="text-xs text-muted-foreground">Compliance Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMART App Management</CardTitle>
              <CardDescription>Manage access controls and rate limits for registered apps</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="list-smart-apps">
                {apps?.map((app) => (
                  <div key={app.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{app.name}</h4>
                          {getStatusBadge(app.status)}
                          {getTrustBadge(app.trustLevel)}
                        </div>
                        <p className="text-sm text-muted-foreground">{app.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Client ID: {app.clientId}</span>
                          {app.metadata?.vendor && <span>Vendor: {app.metadata.vendor}</span>}
                          {app.metadata?.version && <span>v{app.metadata.version}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{app.totalRequests.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total requests</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        {app.lastAccessedAt ? `Last accessed: ${formatDate(app.lastAccessedAt)}` : "Never accessed"}
                      </div>
                      <div className="flex items-center gap-2">
                        {app.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppStatusMutation.mutate({ id: app.id, status: "suspended" })}
                            disabled={updateAppStatusMutation.isPending}
                            data-testid={`button-suspend-${app.clientId}`}
                          >
                            <Ban className="mr-1 h-3 w-3" />
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateAppStatusMutation.mutate({ id: app.id, status: "active" })}
                            disabled={updateAppStatusMutation.isPending}
                            data-testid={`button-activate-${app.clientId}`}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateAppStatusMutation.mutate({ id: app.id, status: "revoked" })}
                          disabled={updateAppStatusMutation.isPending || app.status === "revoked"}
                          data-testid={`button-revoke-${app.clientId}`}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Threat Events</CardTitle>
                  <CardDescription>Security threats detected by AI and pattern matching</CardDescription>
                </div>
                <Select value={threatFilter} onValueChange={setThreatFilter}>
                  <SelectTrigger className="w-40" data-testid="select-threat-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Threats</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="list-threat-events">
                {threatEvents?.map((event) => (
                  <div key={event.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                          <h4 className="font-medium">{event.patternName}</h4>
                          {getSeverityBadge(event.severity)}
                          <Badge variant="outline">{event.type}</Badge>
                          {event.resolved && <Badge className="bg-green-100 text-green-800">Resolved</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        {event.appName && (
                          <p className="text-xs text-muted-foreground mt-1">App: {event.appName}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatDate(event.timestamp)}
                      </div>
                    </div>
                    {event.aiAnalysis && (
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs font-medium mb-1 flex items-center gap-1">
                          <Brain className="h-3 w-3" /> AI Analysis
                        </p>
                        <p className="text-sm text-muted-foreground">{event.aiAnalysis}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <Badge variant="outline">Mitigation: {event.mitigationApplied}</Badge>
                      {!event.resolved && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveThreatMutation.mutate({ id: event.id, falsePositive: true })}
                            data-testid={`button-false-positive-${event.id}`}
                          >
                            False Positive
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => resolveThreatMutation.mutate({ id: event.id, falsePositive: false })}
                            data-testid={`button-resolve-${event.id}`}
                          >
                            Mark Resolved
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>API Gateway Audit Logs</CardTitle>
                  <CardDescription>Complete request history with security context</CardDescription>
                </div>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="w-40" data-testid="select-log-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Requests</SelectItem>
                    <SelectItem value="blocked">Blocked Only</SelectItem>
                    <SelectItem value="threats">With Threats</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2" data-testid="list-audit-logs">
                {auditLogs?.slice(0, 50).map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {log.accessDecision.allowed ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium">{log.operation}</span>
                        {log.resourceType && <Badge variant="outline">{log.resourceType}</Badge>}
                        <span className="text-muted-foreground truncate">{log.appName || log.username || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={log.responseStatus < 400 ? "outline" : "destructive"}>
                          {log.responseStatus}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{log.responseTimeMs}ms</span>
                        {log.threatDetection.threatLevel !== "none" && (
                          <Badge className="bg-orange-100 text-orange-800">{log.threatDetection.threatLevel}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{formatDate(log.timestamp)}</span>
                      <span>Risk: {log.accessDecision.riskScore}</span>
                      {!log.accessDecision.allowed && <span className="text-red-500">{log.accessDecision.reason}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Security Analysis
                  </CardTitle>
                  <CardDescription>Machine learning-powered threat detection and recommendations</CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => generateAIReportMutation.mutate()}
                  disabled={generateAIReportMutation.isPending}
                  data-testid="button-refresh-ai"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${generateAIReportMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh Analysis
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {aiAnalyses && aiAnalyses.length > 0 ? (
                <div className="space-y-4" data-testid="list-ai-analyses">
                  {aiAnalyses.map((analysis) => (
                    <div key={analysis.id} className="p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Brain className="h-5 w-5" />
                          <span className="font-medium">Security Analysis</span>
                          {getSeverityBadge(analysis.findings.threatLevel)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Confidence: {(analysis.confidenceScore * 100).toFixed(0)}%</span>
                          <span>{formatDate(analysis.timestamp)}</span>
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="p-2 rounded bg-muted/50 text-center">
                          <div className="text-lg font-bold">{analysis.findings.anomaliesDetected}</div>
                          <p className="text-xs text-muted-foreground">Anomalies Detected</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50 text-center">
                          <div className="text-lg font-bold">{analysis.findings.suspiciousPatterns.length}</div>
                          <p className="text-xs text-muted-foreground">Suspicious Patterns</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50 text-center">
                          <div className="text-lg font-bold">{analysis.findings.recommendations.length}</div>
                          <p className="text-xs text-muted-foreground">Recommendations</p>
                        </div>
                      </div>
                      {analysis.detailedAnalysis && (
                        <div className="p-3 rounded-md bg-muted/50">
                          <p className="text-sm whitespace-pre-wrap">{analysis.detailedAnalysis}</p>
                        </div>
                      )}
                      {analysis.findings.recommendations.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Recommendations:</p>
                          <ul className="list-disc pl-4 text-sm text-muted-foreground">
                            {analysis.findings.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No AI analyses yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate an AI security report to analyze your API traffic
                  </p>
                  <Button onClick={() => generateAIReportMutation.mutate()} disabled={generateAIReportMutation.isPending}>
                    <Brain className="mr-2 h-4 w-4" />
                    Generate Report
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
