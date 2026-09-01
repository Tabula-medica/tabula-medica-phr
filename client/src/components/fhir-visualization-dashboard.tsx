import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Users,
  Database,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
} from "recharts";

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }[];
}

interface VisualizationConfig {
  id: string;
  title: string;
  description: string;
  chartType: "line" | "bar" | "pie" | "doughnut" | "area" | "scatter" | "radar" | "heatmap";
  data: ChartData;
  insights: string[];
  category: string;
  priority: number;
  aiGenerated: boolean;
  recommendations: string[];
}

interface AIInsight {
  id: string;
  type: "trend" | "anomaly" | "correlation" | "recommendation" | "warning";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  actionItems: string[];
  confidence: number;
}

interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  visualizations: VisualizationConfig[];
  generatedAt: string;
  dataSourceSummary: {
    resourceTypes: string[];
    totalRecords: number;
    dateRange: { start: string; end: string };
  };
}

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316", "#6366f1"];

export function FHIRVisualizationDashboard() {
  const [resourceJson, setResourceJson] = useState("");
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [activeTab, setActiveTab] = useState("generate");
  const [chartFilter, setChartFilter] = useState<string>("all");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateDashboardMutation = useMutation({
    mutationFn: async (resources: any[]) => {
      const response = await apiRequest("POST", "/api/fhir-visualization/dashboard", { resources });
      return response.json();
    },
    onSuccess: (data) => {
      setDashboard(data.dashboard);
      setActiveTab("dashboard");
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async (resources: any[]) => {
      const response = await apiRequest("POST", "/api/fhir-visualization/insights", { resources });
      return response.json();
    },
    onSuccess: (data) => {
      setInsights(data.insights || []);
    },
  });

  const loadSampleDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/fhir-visualization/sample-data");
      return response.json();
    },
    onSuccess: (data) => {
      setResourceJson(JSON.stringify(data.resources, null, 2));
    },
  });

  const handleGenerateDashboard = () => {
    setJsonError(null);
    try {
      const resources = JSON.parse(resourceJson);
      if (!Array.isArray(resources)) {
        const errorMsg = "Resources must be a JSON array";
        setJsonError(errorMsg);
        toast({ title: "Invalid Input", description: errorMsg, variant: "destructive" });
        return;
      }
      generateDashboardMutation.mutate(resources);
      generateInsightsMutation.mutate(resources);
    } catch (e: any) {
      const errorMsg = e.message || "Invalid JSON format";
      setJsonError(errorMsg);
      toast({ title: "JSON Parse Error", description: errorMsg, variant: "destructive" });
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "warning": return <AlertTriangle className="h-4 w-4" />;
      case "trend": return <TrendingUp className="h-4 w-4" />;
      case "recommendation": return <Lightbulb className="h-4 w-4" />;
      case "anomaly": return <Activity className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  const renderChart = (viz: VisualizationConfig) => {
    const chartData = viz.data.labels.map((label, idx) => ({
      name: label,
      value: viz.data.datasets[0]?.data[idx] || 0,
    }));

    switch (viz.chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "doughnut":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPie>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={viz.chartType === "doughnut" ? 50 : 0}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={{ strokeWidth: 1 }}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPie>
          </ResponsiveContainer>
        );

      case "radar":
        return (
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="Score" dataKey="value" stroke="#22c55e" fill="rgba(34, 197, 94, 0.3)" />
            </RadarChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "clinical_trends": return <TrendingUp className="h-4 w-4" />;
      case "patient_population": return <Users className="h-4 w-4" />;
      case "data_quality": return <Database className="h-4 w-4" />;
      case "utilization": return <Activity className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const filteredVisualizations = dashboard?.visualizations.filter(
    (viz) => chartFilter === "all" || viz.category === chartFilter
  ) || [];

  return (
    <div className="space-y-6" data-testid="page-fhir-visualization">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-6 w-6" />
            AI FHIR Data Visualization
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Generate insightful charts and dashboards from your FHIR resources
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-chart-types">
            <PieChart className="h-3 w-3" /> 8 Chart Types
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-ai-insights">
            <Sparkles className="h-3 w-3" /> AI Insights
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Database className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard" disabled={!dashboard}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights" disabled={insights.length === 0}>
            <Lightbulb className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <Card data-testid="card-fhir-input">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-input-title">
                <Database className="h-5 w-5" />
                FHIR Resources Input
              </CardTitle>
              <CardDescription data-testid="text-input-description">
                Paste your FHIR resources as a JSON array to generate visualizations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder='[{"resourceType": "Patient", "id": "1", ...}, ...]'
                  className={`font-mono text-sm min-h-[300px] ${jsonError ? "border-destructive" : ""}`}
                  value={resourceJson}
                  onChange={(e) => { setResourceJson(e.target.value); setJsonError(null); }}
                  data-testid="textarea-fhir-resources"
                />
                {jsonError && (
                  <p className="text-sm text-destructive flex items-center gap-1" data-testid="text-json-error">
                    <AlertTriangle className="h-4 w-4" />
                    {jsonError}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={handleGenerateDashboard}
                  disabled={generateDashboardMutation.isPending || !resourceJson.trim()}
                  data-testid="button-generate-dashboard"
                >
                  {generateDashboardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadSampleDataMutation.mutate()}
                  disabled={loadSampleDataMutation.isPending}
                  data-testid="button-load-sample"
                >
                  {loadSampleDataMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Load Sample Data
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-feature-clinical-trends">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-feature-clinical-trends-title">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Clinical Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-feature-clinical-trends-description">
                  Analyze temporal patterns in conditions, medications, and observations
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-feature-population">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-feature-population-title">
                  <Users className="h-4 w-4 text-green-500" />
                  Population Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-feature-population-description">
                  Demographics, age distribution, and patient cohort analysis
                </p>
              </CardContent>
            </Card>
            <Card data-testid="card-feature-data-quality">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2" data-testid="text-feature-data-quality-title">
                  <Database className="h-4 w-4 text-purple-500" />
                  Data Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground" data-testid="text-feature-data-quality-description">
                  Completeness, validity, consistency, and timeliness metrics
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboard && (
            <>
              <Card data-testid="card-dashboard-summary">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2" data-testid="text-dashboard-name">
                        <BarChart3 className="h-5 w-5" />
                        {dashboard.name}
                      </CardTitle>
                      <CardDescription data-testid="text-dashboard-description">{dashboard.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="fhir-visualization-dashb-filter" className="text-sm" data-testid="label-chart-filter">Filter:</Label>
                      <Select value={chartFilter} onValueChange={setChartFilter}>
                        <SelectTrigger id="fhir-visualization-dashb-filter" className="w-[180px]" data-testid="select-chart-filter">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" data-testid="select-item-all">All Categories</SelectItem>
                          <SelectItem value="clinical_trends" data-testid="select-item-clinical-trends">Clinical Trends</SelectItem>
                          <SelectItem value="patient_population" data-testid="select-item-patient-population">Patient Population</SelectItem>
                          <SelectItem value="data_quality" data-testid="select-item-data-quality">Data Quality</SelectItem>
                          <SelectItem value="utilization" data-testid="select-item-utilization">Utilization</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" data-testid="badge-total-records">
                      {dashboard.dataSourceSummary.totalRecords} Records
                    </Badge>
                    <Badge variant="outline" data-testid="badge-resource-types">
                      {dashboard.dataSourceSummary.resourceTypes.length} Resource Types
                    </Badge>
                    <Badge variant="outline" data-testid="badge-chart-count">
                      {dashboard.visualizations.length} Charts
                    </Badge>
                    {dashboard.visualizations.some(v => v.aiGenerated) && (
                      <Badge className="flex items-center gap-1" data-testid="badge-ai-enhanced">
                        <Sparkles className="h-3 w-3" /> AI Enhanced
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="container-charts">
                {filteredVisualizations.map((viz) => (
                  <Card key={viz.id} className="overflow-hidden" data-testid={`card-chart-${viz.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2" data-testid={`text-chart-title-${viz.id}`}>
                            {getCategoryIcon(viz.category)}
                            {viz.title}
                            {viz.aiGenerated && (
                              <Sparkles className="h-3 w-3" />
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs" data-testid={`text-chart-description-${viz.id}`}>{viz.description}</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-chart-type-${viz.id}`}>
                          {viz.chartType}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {renderChart(viz)}
                      
                      {viz.insights.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground" data-testid={`label-chart-insights-${viz.id}`}>Key Insights:</p>
                          <div className="space-y-1">
                            {viz.insights.slice(0, 2).map((insight, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs" data-testid={`text-chart-insight-${viz.id}-${idx}`}>
                                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                                <span>{insight}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {viz.recommendations.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground" data-testid={`label-chart-recommendations-${viz.id}`}>Recommendations:</p>
                          <div className="flex flex-wrap gap-1">
                            {viz.recommendations.slice(0, 2).map((rec, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs" data-testid={`badge-chart-recommendation-${viz.id}-${idx}`}>
                                {rec.length > 40 ? rec.substring(0, 40) + "..." : rec}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredVisualizations.length === 0 && (
                <Card data-testid="card-empty-charts">
                  <CardContent className="py-12 text-center text-muted-foreground" data-testid="text-empty-charts">
                    No visualizations match the selected filter
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card data-testid="card-ai-insights">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-ai-insights-title">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI-Generated Insights
              </CardTitle>
              <CardDescription data-testid="text-ai-insights-description">
                Intelligent analysis of your FHIR data patterns and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights.length > 0 ? (
                <div className="space-y-4" data-testid="container-insights">
                  {insights.map((insight) => (
                    <Card key={insight.id} data-testid={`card-insight-${insight.id}`} className={`${
                      insight.severity === "high" || insight.severity === "critical" 
                        ? "bg-red-50 dark:bg-red-950/20" 
                        : insight.severity === "medium" 
                          ? "bg-amber-50 dark:bg-amber-950/20" 
                          : "bg-green-50 dark:bg-green-950/20"
                    }`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <CardTitle className="text-sm flex items-center gap-2" data-testid={`text-insight-title-${insight.id}`}>
                            {getInsightIcon(insight.type)}
                            {insight.title}
                          </CardTitle>
                          <div className="flex gap-2">
                            <Badge variant={getSeverityColor(insight.severity) as any} data-testid={`badge-insight-severity-${insight.id}`}>
                              {insight.severity}
                            </Badge>
                            <Badge variant="outline" data-testid={`badge-insight-confidence-${insight.id}`}>
                              {Math.round(insight.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground" data-testid={`text-insight-description-${insight.id}`}>{insight.description}</p>
                        
                        {insight.actionItems.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium" data-testid={`label-action-items-${insight.id}`}>Action Items:</p>
                            <ul className="space-y-1">
                              {insight.actionItems.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-xs" data-testid={`text-action-item-${insight.id}-${idx}`}>
                                  <span className="font-medium">{idx + 1}.</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12" data-testid="text-empty-insights">
                  Generate a dashboard to see AI-powered insights
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
