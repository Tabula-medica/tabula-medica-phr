import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { clickable } from "@/lib/a11y";
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  FileText, 
  Search,
  RefreshCw,
  Eye,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Filter
} from "lucide-react";

interface SensitiveDataPattern {
  id: string;
  name: string;
  description: string;
  category: string;
  indicators: string[];
  riskWeight: number;
}

interface AnomalyFlag {
  id: string;
  type: string;
  severity: string;
  description: string;
  confidence: number;
  indicators: string[];
  recommendation: string;
}

interface EnrichedAuditLog {
  id: string;
  timestamp: string;
  who: {
    userId: string;
    userRole: string;
    userName?: string;
    userEmail?: string;
    ipAddress?: string;
    sessionId?: string;
  };
  what: {
    category: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    description: string;
    changes?: { field: string; oldValue?: any; newValue?: any }[];
  };
  result: {
    success: boolean;
    statusCode?: number;
    errorMessage?: string;
  };
  severity: string;
  phiAccessed?: boolean;
  enrichment: {
    enrichedAt: string;
    riskScore: number;
    riskLevel: string;
    sensitiveDataPatterns: SensitiveDataPattern[];
    anomalyFlags: AnomalyFlag[];
    aiAnalysis: {
      summary: string;
      patterns: string[];
      recommendations: string[];
      complianceNotes: string[];
    };
    accessContext: {
      isAfterHours: boolean;
      isHighVolumeSession: boolean;
      accessedSensitiveResources: boolean;
      unusualBehavior: boolean;
    };
    noCdsCompliance: string;
  };
}

interface EnrichmentStatistics {
  totalEnriched: number;
  byRiskLevel: Record<string, number>;
  byAnomalyType: Record<string, number>;
  averageRiskScore: number;
  sensitiveAccessCount: number;
  flaggedCount: number;
  timeRange: { start: string; end: string };
}

interface DashboardData {
  metadata: {
    serviceName: string;
    version: string;
    description: string;
    noCdsCompliance: string;
  };
  statistics: EnrichmentStatistics;
  highRiskAlerts: EnrichedAuditLog[];
  recentLogs: EnrichedAuditLog[];
}

function getRiskLevelColor(level: string): string {
  switch (level) {
    case "critical": return "bg-red-500 text-white";
    case "high": return "bg-orange-500 text-white";
    case "medium": return "bg-yellow-500 text-black";
    case "low": return "bg-green-500 text-white";
    default: return "bg-gray-500 text-white";
  }
}

