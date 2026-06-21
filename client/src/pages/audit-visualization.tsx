import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Shield,
  ShieldAlert,
  Search,
  User,
  Users,
  Zap,
  TrendingUp,
  History,
  RefreshCw,
  ChevronRight,
  XCircle,
  CheckCircle2,
  Monitor,
  Lock,
} from "lucide-react";

interface AccessPatterns {
  totalEvents: number;
  phiAccessCount: number;
  failedAttempts: number;
  uniqueUsers: number;
  hourlyDistribution: Record<number, number>;
  dailyDistribution: Record<string, number>;
  actionDistribution: Record<string, number>;
  resourceAccess: Record<string, number>;
  topUsers: Array<{ userId: string; count: number; lastActive: string; userName: string; phiAccess: number }>;
  timeRange: { start: string; end: string; rangeLabel: string };
}

interface Anomaly {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  userId: string;
  userName: string;
  detectedAt: string;
  eventCount: number;
  metadata: Record<string, unknown>;
}

interface AnomalyResponse {
  anomalies: Anomaly[];
  totalDetected: number;
  bySeverity: Record<string, number>;
  scanTimestamp: string;
}

interface LiveFeedEntry {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userName: string;
  resourceType: string;
  resourceId?: string;
  outcome: string;
  phiAccessed: boolean;
  ipAddress: string;
  description: string;
}

interface PatientHistory {
  patientId: string;
  totalInteractions: number;
  uniqueAccessors: number;
  phiAccessCount: number;
  timeline: Array<{
    id: string;
    timestamp: string;
    action: string;
    userId: string;
    userName: string;
    userRole: string;
    resourceType: string;
    description: string;
    ipAddress: string;
    outcome: string;
    phiAccessed: boolean;
  }>;
  accessByUser: Array<{ userId: string; count: number; userName: string; lastAccess: string }>;
}

