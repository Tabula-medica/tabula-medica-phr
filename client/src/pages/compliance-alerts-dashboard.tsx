import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Bell, 
  CheckCircle, 
  Clock, 
  Eye, 
  Filter,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
  XCircle,
  Activity,
  FileWarning,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
type AlertCategory = "merge_rejection" | "phi_access" | "access_review" | "audit_anomaly";
type AlertStatus = "active" | "acknowledged" | "resolved" | "dismissed";

interface ComplianceAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  details: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  status: AlertStatus;
  source: string;
  affectedResources?: string[];
  recommendedActions?: string[];
}

interface AlertThreshold {
  id: string;
  category: AlertCategory;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  thresholdValue: number;
  thresholdUnit: string;
  timeWindowMinutes: number;
  cooldownMinutes: number;
  notificationChannels: string[];
}

interface AlertStatistics {
  totalActive: number;
  bySeverity: Record<AlertSeverity, number>;
  byCategory: Record<AlertCategory, number>;
  last24Hours: number;
  last7Days: number;
  averageResolutionTimeMinutes: number;
}

interface DashboardData {
  statistics: AlertStatistics;
  recentAlerts: ComplianceAlert[];
  thresholds: AlertThreshold[];
  overdueAccessReviews: Array<{
    id: string;
    userName: string;
    roleName: string;
    daysOverdue: number;
    status: string;
  }>;
  mergeRejectionMetrics: {
    totalMerges: number;
    totalRejections: number;
    rejectionRate: number;
    topReasons: Array<{ reason: string; count: number }>;
  };
  topPHIAccessPatterns: Array<{
    userId: string;
    userName: string;
    accessCount: number;
    riskScore: number;
    suspiciousIndicators: string[];
  }>;
}

const severityConfig: Record<AlertSeverity, { color: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: "bg-red-500 text-white", icon: AlertCircle, label: "Critical" },
  high: { color: "bg-orange-500 text-white", icon: AlertTriangle, label: "High" },
  medium: { color: "bg-yellow-500 text-black", icon: Bell, label: "Medium" },
  low: { color: "bg-blue-500 text-white", icon: Activity, label: "Low" },
  info: { color: "bg-gray-500 text-white", icon: Eye, label: "Info" }
};

