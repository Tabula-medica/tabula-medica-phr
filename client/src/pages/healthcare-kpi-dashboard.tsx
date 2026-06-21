import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Edit,
  FileCheck,
  FileText,
  Heart,
  Info,
  Layers,
  LineChart,
  Lock,
  PieChart,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";

interface AnalyticsDashboard {
  generatedAt: string;
  timeRange: { start: string; end: string };
  automation: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    successRate: number;
    averageProcessingTimeMs: number;
    p50ProcessingTimeMs: number;
    p90ProcessingTimeMs: number;
    p99ProcessingTimeMs: number;
    byType: Record<string, { count: number; successRate: number; avgTimeMs: number }>;
    trends: { date: string; successRate: number; avgTimeMs: number; jobCount: number }[];
  };
  riskScores: {
    averageRiskScore: number;
    highRiskPatients: number;
    mediumRiskPatients: number;
    lowRiskPatients: number;
    criticalRiskPatients: number;
    riskDistribution: { range: string; count: number; percentage: number }[];
    trends: { date: string; avgScore: number; highRiskCount: number; assessmentCount: number }[];
    topRiskFactors: { factor: string; frequency: number; avgImpact: number }[];
  };
  dataQuality: {
    totalIssues: number;
    resolvedIssues: number;
    pendingIssues: number;
    resolutionRate: number;
    averageResolutionTimeHours: number;
    bySeverity: Record<string, { count: number; resolved: number; avgResolutionHours: number }>;
    byCategory: Record<string, { count: number; resolved: number; resolutionRate: number }>;
    trends: { date: string; newIssues: number; resolved: number; resolutionRate: number }[];
  };
  security: {
    overallComplianceScore: number;
    hipaaComplianceScore: number;
    soc2ComplianceScore: number;
    gdprComplianceScore: number;
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    remediatedVulnerabilities: number;
    remediationProgress: number;
    byCategory: Record<string, { score: number; issues: number; remediated: number }>;
    trends: { date: string; complianceScore: number; openVulns: number; remediated: number }[];
    upcomingAudits: { name: string; date: string; status: string }[];
  };
  engagement: {
    totalActiveUsers: number;
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDurationMinutes: number;
    featureUsage: Record<string, { users: number; sessions: number; avgDurationMinutes: number }>;
    topFeatures: { feature: string; usageCount: number; uniqueUsers: number; satisfaction: number }[];
    trends: { date: string; activeUsers: number; sessions: number; avgDuration: number }[];
    patientPortalMetrics: {
      recordViews: number;
      educationModulesCompleted: number;
      medicationRemindersSet: number;
      appointmentsScheduled: number;
      messagesExchanged: number;
    };
  };
  aiInsights: string[];
  noCdsCompliance: string;
}

interface CustomReport {
  id: string;
  name: string;
  description: string;
  type: string;
  metrics: string[];
  visualization: { chartType?: string };
  createdAt: string;
}

interface AlertThreshold {
  id: string;
  name: string;
  metric: string;
  condition: string;
  value: number;
  severity: string;
  enabled: boolean;
  notifications: { email: boolean; inApp: boolean; sms: boolean };
}

interface CustomKPI {
  id: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  category: string;
  targetValue?: number;
  currentValue?: number;
  trend?: string;
  history: { date: string; value: number }[];
}

interface ExportRequest {
  id: string;
  format: string;
  dataType: string;
  status: string;
  downloadUrl?: string;
  createdAt: string;
}

interface AvailableMetric {
  id: string;
  name: string;
  category: string;
  description: string;
}

