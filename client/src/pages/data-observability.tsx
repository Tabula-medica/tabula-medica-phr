import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  RefreshCw,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface EnhancedDashboard {
  metrics: {
    totalPipelines: number;
    healthyPipelines: number;
    warningPipelines: number;
    criticalPipelines: number;
    totalAnomalies24h: number;
    openAnomalies: number;
    resolvedAnomalies24h: number;
    avgTimeToDetectionMinutes: number;
    avgTimeToResolutionMinutes: number;
    anomaliesBySeverity: Record<string, number>;
    anomaliesByType: Record<string, number>;
  };
  pipelineStatuses: Array<{
    pipeline: {
      id: string;
      name: string;
      status: string;
      sourceType: string;
      destinationType: string;
      recordsProcessed24h: number;
      errorRate24h: number;
    };
    freshnessMetric: {
      freshnessStatus: string;
      actualIntervalMinutes: number;
    };
    volumeMetric: {
      volumeStatus: string;
      recordCount: number;
    };
  }>;
  recentAnomalies: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    pipelineName: string;
    detectedAt: string;
    status: string;
  }>;
  activeAlerts: Array<{
    id: string;
    severity: string;
    title: string;
    createdAt: string;
  }>;
  schemaDriftSummary: {
    totalDrifts: number;
    openDrifts: number;
    criticalDrifts: number;
    byType: Record<string, number>;
    byResourceType: Record<string, number>;
  };
  dataQualitySummary: {
    totalIssues: number;
    openIssues: number;
    criticalIssues: number;
    byType: Record<string, number>;
  };
  rootCauseAnalysisSummary: {
    totalAnalyses: number;
    avgConfidence: number;
    topCauses: Array<{ cause: string; count: number }>;
  };
  lineageSummary: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  };
  noCdsCompliance: string;
}

interface SchemaDriftEvent {
  id: string;
  resourceType: string;
  sourceId: string;
  driftType: string;
  severity: string;
  affectedField: string;
  previousValue: string;
  currentValue: string;
  detectedAt: string;
  status: string;
  impact: string;
  recommendation: string;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "outline";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "healthy":
    case "fresh":
    case "normal":
    case "resolved":
      return "default";
    case "warning":
    case "stale":
    case "open":
    case "acknowledged":
      return "secondary";
    case "critical":
    case "zero":
      return "destructive";
    default:
      return "outline";
  }
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: typeof Activity;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