const categoryConfig: Record<AlertCategory, { icon: typeof Shield; label: string; color: string }> = {
  merge_rejection: { icon: Users, label: "Merge/Rejection", color: "text-purple-500" },
  phi_access: { icon: ShieldAlert, label: "PHI Access", color: "text-red-500" },
  access_review: { icon: UserCheck, label: "Access Review", color: "text-orange-500" },
  audit_anomaly: { icon: FileWarning, label: "Audit Anomaly", color: "text-yellow-500" }
};

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const config = severityConfig[severity];
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} gap-1`} data-testid={`badge-severity-${severity}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: AlertCategory }) {
  const config = categoryConfig[category];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${config.color}`} data-testid={`badge-category-${category}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const configs: Record<AlertStatus, { color: string; label: string }> = {
    active: { color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Active" },
    acknowledged: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", label: "Acknowledged" },
    resolved: { color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", label: "Resolved" },
    dismissed: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300", label: "Dismissed" }
  };
  const config = configs[status];
  return <Badge className={config.color}>{config.label}</Badge>;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend,
  testId
}: { 
  title: string; 
  value: string | number; 
  icon: typeof Shield;
  description?: string;
  trend?: { value: number; isPositive: boolean };
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        {trend && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trend.isPositive ? "text-green-500" : "text-red-500"}`}>
            <TrendingUp className={`w-3 h-3 ${!trend.isPositive ? "rotate-180" : ""}`} />
            {trend.value}% from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertCard({ alert, onAcknowledge, onResolve, onDismiss }: { 
  alert: ComplianceAlert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-3" data-testid={`alert-card-${alert.id}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <SeverityBadge severity={alert.severity} />
              <CategoryBadge category={alert.category} />
              <StatusBadge status={alert.status} />
            </div>
            <CardTitle className="text-base">{alert.title}</CardTitle>
            <CardDescription className="mt-1">{alert.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(alert.triggeredAt).toLocaleString()}
          </span>
          <span>Source: {alert.source}</span>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3">
            <Separator />
            {alert.recommendedActions && alert.recommendedActions.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Recommended Actions:</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {alert.recommendedActions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            {alert.details && Object.keys(alert.details).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Details:</h4>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(alert.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            data-testid={`btn-expand-${alert.id}`}
          >
            {expanded ? "Show Less" : "Show More"}
          </Button>
          
          {alert.status === "active" && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onAcknowledge(alert.id)}
                data-testid={`btn-acknowledge-${alert.id}`}
              >
                <Eye className="w-3 h-3 mr-1" />
                Acknowledge
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onResolve(alert.id)}
                data-testid={`btn-resolve-${alert.id}`}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Resolve
              </Button>
            </>
          )}
          
          {alert.status === "acknowledged" && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onResolve(alert.id)}
              data-testid={`btn-resolve-${alert.id}`}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Resolve
            </Button>
          )}

          {(alert.status === "active" || alert.status === "acknowledged") && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onDismiss(alert.id)}
              data-testid={`btn-dismiss-${alert.id}`}
            >
              <XCircle className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ThresholdConfigCard({ threshold, onUpdate }: { 
  threshold: AlertThreshold;
  onUpdate: (id: string, updates: Partial<AlertThreshold>) => void;
}) {
  const [value, setValue] = useState(threshold.thresholdValue.toString());

  return (
    <Card className="mb-3" data-testid={`threshold-${threshold.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-sm">{threshold.name}</CardTitle>
            <CardDescription className="text-xs">{threshold.description}</CardDescription>
          </div>
          <Switch
            checked={threshold.enabled}
            onCheckedChange={(enabled) => onUpdate(threshold.id, { enabled })}
            data-testid={`switch-${threshold.id}`}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor={`threshold-${threshold.id}`} className="text-xs">Threshold:</Label>
            <Input
              id={`threshold-${threshold.id}`}
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => onUpdate(threshold.id, { thresholdValue: parseInt(value) || threshold.thresholdValue })}
              className="w-20 h-8"
              data-testid={`input-threshold-${threshold.id}`}
            />
            <span className="text-xs text-muted-foreground">{threshold.thresholdUnit}</span>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={threshold.severity} />
          </div>
          <div className="text-xs text-muted-foreground">
            Window: {threshold.timeWindowMinutes}min
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComplianceAlertsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState<AlertStatus[]>(["active", "acknowledged"]);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity[]>([]);

  const { data: dashboardData, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/compliance-anomaly/dashboard"]
  });

  const { data: allAlerts } = useQuery<{ alerts: ComplianceAlert[] }>({
    queryKey: ["/api/compliance-anomaly/alerts", statusFilter.join(","), severityFilter.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter.length) params.set("status", statusFilter.join(","));
      if (severityFilter.length) params.set("severity", severityFilter.join(","));
      const res = await fetch(`/api/compliance-anomaly/alerts?${params}`);
      return res.json();
    }
  });

  const { data: thresholds } = useQuery<{ thresholds: AlertThreshold[] }>({
    queryKey: ["/api/compliance-anomaly/thresholds"]
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/compliance-anomaly/alerts/${id}/acknowledge`, { userId: "current-user" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-anomaly"] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/compliance-anomaly/alerts/${id}/resolve`, { userId: "current-user" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-anomaly"] });
    }
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/compliance-anomaly/alerts/${id}/dismiss`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-anomaly"] });
    }
  });

  const updateThresholdMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AlertThreshold> }) => 
      apiRequest("PATCH", `/api/compliance-anomaly/thresholds/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-anomaly/thresholds"] });
    }
  });

  const toggleStatusFilter = (status: AlertStatus) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleSeverityFilter = (severity: AlertSeverity) => {
    setSeverityFilter(prev => 
      prev.includes(severity) 
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-spinner">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = dashboardData?.statistics;

  return (
    <div className="container mx-auto p-4 max-w-7xl" data-testid="compliance-alerts-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Compliance Alerts Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor and respond to compliance anomalies in real-time
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="btn-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Active Alerts"
          value={stats?.totalActive || 0}
          icon={AlertTriangle}
          description="Requires attention"
          testId="stat-active-alerts"
        />
        <StatCard
          title="Critical Issues"
          value={stats?.bySeverity.critical || 0}
          icon={AlertCircle}
          description="Immediate action needed"
          testId="stat-critical"
        />
        <StatCard
          title="Last 24 Hours"
          value={stats?.last24Hours || 0}
          icon={Clock}
          description="New alerts triggered"
          testId="stat-24h"
        />
        <StatCard
          title="Avg Resolution Time"
          value={`${stats?.averageResolutionTimeMinutes || 0}m`}
          icon={CheckCircle}
          description="Average time to resolve"
          testId="stat-resolution-time"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid" data-testid="dashboard-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">All Alerts</TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4" data-testid="content-overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Recent Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {dashboardData?.recentAlerts.map(alert => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                      onResolve={(id) => resolveMutation.mutate(id)}
                      onDismiss={(id) => dismissMutation.mutate(id)}
                    />
                  ))}
                  {(!dashboardData?.recentAlerts || dashboardData.recentAlerts.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">No active alerts</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Merge/Rejection Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{dashboardData?.mergeRejectionMetrics.totalMerges || 0}</div>
                      <div className="text-xs text-muted-foreground">Total Merges</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{dashboardData?.mergeRejectionMetrics.totalRejections || 0}</div>
                      <div className="text-xs text-muted-foreground">Rejections</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${(dashboardData?.mergeRejectionMetrics.rejectionRate || 0) > 15 ? "text-red-500" : ""}`}>
                        {dashboardData?.mergeRejectionMetrics.rejectionRate?.toFixed(1) || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Rate</div>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div>
                    <h4 className="text-sm font-medium mb-2">Top Rejection Reasons</h4>
                    <div className="space-y-2">
                      {dashboardData?.mergeRejectionMetrics.topReasons.slice(0, 3).map((reason, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{reason.reason}</span>
                          <Badge variant="secondary">{reason.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Overdue Access Reviews
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardData?.overdueAccessReviews.map((review) => (
                      <div key={review.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{review.userName}</div>
                          <div className="text-xs text-muted-foreground">{review.roleName}</div>
                        </div>
                        <Badge 
                          className={review.status === "critical" ? "bg-red-500" : "bg-orange-500"}
                        >
                          {review.daysOverdue} days overdue
                        </Badge>
                      </div>
                    ))}
                    {(!dashboardData?.overdueAccessReviews || dashboardData.overdueAccessReviews.length === 0) && (
                      <p className="text-center text-muted-foreground py-4">All reviews up to date</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4" data-testid="content-alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div>
                  <Label className="text-xs mb-2 block">Status</Label>
                  <div className="flex flex-wrap gap-1">
                    {(["active", "acknowledged", "resolved", "dismissed"] as AlertStatus[]).map(status => (
                      <Button
                        key={status}
                        variant={statusFilter.includes(status) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleStatusFilter(status)}
                        data-testid={`filter-status-${status}`}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Severity</Label>
                  <div className="flex flex-wrap gap-1">
                    {(["critical", "high", "medium", "low", "info"] as AlertSeverity[]).map(severity => (
                      <Button
                        key={severity}
                        variant={severityFilter.includes(severity) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSeverityFilter(severity)}
                        data-testid={`filter-severity-${severity}`}
                      >
                        {severity}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <ScrollArea className="h-[600px]">
            {allAlerts?.alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                onResolve={(id) => resolveMutation.mutate(id)}
                onDismiss={(id) => dismissMutation.mutate(id)}
              />
            ))}
            {(!allAlerts?.alerts || allAlerts.alerts.length === 0) && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No alerts match the current filters
                </CardContent>
              </Card>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4" data-testid="content-patterns">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                PHI Access Patterns
              </CardTitle>
              <CardDescription>Users with suspicious access patterns based on volume and behavior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData?.topPHIAccessPatterns.map((pattern) => (
                  <div key={pattern.userId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{pattern.userName}</div>
                      <div className="text-sm text-muted-foreground">
                        {pattern.accessCount} accesses
                        {pattern.suspiciousIndicators.length > 0 && (
                          <span className="ml-2">
                            {pattern.suspiciousIndicators.map((ind, i) => (
                              <Badge key={i} variant="outline" className="ml-1 text-xs">{ind}</Badge>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${pattern.riskScore > 60 ? "text-red-500" : pattern.riskScore > 30 ? "text-yellow-500" : "text-green-500"}`}>
                        {pattern.riskScore}
                      </div>
                      <div className="text-xs text-muted-foreground">Risk Score</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Alert Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats?.byCategory || {}).map(([cat, count]) => {
                  const config = categoryConfig[cat as AlertCategory];
                  const Icon = config?.icon || Shield;
                  return (
                    <div key={cat} className="text-center p-4 border rounded-lg">
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${config?.color}`} />
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground">{config?.label || cat}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4" data-testid="content-settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Alert Thresholds Configuration
              </CardTitle>
              <CardDescription>Configure when alerts are triggered and their severity levels</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {thresholds?.thresholds.map(threshold => (
                  <ThresholdConfigCard
                    key={threshold.id}
                    threshold={threshold}
                    onUpdate={(id, updates) => updateThresholdMutation.mutate({ id, updates })}
                  />
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
