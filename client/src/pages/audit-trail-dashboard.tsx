import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Activity, AlertTriangle, Search, Download, RefreshCw, Filter, 
  Eye, Clock, User, Database, Settings, Shield, FileText,
  CheckCircle, XCircle, Bell, TrendingUp, BarChart3, AlertCircle,
  Loader2, ChevronLeft, ChevronRight
} from "lucide-react";

type AuditActionCategory = 
  | "data_source" | "configuration" | "rule_execution" | "ai_prediction"
  | "user_management" | "access_control" | "patient_record" | "system_event"
  | "integration" | "export";

type AuditActionType =
  | "create" | "read" | "update" | "delete" | "execute" | "configure"
  | "approve" | "reject" | "export" | "import" | "connect" | "disconnect"
  | "login" | "logout" | "prediction" | "validation" | "error";

type AuditSeverity = "info" | "warning" | "error" | "critical";

interface AuditEntry {
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
    category: AuditActionCategory;
    action: AuditActionType;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    description: string;
    changes?: { field: string; oldValue?: any; newValue?: any }[];
  };
  when: {
    timestamp: string;
    timezone: string;
    epochMs: number;
  };
  why: {
    reason?: string;
    businessJustification?: string;
    triggeredBy?: string;
    automatedAction?: boolean;
  };
  result: {
    success: boolean;
    statusCode?: number;
    errorMessage?: string;
    duration_ms?: number;
  };
  severity: AuditSeverity;
  tags: string[];
  phiAccessed?: boolean;
  complianceFlags?: string[];
}

interface AuditStatistics {
  totalLogs: number;
  byCategory: Record<AuditActionCategory, number>;
  byAction: Record<AuditActionType, number>;
  bySeverity: Record<AuditSeverity, number>;
  byUser: { userId: string; count: number }[];
  successRate: number;
  errorCount: number;
  phiAccessCount: number;
  timeRange: { start: string; end: string };
}

interface AnomalyAlert {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  detectedAt: string;
  source: string;
  status: "active" | "acknowledged" | "resolved";
  affectedResources?: string[];
  recommendedActions?: string[];
}

const categoryIcons: Record<AuditActionCategory, any> = {
  data_source: Database,
  configuration: Settings,
  rule_execution: Activity,
  ai_prediction: TrendingUp,
  user_management: User,
  access_control: Shield,
  patient_record: FileText,
  system_event: Bell,
  integration: RefreshCw,
  export: Download
};

const severityColors: Record<AuditSeverity, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  critical: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
};

const anomalySeverityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function StatCard({ title, value, icon: Icon, trend, color }: { 
  title: string; 
  value: string | number; 
  icon: any; 
  trend?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
      </CardContent>
    </Card>
  );
}