function PipelineHealthTable({ statuses }: { statuses: EnhancedDashboard["pipelineStatuses"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pipeline</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Freshness</TableHead>
          <TableHead>Volume (24h)</TableHead>
          <TableHead>Error Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statuses.map((status) => (
          <TableRow key={status.pipeline.id} data-testid={`pipeline-row-${status.pipeline.id}`}>
            <TableCell>
              <div>
                <div className="font-medium">{status.pipeline.name}</div>
                <div className="text-xs text-muted-foreground">
                  {status.pipeline.sourceType} → {status.pipeline.destinationType}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusColor(status.pipeline.status)}>
                {status.pipeline.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusColor(status.freshnessMetric.freshnessStatus)}>
                {status.freshnessMetric.freshnessStatus}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span>{status.volumeMetric.recordCount.toLocaleString()}</span>
                <Badge variant={getStatusColor(status.volumeMetric.volumeStatus)} className="text-xs">
                  {status.volumeMetric.volumeStatus}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <span className={status.pipeline.errorRate24h > 0.05 ? "text-red-500" : ""}>
                {(status.pipeline.errorRate24h * 100).toFixed(2)}%
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SchemaDriftTable({ events }: { events: SchemaDriftEvent[] }) {
  const { toast } = useToast();
  
  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/data-observability/schema/drift/${id}/acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-observability/schema/drift"] });
      toast({ title: "Schema drift acknowledged" });
    },
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Resource Type</TableHead>
          <TableHead>Drift Type</TableHead>
          <TableHead>Affected Field</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              No schema drift events detected
            </TableCell>
          </TableRow>
        ) : (
          events.map((event) => (
            <TableRow key={event.id} data-testid={`drift-row-${event.id}`}>
              <TableCell className="font-medium">{event.resourceType}</TableCell>
              <TableCell>
                <Badge variant="outline">{event.driftType.replace("_", " ")}</Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">{event.affectedField}</TableCell>
              <TableCell>
                <Badge variant={getSeverityColor(event.severity)}>{event.severity}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusColor(event.status)}>{event.status}</Badge>
              </TableCell>
              <TableCell>
                {event.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(event.id)}
                    disabled={acknowledgeMutation.isPending}
                    data-testid={`button-acknowledge-drift-${event.id}`}
                  >
                    Acknowledge
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function AnomaliesTable({ anomalies }: { anomalies: EnhancedDashboard["recentAnomalies"] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Anomaly</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Pipeline</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Detected</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {anomalies.map((anomaly) => (
          <TableRow key={anomaly.id} data-testid={`anomaly-row-${anomaly.id}`}>
            <TableCell>
              <div className="max-w-[300px] truncate font-medium">{anomaly.title}</div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{anomaly.type}</Badge>
            </TableCell>
            <TableCell>{anomaly.pipelineName}</TableCell>
            <TableCell>
              <Badge variant={getSeverityColor(anomaly.severity)}>{anomaly.severity}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getStatusColor(anomaly.status)}>{anomaly.status}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(anomaly.detectedAt).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RootCauseAnalysisCard({ summary }: { summary: EnhancedDashboard["rootCauseAnalysisSummary"] }) {
  return (
    <Card data-testid="card-rca-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Root Cause Analysis
        </CardTitle>
        <CardDescription>AI-powered automated root cause detection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Analyses</span>
            <span className="font-medium">{summary.totalAnalyses}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Average Confidence</span>
            <div className="flex items-center gap-2">
              <Progress value={summary.avgConfidence * 100} className="w-20" />
              <span className="font-medium">{(summary.avgConfidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          {summary.topCauses.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Top Identified Causes</div>
              <div className="space-y-1">
                {summary.topCauses.slice(0, 3).map((cause, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="max-w-[200px] truncate text-muted-foreground">{cause.cause}</span>
                    <Badge variant="outline">{cause.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DataQualityCard({ summary }: { summary: EnhancedDashboard["dataQualitySummary"] }) {
  return (
    <Card data-testid="card-data-quality-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Data Quality Issues
        </CardTitle>
        <CardDescription>Detected data quality problems</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.totalIssues}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{summary.openIssues}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{summary.criticalIssues}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
          {Object.keys(summary.byType).length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Issues by Type</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline">
                    {type.replace("_", " ")}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SchemaDriftCard({ summary }: { summary: EnhancedDashboard["schemaDriftSummary"] }) {
  return (
    <Card data-testid="card-schema-drift-summary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Schema Drift
        </CardTitle>
        <CardDescription>FHIR schema changes detected</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.totalDrifts}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{summary.openDrifts}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">{summary.criticalDrifts}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
          {Object.keys(summary.byType).length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Drift Types</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <Badge key={type} variant="outline">
                    {type.replace("_", " ")}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DataObservability() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<EnhancedDashboard>({
    queryKey: ["/api/data-observability/enhanced-dashboard"],
  });

  const { data: driftData } = useQuery<{ events: SchemaDriftEvent[] }>({
    queryKey: ["/api/data-observability/schema/drift"],
  });

  const runDetectionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data-observability/detect");
      return res.json() as Promise<{ detected: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-observability"] });
      toast({
        title: "Anomaly Detection Complete",
        description: `Detected ${data.detected} anomalies`,
      });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="container space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Failed to load dashboard</p>
            <p className="text-muted-foreground">Please try refreshing the page</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="container space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Data Observability</h1>
            <p className="text-muted-foreground">
              AI-driven monitoring for FHIR data pipelines
            </p>
          </div>
          <Button
            onClick={() => runDetectionMutation.mutate()}
            disabled={runDetectionMutation.isPending}
            data-testid="button-run-detection"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${runDetectionMutation.isPending ? "animate-spin" : ""}`} />
            Run Detection
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Pipelines"
            value={dashboard.metrics.totalPipelines}
            description={`${dashboard.metrics.healthyPipelines} healthy`}
            icon={Database}
          />
          <MetricCard
            title="Anomalies (24h)"
            value={dashboard.metrics.totalAnomalies24h}
            description={`${dashboard.metrics.openAnomalies} open`}
            icon={AlertTriangle}
            trend={dashboard.metrics.totalAnomalies24h > 0 ? "up" : "neutral"}
          />
          <MetricCard
            title="Schema Drifts"
            value={dashboard.schemaDriftSummary.totalDrifts}
            description={`${dashboard.schemaDriftSummary.criticalDrifts} critical`}
            icon={GitBranch}
          />
          <MetricCard
            title="Data Quality Issues"
            value={dashboard.dataQualitySummary.totalIssues}
            description={`${dashboard.dataQualitySummary.openIssues} open`}
            icon={Shield}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-navigation">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="pipelines" data-testid="tab-pipelines">Pipelines</TabsTrigger>
            <TabsTrigger value="schema-drift" data-testid="tab-schema-drift">Schema Drift</TabsTrigger>
            <TabsTrigger value="anomalies" data-testid="tab-anomalies">Anomalies</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <SchemaDriftCard summary={dashboard.schemaDriftSummary} />
              <DataQualityCard summary={dashboard.dataQualitySummary} />
              <RootCauseAnalysisCard summary={dashboard.rootCauseAnalysisSummary} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Pipeline Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-green-500">
                      {dashboard.metrics.healthyPipelines}
                    </div>
                    <div className="text-sm text-muted-foreground">Healthy</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-yellow-500">
                      {dashboard.metrics.warningPipelines}
                    </div>
                    <div className="text-sm text-muted-foreground">Warning</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-500">
                      {dashboard.metrics.criticalPipelines}
                    </div>
                    <div className="text-sm text-muted-foreground">Critical</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold">
                      {dashboard.lineageSummary.totalNodes}
                    </div>
                    <div className="text-sm text-muted-foreground">Lineage Nodes</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.activeAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    No active alerts
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dashboard.activeAlerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                        data-testid={`alert-item-${alert.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                          <span className="max-w-[400px] truncate">{alert.title}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipelines">
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Status</CardTitle>
                <CardDescription>Real-time health monitoring for all data pipelines</CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineHealthTable statuses={dashboard.pipelineStatuses} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema-drift">
            <Card>
              <CardHeader>
                <CardTitle>Schema Drift Events</CardTitle>
                <CardDescription>
                  Detected structural changes in incoming FHIR resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SchemaDriftTable events={driftData?.events || []} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anomalies">
            <Card>
              <CardHeader>
                <CardTitle>Recent Anomalies</CardTitle>
                <CardDescription>
                  AI-detected anomalies in data ingestion pipelines
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnomaliesTable anomalies={dashboard.recentAnomalies} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">NO-CDS Compliance</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {dashboard.noCdsCompliance}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
