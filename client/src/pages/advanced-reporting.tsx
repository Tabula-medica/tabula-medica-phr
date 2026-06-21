import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Download,
  FileText,
  Plus,
  Play,
  Settings,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2,
  ChevronRight,
  Eye,
  Trash2,
  Mail,
  Filter,
  Sparkles,
  Target,
  Activity,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Brain,
  DollarSign,
  Heart,
  Shield,
  Bed,
  UserPlus,
  Building,
  Star,
  ThumbsUp,
  Smile,
  FileDown,
  Grid3X3,
  UsersRound,
  LayoutDashboard,
  Info,
  Minus,
} from "lucide-react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart as RechartsBarChart, Bar, ReferenceLine } from "recharts";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  dataPoints: any[];
  charts: any[];
  sections: any[];
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  tags: string[];
}

interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  frequency: string;
  nextRunAt: string;
  lastRunAt?: string;
  recipients: string[];
  exportFormat: string;
  dateRangeType: string;
  isActive: boolean;
  createdAt: string;
}

interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  generatedAt: string;
  generatedBy: string;
  dateRange: { start: string; end: string };
  data: any;
  exportFormat: string;
  status: string;
}

interface TrendData {
  id: string;
  metric: string;
  dataPoints: { date: string; value: number }[];
  changePercent: number;
  trend: string;
  periodComparison: {
    current: number;
    previous: number;
    percentChange: number;
  };
}

interface ForecastData {
  id: string;
  metric: string;
  historicalData: { date: string; value: number }[];
  predictions: { date: string; value: number; confidenceLow: number; confidenceHigh: number }[];
  methodology: string;
  accuracy: number;
  nextPeriodPrediction: {
    value: number;
    confidence: number;
    range: { low: number; high: number };
  };
}

interface DashboardData {
  templates: ReportTemplate[];
  scheduledReports: ScheduledReport[];
  recentReports: GeneratedReport[];
  quickStats: {
    totalTemplates: number;
    activeSchedules: number;
    reportsGenerated: number;
    lastReportDate?: string;
  };
  trendSummary: TrendData[];
  forecastSummary: ForecastData[];
}

interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  metric: string;
  unit: string;
  target?: number;
  threshold?: { warning: number; critical: number };
  format: string;
  isActive: boolean;
  displayOrder: number;
}

interface KPIValue {
  kpiId: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: string;
  status: string;
  lastUpdated: string;
}

interface RiskStratificationResult {
  patientId: string;
  patientName: string;
  overallRiskScore: number;
  riskLevel: string;
  riskFactors: { factor: string; contribution: number; description: string }[];
  predictedEvents: { event: string; probability: number; timeframe: string; preventable: boolean }[];
  recommendations: string[];
  lastAssessment: string;
}

interface ResourceForecast {
  id: string;
  resourceType: string;
  resourceName: string;
  currentCapacity: number;
  currentUtilization: number;
  predictions: { date: string; predictedDemand: number; utilization: number }[];
  recommendations: string[];
  alertLevel: string;
}

interface ClinicalOutcomesReport {
  id: string;
  period: { start: string; end: string };
  metrics: {
    readmissionRate: number;
    readmissionTarget: number;
    averageLengthOfStay: number;
    mortalityRate: number;
    infectionRate: number;
    patientFallRate: number;
    medicationErrorRate: number;
    careGapsClosed: number;
    preventiveServicesCompliance: number;
  };
  trends: { metric: string; values: { date: string; value: number }[]; trend: string }[];
  aiInsights: string[];
}

interface PatientSatisfactionReport {
  id: string;
  period: { start: string; end: string };
  overallScore: number;
  npsScore: number;
  responseRate: number;
  totalResponses: number;
  categoryScores: { category: string; score: number; previousScore: number; trend: string }[];
  topStrengths: string[];
  areasForImprovement: string[];
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  keyThemes: { theme: string; count: number; sentiment: string }[];
  aiInsights: string[];
}

interface OperationalCostsReport {
  id: string;
  period: { start: string; end: string };
  totalCosts: number;
  budgetVariance: number;
  costBreakdown: { category: string; amount: number; percentOfTotal: number; budgeted: number; variance: number }[];
  costPerPatient: number;
  costPerVisit: number;
  revenueRecovery: number;
  efficiencyMetrics: { metric: string; value: number; benchmark: number; status: string }[];
  savingsOpportunities: { area: string; potentialSavings: number; difficulty: string; recommendation: string }[];
  aiInsights: string[];
}

interface ExportJob {
  id: string;
  type: string;
  format: string;
  status: string;
  progress: number;
  sourceId: string;
  sourceName: string;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  fileSize?: number;
}

interface InteractiveTrendData {
  id: string;
  metric: string;
  metricLabel: string;
  category: string;
  dataPoints: { date: string; value: number; label?: string }[];
  annotations: { date: string; label: string; type: "event" | "milestone" | "alert" }[];
  statistics: { min: number; max: number; avg: number; median: number; stdDev: number; percentile90: number };
  trendLine: { slope: number; intercept: number; rSquared: number };
  forecast?: { date: string; value: number; confidenceLow: number; confidenceHigh: number }[];
}

