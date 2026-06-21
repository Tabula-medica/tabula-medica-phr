import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  Activity, RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Clock, Wifi, WifiOff, Bell, BellOff, Gauge,
  ArrowUpDown, Circle, Timer, TrendingUp, Shield, ChevronDown, ChevronRight
} from "lucide-react";

type TrafficLightStatus = "green" | "yellow" | "red" | "grey";

interface EndpointHealthRecord {
  partnerId: string;
  partnerName: string;
  endpointType: string;
  url: string;
  status: TrafficLightStatus;
  connectionStatus: string;
  latencyMs: number;
  lastCheckedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  uptimePercent: number;
  responseCode: number | null;
  checkCount: number;
  successCount: number;
}

interface HealthAlert {
  id: string;
  partnerId: string;
  partnerName: string;
  endpointType: string;
  severity: "warning" | "critical" | "resolved";
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  emailSent: boolean;
  resolvedAt: string | null;
}

interface NetworkHealthSummary {
  totalEndpoints: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
  overallStatus: TrafficLightStatus;
  lastFullScanAt: string | null;
  nextScanAt: string | null;
  scanIntervalMs: number;
  activeAlerts: number;
  uptimeAverage: number;
  avgLatencyMs: number;
}

interface UptimeEntry {
  partnerId: string;
  partnerName: string;
  uptimePercent: number;
  avgLatencyMs: number;
  status: TrafficLightStatus;
}

