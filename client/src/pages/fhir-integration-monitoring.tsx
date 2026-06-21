import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, 
  Server, TrendingUp, Zap, Bell, XCircle, Settings,
  Database, Globe, BarChart3, AlertCircle, Gauge
} from "lucide-react";

export default function FHIRIntegrationMonitoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [alertFilter, setAlertFilter] = useState<string>("all");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<any>({
    queryKey: ["/api/fhir-monitoring/dashboard"],
    refetchInterval: 30000
  });

  const { data: endpoints, isLoading: endpointsLoading } = useQuery<any>({
    queryKey: ["/api/fhir-monitoring/endpoints"]
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<any>({
    queryKey: ["/api/fhir-monitoring/alerts", { status: alertFilter !== 'all' ? alertFilter : undefined }]
  });

  const { data: metrics } = useQuery<any>({
    queryKey: ["/api/fhir-monitoring/metrics/realtime"]
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("PATCH", `/api/fhir-monitoring/alerts/${alertId}/acknowledge`, { acknowledgedBy: "admin" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-monitoring/alerts"] });
      toast({ title: "Alert Acknowledged" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  if (dashboardLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            FHIR Integration Monitoring
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring of all FHIR integration points with live metrics and alerts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/fhir-monitoring"] })} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" data-testid="button-settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Endpoints</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalEndpoints || 0}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="default" className="bg-green-500 text-xs">{dashboard?.healthyEndpoints || 0} Healthy</Badge>
              <Badge variant="secondary" className="bg-yellow-500 text-xs">{dashboard?.degradedEndpoints || 0} Degraded</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Requests (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(dashboard?.totalRequests24h || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Error Rate: <span className={dashboard?.errorRate > 5 ? 'text-red-500' : 'text-green-500'}>{dashboard?.errorRate?.toFixed(2) || 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.avgLatencyMs || 0}ms</div>
            <Progress value={Math.min(100, (dashboard?.avgLatencyMs || 0) / 5)} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.activeAlerts || 0}</div>
            {dashboard?.criticalAlerts > 0 && (
              <Badge variant="destructive" className="mt-2">{dashboard.criticalAlerts} Critical</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="text-sm text-muted-foreground p-3 bg-muted/50 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        This monitoring data is for operational purposes only. Not for clinical decision-making.
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList data-testid="tabs-monitoring">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints" data-testid="tab-endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">Real-time Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Health Overview</CardTitle>
                <CardDescription>Current status of all integration endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">System Uptime</span>
                    <span className="text-sm font-medium">{dashboard?.uptime || 99.9}%</span>
                  </div>
                  <Progress value={dashboard?.uptime || 99.9} className="h-2" />
                  
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                      <CheckCircle className="w-6 h-6 mx-auto text-green-500" />
                      <div className="text-lg font-bold mt-2">{dashboard?.healthyEndpoints || 0}</div>
                      <div className="text-xs text-muted-foreground">Healthy</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                      <AlertTriangle className="w-6 h-6 mx-auto text-yellow-500" />
                      <div className="text-lg font-bold mt-2">{dashboard?.degradedEndpoints || 0}</div>
                      <div className="text-xs text-muted-foreground">Degraded</div>
                    </div>
                    <div className="text-center p-4 bg-red-500/10 rounded-lg">
                      <XCircle className="w-6 h-6 mx-auto text-red-500" />
                      <div className="text-lg font-bold mt-2">{dashboard?.unhealthyEndpoints || 0}</div>
                      <div className="text-xs text-muted-foreground">Unhealthy</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Last 24 hours summary</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Total API Calls</span>
                    </div>
                    <span className="font-medium">{(dashboard?.totalRequests24h || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Successful</span>
                    </div>
                    <span className="font-medium">{((dashboard?.totalRequests24h || 0) - (dashboard?.totalErrors24h || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm">Errors</span>
                    </div>
                    <span className="font-medium text-red-500">{(dashboard?.totalErrors24h || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">Avg Response Time</span>
                    </div>
                    <span className="font-medium">{dashboard?.avgLatencyMs || 0}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Integration Endpoints</CardTitle>
              <CardDescription>All connected FHIR and EHR integration points</CardDescription>
            </CardHeader>
            <CardContent>
              {endpointsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {endpoints?.endpoints?.map((endpoint: any) => (
                    <div key={endpoint.id} className="flex items-center justify-between p-4 border rounded-lg hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(endpoint.status)}`} />
                        <div>
                          <div className="font-medium">{endpoint.name}</div>
                          <div className="text-xs text-muted-foreground">{endpoint.url}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{endpoint.type}</Badge>
                        <Badge variant="secondary">{endpoint.version || 'R4'}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Last checked: {new Date(endpoint.lastChecked).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Alert notifications are for operational monitoring only. Consult system administrators for technical decisions.
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Active Alerts</CardTitle>
                <CardDescription>Triggered alerts requiring attention</CardDescription>
              </div>
              <Select value={alertFilter} onValueChange={setAlertFilter}>
                <SelectTrigger className="w-40" data-testid="select-alert-filter">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alerts</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
                </div>
              ) : alerts?.alerts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  No active alerts
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts?.alerts?.map((alert: any) => (
                    <div key={alert.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                          <span className="font-medium">{alert.title}</span>
                          <Badge variant={getSeverityColor(alert.severity) as any}>{alert.severity}</Badge>
                        </div>
                        {alert.status === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            disabled={acknowledgeMutation.isPending}
                            data-testid={`button-ack-${alert.id}`}
                          >
                            Acknowledge
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <div className="text-xs text-muted-foreground">
                        Triggered: {new Date(alert.triggeredAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Real-time Traffic</CardTitle>
                <CardDescription>Current request/response patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.metrics?.slice(0, 5).map((m: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{m.endpointId}</span>
                        <span>{m.requestCount} req/min</span>
                      </div>
                      <Progress value={(m.successCount / Math.max(m.requestCount, 1)) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Latency Distribution</CardTitle>
                <CardDescription>Response time analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.metrics?.slice(0, 5).map((m: any, i: number) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm">{m.endpointId}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{m.avgLatencyMs}ms</div>
                        <div className="text-xs text-muted-foreground">p99: {m.p99LatencyMs}ms</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
