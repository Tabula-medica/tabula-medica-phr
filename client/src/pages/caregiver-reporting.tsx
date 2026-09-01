import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Users,
  Pill,
  Activity,
  Clock,
  Plus,
  Save,
  Trash2,
  FileDown,
  Settings,
  BarChart3,
  PieChartIcon,
  LineChartIcon,
  RefreshCw,
} from "lucide-react";

interface ReportData {
  summary: {
    totalPatients: number;
    overallAdherenceRate: number;
    criticalAlertsCount: number;
    resolvedAlertsCount: number;
    averageHealthScore: number;
    trendsDirection: "improving" | "stable" | "declining";
  };
  patientStatus: {
    patientId: string;
    patientName: string;
    currentStatus: "stable" | "attention_needed" | "critical";
    healthScore: number;
    lastUpdated: string;
    activeMedications: number;
    adherenceRate: number;
    pendingAlerts: number;
  }[];
  adherenceTrends: {
    date: string;
    overallRate: number;
    byCategory: Record<string, number>;
    missedDoses: number;
    takenDoses: number;
  }[];
  criticalAlerts: {
    id: string;
    patientId: string;
    patientName: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    createdAt: string;
    acknowledgedAt?: string;
    resolvedAt?: string;
    status: "active" | "acknowledged" | "resolved";
  }[];
  vitalsTrends: {
    date: string;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    heartRate: number;
    weight: number;
    bloodGlucose: number;
  }[];
  appointmentMetrics: {
    totalScheduled: number;
    attended: number;
    missed: number;
    cancelled: number;
    attendanceRate: number;
    byMonth: { month: string; attended: number; missed: number; total: number }[];
  };
}

interface ReportConfiguration {
  id: string;
  name: string;
  description: string;
  reportType: string;
  dateRange: {
    type: string;
    startDate?: string;
    endDate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const CHART_COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#3b82f6", "#8b5cf6"];
const STATUS_COLORS: Record<string, string> = {
  stable: "#22c55e",
  attention_needed: "#eab308",
  critical: "#ef4444",
};
const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export default function CaregiverReporting() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dateRangeType, setDateRangeType] = useState("last_30_days");
  const [reportType, setReportType] = useState("comprehensive");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [reportName, setReportName] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const { data: dashboardMetrics, isLoading: isLoadingMetrics } = useQuery<{
    summary: ReportData["summary"];
    recentAlerts: ReportData["criticalAlerts"];
    adherenceTrendLast7Days: ReportData["adherenceTrends"];
    configurations: number;
    savedReports: number;
    scheduledReports: number;
  }>({
    queryKey: ["/api/caregiver/reports/dashboard-metrics"],
  });

  const { data: configurations, isLoading: isLoadingConfigs } = useQuery<{
    configurations: ReportConfiguration[];
  }>({
    queryKey: ["/api/caregiver/reports/configurations"],
  });

  const { data: savedReports, isLoading: isLoadingSaved } = useQuery<{
    reports: { id: string; name: string; generatedAt: string; dateRangeStart: string; dateRangeEnd: string }[];
  }>({
    queryKey: ["/api/caregiver/reports/saved"],
  });