function TrafficLight({ status, size = "md" }: { status: TrafficLightStatus; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-6 w-6" };
  const colorMap = {
    green: "bg-green-500 shadow-green-500/50",
    yellow: "bg-yellow-400 shadow-yellow-400/50",
    red: "bg-red-500 shadow-red-500/50",
    grey: "bg-gray-400 shadow-gray-400/50",
  };

  return (
    <span
      className={`inline-block rounded-full ${sizeMap[size]} ${colorMap[status]} shadow-md`}
      data-testid={`traffic-light-${status}`}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "destructive" | "outline" | "secondary"; icon: typeof CheckCircle }> = {
    healthy: { variant: "default", icon: CheckCircle },
    degraded: { variant: "outline", icon: AlertTriangle },
    down: { variant: "destructive", icon: XCircle },
    unknown: { variant: "secondary", icon: Clock },
  };
  const { variant, icon: Icon } = variants[status] || variants.unknown;

  return (
    <Badge variant={variant} className="flex items-center gap-1 text-xs" data-testid={`status-badge-${status}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - d.getTime();
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

function LatencyBar({ latencyMs }: { latencyMs: number }) {
  const maxWidth = 200;
  const maxLatency = 5000;
  const width = Math.min((latencyMs / maxLatency) * 100, 100);
  const color = latencyMs < 500 ? "bg-green-500" : latencyMs < 2000 ? "bg-yellow-400" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden" style={{ maxWidth }}>
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-14 text-right">{latencyMs}ms</span>
    </div>
  );
}

export default function NetworkHealth() {
  const { toast } = useToast();
  const [alertFilter, setAlertFilter] = useState("all");
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);

  const summary = useQuery<NetworkHealthSummary>({
    queryKey: ["/api/network-health/summary"],
    refetchInterval: 30000,
  });

  const endpoints = useQuery<EndpointHealthRecord[]>({
    queryKey: ["/api/network-health/endpoints"],
    refetchInterval: 30000,
  });

  const uptime = useQuery<UptimeEntry[]>({
    queryKey: ["/api/network-health/uptime"],
    refetchInterval: 30000,
  });

  const alerts = useQuery<HealthAlert[]>({
    queryKey: ["/api/network-health/alerts", alertFilter],
    refetchInterval: 15000,
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/network-health/scan"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/network-health"] });
      toast({ title: "Scan Complete", description: "All endpoints have been re-scanned" });
    },
    onError: () => toast({ title: "Scan Failed", variant: "destructive" }),
  });

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest("POST", `/api/network-health/alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/network-health/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network-health/summary"] });
    },
  });

  const ackAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/network-health/alerts/acknowledge-all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/network-health/alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network-health/summary"] });
      toast({ title: "Alerts Acknowledged", description: "All active alerts have been acknowledged" });
    },
  });

  const partnerGroups = endpoints.data
    ? endpoints.data.reduce<Record<string, EndpointHealthRecord[]>>((acc, ep) => {
        if (!acc[ep.partnerId]) acc[ep.partnerId] = [];
        acc[ep.partnerId].push(ep);
        return acc;
      }, {})
    : {};

  const s = summary.data;

  return (
    <div className="space-y-6" data-testid="network-health-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Activity className="h-6 w-6 text-blue-600" />
            Network Health
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time traffic light status for all TEFCA partner endpoints
          </p>
        </div>
        <div className="flex items-center gap-3">
          {s && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last scan: {formatTime(s.lastFullScanAt)}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            data-testid="button-manual-scan"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${scanMutation.isPending ? "animate-spin" : ""}`} />
            {scanMutation.isPending ? "Scanning..." : "Scan Now"}
          </Button>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="summary-cards">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">Overall</div>
              <div className="flex items-center gap-2">
                <TrafficLight status={s.overallStatus} size="lg" />
                <span className="text-lg font-bold capitalize" data-testid="text-overall-status">{s.overallStatus === "green" ? "Healthy" : s.overallStatus === "yellow" ? "Degraded" : s.overallStatus === "red" ? "Critical" : "Unknown"}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1">Endpoints</div>
              <div className="text-lg font-bold" data-testid="text-total-endpoints">{s.totalEndpoints}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Healthy</div>
              <div className="text-lg font-bold text-green-600" data-testid="text-healthy-count">{s.healthy}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-500" /> Degraded</div>
              <div className="text-lg font-bold text-yellow-600" data-testid="text-degraded-count">{s.degraded}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" /> Down</div>
              <div className="text-lg font-bold text-red-600" data-testid="text-down-count">{s.down}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Bell className="h-3 w-3" /> Active Alerts</div>
              <div className="text-lg font-bold text-orange-600" data-testid="text-alert-count">{s.activeAlerts}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {s && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg Uptime</div>
                <div className="text-xl font-bold" data-testid="text-uptime-avg">{s.uptimeAverage}%</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Gauge className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg Latency</div>
                <div className="text-xl font-bold" data-testid="text-latency-avg">{s.avgLatencyMs}ms</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Timer className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Scan Interval</div>
                <div className="text-xl font-bold">{Math.round(s.scanIntervalMs / 60000)}min</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="health-tabs">
          <TabsTrigger value="endpoints" data-testid="tab-endpoints">
            <Wifi className="h-4 w-4 mr-1.5" />
            Endpoints
          </TabsTrigger>
          <TabsTrigger value="uptime" data-testid="tab-uptime">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Uptime
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Bell className="h-4 w-4 mr-1.5" />
            Alerts
            {s && s.activeAlerts > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">{s.activeAlerts}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="mt-4 space-y-3">
          {endpoints.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : (
            Object.entries(partnerGroups).map(([partnerId, eps]) => {
              const isExpanded = expandedPartner === partnerId;
              const worstStatus = eps.reduce<TrafficLightStatus>((worst, ep) => {
                const order: TrafficLightStatus[] = ["red", "yellow", "grey", "green"];
                return order.indexOf(ep.status) < order.indexOf(worst) ? ep.status : worst;
              }, "green");
              const partnerName = eps[0]?.partnerName || partnerId;

              return (
                <Card key={partnerId} className="overflow-hidden" data-testid={`partner-card-${partnerId}`}>
                  <button
                    onClick={() => setExpandedPartner(isExpanded ? null : partnerId)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    data-testid={`button-expand-${partnerId}`}
                  >
                    <div className="flex items-center gap-3">
                      <TrafficLight status={worstStatus} size="md" />
                      <div>
                        <span className="font-semibold">{partnerName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {eps.map(ep => (
                            <TooltipProvider key={ep.endpointType}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <TrafficLight status={ep.status} size="sm" />
                                    {ep.endpointType}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ep.connectionStatus} — {ep.latencyMs}ms — Uptime: {ep.uptimePercent}%</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        <div>Avg latency: {Math.round(eps.reduce((s, e) => s + e.latencyMs, 0) / eps.length)}ms</div>
                        <div>Checked: {formatTime(eps[0]?.lastCheckedAt)}</div>
                      </div>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t">
                      <div className="divide-y">
                        {eps.map(ep => (
                          <div key={ep.endpointType} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center" data-testid={`endpoint-row-${partnerId}-${ep.endpointType}`}>
                            <div>
                              <div className="flex items-center gap-2">
                                <TrafficLight status={ep.status} size="sm" />
                                <span className="font-medium text-sm capitalize">{ep.endpointType}</span>
                                <StatusBadge status={ep.connectionStatus} />
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 truncate max-w-xs" title={ep.url}>{ep.url}</div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground">Latency</div>
                              <LatencyBar latencyMs={ep.latencyMs} />
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="text-muted-foreground">Uptime</div>
                              <div className="font-medium" data-testid={`text-uptime-${partnerId}-${ep.endpointType}`}>{ep.uptimePercent}%</div>
                              <div className="text-muted-foreground">Checks</div>
                              <div className="font-medium">{ep.successCount}/{ep.checkCount}</div>
                              <div className="text-muted-foreground">Last OK</div>
                              <div className="font-medium">{formatTime(ep.lastSuccessAt)}</div>
                              {ep.consecutiveFailures > 0 && (
                                <>
                                  <div className="text-red-600">Failures</div>
                                  <div className="font-medium text-red-600">{ep.consecutiveFailures}x consecutive</div>
                                </>
                              )}
                            </div>
                            <div>
                              {ep.responseCode && (
                                <Badge variant={ep.responseCode < 400 ? "secondary" : "destructive"} className="text-xs">
                                  HTTP {ep.responseCode}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                        {eps.some(ep => ep.lastError) && (
                          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-300">
                            Last error: {eps.find(ep => ep.lastError)?.lastError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="uptime" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Partner Uptime Overview</CardTitle>
              <CardDescription>Aggregate uptime and latency across all endpoints per partner</CardDescription>
            </CardHeader>
            <CardContent>
              {uptime.isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : uptime.data && uptime.data.length > 0 ? (
                <div className="space-y-4">
                  {uptime.data.map(u => (
                    <div key={u.partnerId} className="flex items-center gap-4" data-testid={`uptime-row-${u.partnerId}`}>
                      <TrafficLight status={u.status} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate">{u.partnerName}</span>
                          <span className="text-sm font-bold" data-testid={`text-partner-uptime-${u.partnerId}`}>{u.uptimePercent}%</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              u.uptimePercent >= 99 ? "bg-green-500" : u.uptimePercent >= 95 ? "bg-yellow-400" : "bg-red-500"
                            }`}
                            style={{ width: `${u.uptimePercent}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Avg latency: {u.avgLatencyMs}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No uptime data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-[180px]" data-testid="alert-filter-select">
                <SelectValue placeholder="Filter alerts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alerts</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => ackAllMutation.mutate()}
              disabled={ackAllMutation.isPending}
              data-testid="button-ack-all"
            >
              <BellOff className="h-4 w-4 mr-1.5" />
              Acknowledge All
            </Button>
          </div>

          {alerts.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : alerts.data && alerts.data.length > 0 ? (
            <div className="space-y-2">
              {alerts.data.map(alert => (
                <Card
                  key={alert.id}
                  className={`${
                    alert.severity === "critical" ? "border-l-4 border-l-red-500" :
                    alert.severity === "warning" ? "border-l-4 border-l-yellow-400" :
                    "border-l-4 border-l-green-500"
                  } ${alert.acknowledged ? "opacity-60" : ""}`}
                  data-testid={`alert-card-${alert.id}`}
                >
                  <CardContent className="py-3 px-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={alert.severity === "critical" ? "destructive" : alert.severity === "warning" ? "outline" : "secondary"}
                          className="text-xs"
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{alert.partnerName} / {alert.endpointType}</span>
                        {alert.emailSent && (
                          <Badge variant="secondary" className="text-xs">Email sent</Badge>
                        )}
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span>{formatTime(alert.timestamp)}</span>
                        {alert.acknowledged && (
                          <span className="text-green-600">Acknowledged by {alert.acknowledgedBy} {formatTime(alert.acknowledgedAt)}</span>
                        )}
                        {alert.resolvedAt && (
                          <span className="text-green-600">Resolved {formatTime(alert.resolvedAt)}</span>
                        )}
                      </div>
                    </div>
                    {!alert.acknowledged && alert.severity !== "resolved" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ackMutation.mutate(alert.id)}
                        disabled={ackMutation.isPending}
                        data-testid={`button-ack-${alert.id}`}
                      >
                        <BellOff className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No alerts matching the selected filter</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