export default function HealthcareKPIDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [showKPIDialog, setShowKPIDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { toast } = useToast();

  // Form states
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportType, setReportType] = useState("chart");
  const [reportChartType, setReportChartType] = useState("line");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  const [thresholdName, setThresholdName] = useState("");
  const [thresholdMetric, setThresholdMetric] = useState("");
  const [thresholdCondition, setThresholdCondition] = useState("above");
  const [thresholdValue, setThresholdValue] = useState(0);
  const [thresholdSeverity, setThresholdSeverity] = useState("warning");
  const [thresholdEmail, setThresholdEmail] = useState(true);
  const [thresholdInApp, setThresholdInApp] = useState(true);

  const [kpiName, setKpiName] = useState("");
  const [kpiDescription, setKpiDescription] = useState("");
  const [kpiFormula, setKpiFormula] = useState("");
  const [kpiUnit, setKpiUnit] = useState("%");
  const [kpiCategory, setKpiCategory] = useState("Custom");
  const [kpiTarget, setKpiTarget] = useState(0);

  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportDataType, setExportDataType] = useState("dashboard");

  const { data: dashboard, refetch, isLoading } = useQuery<AnalyticsDashboard>({
    queryKey: ["/api/kpi-analytics/dashboard"],
    refetchInterval: 30000
  });

  const { data: reportsData } = useQuery<{ reports: CustomReport[] }>({
    queryKey: ["/api/kpi-analytics/customize/reports"]
  });

  const { data: thresholdsData } = useQuery<{ thresholds: AlertThreshold[] }>({
    queryKey: ["/api/kpi-analytics/customize/thresholds"]
  });

  const { data: kpisData } = useQuery<{ kpis: CustomKPI[] }>({
    queryKey: ["/api/kpi-analytics/customize/kpis"]
  });

  const { data: exportsData } = useQuery<{ exports: ExportRequest[] }>({
    queryKey: ["/api/kpi-analytics/customize/exports"]
  });

  const { data: metricsData } = useQuery<{ metrics: AvailableMetric[] }>({
    queryKey: ["/api/kpi-analytics/customize/metrics"]
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/kpi-analytics/customize/reports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/reports"] });
      toast({ title: "Report created", description: "Your custom report has been saved." });
      setShowReportDialog(false);
      resetReportForm();
    }
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/kpi-analytics/customize/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/reports"] });
      toast({ title: "Report deleted" });
    }
  });

  const createThresholdMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/kpi-analytics/customize/thresholds", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/thresholds"] });
      toast({ title: "Alert threshold created", description: "You'll be notified when this threshold is triggered." });
      setShowThresholdDialog(false);
      resetThresholdForm();
    }
  });

  const toggleThresholdMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => 
      apiRequest("PUT", `/api/kpi-analytics/customize/thresholds/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/thresholds"] });
    }
  });

  const deleteThresholdMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/kpi-analytics/customize/thresholds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/thresholds"] });
      toast({ title: "Threshold deleted" });
    }
  });

  const createKPIMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/kpi-analytics/customize/kpis", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/kpis"] });
      toast({ title: "Custom KPI created", description: "Your KPI is now being tracked." });
      setShowKPIDialog(false);
      resetKPIForm();
    }
  });

  const deleteKPIMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/kpi-analytics/customize/kpis/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/kpis"] });
      toast({ title: "KPI deleted" });
    }
  });

  const exportMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/kpi-analytics/customize/exports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-analytics/customize/exports"] });
      toast({ title: "Export started", description: "Your export will be ready shortly." });
      setShowExportDialog(false);
    }
  });

  const resetReportForm = () => {
    setReportName("");
    setReportDescription("");
    setReportType("chart");
    setReportChartType("line");
    setSelectedMetrics([]);
  };

  const resetThresholdForm = () => {
    setThresholdName("");
    setThresholdMetric("");
    setThresholdCondition("above");
    setThresholdValue(0);
    setThresholdSeverity("warning");
    setThresholdEmail(true);
    setThresholdInApp(true);
  };

  const resetKPIForm = () => {
    setKpiName("");
    setKpiDescription("");
    setKpiFormula("");
    setKpiUnit("%");
    setKpiCategory("Custom");
    setKpiTarget(0);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-amber-500";
    return "text-red-500";
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading KPI dashboard...</p>
        </div>
      </div>
    );
  }

  const automation = dashboard?.automation;
  const riskScores = dashboard?.riskScores;
  const dataQuality = dashboard?.dataQuality;
  const security = dashboard?.security;
  const engagement = dashboard?.engagement;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-healthcare-kpi-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-kpi">
            <BarChart3 className="h-8 w-8 text-primary" />
            Healthcare KPI Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Key performance indicators for healthcare workflows
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground">
            Last updated: {dashboard?.generatedAt ? new Date(dashboard.generatedAt).toLocaleString() : "N/A"}
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">Automation</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">Risk Scores</TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">Data Quality</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
          <TabsTrigger value="customize" data-testid="tab-customize">Customize</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card data-testid="card-automation-rate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Automation Success</CardTitle>
                <Zap className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor((automation?.successRate || 0) * 100)}`}>
                  {((automation?.successRate || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">{automation?.totalJobs || 0} jobs processed</p>
              </CardContent>
            </Card>

            <Card data-testid="card-risk-patients">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">High-Risk Patients</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-500">
                  {(riskScores?.criticalRiskPatients || 0) + (riskScores?.highRiskPatients || 0)}
                </div>
                <p className="text-xs text-muted-foreground">{riskScores?.criticalRiskPatients || 0} critical</p>
              </CardContent>
            </Card>

            <Card data-testid="card-quality-rate">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Quality Resolution</CardTitle>
                <FileCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor((dataQuality?.resolutionRate || 0) * 100)}`}>
                  {((dataQuality?.resolutionRate || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">{dataQuality?.pendingIssues || 0} pending</p>
              </CardContent>
            </Card>

            <Card data-testid="card-compliance-score">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
                <Shield className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(security?.overallComplianceScore || 0)}`}>
                  {(security?.overallComplianceScore || 0).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">{security?.criticalVulnerabilities || 0} critical vulns</p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">{engagement?.dailyActiveUsers || 0}</div>
                <p className="text-xs text-muted-foreground">daily active</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-ai-insights">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI-Generated Insights
              </CardTitle>
              <CardDescription>Operational analysis based on current metrics (NOT clinical advice)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard?.aiInsights?.map((insight, idx) => (
                  <Alert key={idx} className="bg-muted/30">
                    <Info className="h-4 w-4" />
                    <AlertDescription>{insight}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="card-quick-metrics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Processing Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Processing Time</span>
                  <span className="font-medium">{Math.round(automation?.averageProcessingTimeMs || 0)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">P50 Latency</span>
                  <span className="font-medium text-green-500">{Math.round(automation?.p50ProcessingTimeMs || 0)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">P90 Latency</span>
                  <span className="font-medium text-amber-500">{Math.round(automation?.p90ProcessingTimeMs || 0)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">P99 Latency</span>
                  <span className="font-medium text-red-500">{Math.round(automation?.p99ProcessingTimeMs || 0)}ms</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-patient-portal">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Patient Portal Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Record Views</span>
                  <span className="font-medium">{(engagement?.patientPortalMetrics?.recordViews || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Education Completed</span>
                  <span className="font-medium">{(engagement?.patientPortalMetrics?.educationModulesCompleted || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Medication Reminders</span>
                  <span className="font-medium">{(engagement?.patientPortalMetrics?.medicationRemindersSet || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Messages Exchanged</span>
                  <span className="font-medium">{(engagement?.patientPortalMetrics?.messagesExchanged || 0).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(automation?.totalJobs || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Successful</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{(automation?.successfulJobs || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{automation?.failedJobs || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Math.round(automation?.averageProcessingTimeMs || 0)}ms</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Job Types Breakdown</CardTitle>
              <CardDescription>Performance by automation type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {automation?.byType && Object.entries(automation.byType).map(([type, data]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-medium capitalize">{type.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-4 flex-wrap">
                        <Badge variant="outline">{data.count.toLocaleString()} jobs</Badge>
                        <Badge className={getScoreColor(data.successRate * 100) === "text-green-500" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}>
                          {(data.successRate * 100).toFixed(1)}%
                        </Badge>
                        <span className="text-sm text-muted-foreground">{Math.round(data.avgTimeMs)}ms avg</span>
                      </div>
                    </div>
                    <Progress value={data.successRate * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>30-Day Trend</CardTitle>
              <CardDescription>Success rate and volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {automation?.trends?.slice(-10).map((day, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm flex-wrap gap-2">
                      <span>{new Date(day.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span>{day.jobCount} jobs</span>
                        <Badge variant="outline">{(day.successRate * 100).toFixed(1)}%</Badge>
                        <span className="text-muted-foreground">{Math.round(day.avgTimeMs)}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4 mt-4">
          <Alert className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Risk scores are for care coordination purposes only. NOT clinical decision support.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Critical Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{riskScores?.criticalRiskPatients || 0}</div>
                <p className="text-xs text-muted-foreground">Score 81-100</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">High Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{riskScores?.highRiskPatients || 0}</div>
                <p className="text-xs text-muted-foreground">Score 61-80</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Medium Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{riskScores?.mediumRiskPatients || 0}</div>
                <p className="text-xs text-muted-foreground">Score 21-60</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{riskScores?.lowRiskPatients || 0}</div>
                <p className="text-xs text-muted-foreground">Score 0-20</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Risk Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskScores?.riskDistribution?.map((range, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                        <span>{range.range}</span>
                        <span className="font-medium">{range.count} ({range.percentage.toFixed(1)}%)</span>
                      </div>
                      <Progress value={range.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Risk Factors
                </CardTitle>
                <CardDescription>Most common contributing factors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskScores?.topRiskFactors?.map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm">{factor.factor}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{factor.frequency}</Badge>
                        <span className="text-xs text-muted-foreground">+{factor.avgImpact.toFixed(1)} avg impact</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{dataQuality?.totalIssues || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-500">{dataQuality?.resolvedIssues || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{dataQuality?.pendingIssues || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(dataQuality?.averageResolutionTimeHours || 0).toFixed(1)}h</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Issues by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dataQuality?.bySeverity && Object.entries(dataQuality.bySeverity).map(([severity, data]) => (
                    <div key={severity} className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-medium capitalize">{severity}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{data.resolved}/{data.count} resolved</span>
                          <span className="text-xs text-muted-foreground">{data.avgResolutionHours}h avg</span>
                        </div>
                      </div>
                      <Progress value={(data.resolved / Math.max(data.count, 1)) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Issues by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dataQuality?.byCategory && Object.entries(dataQuality.byCategory).map(([category, data]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-medium capitalize">{category.replace(/_/g, " ")}</span>
                        <Badge variant="outline">{(data.resolutionRate * 100).toFixed(0)}%</Badge>
                      </div>
                      <Progress value={data.resolutionRate * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">HIPAA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(security?.hipaaComplianceScore || 0)}`}>
                  {(security?.hipaaComplianceScore || 0).toFixed(0)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">SOC2</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(security?.soc2ComplianceScore || 0)}`}>
                  {(security?.soc2ComplianceScore || 0).toFixed(0)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">GDPR</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getScoreColor(security?.gdprComplianceScore || 0)}`}>
                  {(security?.gdprComplianceScore || 0).toFixed(0)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Remediation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(security?.remediationProgress || 0).toFixed(0)}%</div>
                <Progress value={security?.remediationProgress || 0} className="h-2 mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {security?.byCategory && Object.entries(security.byCategory).map(([category, data]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-medium capitalize">{category.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <Badge className={getScoreColor(data.score) === "text-green-500" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}>
                            {data.score}%
                          </Badge>
                          <span className="text-xs text-muted-foreground">{data.remediated}/{data.issues} fixed</span>
                        </div>
                      </div>
                      <Progress value={data.score} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Audits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {security?.upcomingAudits?.map((audit, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border flex-wrap gap-2">
                      <div>
                        <div className="font-medium">{audit.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(audit.date).toLocaleDateString()}</div>
                      </div>
                      <Badge variant="outline" className="capitalize">{audit.status.replace(/_/g, " ")}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Daily Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-500">{(engagement?.dailyActiveUsers || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Weekly Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(engagement?.weeklyActiveUsers || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Monthly Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(engagement?.monthlyActiveUsers || 0).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{(engagement?.averageSessionDurationMinutes || 0).toFixed(1)}m</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Top Features
                </CardTitle>
                <CardDescription>Most used patient-facing features</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {engagement?.topFeatures?.map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-medium">{feature.feature}</div>
                        <div className="text-xs text-muted-foreground">{feature.uniqueUsers.toLocaleString()} users</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{feature.usageCount.toLocaleString()}</Badge>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{feature.satisfaction.toFixed(1)}</span>
                          <span className="text-amber-500">★</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Feature Usage
                </CardTitle>
                <CardDescription>Sessions by feature category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {engagement?.featureUsage && Object.entries(engagement.featureUsage).map(([feature, data]) => (
                    <div key={feature} className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-medium capitalize">{feature.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-sm">{data.users.toLocaleString()} users</span>
                        <span className="text-sm text-muted-foreground">{data.sessions.toLocaleString()} sessions</span>
                        <Badge variant="outline">{data.avgDurationMinutes.toFixed(0)}m avg</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customize" className="space-y-6 mt-4">
          <Alert className="bg-muted/50">
            <Settings className="h-4 w-4" />
            <AlertDescription>
              Customize your analytics experience with custom reports, alert thresholds, KPIs, and exports.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-custom-reports">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Custom Reports
                  </CardTitle>
                  <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-report">
                        <Plus className="h-4 w-4 mr-1" />
                        New Report
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Custom Report</DialogTitle>
                        <DialogDescription>Define a new report with your selected metrics and visualization.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="report-name">Report Name</Label>
                          <Input id="report-name" value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="Weekly Performance Summary" data-testid="input-report-name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="report-description">Description</Label>
                          <Textarea id="report-description" value={reportDescription} onChange={(e) => setReportDescription(e.target.value)} placeholder="Describe what this report tracks..." data-testid="input-report-description" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Report Type</Label>
                            <Select value={reportType} onValueChange={setReportType}>
                              <SelectTrigger data-testid="select-report-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="chart">Chart</SelectItem>
                                <SelectItem value="table">Table</SelectItem>
                                <SelectItem value="summary">Summary</SelectItem>
                                <SelectItem value="comparison">Comparison</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Chart Type</Label>
                            <Select value={reportChartType} onValueChange={setReportChartType}>
                              <SelectTrigger data-testid="select-chart-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="line">Line</SelectItem>
                                <SelectItem value="bar">Bar</SelectItem>
                                <SelectItem value="pie">Pie</SelectItem>
                                <SelectItem value="area">Area</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Select Metrics</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                            {metricsData?.metrics?.map((metric) => (
                              <label key={metric.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedMetrics.includes(metric.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMetrics([...selectedMetrics, metric.id]);
                                    } else {
                                      setSelectedMetrics(selectedMetrics.filter(m => m !== metric.id));
                                    }
                                  }}
                                  className="rounded"
                                />
                                {metric.name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
                        <Button onClick={() => createReportMutation.mutate({
                          name: reportName,
                          description: reportDescription,
                          type: reportType,
                          metrics: selectedMetrics,
                          visualization: { chartType: reportChartType },
                          filters: {}
                        })} disabled={!reportName || selectedMetrics.length === 0} data-testid="button-create-report">
                          Create Report
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>Create and manage custom reports</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {reportsData?.reports?.map((report) => (
                      <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{report.name}</div>
                          <div className="text-xs text-muted-foreground">{report.type} - {report.metrics.length} metrics</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{report.visualization.chartType}</Badge>
                          <Button size="icon" variant="ghost" onClick={() => deleteReportMutation.mutate(report.id)} data-testid={`button-delete-report-${report.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!reportsData?.reports || reportsData.reports.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No custom reports yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-alert-thresholds">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Alert Thresholds
                  </CardTitle>
                  <Dialog open={showThresholdDialog} onOpenChange={setShowThresholdDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-threshold">
                        <Plus className="h-4 w-4 mr-1" />
                        New Threshold
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Alert Threshold</DialogTitle>
                        <DialogDescription>Set up personalized alerts when metrics cross your thresholds.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="threshold-name">Alert Name</Label>
                          <Input id="threshold-name" value={thresholdName} onChange={(e) => setThresholdName(e.target.value)} placeholder="Critical Patient Alert" data-testid="input-threshold-name" />
                        </div>
                        <div className="space-y-2">
                          <Label>Metric</Label>
                          <Select value={thresholdMetric} onValueChange={setThresholdMetric}>
                            <SelectTrigger data-testid="select-threshold-metric">
                              <SelectValue placeholder="Select metric..." />
                            </SelectTrigger>
                            <SelectContent>
                              {metricsData?.metrics?.map((metric) => (
                                <SelectItem key={metric.id} value={metric.id}>{metric.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Condition</Label>
                            <Select value={thresholdCondition} onValueChange={setThresholdCondition}>
                              <SelectTrigger data-testid="select-threshold-condition">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="above">Above</SelectItem>
                                <SelectItem value="below">Below</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="threshold-value">Value</Label>
                            <Input id="threshold-value" type="number" value={thresholdValue} onChange={(e) => setThresholdValue(Number(e.target.value))} data-testid="input-threshold-value" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Severity</Label>
                          <Select value={thresholdSeverity} onValueChange={setThresholdSeverity}>
                            <SelectTrigger data-testid="select-threshold-severity">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="info">Info</SelectItem>
                              <SelectItem value="warning">Warning</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notifications</Label>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                              <Switch checked={thresholdEmail} onCheckedChange={setThresholdEmail} />
                              <span className="text-sm">Email</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <Switch checked={thresholdInApp} onCheckedChange={setThresholdInApp} />
                              <span className="text-sm">In-App</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowThresholdDialog(false)}>Cancel</Button>
                        <Button onClick={() => createThresholdMutation.mutate({
                          name: thresholdName,
                          metric: thresholdMetric,
                          condition: thresholdCondition,
                          value: thresholdValue,
                          severity: thresholdSeverity,
                          enabled: true,
                          notifications: { email: thresholdEmail, inApp: thresholdInApp, sms: false },
                          cooldownMinutes: 60
                        })} disabled={!thresholdName || !thresholdMetric} data-testid="button-create-threshold">
                          Create Threshold
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>Set personalized alert thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {thresholdsData?.thresholds?.map((threshold) => (
                      <div key={threshold.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Switch 
                            checked={threshold.enabled} 
                            onCheckedChange={(enabled) => toggleThresholdMutation.mutate({ id: threshold.id, enabled })}
                          />
                          <div>
                            <div className="font-medium">{threshold.name}</div>
                            <div className="text-xs text-muted-foreground">{threshold.metric} {threshold.condition} {threshold.value}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={threshold.severity === "critical" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : threshold.severity === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"}>
                            {threshold.severity}
                          </Badge>
                          <Button size="icon" variant="ghost" onClick={() => deleteThresholdMutation.mutate(threshold.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!thresholdsData?.thresholds || thresholdsData.thresholds.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No alert thresholds configured</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-custom-kpis">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Custom KPIs
                  </CardTitle>
                  <Dialog open={showKPIDialog} onOpenChange={setShowKPIDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-kpi">
                        <Plus className="h-4 w-4 mr-1" />
                        New KPI
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Custom KPI</DialogTitle>
                        <DialogDescription>Define and track custom KPIs for your workflows.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="kpi-name">KPI Name</Label>
                          <Input id="kpi-name" value={kpiName} onChange={(e) => setKpiName(e.target.value)} placeholder="Data Quality Index" data-testid="input-kpi-name" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="kpi-description">Description</Label>
                          <Textarea id="kpi-description" value={kpiDescription} onChange={(e) => setKpiDescription(e.target.value)} placeholder="What this KPI measures..." data-testid="input-kpi-description" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="kpi-formula">Formula</Label>
                          <Input id="kpi-formula" value={kpiFormula} onChange={(e) => setKpiFormula(e.target.value)} placeholder="(metric_a + metric_b) / 2" data-testid="input-kpi-formula" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="kpi-unit">Unit</Label>
                            <Input id="kpi-unit" value={kpiUnit} onChange={(e) => setKpiUnit(e.target.value)} data-testid="input-kpi-unit" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="kpi-category">Category</Label>
                            <Input id="kpi-category" value={kpiCategory} onChange={(e) => setKpiCategory(e.target.value)} data-testid="input-kpi-category" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="kpi-target">Target</Label>
                            <Input id="kpi-target" type="number" value={kpiTarget} onChange={(e) => setKpiTarget(Number(e.target.value))} data-testid="input-kpi-target" />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowKPIDialog(false)}>Cancel</Button>
                        <Button onClick={() => createKPIMutation.mutate({
                          name: kpiName,
                          description: kpiDescription,
                          formula: kpiFormula,
                          unit: kpiUnit,
                          category: kpiCategory,
                          targetValue: kpiTarget,
                          dataSource: "custom",
                          aggregation: "avg",
                          timeframe: "daily"
                        })} disabled={!kpiName || !kpiFormula} data-testid="button-create-kpi">
                          Create KPI
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>Define and track custom KPIs</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {kpisData?.kpis?.map((kpi) => (
                      <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getTrendIcon(kpi.trend)}
                          <div>
                            <div className="font-medium">{kpi.name}</div>
                            <div className="text-xs text-muted-foreground">{kpi.category} - {kpi.formula}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="font-bold">{kpi.currentValue?.toFixed(1)}{kpi.unit}</div>
                            {kpi.targetValue && <div className="text-xs text-muted-foreground">Target: {kpi.targetValue}{kpi.unit}</div>}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => deleteKPIMutation.mutate(kpi.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!kpisData?.kpis || kpisData.kpis.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No custom KPIs defined</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-exports">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export Data
                  </CardTitle>
                  <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-export">
                        <Plus className="h-4 w-4 mr-1" />
                        New Export
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Export Analytics Data</DialogTitle>
                        <DialogDescription>Export your analytics data in CSV or PDF format.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Format</Label>
                          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "pdf")}>
                            <SelectTrigger data-testid="select-export-format">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                              <SelectItem value="pdf">PDF (Report)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Data Type</Label>
                          <Select value={exportDataType} onValueChange={setExportDataType}>
                            <SelectTrigger data-testid="select-export-data-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dashboard">Full Dashboard</SelectItem>
                              <SelectItem value="report">Custom Reports</SelectItem>
                              <SelectItem value="kpis">Custom KPIs</SelectItem>
                              <SelectItem value="alerts">Alert History</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
                        <Button onClick={() => exportMutation.mutate({
                          format: exportFormat,
                          dataType: exportDataType
                        })} data-testid="button-start-export">
                          Start Export
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>Export analytics data in various formats</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {exportsData?.exports?.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{exp.dataType} Export</div>
                          <div className="text-xs text-muted-foreground">{new Date(exp.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="uppercase">{exp.format}</Badge>
                          {exp.status === "completed" && exp.downloadUrl ? (
                            <Button size="sm" variant="outline" asChild>
                              <a href={exp.downloadUrl} download data-testid={`button-download-${exp.id}`}>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </a>
                            </Button>
                          ) : (
                            <Badge className={exp.status === "processing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : exp.status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}>
                              {exp.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!exportsData?.exports || exportsData.exports.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">No exports yet</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