function getRiskLevelIcon(level: string) {
  switch (level) {
    case "critical": return <XCircle className="h-4 w-4" />;
    case "high": return <AlertTriangle className="h-4 w-4" />;
    case "medium": return <AlertCircle className="h-4 w-4" />;
    case "low": return <CheckCircle className="h-4 w-4" />;
    default: return <Shield className="h-4 w-4" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export default function AIAuditLogEnrichmentPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<EnrichedAuditLog | null>(null);
  const [showLogDetails, setShowLogDetails] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading, isError: dashboardError, refetch: refetchDashboard } = useQuery<DashboardData>({
    queryKey: ["/api/audit-enrichment/dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/audit-enrichment/dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }
      return response.json();
    }
  });

  const { data: logs, isLoading: logsLoading, isError: logsError, refetch: refetchLogs } = useQuery<EnrichedAuditLog[]>({
    queryKey: ["/api/audit-enrichment/logs", riskFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (riskFilter !== "all") {
        params.set("riskLevel", riskFilter);
      }
      params.set("limit", "50");
      const response = await fetch(`/api/audit-enrichment/logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch enriched logs");
      }
      return response.json();
    }
  });

  const { data: alerts, isLoading: alertsLoading, isError: alertsError, refetch: refetchAlerts } = useQuery<EnrichedAuditLog[]>({
    queryKey: ["/api/audit-enrichment/alerts"],
    queryFn: async () => {
      const response = await fetch("/api/audit-enrichment/alerts");
      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }
      return response.json();
    }
  });

  const handleRefresh = () => {
    refetchDashboard();
    refetchLogs();
    refetchAlerts();
  };

  const filteredLogs = logs?.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.who.userName?.toLowerCase().includes(query) ||
      log.who.userId.toLowerCase().includes(query) ||
      log.what.resourceType.toLowerCase().includes(query) ||
      log.what.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">AI Audit Log Enrichment</h1>
              <p className="text-muted-foreground mt-1">
                AI-powered security monitoring with anomaly detection and risk scoring
              </p>
            </div>
            <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {dashboard?.metadata?.noCdsCompliance && (
            <Card className="border-amber-500 bg-amber-500/10">
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="text-compliance-notice">
                    {dashboard.metadata.noCdsCompliance}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">
                <FileText className="h-4 w-4 mr-2" />
                Enriched Logs
              </TabsTrigger>
              <TabsTrigger value="alerts" data-testid="tab-alerts">
                <AlertTriangle className="h-4 w-4 mr-2" />
                High-Risk Alerts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              {dashboardLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : dashboardError ? (
                <Card className="border-red-500">
                  <CardContent className="py-8 text-center">
                    <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-lg font-medium">Failed to load dashboard data</p>
                    <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page</p>
                    <Button onClick={() => refetchDashboard()} variant="outline" className="mt-4">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : dashboard ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card data-testid="card-total-logs">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Enriched</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{dashboard.statistics.totalEnriched}</div>
                        <p className="text-xs text-muted-foreground">Audit log entries</p>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-avg-risk">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{dashboard.statistics.averageRiskScore}</div>
                        <Progress value={dashboard.statistics.averageRiskScore} className="mt-2" />
                      </CardContent>
                    </Card>

                    <Card data-testid="card-flagged">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Flagged Entries</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{dashboard.statistics.flaggedCount}</div>
                        <p className="text-xs text-muted-foreground">With anomalies detected</p>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-sensitive">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Sensitive Access</CardTitle>
                        <Shield className="h-4 w-4 text-red-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{dashboard.statistics.sensitiveAccessCount}</div>
                        <p className="text-xs text-muted-foreground">PHI/PII accessed</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Risk Level Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(dashboard.statistics.byRiskLevel).map(([level, count]) => (
                            <div key={level} className="flex items-center gap-3">
                              <Badge className={`${getRiskLevelColor(level)} w-20 justify-center`}>
                                {level}
                              </Badge>
                              <div className="flex-1">
                                <Progress 
                                  value={(count / Math.max(dashboard.statistics.totalEnriched, 1)) * 100} 
                                />
                              </div>
                              <span className="text-sm font-medium w-12 text-right">{count}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recent High-Risk Alerts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-3">
                            {dashboard.highRiskAlerts.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No high-risk alerts detected
                              </p>
                            ) : (
                              dashboard.highRiskAlerts.map(alert => (
                                <div 
                                  key={alert.id} 
                                  className="p-3 rounded-lg border hover-elevate cursor-pointer"
                                  {...clickable(() => {
                                    setSelectedLog(alert);
                                    setShowLogDetails(true);
                                  })}
                                  data-testid={`alert-item-${alert.id}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {getRiskLevelIcon(alert.enrichment.riskLevel)}
                                      <span className="font-medium text-sm">
                                        {alert.who.userName || alert.who.userId}
                                      </span>
                                    </div>
                                    <Badge className={getRiskLevelColor(alert.enrichment.riskLevel)}>
                                      {alert.enrichment.riskScore}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                    {alert.what.description}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Anomaly Type Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Object.entries(dashboard.statistics.byAnomalyType)
                          .filter(([_, count]) => count > 0)
                          .map(([type, count]) => (
                            <div key={type} className="p-3 rounded-lg border text-center">
                              <div className="text-lg font-bold">{count}</div>
                              <div className="text-xs text-muted-foreground">
                                {type.replace(/_/g, " ")}
                              </div>
                            </div>
                          ))}
                        {Object.values(dashboard.statistics.byAnomalyType).every(c => c === 0) && (
                          <p className="text-sm text-muted-foreground col-span-full text-center py-4">
                            No anomalies detected
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>Enriched Audit Logs</CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search logs..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 w-64"
                          data-testid="input-search-logs"
                        />
                      </div>
                      <Select value={riskFilter} onValueChange={setRiskFilter}>
                        <SelectTrigger className="w-40" data-testid="select-risk-filter">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue placeholder="Risk Level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {logsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : logsError ? (
                    <div className="py-8 text-center">
                      <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <p className="text-lg font-medium">Failed to load enriched logs</p>
                      <p className="text-sm text-muted-foreground mt-1">Please try again</p>
                      <Button onClick={() => refetchLogs()} variant="outline" className="mt-4">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3">
                        {filteredLogs?.map(log => (
                          <div
                            key={log.id}
                            className="p-4 rounded-lg border hover-elevate cursor-pointer"
                            {...clickable(() => {
                              setSelectedLog(log);
                              setShowLogDetails(true);
                            })}
                            data-testid={`log-item-${log.id}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getRiskLevelIcon(log.enrichment.riskLevel)}
                                  <span className="font-medium">
                                    {log.who.userName || log.who.userId}
                                  </span>
                                  <Badge variant="outline">{log.who.userRole}</Badge>
                                  <Badge variant="secondary">{log.what.action}</Badge>
                                  {log.phiAccessed && (
                                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                      PHI
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {log.what.description}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(log.timestamp)}
                                  </span>
                                  <span>{log.what.resourceType}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge className={getRiskLevelColor(log.enrichment.riskLevel)}>
                                  Score: {log.enrichment.riskScore}
                                </Badge>
                                {log.enrichment.anomalyFlags.length > 0 && (
                                  <Badge variant="outline" className="text-orange-600">
                                    {log.enrichment.anomalyFlags.length} anomalies
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {filteredLogs?.length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            No logs match your criteria
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>High-Risk Security Alerts</CardTitle>
                  <CardDescription>
                    Audit log entries flagged as high or critical risk requiring review
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {alertsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : alertsError ? (
                    <div className="py-8 text-center">
                      <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <p className="text-lg font-medium">Failed to load alerts</p>
                      <p className="text-sm text-muted-foreground mt-1">Please try again</p>
                      <Button onClick={() => refetchAlerts()} variant="outline" className="mt-4">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {alerts?.map(alert => (
                        <Card 
                          key={alert.id} 
                          className="border-l-4 border-l-red-500 hover-elevate cursor-pointer"
                          onClick={() => {
                            setSelectedLog(alert);
                            setShowLogDetails(true);
                          }}
                          data-testid={`alert-card-${alert.id}`}
                        >
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <AlertTriangle className="h-5 w-5 text-red-500" />
                                  <span className="font-bold">
                                    {alert.who.userName || alert.who.userId}
                                  </span>
                                  <Badge className={getRiskLevelColor(alert.enrichment.riskLevel)}>
                                    {alert.enrichment.riskLevel.toUpperCase()}
                                  </Badge>
                                </div>
                                <p className="text-sm mt-2">{alert.what.description}</p>
                                
                                {alert.enrichment.anomalyFlags.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                      DETECTED ANOMALIES:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {alert.enrichment.anomalyFlags.map(flag => (
                                        <Badge key={flag.id} variant="outline" className="text-orange-600">
                                          {flag.type.replace(/_/g, " ")}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(alert.timestamp)}
                                  </span>
                                  <span>{alert.what.resourceType}</span>
                                  {alert.who.ipAddress && (
                                    <span>IP: {alert.who.ipAddress}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-red-500">
                                  {alert.enrichment.riskScore}
                                </div>
                                <p className="text-xs text-muted-foreground">Risk Score</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {alerts?.length === 0 && (
                        <div className="text-center py-12">
                          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                          <p className="text-lg font-medium">No High-Risk Alerts</p>
                          <p className="text-sm text-muted-foreground">
                            All audit logs are within acceptable risk thresholds
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showLogDetails} onOpenChange={setShowLogDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Enriched Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Complete analysis and risk assessment for this audit entry
            </DialogDescription>
          </DialogHeader>
          
          {selectedLog && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getRiskLevelIcon(selectedLog.enrichment.riskLevel)}
                    <div>
                      <p className="font-bold">{selectedLog.who.userName || selectedLog.who.userId}</p>
                      <p className="text-sm text-muted-foreground">{selectedLog.who.userRole}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={`${getRiskLevelColor(selectedLog.enrichment.riskLevel)} text-lg px-4 py-2`}>
                      Risk Score: {selectedLog.enrichment.riskScore}
                    </Badge>
                  </div>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Action Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-muted-foreground">Action:</span>
                        <span className="ml-2 font-medium">{selectedLog.what.action}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Resource:</span>
                        <span className="ml-2 font-medium">{selectedLog.what.resourceType}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Category:</span>
                        <span className="ml-2 font-medium">{selectedLog.what.category}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="ml-2 font-medium">{formatDate(selectedLog.timestamp)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>
                      <p className="mt-1">{selectedLog.what.description}</p>
                    </div>
                  </CardContent>
                </Card>

                {selectedLog.enrichment.aiAnalysis && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">AI Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>{selectedLog.enrichment.aiAnalysis.summary}</p>
                      
                      {selectedLog.enrichment.aiAnalysis.recommendations.length > 0 && (
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Recommendations:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {selectedLog.enrichment.aiAnalysis.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedLog.enrichment.aiAnalysis.complianceNotes.length > 0 && (
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Compliance Notes:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {selectedLog.enrichment.aiAnalysis.complianceNotes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {selectedLog.enrichment.anomalyFlags.length > 0 && (
                  <Card className="border-orange-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Detected Anomalies ({selectedLog.enrichment.anomalyFlags.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedLog.enrichment.anomalyFlags.map(flag => (
                        <div key={flag.id} className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{flag.type.replace(/_/g, " ")}</p>
                              <p className="text-sm text-muted-foreground">{flag.description}</p>
                            </div>
                            <Badge className={getRiskLevelColor(flag.severity)}>
                              {flag.severity}
                            </Badge>
                          </div>
                          <p className="text-sm mt-2">
                            <span className="font-medium">Recommendation:</span> {flag.recommendation}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              Confidence: {Math.round(flag.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedLog.enrichment.sensitiveDataPatterns.length > 0 && (
                  <Card className="border-red-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        Sensitive Data Patterns ({selectedLog.enrichment.sensitiveDataPatterns.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedLog.enrichment.sensitiveDataPatterns.map(pattern => (
                        <div key={pattern.id} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{pattern.name}</p>
                              <p className="text-sm text-muted-foreground">{pattern.description}</p>
                            </div>
                            <Badge variant="outline">{pattern.category}</Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Access Context</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {selectedLog.enrichment.accessContext.isAfterHours ? (
                          <XCircle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span>After Hours Access</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLog.enrichment.accessContext.isHighVolumeSession ? (
                          <XCircle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span>High Volume Session</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLog.enrichment.accessContext.accessedSensitiveResources ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span>Sensitive Resources</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLog.enrichment.accessContext.unusualBehavior ? (
                          <XCircle className="h-4 w-4 text-orange-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <span>Unusual Behavior</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