function HourlyChart({ data }: { data: Record<number, number> }) {
  const maxVal = Math.max(...Object.values(data), 1);
  return (
    <div className="flex items-end gap-[2px] h-24" data-testid="chart-hourly">
      {Array.from({ length: 24 }, (_, h) => {
        const count = data[h] || 0;
        const height = maxVal > 0 ? (count / maxVal) * 100 : 0;
        const isBusinessHours = h >= 6 && h < 22;
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className={`w-full rounded-t transition-all ${isBusinessHours ? "bg-primary/70 hover:bg-primary" : "bg-amber-400/70 hover:bg-amber-400"}`}
              style={{ height: `${Math.max(height, 2)}%` }}
              title={`${h}:00 — ${count} events`}
            />
            {h % 4 === 0 && <span className="text-[9px] text-muted-foreground">{h}</span>}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {h}:00 — {count} events
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex items-end gap-1 h-24" data-testid="chart-daily">
      {entries.map(([day, count]) => {
        const height = (count / maxVal) * 100;
        const label = new Date(day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full rounded-t bg-primary/60 hover:bg-primary transition-all"
              style={{ height: `${Math.max(height, 3)}%` }}
            />
            {entries.length <= 7 && <span className="text-[8px] text-muted-foreground truncate">{label}</span>}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] shadow-sm opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
              {label} — {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[severity] || styles.low}`} data-testid={`badge-severity-${severity}`}>
      {severity}
    </span>
  );
}

function AnomalyIcon({ type }: { type: string }) {
  switch (type) {
    case "excessive_phi_access": return <Eye className="h-4 w-4 text-red-500" />;
    case "access_burst": return <Zap className="h-4 w-4 text-orange-500" />;
    case "repeated_failures": return <XCircle className="h-4 w-4 text-red-500" />;
    case "after_hours_phi": return <Clock className="h-4 w-4 text-amber-500" />;
    case "shared_ip": return <Users className="h-4 w-4 text-amber-500" />;
    default: return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }
}

function ActionIcon({ action, phi }: { action: string; phi?: boolean }) {
  if (phi) return <Eye className="h-3.5 w-3.5 text-red-500" />;
  if (action.startsWith("auth.")) return <Lock className="h-3.5 w-3.5 text-blue-500" />;
  if (action.startsWith("data.")) return <FileText className="h-3.5 w-3.5 text-green-500" />;
  if (action.startsWith("phi.")) return <Eye className="h-3.5 w-3.5 text-red-500" />;
  if (action.startsWith("admin.")) return <Shield className="h-3.5 w-3.5 text-purple-500" />;
  if (action.startsWith("security.")) return <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function AuditVisualization() {
  useSEO({
    title: "Audit Log Visualization | Tabula Medica",
    description: "Real-time audit log visualization with access patterns, anomaly detection, and patient history tracking.",
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("7d");
  const [patientHistoryId, setPatientHistoryId] = useState<string | null>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: patterns, isLoading: patternsLoading } = useQuery<AccessPatterns>({
    queryKey: ["/api/audit-visualization/access-patterns", timeRange, refreshKey],
  });

  const { data: anomalyData, isLoading: anomalyLoading } = useQuery<AnomalyResponse>({
    queryKey: ["/api/audit-visualization/anomalies", refreshKey],
  });

  const { data: liveFeed, isLoading: feedLoading } = useQuery<LiveFeedEntry[]>({
    queryKey: ["/api/audit-visualization/live-feed", refreshKey],
    refetchInterval: 15000,
  });

  const { data: patientHistory, isLoading: patientHistoryLoading } = useQuery<PatientHistory>({
    queryKey: ["/api/audit-visualization/patient-history", patientHistoryId],
    enabled: !!patientHistoryId,
  });

  const handleRefresh = () => setRefreshKey(k => k + 1);

  if (patternsLoading && anomalyLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6" data-testid="page-audit-viz-loading">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const anomalies = anomalyData?.anomalies || [];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-audit-visualization">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Monitor className="h-7 w-7 text-primary" />
            Audit Log Visualization
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Real-time access patterns, anomaly detection, and patient interaction history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="button-refresh" aria-label="Refresh data">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-events">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patterns?.totalEvents ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-phi-access">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Eye className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patterns?.phiAccessCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">PHI Access Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-failed-attempts">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patterns?.failedAttempts ?? 0}</p>
                <p className="text-xs text-muted-foreground">Failed Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-anomalies">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${anomalies.length > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                {anomalies.length > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{anomalies.length}</p>
                <p className="text-xs text-muted-foreground">Anomalies Detected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-audit">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Access Patterns
          </TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Anomalies
            {anomalies.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-[10px]">{anomalies.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="live" data-testid="tab-live-feed">
            <Zap className="h-4 w-4 mr-1.5" />
            Live Feed
          </TabsTrigger>
          <TabsTrigger value="patient" data-testid="tab-patient-history">
            <History className="h-4 w-4 mr-1.5" />
            Patient History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-hourly-distribution">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Hourly Access Distribution</CardTitle>
                <CardDescription>Events by hour of day — <span className="text-amber-500 font-medium">amber</span> bars indicate after-hours (10 PM–6 AM)</CardDescription>
              </CardHeader>
              <CardContent>
                {patterns?.hourlyDistribution ? (
                  <HourlyChart data={patterns.hourlyDistribution} />
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-daily-trend">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Daily Event Trend</CardTitle>
                <CardDescription>Event volume over the selected time period</CardDescription>
              </CardHeader>
              <CardContent>
                {patterns?.dailyDistribution && Object.keys(patterns.dailyDistribution).length > 0 ? (
                  <DailyChart data={patterns.dailyDistribution} />
                ) : (
                  <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-action-breakdown">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Event Type Breakdown</CardTitle>
                <CardDescription>Distribution of audit events by action type</CardDescription>
              </CardHeader>
              <CardContent>
                {patterns?.actionDistribution && Object.keys(patterns.actionDistribution).length > 0 ? (
                  <div className="space-y-2.5">
                    {Object.entries(patterns.actionDistribution)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([action, count]) => {
                        const pct = patterns.totalEvents > 0 ? (count / patterns.totalEvents) * 100 : 0;
                        return (
                          <div key={action} className="flex items-center gap-3" data-testid={`action-${action}`}>
                            <ActionIcon action={action} />
                            <span className="text-sm flex-1 min-w-0 truncate">{action.replace(/_/g, " ")}</span>
                            <Progress value={pct} className="w-24 h-2" />
                            <span className="text-xs text-muted-foreground w-12 text-right">{count}</span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">No events recorded</div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-users">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Most Active Users</CardTitle>
                <CardDescription>Users with the highest event volume in this period</CardDescription>
              </CardHeader>
              <CardContent>
                {patterns?.topUsers && patterns.topUsers.length > 0 ? (
                  <div className="space-y-2">
                    {patterns.topUsers.slice(0, 8).map((user, idx) => (
                      <div key={user.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors" data-testid={`user-activity-${idx}`}>
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.count} events · {user.phiAccess > 0 ? <span className="text-red-500">{user.phiAccess} PHI</span> : "0 PHI"}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(user.lastActive).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">No user activity data</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-resource-access">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resource Access Distribution</CardTitle>
              <CardDescription>Which types of resources are being accessed most frequently</CardDescription>
            </CardHeader>
            <CardContent>
              {patterns?.resourceAccess && Object.keys(patterns.resourceAccess).length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(patterns.resourceAccess)
                    .sort(([, a], [, b]) => b - a)
                    .map(([resource, count]) => (
                      <div key={resource} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card" data-testid={`resource-${resource}`}>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm capitalize">{resource.replace(/_/g, " ")}</span>
                        <Badge variant="secondary" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">No resource access data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4 mt-6">
          {anomalyLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
          ) : anomalies.length > 0 ? (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-xs text-muted-foreground">Critical: {anomalyData?.bySeverity?.critical ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <span className="text-xs text-muted-foreground">High: {anomalyData?.bySeverity?.high ?? 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs text-muted-foreground">Medium: {anomalyData?.bySeverity?.medium ?? 0}</span>
                </div>
              </div>
              <div className="space-y-3">
                {anomalies.map(anomaly => (
                  <Card key={anomaly.id} className={`border-l-4 ${anomaly.severity === "critical" ? "border-l-red-500" : anomaly.severity === "high" ? "border-l-orange-500" : "border-l-amber-400"}`} data-testid={`anomaly-${anomaly.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <AnomalyIcon type={anomaly.type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold">{anomaly.title}</h4>
                            <SeverityBadge severity={anomaly.severity} />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{anomaly.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {anomaly.userName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(anomaly.detectedAt).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              {anomaly.eventCount} event{anomaly.eventCount !== 1 ? "s" : ""}
                            </span>
                            <Badge variant="outline" className="text-[10px] capitalize">{anomaly.type.replace(/_/g, " ")}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-3 text-green-500" />
                  <p className="text-base font-medium">No Anomalies Detected</p>
                  <p className="text-sm mt-1">All access patterns appear normal. Anomaly detection scans for excessive PHI access, unusual volume bursts, repeated failures, after-hours activity, and shared IP sessions.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    Live Audit Feed
                  </CardTitle>
                  <CardDescription>Auto-refreshes every 15 seconds</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {feedLoading ? (
                <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (liveFeed?.length ?? 0) > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {liveFeed?.map(entry => (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors ${entry.phiAccessed ? "bg-red-50/50 dark:bg-red-950/10" : ""} ${entry.outcome === "failure" || entry.outcome === "denied" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                        data-testid={`feed-entry-${entry.id}`}
                      >
                        <ActionIcon action={entry.action} phi={entry.phiAccessed} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{entry.action.replace(/_/g, " ")}</span>
                            {entry.phiAccessed && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">PHI</Badge>
                            )}
                            {(entry.outcome === "failure" || entry.outcome === "denied") && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-600 border-red-200">{entry.outcome}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {entry.userName} · {entry.resourceType}{entry.resourceId ? ` #${entry.resourceId.substring(0, 8)}` : ""}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p>No audit events recorded yet</p>
                  <p className="text-xs mt-1">Events will appear here in real-time as users interact with the system</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patient" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">View Patient History</CardTitle>
              <CardDescription>Search for a patient ID to view all historical interactions and access records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter Patient ID or Profile ID..."
                    value={patientSearchQuery}
                    onChange={e => setPatientSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && patientSearchQuery.trim()) setPatientHistoryId(patientSearchQuery.trim()); }}
                    className="pl-9"
                    data-testid="input-patient-search"
                  />
                </div>
                <Button
                  onClick={() => { if (patientSearchQuery.trim()) setPatientHistoryId(patientSearchQuery.trim()); }}
                  disabled={!patientSearchQuery.trim()}
                  data-testid="button-search-patient"
                >
                  <Search className="h-4 w-4 mr-1.5" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {patientHistoryId && (
            <PatientHistoryPanel
              patientId={patientHistoryId}
              data={patientHistory}
              isLoading={patientHistoryLoading}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!patientHistoryId && activeTab !== "patient"} onOpenChange={(open) => { if (!open) setPatientHistoryId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Patient Access History</DialogTitle>
            <DialogDescription>All recorded interactions for patient {patientHistoryId}</DialogDescription>
          </DialogHeader>
          {patientHistory && (
            <PatientHistoryPanel patientId={patientHistoryId!} data={patientHistory} isLoading={patientHistoryLoading} compact />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientHistoryPanel({ patientId, data, isLoading, compact = false }: {
  patientId: string;
  data: PatientHistory | undefined;
  isLoading: boolean;
  compact?: boolean;
}) {
  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>;
  }

  if (!data || data.totalInteractions === 0) {
    return (
      <Card data-testid="card-patient-no-history">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <EyeOff className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No History Found</p>
            <p className="text-xs mt-1">No audit records found for patient ID: {patientId}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="patient-history-panel">
      <div className={`grid ${compact ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"} gap-3`}>
        <div className="text-center p-3 rounded-lg border bg-card">
          <p className="text-xl font-bold">{data.totalInteractions}</p>
          <p className="text-xs text-muted-foreground">Total Interactions</p>
        </div>
        <div className="text-center p-3 rounded-lg border bg-card">
          <p className="text-xl font-bold">{data.uniqueAccessors}</p>
          <p className="text-xs text-muted-foreground">Unique Accessors</p>
        </div>
        <div className="text-center p-3 rounded-lg border bg-card">
          <p className="text-xl font-bold text-red-600">{data.phiAccessCount}</p>
          <p className="text-xs text-muted-foreground">PHI Accesses</p>
        </div>
        {!compact && data.accessByUser.length > 0 && (
          <div className="text-center p-3 rounded-lg border bg-card">
            <p className="text-xl font-bold">{data.accessByUser[0].userName}</p>
            <p className="text-xs text-muted-foreground">Most Frequent Accessor</p>
          </div>
        )}
      </div>

      {data.accessByUser.length > 0 && (
        <Card data-testid="card-patient-accessors">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Users Who Accessed This Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.accessByUser.slice(0, compact ? 5 : 10).map((accessor, idx) => (
                <div key={accessor.userId} className="flex items-center gap-3 text-sm" data-testid={`accessor-${idx}`}>
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium flex-1">{accessor.userName}</span>
                  <span className="text-xs text-muted-foreground">{accessor.count} interactions</span>
                  <span className="text-xs text-muted-foreground">{new Date(accessor.lastAccess).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-patient-timeline">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Access Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className={compact ? "h-[300px]" : "h-[400px]"}>
            <div className="space-y-1">
              {data.timeline.slice(0, compact ? 30 : 100).map(entry => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors ${entry.phiAccessed ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}
                  data-testid={`timeline-entry-${entry.id}`}
                >
                  <ActionIcon action={entry.action} phi={entry.phiAccessed} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{entry.action.replace(/_/g, " ")}</span>
                      {entry.phiAccessed && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">PHI</Badge>}
                      {entry.outcome !== "success" && <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">{entry.outcome}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.userName} ({entry.userRole}) · {entry.resourceType}
                    </p>
                    {entry.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.description}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
