import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Sparkles,
  BarChart3,
  Target,
  Zap,
  Database,
  FileWarning,
  Layers,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface DashboardSummary {
  overallScore: number;
  openAlerts: { total: number; critical: number; error: number; warning: number; info: number };
  driftMetrics: { total: number; critical: number; high: number };
  anomalies: { total: number; critical: number; high: number };
  risks: { total: number; critical: number; high: number };
  lastUpdated: string;
}

interface DataQualitySnapshot {
  id: string;
  timestamp: string;
  overallScore: number;
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
    validity: number;
  };
  sourceMetrics: Record<string, any>;
  resourceMetrics: Record<string, any>;
}

interface DataQualityAlert {
  id: string;
  alertType: string;
  title: string;
  description: string;
  severity: string;
  sourceId: string;
  resourceType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  relatedEntityId: string;
  relatedEntityType: string;
  metadata: Record<string, any>;
}

interface DataDriftMetric {
  id: string;
  metricName: string;
  resourceType: string;
  sourceId: string;
  baselineValue: number;
  currentValue: number;
  driftPercentage: number;
  driftDirection: string;
  severity: string;
  detectedAt: string;
  trend: number[];
}

interface AnomalyPattern {
  id: string;
  patternType: string;
  resourceType: string;
  sourceId: string;
  description: string;
  affectedRecordCount: number;
  confidenceScore: number;
  severity: string;
  detectedAt: string;
  suggestedAction: string;
}

interface IntegrityRisk {
  id: string;
  riskCategory: string;
  resourceType: string;
  sourceId: string;
  riskScore: number;
  riskLevel: string;
  description: string;
  impactAssessment: string;
  affectedFields: string[];
  mitigationSuggestions: string[];
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-orange-500",
  high: "bg-orange-500",
  warning: "bg-yellow-500",
  medium: "bg-yellow-500",
  info: "bg-blue-500",
  low: "bg-green-500",
};

const statusColors: Record<string, string> = {
  open: "bg-red-500",
  acknowledged: "bg-yellow-500",
  investigating: "bg-blue-500",
  resolved: "bg-green-500",
  dismissed: "bg-gray-500",
};

