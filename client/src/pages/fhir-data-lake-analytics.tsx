import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  LineChart,
  Activity,
  Users,
  Database,
  Shield,
  Target,
  Lightbulb,
  FileText,
  Bell,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Loader2,
  Download,
  Eye,
  ChevronRight,
  Zap,
  Heart,
  Stethoscope
} from "lucide-react";

interface DataLakeMetrics {
  totalPatients: number;
  totalResources: number;
  resourceBreakdown: Record<string, number>;
  dataQualityScore: number;
  lastUpdated: string;
}

interface PredictiveInsight {
  id: string;
  category: string;
  title: string;
  description: string;
  probability: number;
  confidence: number;
  affectedPopulation: number;
  riskFactors: Array<{ factor: string; weight: number; evidence: string }>;
  recommendations: string[];
  timeframe: string;
  trend: string;
  generatedAt: string;
}

interface PopulationTrend {
  id: string;
  metric: string;
  category: string;
  condition?: string;
  currentValue: number;
  previousValue: number;
  percentChange: number;
  trend: string;
  dataPoints: Array<{ date: string; value: number }>;
  demographicBreakdown: Array<{ segment: string; value: number; percentage: number }>;
  forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }>;
  insights: string[];
  generatedAt: string;
}

interface AnomalyAlert {
  id: string;
  severity: string;
  type: string;
  title: string;
  description: string;
  affectedEntity: string;
  detectedAt: string;
  metrics: Record<string, number>;
  expectedRange: { min: number; max: number };
  actualValue: number;
  deviationPercent: number;
  recommendation: string;
  status: string;
  relatedAlerts?: string[];
}

interface QualityMetric {
  id: string;
  name: string;
  category: string;
  currentScore: number;
  targetScore: number;
  benchmark: number;
  trend: string;
  historicalData: Array<{ period: string; score: number }>;
  components: Array<{ name: string; score: number; weight: number }>;
  recommendations: string[];
}

interface RecommendationAction {
  id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  rationale: string;
  expectedImpact: { metric: string; improvement: number; timeframe: string };
  steps: string[];
  resources: string[];
  status: string;
  assignedTo?: string;
  dueDate?: string;
}

interface DashboardSummary {
  dataLake: DataLakeMetrics;
  insights: { total: number; topInsights: PredictiveInsight[]; categories: Record<string, number> };
  trends: { total: number; improving: number; declining: number; topTrends: PopulationTrend[] };
  alerts: { total: number; active: number; critical: number; recentAlerts: AnomalyAlert[] };
  quality: { averageScore: number; belowTarget: number; improving: number; metrics: QualityMetric[] };
  recommendations: { total: number; pending: number; critical: number; topRecommendations: RecommendationAction[] };
  generatedAt: string;
  disclaimer: string;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500"
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500"
};

const categoryIcons: Record<string, typeof Brain> = {
  readmission_risk: Activity,
  disease_progression: TrendingUp,
  care_gap: Target,
  resource_utilization: BarChart3,
  patient_outcome: Heart,
  clinical: Stethoscope,
  operational: Zap,
  quality: Shield,
  cost: LineChart,
  compliance: FileText
};