interface HeatmapData {
  id: string;
  title: string;
  description: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xCategories: string[];
  yCategories: string[];
  cells: { x: number; y: number; value: number; label?: string; count?: number }[];
  colorScale: { min: number; max: number; minColor: string; maxColor: string };
  aggregationType: "count" | "average" | "sum" | "percentage";
}

interface CohortCriteria {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between" | "in";
  value: string | number | string[] | number[];
  logicalOperator?: "AND" | "OR";
}

interface CohortDefinition {
  id: string;
  name: string;
  description: string;
  criteria: CohortCriteria[];
  patientCount: number;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

interface CohortAnalysisResult {
  id: string;
  cohorts: {
    cohortId: string;
    cohortName: string;
    patientCount: number;
    metrics: { metric: string; value: number; trend: string }[];
  }[];
  comparisons: {
    metric: string;
    cohortValues: { cohortId: string; value: number; percentile: number }[];
    significanceLevel: number;
    isSignificant: boolean;
  }[];
  timeSeriesComparison: {
    metric: string;
    cohortData: { cohortId: string; dataPoints: { date: string; value: number }[] }[];
  }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
  generatedAt: string;
}

interface DashboardLayout {
  columns: number;
  rowHeight: number;
  gap: number;
  responsive: boolean;
}

interface CustomWidget {
  id: string;
  type: "trend_graph" | "heatmap" | "kpi_card" | "cohort_chart" | "table" | "pie_chart" | "bar_chart" | "area_chart" | "gauge" | "text_box";
  title: string;
  dataSource: string;
  config: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval?: number;
  drilldownEnabled: boolean;
}

interface SavedFilter {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: any;
  isActive: boolean;
}

interface CustomDashboardView {
  id: string;
  name: string;
  description: string;
  stakeholderType: "administrator" | "clinician" | "analyst" | "executive" | "care_coordinator" | "custom";
  layout: DashboardLayout;
  widgets: CustomWidget[];
  filters: SavedFilter[];
  theme: "light" | "dark" | "system";
  refreshInterval: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  isShared: boolean;
  sharedWith: string[];
}

export default function AdvancedReporting() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [dateRangeType, setDateRangeType] = useState("last_30_days");
  const [exportFormat, setExportFormat] = useState("pdf");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/advanced-reporting/dashboard"],
  });

  const { data: kpisData } = useQuery<{ kpis: KPIDefinition[] }>({
    queryKey: ["/api/advanced-reporting/kpis"],
  });

  const { data: riskData } = useQuery<{ results: RiskStratificationResult[] }>({
    queryKey: ["/api/advanced-reporting/risk-stratification"],
  });

  const { data: resourceData } = useQuery<{ forecasts: ResourceForecast[] }>({
    queryKey: ["/api/advanced-reporting/resource-forecasts"],
  });

  const { data: clinicalOutcomes } = useQuery<ClinicalOutcomesReport>({
    queryKey: ["/api/advanced-reporting/clinical-outcomes"],
  });

  const { data: patientSatisfaction } = useQuery<PatientSatisfactionReport>({
    queryKey: ["/api/advanced-reporting/patient-satisfaction"],
  });

  const { data: operationalCosts } = useQuery<OperationalCostsReport>({
    queryKey: ["/api/advanced-reporting/operational-costs"],
  });

  const { data: exportsData } = useQuery<{ jobs: ExportJob[] }>({
    queryKey: ["/api/advanced-reporting/exports"],
  });

  const { data: interactiveTrendsData } = useQuery<{ trends: InteractiveTrendData[] }>({
    queryKey: ["/api/advanced-reporting/interactive-trends"],
  });

  const { data: heatmapsData } = useQuery<{ heatmaps: HeatmapData[] }>({
    queryKey: ["/api/advanced-reporting/heatmaps"],
  });

  const { data: cohortsData } = useQuery<{ cohorts: CohortDefinition[] }>({
    queryKey: ["/api/advanced-reporting/cohorts"],
  });

  const { data: customDashboardsData } = useQuery<{ dashboards: CustomDashboardView[] }>({
    queryKey: ["/api/advanced-reporting/custom-dashboards"],
  });

  const { data: stakeholderPresetsData } = useQuery<{ presets: { type: string; name: string; description: string; defaultWidgets: string[] }[] }>({
    queryKey: ["/api/advanced-reporting/stakeholder-presets"],
  });

  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [cohortAnalysisResult, setCohortAnalysisResult] = useState<CohortAnalysisResult | null>(null);

  const cohortAnalysisMutation = useMutation({
    mutationFn: async (params: { cohortIds: string[]; metrics: string[] }) => {
      const response = await apiRequest("POST", "/api/advanced-reporting/cohort-analysis", params);
      return response.json();
    },
    onSuccess: (data) => {
      setCohortAnalysisResult(data);
      toast({ title: "Analysis Complete", description: "Cohort comparison analysis has been generated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to run cohort analysis.", variant: "destructive" });
    },
  });

  const kpiValuesMutation = useMutation({
    mutationFn: async (kpiIds: string[]) => {
      const response = await apiRequest("POST", "/api/advanced-reporting/kpi-values", { kpiIds });
      return response.json();
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (params: { type: string; format: string; sourceId: string; sourceName: string }) => {
      const response = await apiRequest("POST", "/api/advanced-reporting/exports", params);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-reporting/exports"] });
      toast({ title: "Export Started", description: "Your export is being processed." });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", "/api/advanced-reporting/generate", {
        templateId,
        dateRangeType,
        exportFormat,
      });
      if (response.status === 403) {
        throw new Error("ACCESS_DENIED");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-reporting/dashboard"] });
      toast({ title: "Report Generated", description: `${data.name} has been generated successfully.` });
    },
    onError: (error: Error) => {
      if (error.message === "ACCESS_DENIED") {
        toast({ title: "Access Denied", description: "You need appropriate permissions to generate reports.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to generate report.", variant: "destructive" });
      }
    },
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "decreasing": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-8 w-8 text-primary" />
            Advanced Reporting & Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Create custom reports, schedule automated generation, and visualize data trends
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button data-testid="button-new-report">
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Informational Analytics</AlertTitle>
        <AlertDescription>
          These reports and analytics are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support. All healthcare decisions must be made by qualified healthcare providers.
        </AlertDescription>
      </Alert>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Report Templates</p>
                <p className="text-2xl font-bold" data-testid="stat-templates">{dashboard?.quickStats.totalTemplates || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Schedules</p>
                <p className="text-2xl font-bold" data-testid="stat-schedules">{dashboard?.quickStats.activeSchedules || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reports Generated</p>
                <p className="text-2xl font-bold" data-testid="stat-reports">{dashboard?.quickStats.reportsGenerated || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Report</p>
                <p className="text-sm font-medium" data-testid="stat-last-report">
                  {dashboard?.quickStats.lastReportDate 
                    ? formatDate(dashboard.quickStats.lastReportDate)
                    : "No reports yet"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-12">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
          <TabsTrigger value="predictive" data-testid="tab-predictive">Predictive</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="schedules" data-testid="tab-schedules">Schedules</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="visualizations" data-testid="tab-visualizations">Visualizations</TabsTrigger>
          <TabsTrigger value="heatmaps" data-testid="tab-heatmaps">Heatmaps</TabsTrigger>
          <TabsTrigger value="cohorts" data-testid="tab-cohorts">Cohorts</TabsTrigger>
          <TabsTrigger value="dashboards" data-testid="tab-dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="exports" data-testid="tab-exports">Exports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Reports */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Reports
                </CardTitle>
                <CardDescription>Latest generated reports</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {dashboard?.recentReports && dashboard.recentReports.length > 0 ? (
                    <div className="space-y-3">
                      {dashboard.recentReports.map((report) => (
                        <div key={report.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${report.status === "completed" ? "bg-green-100" : "bg-yellow-100"}`}>
                              {report.status === "completed" ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{report.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(report.generatedAt)} at {formatTime(report.generatedAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{report.exportFormat.toUpperCase()}</Badge>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="h-12 w-12 mb-2 opacity-50" />
                      <p>No reports generated yet</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Quick Generate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Quick Generate
                </CardTitle>
                <CardDescription>Generate a report from a template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {dashboard?.templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={dateRangeType} onValueChange={setDateRangeType}>
                    <SelectTrigger data-testid="select-date-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                      <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                      <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                      <SelectItem value="last_year">Last Year</SelectItem>
                      <SelectItem value="all_time">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Export Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger data-testid="select-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!selectedTemplate || generateReportMutation.isPending}
                  onClick={() => selectedTemplate && generateReportMutation.mutate(selectedTemplate)}
                  data-testid="button-generate"
                >
                  {generateReportMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Trend Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard?.trendSummary?.slice(0, 3).map((trend) => (
              <Card key={trend.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {getTrendIcon(trend.trend)}
                      <span className="font-medium capitalize">{trend.metric.replace(/_/g, " ")}</span>
                    </div>
                    <Badge variant={trend.changePercent > 0 ? "default" : trend.changePercent < 0 ? "destructive" : "secondary"}>
                      {trend.changePercent > 0 ? "+" : ""}{trend.changePercent}%
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{trend.periodComparison.current}</p>
                      <p className="text-xs text-muted-foreground">vs {trend.periodComparison.previous} previous period</p>
                    </div>
                    <div className={`flex items-center gap-1 ${getChangeColor(trend.changePercent)}`}>
                      {trend.changePercent > 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : trend.changePercent < 0 ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Report Templates</h2>
            <Button data-testid="button-create-template">
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard?.templates.map((template) => (
              <Card key={template.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    </div>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="font-bold">{template.dataPoints.length}</p>
                      <p className="text-muted-foreground text-xs">Data Points</p>
                    </div>
                    <div>
                      <p className="font-bold">{template.charts.length}</p>
                      <p className="text-muted-foreground text-xs">Charts</p>
                    </div>
                    <div>
                      <p className="font-bold">{template.sections.length}</p>
                      <p className="text-muted-foreground text-xs">Sections</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      generateReportMutation.mutate(template.id);
                    }}
                    disabled={generateReportMutation.isPending}
                    data-testid={`button-generate-${template.id}`}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Generate
                  </Button>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Scheduled Reports</h2>
            <Button data-testid="button-create-schedule">
              <Plus className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          </div>
          {dashboard?.scheduledReports && dashboard.scheduledReports.length > 0 ? (
            <div className="space-y-4">
              {dashboard.scheduledReports.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${schedule.isActive ? "bg-green-100" : "bg-gray-100"}`}>
                          <Calendar className={`h-5 w-5 ${schedule.isActive ? "text-green-600" : "text-gray-500"}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{schedule.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="capitalize">{schedule.frequency}</Badge>
                            <span>Next run: {formatDate(schedule.nextRunAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{schedule.recipients.length} recipients</span>
                          </div>
                          <Badge variant="secondary">{schedule.exportFormat.toUpperCase()}</Badge>
                        </div>
                        <Switch checked={schedule.isActive} />
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No Scheduled Reports</p>
                <p className="text-muted-foreground mb-4">Create a schedule to automate report generation</p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Historical Trend Analysis</h2>
            <div className="flex gap-2">
              <Select defaultValue="30">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dashboard?.trendSummary?.map((trend) => (
              <Card key={trend.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize">{trend.metric.replace(/_/g, " ")} Trend</CardTitle>
                    <Badge variant={trend.trend === "increasing" ? "default" : trend.trend === "decreasing" ? "destructive" : "secondary"}>
                      {trend.trend}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end gap-1">
                    {trend.dataPoints.slice(-14).map((dp, idx) => (
                      <div
                        key={idx}
                        className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
                        style={{
                          height: `${(dp.value / Math.max(...trend.dataPoints.map(d => d.value))) * 100}%`,
                          minHeight: "4px",
                        }}
                        title={`${dp.date}: ${dp.value}`}
                      />
                    ))}
                  </div>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{trend.periodComparison.current}</p>
                      <p className="text-xs text-muted-foreground">Current Period</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{trend.periodComparison.previous}</p>
                      <p className="text-xs text-muted-foreground">Previous Period</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${getChangeColor(trend.changePercent)}`}>
                        {trend.changePercent > 0 ? "+" : ""}{trend.changePercent}%
                      </p>
                      <p className="text-xs text-muted-foreground">Change</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* KPIs Tab */}
        <TabsContent value="kpis" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Key Performance Indicators</h2>
            <Button variant="outline" data-testid="button-customize-kpis">
              <Settings className="mr-2 h-4 w-4" />
              Customize Dashboard
            </Button>
          </div>
          <Alert>
            <Gauge className="h-4 w-4" />
            <AlertTitle>Customizable KPI Dashboard</AlertTitle>
            <AlertDescription>
              Monitor key metrics across clinical, operational, financial, and patient satisfaction domains. KPIs are for informational purposes only.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpisData?.kpis?.map((kpi, index) => {
              const sampleValues = [11.2, 4.3, 18.5, 92.3, 42, 823, 35, 78.5, 1.8, 94.2];
              const sampleChanges = [2.3, -1.2, 5.8, -0.5, 3.1, -12, 8.4, 2.1, -0.3, 1.5];
              const value = sampleValues[index % sampleValues.length];
              const change = sampleChanges[index % sampleChanges.length];
              const isPositive = change > 0;
              const meetsTarget = kpi.target ? value <= (kpi.target * 1.1) : true;
              
              return (
                <Card key={kpi.id} data-testid={`kpi-card-${kpi.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">{kpi.category.replace(/_/g, " ")}</Badge>
                    </div>
                    <CardDescription className="text-xs">{kpi.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{value}</span>
                      <span className="text-muted-foreground text-sm">{kpi.unit}</span>
                      {kpi.target && (
                        <Badge variant={meetsTarget ? "default" : "destructive"} className="ml-auto">
                          Target: {kpi.target}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {isPositive ? (
                        <><TrendingUp className="h-3 w-3 text-green-500" /><span className="text-green-600">+{change.toFixed(1)}%</span></>
                      ) : (
                        <><TrendingDown className="h-3 w-3 text-red-500" /><span className="text-red-600">{change.toFixed(1)}%</span></>
                      )}
                      <span className="text-muted-foreground">vs previous period</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>KPI Dashboard Disclaimer</AlertTitle>
            <AlertDescription>
              These KPIs are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support. All metrics should be reviewed by qualified healthcare administrators.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Predictive Analytics Tab */}
        <TabsContent value="predictive" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Predictive Analytics</h2>
            <Button variant="outline" data-testid="button-refresh-predictions">
              <Brain className="mr-2 h-4 w-4" />
              Refresh Predictions
            </Button>
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Predictive Analytics Disclaimer</AlertTitle>
            <AlertDescription>
              These predictions are for INFORMATIONAL and PLANNING purposes only. They do NOT constitute clinical decision support. All healthcare decisions must be made by qualified healthcare providers.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Stratification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  Patient Risk Stratification
                </CardTitle>
                <CardDescription>AI-powered risk assessment for patient population</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {riskData?.results?.map((patient) => (
                      <div key={patient.patientId} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            patient.riskLevel === "critical" ? "bg-red-500" :
                            patient.riskLevel === "high" ? "bg-orange-500" :
                            patient.riskLevel === "medium" ? "bg-yellow-500" : "bg-green-500"
                          }`} />
                          <div>
                            <p className="font-medium text-sm">{patient.patientName}</p>
                            <p className="text-xs text-muted-foreground">
                              Risk Score: {Math.round(patient.overallRiskScore * 100)}%
                            </p>
                          </div>
                        </div>
                        <Badge variant={
                          patient.riskLevel === "critical" ? "destructive" :
                          patient.riskLevel === "high" ? "default" :
                          patient.riskLevel === "medium" ? "secondary" : "outline"
                        } className="capitalize">
                          {patient.riskLevel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Resource Forecasting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-500" />
                  Resource Planning Forecast
                </CardTitle>
                <CardDescription>Predicted resource utilization and capacity planning</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {resourceData?.forecasts?.map((resource) => (
                      <div key={resource.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {resource.resourceType === "beds" && <Bed className="h-4 w-4" />}
                            {resource.resourceType === "staff" && <UserPlus className="h-4 w-4" />}
                            {resource.resourceType === "appointments" && <Calendar className="h-4 w-4" />}
                            {resource.resourceType === "equipment" && <Settings className="h-4 w-4" />}
                            <span className="font-medium text-sm">{resource.resourceName}</span>
                          </div>
                          <Badge variant={
                            resource.alertLevel === "high" ? "destructive" :
                            resource.alertLevel === "elevated" ? "default" : "outline"
                          }>
                            {resource.currentUtilization}% utilized
                          </Badge>
                        </div>
                        <Progress value={resource.currentUtilization} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                          Capacity: {resource.currentCapacity} | {resource.recommendations[0]}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Reports Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Performance Reports</h2>
            <div className="flex gap-2">
              <Select defaultValue="30">
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => exportMutation.mutate({ type: "report", format: "pdf", sourceId: "performance", sourceName: "Performance Report" })}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Clinical Outcomes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Clinical Outcomes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{clinicalOutcomes?.metrics?.readmissionRate || 11.2}%</p>
                    <p className="text-xs text-muted-foreground">Readmission Rate</p>
                    <Badge variant={11.2 <= 12 ? "default" : "destructive"} className="mt-1 text-xs">
                      Target: {clinicalOutcomes?.metrics?.readmissionTarget || 12}%
                    </Badge>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{clinicalOutcomes?.metrics?.averageLengthOfStay || 4.3}</p>
                    <p className="text-xs text-muted-foreground">Avg Length of Stay (days)</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{clinicalOutcomes?.metrics?.careGapsClosed || 156}</p>
                    <p className="text-xs text-muted-foreground">Care Gaps Closed</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{clinicalOutcomes?.metrics?.preventiveServicesCompliance || 87.5}%</p>
                    <p className="text-xs text-muted-foreground">Preventive Compliance</p>
                  </div>
                </div>
                {clinicalOutcomes?.aiInsights?.slice(0, 2).map((insight, i) => (
                  <div key={i} className="text-xs p-2 bg-blue-50 dark:bg-blue-950 rounded border-l-2 border-blue-500">
                    <Sparkles className="h-3 w-3 inline mr-1 text-blue-500" />
                    {insight}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Patient Satisfaction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5 text-yellow-500" />
                  Patient Satisfaction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{patientSatisfaction?.overallScore || 4.2}/5</p>
                    <p className="text-xs text-muted-foreground">Overall Score</p>
                    <div className="flex justify-center mt-1">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={`h-3 w-3 ${i <= Math.round(patientSatisfaction?.overallScore || 4.2) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{patientSatisfaction?.npsScore || 42}</p>
                    <p className="text-xs text-muted-foreground">NPS Score</p>
                    <Badge variant="outline" className="mt-1 text-xs">Good</Badge>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{patientSatisfaction?.responseRate || 34.5}%</p>
                    <p className="text-xs text-muted-foreground">Response Rate</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{patientSatisfaction?.totalResponses || 287}</p>
                    <p className="text-xs text-muted-foreground">Total Responses</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 text-center p-2 rounded bg-green-100 dark:bg-green-950">
                    <p className="text-sm font-bold text-green-700 dark:text-green-400">{patientSatisfaction?.sentimentDistribution?.positive || 68}%</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Positive</p>
                  </div>
                  <div className="flex-1 text-center p-2 rounded bg-gray-100 dark:bg-gray-800">
                    <p className="text-sm font-bold">{patientSatisfaction?.sentimentDistribution?.neutral || 22}%</p>
                    <p className="text-xs text-muted-foreground">Neutral</p>
                  </div>
                  <div className="flex-1 text-center p-2 rounded bg-red-100 dark:bg-red-950">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">{patientSatisfaction?.sentimentDistribution?.negative || 10}%</p>
                    <p className="text-xs text-red-600 dark:text-red-500">Negative</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Operational Costs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Operational Costs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">${((operationalCosts?.totalCosts || 2450000) / 1000000).toFixed(2)}M</p>
                    <p className="text-xs text-muted-foreground">Total Costs</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className={`text-2xl font-bold ${(operationalCosts?.budgetVariance || -45000) < 0 ? "text-green-600" : "text-red-600"}`}>
                      {(operationalCosts?.budgetVariance || -45000) < 0 ? "-" : "+"}${Math.abs((operationalCosts?.budgetVariance || -45000) / 1000).toFixed(0)}K
                    </p>
                    <p className="text-xs text-muted-foreground">Budget Variance</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">${operationalCosts?.costPerPatient || 823}</p>
                    <p className="text-xs text-muted-foreground">Cost/Patient</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{operationalCosts?.revenueRecovery || 94.2}%</p>
                    <p className="text-xs text-muted-foreground">Revenue Recovery</p>
                  </div>
                </div>
                {operationalCosts?.savingsOpportunities?.slice(0, 2).map((opp, i) => (
                  <div key={i} className="text-xs p-2 bg-green-50 dark:bg-green-950 rounded border-l-2 border-green-500">
                    <ThumbsUp className="h-3 w-3 inline mr-1 text-green-500" />
                    {opp.area}: Save ${(opp.potentialSavings / 1000).toFixed(0)}K
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Performance Reports Disclaimer</AlertTitle>
            <AlertDescription>
              These reports are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="visualizations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Interactive Trend Graphs
            </h2>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Interactive Analytics</AlertTitle>
            <AlertDescription>
              Explore 90-day trend data with annotations, statistics, trend lines, and AI-generated forecasts. All predictions are informational only.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {interactiveTrendsData?.trends?.slice(0, 4).map((trend) => (
              <Card key={trend.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{trend.metricLabel}</CardTitle>
                    <Badge variant="outline">{trend.category}</Badge>
                  </div>
                  <CardDescription>
                    90-day trend {trend.forecast ? `with ${trend.forecast.length} forecast points` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...trend.dataPoints.slice(-30), ...(trend.forecast || []).map(f => ({ date: f.date, value: null, forecast: f.value, low: f.confidenceLow, high: f.confidenceHigh }))]}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d?.split("-")?.slice(1).join("/") || ""} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                        <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Actual" />
                        <Area type="monotone" dataKey="forecast" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2) / 0.2)" strokeDasharray="5 5" name="Forecast" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-6 gap-2 mt-4 text-center text-xs">
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium">{trend.statistics?.min?.toFixed(1) || "N/A"}</p>
                      <p className="text-muted-foreground">Min</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium">{trend.statistics?.max?.toFixed(1) || "N/A"}</p>
                      <p className="text-muted-foreground">Max</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium">{trend.statistics?.avg?.toFixed(1) || "N/A"}</p>
                      <p className="text-muted-foreground">Avg</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium">{trend.statistics?.median?.toFixed(1) || "N/A"}</p>
                      <p className="text-muted-foreground">Median</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium">{trend.statistics?.percentile90?.toFixed(1) || "N/A"}</p>
                      <p className="text-muted-foreground">P90</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="font-medium">R²: {trend.trendLine?.rSquared?.toFixed(2) || "N/A"}</p>
                      <p className="text-muted-foreground">Fit</p>
                    </div>
                  </div>
                  {trend.annotations?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Annotations:</p>
                      {trend.annotations.slice(0, 2).map((a, i) => (
                        <div key={i} className="text-xs flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs py-0">{a.type}</Badge>
                          <span>{a.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NO-CDS Disclaimer</AlertTitle>
            <AlertDescription>
              These visualizations are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Heatmaps Tab */}
        <TabsContent value="heatmaps" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              Heatmap Visualizations
            </h2>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Heatmap Analytics</AlertTitle>
            <AlertDescription>
              Visualize patient distribution, appointment patterns, and satisfaction scores across multiple dimensions.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 gap-6">
            {heatmapsData?.heatmaps?.map((heatmap) => {
              const getCellValue = (xIdx: number, yIdx: number) => {
                const cell = heatmap.cells?.find(c => c.x === xIdx && c.y === yIdx);
                return cell?.value ?? 0;
              };
              const interpolateColor = (value: number) => {
                const normalized = Math.min(1, Math.max(0, (value - heatmap.colorScale.min) / (heatmap.colorScale.max - heatmap.colorScale.min || 1)));
                const minRGB = parseInt(heatmap.colorScale.minColor?.slice(1) || "f7fbff", 16);
                const maxRGB = parseInt(heatmap.colorScale.maxColor?.slice(1) || "08306b", 16);
                const r = Math.round(((minRGB >> 16) & 0xff) + normalized * (((maxRGB >> 16) & 0xff) - ((minRGB >> 16) & 0xff)));
                const g = Math.round(((minRGB >> 8) & 0xff) + normalized * (((maxRGB >> 8) & 0xff) - ((minRGB >> 8) & 0xff)));
                const b = Math.round((minRGB & 0xff) + normalized * ((maxRGB & 0xff) - (minRGB & 0xff)));
                return `rgb(${r},${g},${b})`;
              };
              return (
                <Card key={heatmap.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Grid3X3 className="h-5 w-5" />
                      {heatmap.title}
                    </CardTitle>
                    <CardDescription>
                      {heatmap.xAxisLabel} vs {heatmap.yAxisLabel} ({heatmap.aggregationType})
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className="p-2 text-left font-medium text-muted-foreground">{heatmap.yAxisLabel} / {heatmap.xAxisLabel}</th>
                            {heatmap.xCategories?.map((x) => (
                              <th key={x} className="p-2 text-center font-medium text-muted-foreground">{x}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {heatmap.yCategories?.map((y, yIndex) => (
                            <tr key={y}>
                              <td className="p-2 font-medium">{y}</td>
                              {heatmap.xCategories?.map((_, xIndex) => {
                                const value = getCellValue(xIndex, yIndex);
                                const bgColor = interpolateColor(value);
                                const textColor = value > (heatmap.colorScale.max - heatmap.colorScale.min) / 2 + heatmap.colorScale.min ? "white" : "black";
                                return (
                                  <td
                                    key={xIndex}
                                    className="p-2 text-center font-medium"
                                    style={{ backgroundColor: bgColor, color: textColor }}
                                    data-testid={`heatmap-cell-${heatmap.id}-${yIndex}-${xIndex}`}
                                  >
                                    {value}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-4 text-xs">
                      <span className="text-muted-foreground">Low ({heatmap.colorScale.min})</span>
                      <div className="w-24 h-4 rounded" style={{ background: `linear-gradient(to right, ${heatmap.colorScale.minColor}, ${heatmap.colorScale.maxColor})` }} />
                      <span className="text-muted-foreground">High ({heatmap.colorScale.max})</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NO-CDS Disclaimer</AlertTitle>
            <AlertDescription>
              These visualizations are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Cohorts Tab */}
        <TabsContent value="cohorts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              Cohort Analysis
            </h2>
            <Button
              onClick={() => cohortAnalysisMutation.mutate({ cohortIds: selectedCohorts, metrics: ["readmission_rate", "length_of_stay", "satisfaction_score"] })}
              disabled={selectedCohorts.length < 2 || cohortAnalysisMutation.isPending}
              data-testid="button-run-cohort-analysis"
            >
              {cohortAnalysisMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Compare Cohorts
            </Button>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Cohort Comparison</AlertTitle>
            <AlertDescription>
              Select 2 or more cohorts to compare key metrics including readmission rates, length of stay, and satisfaction scores.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Available Cohorts</CardTitle>
                <CardDescription>Select cohorts to compare</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {cohortsData?.cohorts?.map((cohort) => (
                  <div
                    key={cohort.id}
                    className={`p-3 rounded-lg border cursor-pointer hover-elevate ${selectedCohorts.includes(cohort.id) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => {
                      setSelectedCohorts(prev =>
                        prev.includes(cohort.id) ? prev.filter(id => id !== cohort.id) : [...prev, cohort.id]
                      );
                    }}
                    data-testid={`cohort-select-${cohort.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{cohort.name}</p>
                        <p className="text-xs text-muted-foreground">{cohort.patientCount?.toLocaleString() || 0} patients</p>
                      </div>
                      {selectedCohorts.includes(cohort.id) && (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{cohort.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Comparison Results</CardTitle>
                <CardDescription>
                  {cohortAnalysisResult ? `Comparing ${cohortAnalysisResult.cohorts.length} cohorts` : "Select cohorts and click Compare"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cohortAnalysisResult ? (
                  <div className="space-y-4">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={cohortAnalysisResult.comparisons?.map(comp => ({
                          name: comp.metric,
                          ...Object.fromEntries(comp.cohortValues.map(cv => [cohortAnalysisResult.cohorts.find(c => c.cohortId === cv.cohortId)?.cohortName || cv.cohortId, cv.value])),
                          isSignificant: comp.isSignificant
                        })) || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                          <Legend />
                          {cohortAnalysisResult.cohorts?.map((cohort, i) => (
                            <Bar key={cohort.cohortId} dataKey={cohort.cohortName} fill={`hsl(var(--chart-${i + 1}))`} />
                          ))}
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {cohortAnalysisResult.cohorts?.map((cohort) => (
                        <Card key={cohort.cohortId}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{cohort.cohortName}</CardTitle>
                            <CardDescription>{cohort.patientCount?.toLocaleString()} patients</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-1">
                              {cohort.metrics?.slice(0, 3).map((m, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">{m.metric}</span>
                                  <span className="font-medium">{m.value?.toFixed(1)} <span className={m.trend === "improving" ? "text-green-500" : m.trend === "worsening" ? "text-red-500" : "text-muted-foreground"}>({m.trend})</span></span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {cohortAnalysisResult.aiInsights?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                          AI Insights
                        </p>
                        {cohortAnalysisResult.aiInsights.map((insight, i) => (
                          <div key={i} className="text-xs p-2 bg-muted/50 rounded border-l-2 border-yellow-500">
                            {insight}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <UsersRound className="h-12 w-12 mb-2 opacity-50" />
                    <p>No analysis results yet</p>
                    <p className="text-sm">Select at least 2 cohorts and click Compare</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NO-CDS Disclaimer</AlertTitle>
            <AlertDescription>
              {cohortAnalysisResult?.noCdsDisclaimer || "Cohort analyses are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support."}
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Custom Dashboards Tab */}
        <TabsContent value="dashboards" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              Custom Dashboard Views
            </h2>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Stakeholder Dashboards</AlertTitle>
            <AlertDescription>
              Pre-configured dashboard views optimized for different stakeholder roles including administrators, clinicians, analysts, executives, and care coordinators.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stakeholderPresetsData?.presets?.map((preset) => (
              <Card key={preset.type} className="hover-elevate cursor-pointer" data-testid={`dashboard-preset-${preset.type}`}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {preset.type === "administrator" && <Building className="h-4 w-4 text-blue-500" />}
                    {preset.type === "clinician" && <Heart className="h-4 w-4 text-red-500" />}
                    {preset.type === "analyst" && <BarChart3 className="h-4 w-4 text-purple-500" />}
                    {preset.type === "executive" && <Star className="h-4 w-4 text-yellow-500" />}
                    {preset.type === "care_coordinator" && <Users className="h-4 w-4 text-green-500" />}
                    {preset.name}
                  </CardTitle>
                  <CardDescription>{preset.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {preset.defaultWidgets.map(widget => (
                      <Badge key={widget} variant="secondary" className="text-xs">
                        {widget.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium mb-4">Your Dashboards</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customDashboardsData?.dashboards?.map((dashboard) => (
                <Card key={dashboard.id} data-testid={`custom-dashboard-${dashboard.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{dashboard.name}</CardTitle>
                      {dashboard.isShared && <Badge variant="outline">Shared</Badge>}
                    </div>
                    <CardDescription>{dashboard.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.widgets.length} widgets | Updated {formatDate(dashboard.updatedAt)}
                    </p>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {(!customDashboardsData?.dashboards || customDashboardsData.dashboards.length === 0) && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <LayoutDashboard className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">No custom dashboards yet</p>
                    <p className="text-xs">Select a preset above to get started</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>NO-CDS Disclaimer</AlertTitle>
            <AlertDescription>
              All dashboard views and analytics are for INFORMATIONAL PURPOSES ONLY. They do NOT constitute medical advice or clinical decision support.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* Exports Tab */}
        <TabsContent value="exports" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Data Exports</h2>
            <Button onClick={() => exportMutation.mutate({ type: "analytics", format: "csv", sourceId: "all", sourceName: "Full Analytics Export" })} data-testid="button-new-export">
              <FileDown className="mr-2 h-4 w-4" />
              New Export
            </Button>
          </div>
          <Alert>
            <Download className="h-4 w-4" />
            <AlertTitle>Export Your Data</AlertTitle>
            <AlertDescription>
              Export reports, dashboards, and raw data in multiple formats (PDF, CSV, JSON, Excel) for further analysis. All exports include appropriate disclaimers.
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>Export History</CardTitle>
              <CardDescription>Your recent data exports</CardDescription>
            </CardHeader>
            <CardContent>
              {exportsData?.jobs && exportsData.jobs.length > 0 ? (
                <div className="space-y-3">
                  {exportsData.jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          job.status === "completed" ? "bg-green-100 dark:bg-green-950" :
                          job.status === "processing" ? "bg-blue-100 dark:bg-blue-950" :
                          job.status === "failed" ? "bg-red-100 dark:bg-red-950" : "bg-gray-100 dark:bg-gray-800"
                        }`}>
                          {job.status === "completed" ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                           job.status === "processing" ? <Loader2 className="h-4 w-4 text-blue-600 animate-spin" /> :
                           job.status === "failed" ? <AlertCircle className="h-4 w-4 text-red-600" /> :
                           <Clock className="h-4 w-4 text-gray-600" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{job.sourceName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(job.createdAt)} | {job.format.toUpperCase()}
                            {job.fileSize && ` | ${(job.fileSize / 1024).toFixed(0)} KB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{job.status}</Badge>
                        {job.status === "completed" && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={job.downloadUrl} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {job.status === "processing" && (
                          <Progress value={job.progress} className="w-20 h-2" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileDown className="h-12 w-12 mb-2 opacity-50" />
                  <p>No exports yet</p>
                  <p className="text-sm">Create an export to download your data</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover-elevate cursor-pointer" onClick={() => exportMutation.mutate({ type: "report", format: "pdf", sourceId: "clinical", sourceName: "Clinical Outcomes Report" })}>
              <CardContent className="pt-6 text-center">
                <Heart className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="font-medium">Clinical Outcomes</p>
                <p className="text-xs text-muted-foreground">PDF Report</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => exportMutation.mutate({ type: "report", format: "pdf", sourceId: "satisfaction", sourceName: "Patient Satisfaction Report" })}>
              <CardContent className="pt-6 text-center">
                <Smile className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <p className="font-medium">Patient Satisfaction</p>
                <p className="text-xs text-muted-foreground">PDF Report</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => exportMutation.mutate({ type: "report", format: "csv", sourceId: "costs", sourceName: "Operational Costs Data" })}>
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="font-medium">Operational Costs</p>
                <p className="text-xs text-muted-foreground">CSV Export</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => exportMutation.mutate({ type: "raw_data", format: "json", sourceId: "kpis", sourceName: "KPI Raw Data" })}>
              <CardContent className="pt-6 text-center">
                <Gauge className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p className="font-medium">KPI Data</p>
                <p className="text-xs text-muted-foreground">JSON Export</p>
              </CardContent>
            </Card>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Data Export Disclaimer</AlertTitle>
            <AlertDescription>
              Exported data is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute medical advice or clinical decision support. All exported analytics should be reviewed by qualified professionals before use.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}