export default function ProactiveDataQualityPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/proactive-quality/dashboard"],
  });

  const { data: snapshot } = useQuery<DataQualitySnapshot>({
    queryKey: ["/api/proactive-quality/snapshot"],
  });

  const { data: alerts = [] } = useQuery<DataQualityAlert[]>({
    queryKey: ["/api/proactive-quality/alerts"],
  });

  const { data: driftMetrics = [] } = useQuery<DataDriftMetric[]>({
    queryKey: ["/api/proactive-quality/drift-metrics"],
  });

  const { data: anomalies = [] } = useQuery<AnomalyPattern[]>({
    queryKey: ["/api/proactive-quality/anomaly-patterns"],
  });

  const { data: risks = [] } = useQuery<IntegrityRisk[]>({
    queryKey: ["/api/proactive-quality/integrity-risks"],
  });

  const { data: aiAnalysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<{
    summary: string;
    recommendations: string[];
    prioritizedActions: string[];
  }>({
    queryKey: ["/api/proactive-quality/ai-analysis"],
    enabled: false,
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/proactive-quality/scan"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-quality"] });
      toast({ title: "Scan Complete", description: "Quality scan completed successfully" });
    },
    onError: () => {
      toast({ title: "Scan Failed", description: "Failed to run quality scan", variant: "destructive" });
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/proactive-quality/alerts/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-quality/alerts"] });
      toast({ title: "Alert Updated", description: "Alert status updated successfully" });
    },
  });

  const filteredAlerts = alertFilter === "all" ? alerts : alerts.filter(a => a.status === alertFilter);

  const dimensionData = snapshot?.dimensionScores
    ? [
        { dimension: "Completeness", score: snapshot.dimensionScores.completeness, fullMark: 100 },
        { dimension: "Accuracy", score: snapshot.dimensionScores.accuracy, fullMark: 100 },
        { dimension: "Consistency", score: snapshot.dimensionScores.consistency, fullMark: 100 },
        { dimension: "Timeliness", score: snapshot.dimensionScores.timeliness, fullMark: 100 },
        { dimension: "Uniqueness", score: snapshot.dimensionScores.uniqueness, fullMark: 100 },
        { dimension: "Validity", score: snapshot.dimensionScores.validity, fullMark: 100 },
      ]
    : [];

  const sourceData = snapshot?.sourceMetrics
    ? Object.values(snapshot.sourceMetrics).map((s: any) => ({
        name: s.sourceName.split(" ")[0],
        score: s.qualityScore,
        records: s.recordCount,
      }))
    : [];

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-state">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="proactive-quality-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Proactive Data Quality Monitoring</h1>
          <p className="text-muted-foreground">AI-powered detection of data drift, anomalies, and integrity risks</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetchAnalysis()}
            disabled={analysisLoading}
            data-testid="button-ai-analysis"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI Analysis
          </Button>
          <Button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending} data-testid="button-run-scan">
            <RefreshCw className={`h-4 w-4 mr-2 ${scanMutation.isPending ? "animate-spin" : ""}`} />
            Run Scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-overall-score">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.overallScore || 0}%</div>
            <Progress value={dashboard?.overallScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card data-testid="card-open-alerts">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Open Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.openAlerts.total || 0}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(dashboard?.openAlerts.critical || 0) > 0 && (
                <Badge variant="destructive">{dashboard?.openAlerts.critical} Critical</Badge>
              )}
              {(dashboard?.openAlerts.error || 0) > 0 && (
                <Badge className="bg-orange-500">{dashboard?.openAlerts.error} Error</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-drift-metrics">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Data Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.driftMetrics.total || 0}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(dashboard?.driftMetrics.critical || 0) > 0 && (
                <Badge variant="destructive">{dashboard?.driftMetrics.critical} Critical</Badge>
              )}
              {(dashboard?.driftMetrics.high || 0) > 0 && (
                <Badge className="bg-orange-500">{dashboard?.driftMetrics.high} High</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-anomalies">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.anomalies.total || 0}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(dashboard?.anomalies.high || 0) > 0 && (
                <Badge className="bg-orange-500">{dashboard?.anomalies.high} High</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-integrity-risks">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Integrity Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.risks.total || 0}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {(dashboard?.risks.high || 0) > 0 && (
                <Badge className="bg-orange-500">{dashboard?.risks.high} High</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {aiAnalysis && (
        <Card data-testid="card-ai-analysis">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Summary</h4>
              <p className="text-muted-foreground">{aiAnalysis.summary}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {aiAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Priority Actions</h4>
                <ul className="space-y-1">
                  {aiAnalysis.prioritizedActions.map((action, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Zap className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          <TabsTrigger value="drift" data-testid="tab-drift">Drift</TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">Anomalies</TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">Risks</TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Quality Dimensions
                </CardTitle>
                <CardDescription>Six dimensions of data quality assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={dimensionData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="dimension" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Source Quality Scores
                </CardTitle>
                <CardDescription>Quality scores by data source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="hsl(var(--primary))">
                        {sourceData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.score >= 80 ? "hsl(var(--chart-2))" : entry.score >= 60 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {alerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                        <div>
                          <p className="font-medium text-sm">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">{alert.resourceType} - {alert.sourceId}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Quality Alerts
                </CardTitle>
                <Select value={alertFilter} onValueChange={setAlertFilter}>
                  <SelectTrigger className="w-40" data-testid="select-alert-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 border rounded-lg space-y-3" data-testid={`alert-${alert.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                          <Badge className={statusColors[alert.status]} variant="outline">{alert.status}</Badge>
                          <div>
                            <p className="font-medium">{alert.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(alert.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{alert.resourceType}</span>
                          <span>|</span>
                          <span>{alert.sourceId}</span>
                          <span>|</span>
                          <span>{alert.alertType}</span>
                        </div>
                        <div className="flex gap-2">
                          {alert.status === "open" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAlertMutation.mutate({ id: alert.id, status: "acknowledged" })}
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Acknowledge
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAlertMutation.mutate({ id: alert.id, status: "dismissed" })}
                                data-testid={`button-dismiss-${alert.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Dismiss
                              </Button>
                            </>
                          )}
                          {(alert.status === "acknowledged" || alert.status === "investigating") && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateAlertMutation.mutate({ id: alert.id, status: "resolved" })}
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drift" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Data Drift Metrics
              </CardTitle>
              <CardDescription>Detected changes in data distribution patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {driftMetrics.map((drift) => (
                    <div key={drift.id} className="p-4 border rounded-lg space-y-3" data-testid={`drift-${drift.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Badge className={severityColors[drift.severity]}>{drift.severity}</Badge>
                          {drift.driftDirection === "increase" ? (
                            <TrendingUp className="h-5 w-5 text-red-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-blue-500" />
                          )}
                          <div>
                            <p className="font-medium">{drift.metricName}</p>
                            <p className="text-sm text-muted-foreground">
                              {drift.resourceType} - {drift.sourceId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${drift.driftPercentage > 0 ? "text-red-500" : "text-blue-500"}`}>
                            {drift.driftPercentage > 0 ? "+" : ""}{drift.driftPercentage.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {drift.baselineValue.toFixed(2)} → {drift.currentValue.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={drift.trend.map((v, i) => ({ index: i, value: v }))}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="index" hide />
                            <YAxis hide domain={["dataMin - 10%", "dataMax + 10%"]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Anomaly Patterns
              </CardTitle>
              <CardDescription>Detected unusual patterns in data that may indicate quality issues</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {anomalies.map((anomaly) => (
                    <div key={anomaly.id} className="p-4 border rounded-lg space-y-3" data-testid={`anomaly-${anomaly.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Badge className={severityColors[anomaly.severity]}>{anomaly.severity}</Badge>
                          <FileWarning className="h-5 w-5 text-yellow-500" />
                          <div>
                            <p className="font-medium capitalize">{anomaly.patternType.replace(/_/g, " ")}</p>
                            <p className="text-sm text-muted-foreground mt-1">{anomaly.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{anomaly.affectedRecordCount}</p>
                          <p className="text-xs text-muted-foreground">affected records</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-4 text-sm">
                          <span className="text-muted-foreground">{anomaly.resourceType}</span>
                          <span className="text-muted-foreground">{anomaly.sourceId}</span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {(anomaly.confidenceScore * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">Suggested Action</p>
                        <p className="text-sm text-muted-foreground">{anomaly.suggestedAction}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Data Integrity Risks
              </CardTitle>
              <CardDescription>Identified risks to data integrity across quality dimensions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {risks.map((risk) => (
                    <div key={risk.id} className="p-4 border rounded-lg space-y-3" data-testid={`risk-${risk.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Badge className={severityColors[risk.riskLevel]}>{risk.riskLevel}</Badge>
                          <Layers className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="font-medium capitalize">{risk.riskCategory} Risk</p>
                            <p className="text-sm text-muted-foreground mt-1">{risk.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{(risk.riskScore * 100).toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">risk score</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">{risk.impactAssessment}</p>
                        <div className="flex gap-2 flex-wrap">
                          {risk.affectedFields.map((field) => (
                            <Badge key={field} variant="outline">{field}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-2">Mitigation Suggestions</p>
                        <ul className="space-y-1">
                          {risk.mitigationSuggestions.map((suggestion, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {snapshot?.sourceMetrics && Object.values(snapshot.sourceMetrics).map((source: any) => (
              <Card key={source.sourceId} data-testid={`source-${source.sourceId}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{source.sourceName}</CardTitle>
                  <CardDescription>{source.sourceId}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Quality Score</span>
                    <span className="text-2xl font-bold">{source.qualityScore}%</span>
                  </div>
                  <Progress value={source.qualityScore} />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Records</p>
                      <p className="font-medium">{source.recordCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Error Rate</p>
                      <p className="font-medium">{(source.errorRate * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last sync: {new Date(source.lastSync).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