export default function FHIRDataLakeAnalytics() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedInsight, setSelectedInsight] = useState<PredictiveInsight | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AnomalyAlert | null>(null);
  const [alertFilter, setAlertFilter] = useState<string>("all");
  const [reportConfig, setReportConfig] = useState({
    type: "executive_summary",
    title: `Analytics Report - ${new Date().toLocaleDateString()}`,
    includeSections: ["metrics", "trends", "alerts", "insights", "recommendations"]
  });
  const [reportTitleError, setReportTitleError] = useState("");

  const { data: dashboardData, isLoading: loadingDashboard, refetch: refetchDashboard } = useQuery<DashboardSummary>({
    queryKey: ["/api/data-lake-analytics/dashboard-summary"],
  });

  const { data: insightsData, isLoading: loadingInsights } = useQuery<{ insights: PredictiveInsight[] }>({
    queryKey: ["/api/data-lake-analytics/predictive-insights"],
    enabled: activeTab === "insights"
  });

  const { data: trendsData, isLoading: loadingTrends } = useQuery<{ trends: PopulationTrend[] }>({
    queryKey: ["/api/data-lake-analytics/population-trends"],
    enabled: activeTab === "trends"
  });

  const { data: alertsData, isLoading: loadingAlerts } = useQuery<{ alerts: AnomalyAlert[]; summary: Record<string, number> }>({
    queryKey: ["/api/data-lake-analytics/anomaly-alerts"],
    enabled: activeTab === "alerts"
  });

  const { data: qualityData, isLoading: loadingQuality } = useQuery<{ metrics: QualityMetric[]; summary: Record<string, number> }>({
    queryKey: ["/api/data-lake-analytics/quality-metrics"],
    enabled: activeTab === "quality"
  });

  const { data: recommendationsData, isLoading: loadingRecommendations } = useQuery<{ recommendations: RecommendationAction[] }>({
    queryKey: ["/api/data-lake-analytics/recommendations"],
    enabled: activeTab === "recommendations"
  });

  const generateReportMutation = useMutation({
    mutationFn: async (config: typeof reportConfig) => {
      const response = await apiRequest("POST", "/api/data-lake-analytics/reports/generate", config);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Report Generated", description: "Your custom report has been generated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report.", variant: "destructive" });
    }
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("PATCH", `/api/data-lake-analytics/anomaly-alerts/${alertId}/acknowledge`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-lake-analytics/anomaly-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-lake-analytics/dashboard-summary"] });
      toast({ title: "Alert Acknowledged", description: "The alert has been acknowledged." });
    }
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercent = (num: number) => `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;

  const TrendIndicator = ({ trend, value }: { trend: string; value?: number }) => {
    if (trend === 'up' || trend === 'increasing') {
      return (
        <span className="flex items-center gap-1 text-red-500">
          <ArrowUpRight className="w-4 h-4" />
          {value !== undefined && formatPercent(value)}
        </span>
      );
    }
    if (trend === 'down' || trend === 'decreasing') {
      return (
        <span className="flex items-center gap-1 text-green-500">
          <ArrowDownRight className="w-4 h-4" />
          {value !== undefined && formatPercent(value)}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Minus className="w-4 h-4" />
        {value !== undefined && formatPercent(value)}
      </span>
    );
  };

  const MiniChart = ({ dataPoints }: { dataPoints: Array<{ date: string; value: number }> }) => {
    if (!dataPoints?.length) return null;
    const max = Math.max(...dataPoints.map(d => d.value));
    const min = Math.min(...dataPoints.map(d => d.value));
    const range = max - min || 1;
    
    return (
      <div className="flex items-end gap-0.5 h-8" data-testid="mini-chart">
        {dataPoints.slice(-12).map((point, i) => (
          <div
            key={i}
            className="w-1.5 bg-primary/70 rounded-t"
            style={{ height: `${((point.value - min) / range) * 100}%`, minHeight: '4px' }}
          />
        ))}
      </div>
    );
  };

  if (loadingDashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const summary = dashboardData;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary" />
            AI-Powered Data Lake Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Predictive insights, population trends, and proactive recommendations from FHIR health data
          </p>
        </div>
        <Button onClick={() => refetchDashboard()} variant="outline" data-testid="button-refresh-dashboard">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Compliance Notice</AlertTitle>
        <AlertDescription>
          {summary?.disclaimer || "This analysis is for informational and data governance purposes only. Not for clinical decision-making."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card data-testid="card-metric-patients">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">Patients</span>
            </div>
            <div className="text-2xl font-bold">{formatNumber(summary?.dataLake?.totalPatients || 0)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-resources">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Database className="w-4 h-4" />
              <span className="text-xs">FHIR Resources</span>
            </div>
            <div className="text-2xl font-bold">{formatNumber(summary?.dataLake?.totalResources || 0)}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-quality">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="w-4 h-4" />
              <span className="text-xs">Data Quality</span>
            </div>
            <div className="text-2xl font-bold">{summary?.dataLake?.dataQualityScore || 0}%</div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-alerts">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bell className="w-4 h-4" />
              <span className="text-xs">Active Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{summary?.alerts?.active || 0}</span>
              {(summary?.alerts?.critical || 0) > 0 && (
                <Badge variant="destructive" className="text-xs">{summary?.alerts?.critical} critical</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-insights">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Lightbulb className="w-4 h-4" />
              <span className="text-xs">Insights</span>
            </div>
            <div className="text-2xl font-bold">{summary?.insights?.total || 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-quality-score">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs">Quality Score</span>
            </div>
            <div className="text-2xl font-bold">{summary?.quality?.averageScore || 0}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">Quality</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Critical Alerts
                </CardTitle>
                <CardDescription>Requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary?.alerts?.recentAlerts?.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                    onClick={() => { setSelectedAlert(alert); setActiveTab("alerts"); }}
                    data-testid={`alert-item-${alert.id}`}
                  >
                    <div className={`w-2 h-2 mt-2 rounded-full ${severityColors[alert.severity]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{alert.title}</div>
                      <div className="text-sm text-muted-foreground truncate">{alert.affectedEntity}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0">{alert.severity}</Badge>
                  </div>
                ))}
                {(!summary?.alerts?.recentAlerts?.length) && (
                  <div className="text-center text-muted-foreground py-4">No active alerts</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" />
                  Top Predictive Insights
                </CardTitle>
                <CardDescription>AI-generated patient outcome predictions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary?.insights?.topInsights?.map((insight) => {
                  const Icon = categoryIcons[insight.category] || Brain;
                  return (
                    <div
                      key={insight.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                      onClick={() => { setSelectedInsight(insight); setActiveTab("insights"); }}
                      data-testid={`insight-item-${insight.id}`}
                    >
                      <Icon className="w-5 h-5 mt-0.5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{insight.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {insight.affectedPopulation.toLocaleString()} patients affected
                        </div>
                      </div>
                      <Badge variant="secondary">{Math.round(insight.probability * 100)}%</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Population Health Trends
                </CardTitle>
                <CardDescription>Key metrics over time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary?.trends?.topTrends?.map((trend) => (
                  <div key={trend.id} className="space-y-2" data-testid={`trend-item-${trend.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{trend.metric}</div>
                      <TrendIndicator trend={trend.trend} value={trend.percentChange} />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-bold">{trend.currentValue}{trend.category === 'prevalence' ? '%' : ''}</div>
                      <MiniChart dataPoints={trend.dataPoints} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Priority Recommendations
                </CardTitle>
                <CardDescription>Actionable improvements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary?.recommendations?.topRecommendations?.map((rec) => {
                  const Icon = categoryIcons[rec.category] || Lightbulb;
                  return (
                    <div
                      key={rec.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`recommendation-item-${rec.id}`}
                    >
                      <Icon className="w-5 h-5 mt-0.5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{rec.title}</div>
                        <div className="text-sm text-muted-foreground">
                          Impact: {rec.expectedImpact.improvement}% improvement in {rec.expectedImpact.timeframe}
                        </div>
                      </div>
                      <Badge className={priorityColors[rec.priority]}>{rec.priority}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                FHIR Resource Distribution
              </CardTitle>
              <CardDescription>Data lake composition by resource type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(summary?.dataLake?.resourceBreakdown || {}).slice(0, 10).map(([resource, count]) => (
                  <div key={resource} className="text-center p-3 rounded-lg bg-muted/50" data-testid={`resource-${resource}`}>
                    <div className="text-lg font-bold">{formatNumber(count as number)}</div>
                    <div className="text-xs text-muted-foreground">{resource}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {loadingInsights ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <div className="grid gap-4">
              {insightsData?.insights?.map((insight) => {
                const Icon = categoryIcons[insight.category] || Brain;
                return (
                  <Card key={insight.id} className={selectedInsight?.id === insight.id ? "ring-2 ring-primary" : ""} data-testid={`insight-card-${insight.id}`}>
                    <CardHeader className="cursor-pointer" onClick={() => setSelectedInsight(selectedInsight?.id === insight.id ? null : insight)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{insight.title}</CardTitle>
                            <CardDescription className="mt-1">{insight.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="secondary" className="text-lg">{Math.round(insight.probability * 100)}%</Badge>
                          <TrendIndicator trend={insight.trend} />
                        </div>
                      </div>
                    </CardHeader>
                    {selectedInsight?.id === insight.id && (
                      <CardContent className="space-y-4 border-t pt-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="text-center p-3 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{insight.affectedPopulation.toLocaleString()}</div>
                            <div className="text-sm text-muted-foreground">Affected Patients</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{Math.round(insight.confidence * 100)}%</div>
                            <div className="text-sm text-muted-foreground">Confidence</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-muted">
                            <div className="text-2xl font-bold">{insight.timeframe}</div>
                            <div className="text-sm text-muted-foreground">Timeframe</div>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Risk Factors</h4>
                          <div className="space-y-2">
                            {insight.riskFactors.map((rf, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <Progress value={rf.weight * 100} className="flex-1" />
                                <span className="text-sm w-12 text-right">{Math.round(rf.weight * 100)}%</span>
                                <span className="text-sm flex-1">{rf.factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Recommendations</h4>
                          <ul className="space-y-1">
                            {insight.recommendations.map((rec, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="w-4 h-4 mt-0.5 text-primary" />
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {loadingTrends ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <div className="grid gap-4">
              {trendsData?.trends?.map((trend) => (
                <Card key={trend.id} data-testid={`trend-card-${trend.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {trend.metric}
                          {trend.condition && <Badge variant="outline">{trend.condition}</Badge>}
                        </CardTitle>
                        <CardDescription>Category: {trend.category}</CardDescription>
                      </div>
                      <TrendIndicator trend={trend.trend} value={trend.percentChange} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <div className="text-2xl font-bold">{trend.currentValue}</div>
                        <div className="text-sm text-muted-foreground">Current</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <div className="text-2xl font-bold">{trend.previousValue}</div>
                        <div className="text-sm text-muted-foreground">Previous</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted">
                        <MiniChart dataPoints={trend.dataPoints} />
                        <div className="text-sm text-muted-foreground mt-1">12-Month Trend</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Demographic Breakdown</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {trend.demographicBreakdown.map((segment, i) => (
                          <div key={i} className="p-2 rounded bg-muted/50 text-center">
                            <div className="font-medium">{segment.value}</div>
                            <div className="text-xs text-muted-foreground">{segment.segment}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">AI Insights</h4>
                      <ul className="space-y-1">
                        {trend.insights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Lightbulb className="w-4 h-4 mt-0.5 text-yellow-500" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center gap-4">
            <Select value={alertFilter} onValueChange={setAlertFilter} data-testid="select-alert-filter">
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {alertsData?.summary && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="destructive">{alertsData.summary.critical || 0} Critical</Badge>
                <Badge className="bg-orange-500">{alertsData.summary.high || 0} High</Badge>
                <Badge variant="secondary">{alertsData.summary.active || 0} Active</Badge>
              </div>
            )}
          </div>
          {loadingAlerts ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <div className="grid gap-4">
              {alertsData?.alerts
                ?.filter(a => alertFilter === 'all' || a.severity === alertFilter)
                .map((alert) => (
                <Card key={alert.id} className={`border-l-4 ${
                  alert.severity === 'critical' ? 'border-l-red-500' :
                  alert.severity === 'high' ? 'border-l-orange-500' :
                  alert.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                }`} data-testid={`alert-card-${alert.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`w-5 h-5 ${
                          alert.severity === 'critical' ? 'text-red-500' :
                          alert.severity === 'high' ? 'text-orange-500' :
                          alert.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <CardTitle className="text-lg">{alert.title}</CardTitle>
                          <CardDescription>{alert.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                        <Badge variant="outline">{alert.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Affected Entity</div>
                        <div className="font-medium">{alert.affectedEntity}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Actual Value</div>
                        <div className="font-medium">{alert.actualValue}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Expected Range</div>
                        <div className="font-medium">{alert.expectedRange.min} - {alert.expectedRange.max}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <div className="text-sm text-muted-foreground">Deviation</div>
                        <div className="font-medium text-red-500">+{alert.deviationPercent}%</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="font-semibold mb-1">Recommendation</div>
                      <p className="text-sm">{alert.recommendation}</p>
                    </div>
                    {alert.status === 'active' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                          disabled={acknowledgeAlertMutation.isPending}
                          data-testid={`button-acknowledge-${alert.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Acknowledge
                        </Button>
                        <Button size="sm" variant="outline" data-testid={`button-investigate-${alert.id}`}>
                          <Clock className="w-4 h-4 mr-2" />
                          Investigate
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          {loadingQuality ? (
            <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold">{qualityData?.summary?.averageScore || 0}%</div>
                    <div className="text-sm text-muted-foreground">Average Score</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-green-500">{qualityData?.summary?.improving || 0}</div>
                    <div className="text-sm text-muted-foreground">Improving</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{qualityData?.summary?.belowTarget || 0}</div>
                    <div className="text-sm text-muted-foreground">Below Target</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold">{qualityData?.metrics?.length || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Metrics</div>
                  </CardContent>
                </Card>
              </div>
              <div className="grid gap-4">
                {qualityData?.metrics?.map((metric) => (
                  <Card key={metric.id} data-testid={`quality-card-${metric.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {metric.name}
                            <Badge variant="outline">{metric.category.replace('_', ' ')}</Badge>
                          </CardTitle>
                          <CardDescription>
                            Target: {metric.targetScore}% | Benchmark: {metric.benchmark}%
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">{metric.currentScore}%</div>
                          <Badge variant={metric.trend === 'improving' ? 'default' : metric.trend === 'declining' ? 'destructive' : 'secondary'}>
                            {metric.trend}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress to Target</span>
                          <span>{Math.round((metric.currentScore / metric.targetScore) * 100)}%</span>
                        </div>
                        <Progress value={(metric.currentScore / metric.targetScore) * 100} />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Components</h4>
                        <div className="grid md:grid-cols-2 gap-2">
                          {metric.components.map((comp, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <span className="text-sm">{comp.name}</span>
                              <span className="font-medium">{comp.score}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {metric.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <ChevronRight className="w-4 h-4 mt-0.5 text-primary" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Generate Custom Report
              </CardTitle>
              <CardDescription>
                Create customized analytics reports for stakeholders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select
                    value={reportConfig.type}
                    onValueChange={(value) => setReportConfig({ ...reportConfig, type: value })}
                    data-testid="select-report-type"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive_summary">Executive Summary</SelectItem>
                      <SelectItem value="clinical_quality">Clinical Quality</SelectItem>
                      <SelectItem value="population_health">Population Health</SelectItem>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Report Title <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Enter report title"
                    value={reportConfig.title}
                    onChange={(e) => {
                      setReportConfig({ ...reportConfig, title: e.target.value });
                      if (!e.target.value.trim()) {
                        setReportTitleError("Report title is required");
                      } else {
                        setReportTitleError("");
                      }
                    }}
                    className={reportTitleError ? "border-red-500" : ""}
                    data-testid="input-report-title"
                  />
                  {reportTitleError && (
                    <p className="text-sm text-red-500">{reportTitleError}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Include Sections</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {['metrics', 'trends', 'alerts', 'insights', 'recommendations'].map((section) => (
                    <div key={section} className="flex items-center gap-2">
                      <Checkbox
                        id={section}
                        checked={reportConfig.includeSections.includes(section)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setReportConfig({
                              ...reportConfig,
                              includeSections: [...reportConfig.includeSections, section]
                            });
                          } else {
                            setReportConfig({
                              ...reportConfig,
                              includeSections: reportConfig.includeSections.filter(s => s !== section)
                            });
                          }
                        }}
                        data-testid={`checkbox-section-${section}`}
                      />
                      <Label htmlFor={section} className="capitalize">{section}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => {
                  if (!reportConfig.title.trim()) {
                    setReportTitleError("Report title is required");
                    return;
                  }
                  generateReportMutation.mutate(reportConfig);
                }}
                disabled={!reportConfig.title.trim() || generateReportMutation.isPending}
                data-testid="button-generate-report"
              >
                {generateReportMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Generate Report
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>Previously generated analytics reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { id: 1, name: 'Q4 Executive Summary', type: 'executive_summary', date: '2026-01-28' },
                  { id: 2, name: 'Population Health Overview', type: 'population_health', date: '2026-01-25' },
                  { id: 3, name: 'Clinical Quality Metrics', type: 'clinical_quality', date: '2026-01-20' },
                ].map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate" data-testid={`recent-report-${report.id}`}>
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">{report.type.replace('_', ' ')} - {report.date}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" data-testid={`button-view-report-${report.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