  const { data: templates } = useQuery<{
    templates: { id: string; name: string; description: string; metrics: string[]; recommendedCharts: string[] }[];
  }>({
    queryKey: ["/api/caregiver/reports/templates"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (params: { reportType: string; dateRange: { type: string; startDate?: string; endDate?: string } }) => {
      const response = await apiRequest("POST", "/api/caregiver/reports/generate", params);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Report generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate report", variant: "destructive" });
    },
  });

  const [generatedReport, setGeneratedReport] = useState<{ reportData: ReportData; metadata: any } | null>(null);

  const handleGenerateReport = async () => {
    const dateRange = dateRangeType === "custom" 
      ? { type: "custom", startDate: customStartDate, endDate: customEndDate }
      : { type: dateRangeType };
    
    const result = await generateReportMutation.mutateAsync({ reportType, dateRange });
    setGeneratedReport(result);
  };

  const handleExportCSV = async () => {
    if (!generatedReport) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/caregiver/reports/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportData: generatedReport.reportData,
          reportName: reportName || "Caregiver Report",
        }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName || "report"}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "CSV exported successfully" });
    } catch {
      toast({ title: "Failed to export CSV", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!generatedReport) return;
    setIsExporting(true);
    try {
      const response = await fetch("/api/caregiver/reports/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportData: generatedReport.reportData,
          reportName: reportName || "Caregiver Report",
          metadata: generatedReport.metadata,
        }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName || "report"}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "PDF exported successfully" });
    } catch {
      toast({ title: "Failed to export PDF", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const saveReportMutation = useMutation({
    mutationFn: async () => {
      if (!generatedReport) throw new Error("No report to save");
      const response = await apiRequest("POST", "/api/caregiver/reports/save", {
        name: reportName || `Report ${new Date().toLocaleDateString()}`,
        reportData: generatedReport.reportData,
        dateRangeStart: generatedReport.metadata?.dateRangeStart,
        dateRangeEnd: generatedReport.metadata?.dateRangeEnd,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Report saved successfully" });
      setShowSaveDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/reports/saved"] });
    },
    onError: () => {
      toast({ title: "Failed to save report", variant: "destructive" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      await apiRequest("DELETE", `/api/caregiver/reports/saved/${reportId}`);
    },
    onSuccess: () => {
      toast({ title: "Report deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/reports/saved"] });
    },
  });

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (isLoadingMetrics) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Advanced Reporting Dashboard</h1>
          <p className="text-muted-foreground">Generate customizable reports with visualizations and export options</p>
        </div>
        <Badge variant="outline" className="self-start">
          <Activity className="h-3 w-3 mr-1" />
          HIPAA Compliant
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved">
            <FileText className="h-4 w-4 mr-2" />
            Saved Reports
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Configurations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Patients</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  {dashboardMetrics?.summary.totalPatients || 0}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Overall Adherence</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Pill className="h-6 w-6 text-blue-500" />
                  {dashboardMetrics?.summary.overallAdherenceRate?.toFixed(1) || 0}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {getTrendIcon(dashboardMetrics?.summary.trendsDirection || "stable")}
                  <span className="capitalize">{dashboardMetrics?.summary.trendsDirection || "stable"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Alerts</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                  {dashboardMetrics?.summary.criticalAlertsCount || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {dashboardMetrics?.summary.resolvedAlertsCount || 0} resolved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Health Score</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Activity className="h-6 w-6 text-green-500" />
                  {dashboardMetrics?.summary.averageHealthScore || 0}/100
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  Adherence Trend (Last 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dashboardMetrics?.adherenceTrendLast7Days || []}>
                    <defs>
                      <linearGradient id="adherenceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { weekday: "short" })} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, "Adherence"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    />
                    <Area type="monotone" dataKey="overallRate" stroke="#3b82f6" fillOpacity={1} fill="url(#adherenceGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(dashboardMetrics?.recentAlerts || []).slice(0, 4).map((alert) => (
                    <div key={alert.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }} 
                            className="text-white text-xs"
                          >
                            {alert.severity}
                          </Badge>
                          <span className="font-medium text-sm">{alert.patientName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      </div>
                      <Badge variant={alert.status === "resolved" ? "default" : "outline"} className="text-xs">
                        {alert.status}
                      </Badge>
                    </div>
                  ))}
                  {(!dashboardMetrics?.recentAlerts || dashboardMetrics.recentAlerts.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No recent alerts</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("settings")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Saved Configurations
                </CardTitle>
                <CardDescription className="text-3xl font-bold">
                  {dashboardMetrics?.configurations || 0}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("saved")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Saved Reports
                </CardTitle>
                <CardDescription className="text-3xl font-bold">
                  {dashboardMetrics?.savedReports || 0}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("generate")}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scheduled Reports
                </CardTitle>
                <CardDescription className="text-3xl font-bold">
                  {dashboardMetrics?.scheduledReports || 0}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
              <CardDescription>Select the type of report and date range to generate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger id="report-type" data-testid="select-report-type">
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      )) || (
                        <>
                          <SelectItem value="comprehensive">Comprehensive Health Report</SelectItem>
                          <SelectItem value="patient_status">Patient Status Report</SelectItem>
                          <SelectItem value="adherence_trends">Medication Adherence Trends</SelectItem>
                          <SelectItem value="critical_alerts">Critical Alerts Report</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-range">Date Range</Label>
                  <Select value={dateRangeType} onValueChange={setDateRangeType}>
                    <SelectTrigger id="date-range" data-testid="select-date-range">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                      <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                      <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {dateRangeType === "custom" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name (optional)</Label>
                <Input
                  id="report-name"
                  placeholder="Enter a name for this report"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  data-testid="input-report-name"
                />
              </div>

              <Button 
                onClick={handleGenerateReport} 
                disabled={generateReportMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-generate-report"
              >
                {generateReportMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {generatedReport && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleExportPDF} disabled={isExporting} data-testid="button-export-pdf">
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={handleExportCSV} disabled={isExporting} data-testid="button-export-csv">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-save-report">
                      <Save className="h-4 w-4 mr-2" />
                      Save Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Report</DialogTitle>
                      <DialogDescription>Save this report for future reference</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="caregiver-reporting-report-name">Report Name</Label>
                        <Input id="caregiver-reporting-report-name"
                          value={reportName}
                          onChange={(e) => setReportName(e.target.value)}
                          placeholder="Enter report name"
                          data-testid="input-save-report-name"
                        />
                      </div>
                      <Button 
                        onClick={() => saveReportMutation.mutate()} 
                        disabled={saveReportMutation.isPending}
                        className="w-full"
                        data-testid="button-confirm-save"
                      >
                        {saveReportMutation.isPending ? "Saving..." : "Save Report"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
                  <CardDescription>
                    Report generated on {new Date(generatedReport.metadata.generatedAt).toLocaleString()}
                    {" | "}
                    {generatedReport.metadata.dateRangeStart} to {generatedReport.metadata.dateRangeEnd}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{generatedReport.reportData.summary.totalPatients}</p>
                      <p className="text-sm text-muted-foreground">Patients</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{generatedReport.reportData.summary.overallAdherenceRate.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Adherence</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{generatedReport.reportData.summary.criticalAlertsCount}</p>
                      <p className="text-sm text-muted-foreground">Active Alerts</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{generatedReport.reportData.summary.resolvedAlertsCount}</p>
                      <p className="text-sm text-muted-foreground">Resolved</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{generatedReport.reportData.summary.averageHealthScore}</p>
                      <p className="text-sm text-muted-foreground">Health Score</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-center gap-1">
                        {getTrendIcon(generatedReport.reportData.summary.trendsDirection)}
                        <p className="text-lg font-medium capitalize">{generatedReport.reportData.summary.trendsDirection}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">Trend</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChartIcon className="h-5 w-5" />
                      Medication Adherence Over Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={generatedReport.reportData.adherenceTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Rate"]}
                          labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="overallRate" name="Overall Adherence" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="h-5 w-5" />
                      Patient Status Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Stable", value: generatedReport.reportData.patientStatus.filter(p => p.currentStatus === "stable").length },
                            { name: "Attention Needed", value: generatedReport.reportData.patientStatus.filter(p => p.currentStatus === "attention_needed").length },
                            { name: "Critical", value: generatedReport.reportData.patientStatus.filter(p => p.currentStatus === "critical").length },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {[STATUS_COLORS.stable, STATUS_COLORS.attention_needed, STATUS_COLORS.critical].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Vitals Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={generatedReport.reportData.vitalsTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip labelFormatter={(label) => new Date(label).toLocaleDateString()} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="bloodPressureSystolic" name="Systolic BP" stroke="#ef4444" dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="bloodPressureDiastolic" name="Diastolic BP" stroke="#f97316" dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#3b82f6" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Appointment Attendance by Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={generatedReport.reportData.appointmentMetrics.byMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="attended" name="Attended" fill="#22c55e" />
                        <Bar dataKey="missed" name="Missed" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Patient Status Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Patient</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Health Score</th>
                          <th className="text-left p-2">Medications</th>
                          <th className="text-left p-2">Adherence</th>
                          <th className="text-left p-2">Alerts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.reportData.patientStatus.map((patient) => (
                          <tr key={patient.patientId} className="border-b">
                            <td className="p-2 font-medium">{patient.patientName}</td>
                            <td className="p-2">
                              <Badge style={{ backgroundColor: STATUS_COLORS[patient.currentStatus] }} className="text-white">
                                {patient.currentStatus.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="p-2">{patient.healthScore}/100</td>
                            <td className="p-2">{patient.activeMedications}</td>
                            <td className="p-2">{patient.adherenceRate}%</td>
                            <td className="p-2">
                              {patient.pendingAlerts > 0 ? (
                                <Badge variant="destructive">{patient.pendingAlerts}</Badge>
                              ) : (
                                <Badge variant="outline">0</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alert History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {generatedReport.reportData.criticalAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }} className="text-white">
                              {alert.severity}
                            </Badge>
                            <span className="font-medium">{alert.patientName}</span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(alert.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Type: {alert.type.replace(/_/g, " ")}
                          </p>
                        </div>
                        <Badge variant={alert.status === "resolved" ? "default" : alert.status === "acknowledged" ? "secondary" : "destructive"}>
                          {alert.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>View and manage your previously saved reports</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSaved ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : savedReports?.reports.length ? (
                <div className="space-y-4">
                  {savedReports.reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Generated: {new Date(report.generatedAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Period: {report.dateRangeStart} to {report.dateRangeEnd}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-view-report-${report.id}`}>
                          <FileText className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => deleteReportMutation.mutate(report.id)}
                          data-testid={`button-delete-report-${report.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved reports yet</p>
                  <p className="text-sm">Generate a report and save it for future reference</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Report Templates</CardTitle>
              <CardDescription>Available report templates and their descriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {templates?.templates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{template.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.recommendedCharts.map((chart) => (
                            <Badge key={chart} variant="outline" className="text-xs">
                              {chart === "line" && <LineChartIcon className="h-3 w-3 mr-1" />}
                              {chart === "bar" && <BarChart3 className="h-3 w-3 mr-1" />}
                              {chart === "pie" && <PieChartIcon className="h-3 w-3 mr-1" />}
                              {chart}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setReportType(template.id);
                          setActiveTab("generate");
                        }}
                        data-testid={`button-use-template-${template.id}`}
                      >
                        Use Template
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved Configurations</CardTitle>
              <CardDescription>Your custom report configurations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingConfigs ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : configurations?.configurations.length ? (
                <div className="space-y-4">
                  {configurations.configurations.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{config.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Type: {config.reportType} | Range: {config.dateRange.type.replace(/_/g, " ")}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-use-config-${config.id}`}>
                        Use
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved configurations</p>
                  <p className="text-sm">Configurations will appear here when you save them</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