export default function AuditTrailDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [filters, setFilters] = useState({
    category: "",
    severity: "",
    action: "",
    searchText: "",
    startDate: "",
    endDate: ""
  });
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlert[]>(() => generateInitialMockAlerts());

  function generateInitialMockAlerts(): AnomalyAlert[] {
    return [
      {
        id: "alert-1",
        type: "unusual_access_pattern",
        severity: "high",
        title: "Unusual PHI Access Pattern Detected",
        description: "User accessed 50+ patient records in last hour, exceeding normal threshold of 20",
        detectedAt: new Date(Date.now() - 1800000).toISOString(),
        source: "Access Control Monitor",
        status: "active",
        affectedResources: ["patient_records"],
        recommendedActions: ["Review user activity", "Verify access justification", "Consider temporary access restriction"]
      },
      {
        id: "alert-2",
        type: "failed_auth_spike",
        severity: "critical",
        title: "Authentication Failure Spike",
        description: "15 failed login attempts detected from IP 192.168.1.100 in last 10 minutes",
        detectedAt: new Date(Date.now() - 600000).toISOString(),
        source: "Security Monitor",
        status: "active",
        affectedResources: ["auth_system"],
        recommendedActions: ["Block IP address", "Reset affected accounts", "Enable additional MFA"]
      },
      {
        id: "alert-3",
        type: "data_export_anomaly",
        severity: "medium",
        title: "Large Data Export Detected",
        description: "Bulk export of 1000+ records initiated outside business hours",
        detectedAt: new Date(Date.now() - 3600000).toISOString(),
        source: "Data Loss Prevention",
        status: "acknowledged",
        affectedResources: ["export_service"],
        recommendedActions: ["Verify export authorization", "Review export contents"]
      },
      {
        id: "alert-4",
        type: "config_change",
        severity: "low",
        title: "System Configuration Modified",
        description: "RBAC policy updated - new role 'data_analyst' permissions expanded",
        detectedAt: new Date(Date.now() - 7200000).toISOString(),
        source: "Configuration Monitor",
        status: "resolved",
        affectedResources: ["rbac_policies"],
        recommendedActions: ["Review permission changes", "Verify change authorization"]
      }
    ];
  }

  const { data: statistics, isLoading: statsLoading } = useQuery<AuditStatistics>({
    queryKey: ["/api/audit-trail/statistics"],
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.severity) params.append("severity", filters.severity);
    if (filters.action) params.append("action", filters.action);
    if (filters.searchText) params.append("searchText", filters.searchText);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    params.append("limit", pageSize.toString());
    params.append("offset", (page * pageSize).toString());
    params.append("sortBy", "timestamp");
    params.append("sortOrder", "desc");
    return params.toString();
  };

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{ logs: AuditEntry[]; total: number }>({
    queryKey: ["/api/audit-trail/logs", filters, page],
    queryFn: async () => {
      const res = await fetch(`/api/audit-trail/logs?${buildQueryString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    }
  });

  const acknowledgeAlert = (alertId: string) => {
    setAnomalyAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, status: "acknowledged" as const }
        : alert
    ));
    toast({ title: "Alert acknowledged", description: "The alert has been marked as acknowledged" });
  };

  const refetchAlerts = () => {
    setAnomalyAlerts(generateInitialMockAlerts());
    toast({ title: "Alerts refreshed" });
  };

  const exportMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      return apiRequest("POST", "/api/audit-trail/export", { 
        format, 
        filter: filters 
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Export started", description: `Export ID: ${data.exportId}` });
    },
    onError: () => {
      toast({ title: "Export failed", variant: "destructive" });
    }
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      category: "",
      severity: "",
      action: "",
      searchText: "",
      startDate: "",
      endDate: ""
    });
    setPage(0);
  };

  const totalPages = logsData ? Math.ceil(logsData.total / pageSize) : 0;
  const activeAlerts = anomalyAlerts.filter((a: AnomalyAlert) => a.status === "active");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Audit Trail Dashboard</h1>
          <p className="text-muted-foreground">Monitor user actions, system events, and security anomalies</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => { refetchLogs(); refetchAlerts(); }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={() => exportMutation.mutate("csv")}
            disabled={exportMutation.isPending}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {activeAlerts.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-800 dark:text-red-200">
                {activeAlerts.length} Active Anomaly Alert{activeAlerts.length > 1 ? "s" : ""}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeAlerts.slice(0, 2).map((alert: AnomalyAlert) => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-md">
                  <div className="flex items-center gap-3">
                    <Badge className={anomalySeverityColors[alert.severity]}>{alert.severity}</Badge>
                    <span className="font-medium">{alert.title}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setActiveTab("monitoring")}
                    data-testid={`button-view-alert-${alert.id}`}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="monitoring" data-testid="tab-monitoring">
            Monitoring
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">
                {activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {statsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : statistics ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                  title="Total Events" 
                  value={statistics.totalLogs.toLocaleString()} 
                  icon={Activity}
                  trend="Last 24 hours"
                />
                <StatCard 
                  title="Success Rate" 
                  value={`${(statistics.successRate * 100).toFixed(1)}%`} 
                  icon={CheckCircle}
                  color="text-green-600"
                />
                <StatCard 
                  title="Errors" 
                  value={statistics.errorCount} 
                  icon={XCircle}
                  color="text-red-600"
                />
                <StatCard 
                  title="PHI Accesses" 
                  value={statistics.phiAccessCount} 
                  icon={Shield}
                  color="text-blue-600"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Events by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(statistics.byCategory)
                        .filter(([_, count]) => count > 0)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 6)
                        .map(([category, count]) => {
                          const Icon = categoryIcons[category as AuditActionCategory] || Activity;
                          const percentage = (count / statistics.totalLogs * 100).toFixed(1);
                          return (
                            <div key={category} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="capitalize">{category.replace("_", " ")}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary" 
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground w-12 text-right">
                                  {count}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Events by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(["critical", "error", "warning", "info"] as AuditSeverity[]).map(severity => {
                        const count = statistics.bySeverity[severity] || 0;
                        const percentage = statistics.totalLogs > 0 
                          ? (count / statistics.totalLogs * 100).toFixed(1) 
                          : "0";
                        return (
                          <div key={severity} className="flex items-center justify-between">
                            <Badge className={severityColors[severity]}>{severity}</Badge>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Users by Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                    {statistics.byUser.slice(0, 8).map(({ userId, count }) => (
                      <div key={userId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate max-w-[100px]">{userId}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No statistics available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search logs..."
                      value={filters.searchText}
                      onChange={(e) => handleFilterChange("searchText", e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select 
                    value={filters.category} 
                    onValueChange={(v) => handleFilterChange("category", v)}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="data_source">Data Source</SelectItem>
                      <SelectItem value="configuration">Configuration</SelectItem>
                      <SelectItem value="rule_execution">Rule Execution</SelectItem>
                      <SelectItem value="ai_prediction">AI Prediction</SelectItem>
                      <SelectItem value="user_management">User Management</SelectItem>
                      <SelectItem value="access_control">Access Control</SelectItem>
                      <SelectItem value="patient_record">Patient Record</SelectItem>
                      <SelectItem value="system_event">System Event</SelectItem>
                      <SelectItem value="integration">Integration</SelectItem>
                      <SelectItem value="export">Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select 
                    value={filters.severity} 
                    onValueChange={(v) => handleFilterChange("severity", v)}
                  >
                    <SelectTrigger data-testid="select-severity">
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select 
                    value={filters.action} 
                    onValueChange={(v) => handleFilterChange("action", v)}
                  >
                    <SelectTrigger data-testid="select-action">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                      <SelectItem value="export">Export</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">Audit Logs</CardTitle>
                <span className="text-sm text-muted-foreground">
                  {logsData?.total.toLocaleString() || 0} total entries
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : logsData?.logs.length ? (
                <>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logsData.logs.map((log) => {
                          const CategoryIcon = categoryIcons[log.what.category] || Activity;
                          return (
                            <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  {formatTimestamp(log.timestamp)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="truncate max-w-[100px]">{log.who.userId}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <CategoryIcon className="h-3 w-3" />
                                  <span className="capitalize text-sm">
                                    {log.what.category.replace("_", " ")}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="capitalize">{log.what.action}</TableCell>
                              <TableCell>
                                <span className="truncate max-w-[120px] block">
                                  {log.what.resourceName || log.what.resourceType}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={severityColors[log.severity]}>
                                  {log.severity}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {log.result.success ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setSelectedLog(log)}
                                  data-testid={`button-view-log-${log.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No audit logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard 
              title="Active Alerts" 
              value={activeAlerts.length} 
              icon={AlertTriangle}
              color={activeAlerts.length > 0 ? "text-red-600" : "text-green-600"}
            />
            <StatCard 
              title="Critical" 
              value={anomalyAlerts.filter((a: AnomalyAlert) => a.severity === "critical" && a.status === "active").length} 
              icon={AlertCircle}
              color="text-red-600"
            />
            <StatCard 
              title="Acknowledged" 
              value={anomalyAlerts.filter((a: AnomalyAlert) => a.status === "acknowledged").length} 
              icon={CheckCircle}
              color="text-yellow-600"
            />
            <StatCard 
              title="Resolved" 
              value={anomalyAlerts.filter((a: AnomalyAlert) => a.status === "resolved").length} 
              icon={CheckCircle}
              color="text-green-600"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Anomaly Detection Alerts
              </CardTitle>
              <CardDescription>
                Real-time monitoring for unusual patterns and security events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalyAlerts.length > 0 ? (
                <div className="space-y-4">
                  {anomalyAlerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 border rounded-lg ${
                        alert.status === "active" 
                          ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950" 
                          : alert.status === "acknowledged"
                          ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950"
                          : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950"
                      }`}
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={anomalySeverityColors[alert.severity]}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {alert.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatTimestamp(alert.detectedAt)}
                            </span>
                          </div>
                          <h4 className="font-semibold mb-1">{alert.title}</h4>
                          <p className="text-sm text-muted-foreground mb-3">{alert.description}</p>
                          
                          {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium mb-1">Recommended Actions:</p>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {alert.recommendedActions.map((action, i) => (
                                  <li key={i}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {alert.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlert(alert.id)}
                              data-testid={`button-acknowledge-${alert.id}`}
                            >
                              Acknowledge
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
                  <p className="text-muted-foreground">No anomaly alerts detected</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Real-Time Monitoring Status</CardTitle>
              <CardDescription>System health and monitoring service status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span>Access Control Monitor</span>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span>Security Monitor</span>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span>Data Loss Prevention</span>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Full details for audit entry {selectedLog?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Timestamp</Label>
                  <p className="font-medium">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <div className="mt-1">
                    <Badge className={severityColors[selectedLog.severity]}>
                      {selectedLog.severity}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Who
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User ID:</span>
                    <span>{selectedLog.who.userId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span>{selectedLog.who.userRole}</span>
                  </div>
                  {selectedLog.who.ipAddress && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IP Address:</span>
                      <span>{selectedLog.who.ipAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  What
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="capitalize">{selectedLog.what.category.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Action:</span>
                    <span className="capitalize">{selectedLog.what.action}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resource:</span>
                    <span>{selectedLog.what.resourceType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Description:</span>
                    <p className="mt-1">{selectedLog.what.description}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Result
                </h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Success:</span>
                    <span>{selectedLog.result.success ? "Yes" : "No"}</span>
                  </div>
                  {selectedLog.result.duration_ms && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{selectedLog.result.duration_ms}ms</span>
                    </div>
                  )}
                  {selectedLog.result.errorMessage && (
                    <div>
                      <span className="text-muted-foreground">Error:</span>
                      <p className="mt-1 text-red-600">{selectedLog.result.errorMessage}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedLog.tags.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Tags</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedLog.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedLog.phiAccessed && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <Shield className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      PHI was accessed in this action
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>HIPAA Compliance Notice:</strong> All audit logs are retained for 2555 days (7 years) 
            in accordance with HIPAA regulations. Access to audit data is restricted to authorized personnel only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
