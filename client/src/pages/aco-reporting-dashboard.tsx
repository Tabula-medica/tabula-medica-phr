import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  BarChart3, 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Activity, 
  Shield, 
  Star,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileSpreadsheet,
  FileBadge,
  Send,
  RefreshCw
} from "lucide-react";

interface HEDISResult {
  measureCode: string;
  measureName: string;
  category: string;
  numerator: number;
  denominator: number;
  rate: number;
  targetRate: number;
  nationalBenchmark: number;
  percentile: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  trend: "improving" | "declining" | "stable";
  gapCount: number;
}

interface DashboardData {
  qualityOverview: {
    overallScore: number;
    starRating: 1 | 2 | 3 | 4 | 5;
    hedisPerformance: { measure: string; rate: number; target: number; status: string }[];
    trendsVsPriorYear: number;
  };
  populationHealth: {
    totalMembers: number;
    riskDistribution: { level: string; count: number; percent: number }[];
    topConditions: { name: string; prevalence: number }[];
    careGapsSummary: { total: number; closed: number; closureRate: number };
  };
  providerPerformance: {
    totalProviders: number;
    topPerformers: number;
    improvementNeeded: number;
    avgQualityScore: number;
  };
  compliance: {
    overallScore: number;
    openFindings: number;
    upcomingDeadlines: { item: string; date: string }[];
  };
  recentReports: { id: string; name: string; type: string; generatedAt: string; status: string }[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
}

export default function ACOReportingDashboard() {
  const { toast } = useToast();
  const [selectedOrg] = useState("org-001");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [generatingReport, setGeneratingReport] = useState(false);

  const { data: dashboardData, isLoading: loadingDashboard } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/aco-reporting/dashboard", selectedOrg],
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery<{ success: boolean; data: ReportTemplate[] }>({
    queryKey: ["/api/aco-reporting/templates"],
  });

  const { data: hedisData } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/aco-reporting/hedis/measures"],
  });

  const { data: reportsData, refetch: refetchReports } = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["/api/aco-reporting/reports", selectedOrg],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const today = new Date();
      const yearStart = new Date(today.getFullYear(), 0, 1);
      
      const config = await apiRequest("POST", "/api/aco-reporting/configurations", {
        name: `Report - ${new Date().toLocaleDateString()}`,
        description: "Generated from template",
        type: templatesData?.data?.find(t => t.id === templateId)?.type || "quality_metrics",
        filters: {
          dateRange: {
            start: yearStart.toISOString().split("T")[0],
            end: today.toISOString().split("T")[0]
          }
        },
        sections: [],
        exportFormats: ["csv", "pdf"],
        createdBy: "current-user",
        organizationId: selectedOrg
      });

      const configData = await config.json();
      
      return apiRequest("POST", "/api/aco-reporting/reports/generate", {
        configId: configData.data.id,
        generatedBy: "current-user"
      });
    },
    onSuccess: () => {
      toast({ title: "Report generated successfully" });
      refetchReports();
      queryClient.invalidateQueries({ queryKey: ["/api/aco-reporting/reports"] });
    },
    onError: () => {
      toast({ title: "Failed to generate report", variant: "destructive" });
    }
  });

  const exportMutation = useMutation({
    mutationFn: async ({ reportId, format }: { reportId: string; format: "csv" | "pdf" }) => {
      return apiRequest("POST", `/api/aco-reporting/reports/${reportId}/export/${format}`, {
        userId: "current-user"
      });
    },
    onSuccess: async (response) => {
      const data = await response.json();
      if (data.success && data.data) {
        const downloadUrl = `${data.data.downloadUrl}?token=${data.data.downloadToken}`;
        window.open(downloadUrl, "_blank");
        toast({ title: "Export ready for download" });
      }
    },
    onError: () => {
      toast({ title: "Failed to export report", variant: "destructive" });
    }
  });

  const handleGenerateReport = async () => {
    if (!selectedTemplate) {
      toast({ title: "Please select a report template", variant: "destructive" });
      return;
    }
    setGeneratingReport(true);
    try {
      await generateReportMutation.mutateAsync(selectedTemplate);
    } finally {
      setGeneratingReport(false);
    }
  };

  const dashboard = dashboardData?.data;
  const templates = templatesData?.data || [];
  const reports = reportsData?.data || [];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
      />
    ));
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving" || trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "declining" || trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "exceeds":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Exceeds</Badge>;
      case "meets":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Meets</Badge>;
      case "below":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Below</Badge>;
      case "critical":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Critical</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loadingDashboard) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">ACO Reporting Dashboard</h1>
          <p className="text-muted-foreground">Quality metrics, population health, and compliance reporting for ACOs and payers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-[220px]" data-testid="select-template">
              <SelectValue placeholder="Select report template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleGenerateReport} 
            disabled={generatingReport || !selectedTemplate}
            data-testid="button-generate-report"
          >
            {generatingReport ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-quality-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.qualityOverview.overallScore || 0}%</div>
            <div className="flex items-center gap-1 mt-1">
              {renderStars(dashboard?.qualityOverview.starRating || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(dashboard?.qualityOverview.trendsVsPriorYear ?? 0) > 0 ? "+" : ""}
              {dashboard?.qualityOverview.trendsVsPriorYear ?? 0}% vs prior year
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-population">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Population</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.populationHealth.totalMembers?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Total attributed members</p>
            <div className="mt-2">
              <Progress 
                value={dashboard?.populationHealth.careGapsSummary.closureRate || 0} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard?.populationHealth.careGapsSummary.closureRate}% care gap closure
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-providers">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Provider Performance</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.providerPerformance.avgQualityScore || 0}</div>
            <p className="text-xs text-muted-foreground">Avg quality score</p>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {dashboard?.providerPerformance.topPerformers} top
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                {dashboard?.providerPerformance.improvementNeeded} need improvement
              </span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.compliance.overallScore || 0}%</div>
            <p className="text-xs text-muted-foreground">Overall compliance score</p>
            <div className="flex items-center gap-1 mt-2 text-xs">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              {dashboard?.compliance.openFindings} open findings
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="quality" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="quality" data-testid="tab-quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="population" data-testid="tab-population">Population Health</TabsTrigger>
          <TabsTrigger value="providers" data-testid="tab-providers">Providers</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HEDIS Performance Measures</CardTitle>
              <CardDescription>Quality metrics based on Healthcare Effectiveness Data and Information Set</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.qualityOverview.hedisPerformance.map((measure, index) => (
                  <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <div className="font-medium">{measure.measure}</div>
                      <div className="text-sm text-muted-foreground">Target: {measure.target}%</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-lg font-bold">{measure.rate}%</div>
                        <Progress value={(measure.rate / measure.target) * 100} className="h-2 w-24" />
                      </div>
                      {getStatusBadge(measure.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="population" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Risk Stratification</CardTitle>
                <CardDescription>Population distribution by risk level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard?.populationHealth.riskDistribution.map((risk) => (
                    <div key={risk.level} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          risk.level === "Low" ? "bg-green-500" :
                          risk.level === "Moderate" ? "bg-yellow-500" :
                          risk.level === "High" ? "bg-orange-500" : "bg-red-500"
                        }`} />
                        <span>{risk.level} Risk</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">{risk.count.toLocaleString()}</span>
                        <Badge variant="secondary">{risk.percent}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Chronic Conditions</CardTitle>
                <CardDescription>Most prevalent conditions in population</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard?.populationHealth.topConditions.map((condition) => (
                    <div key={condition.name} className="flex items-center justify-between">
                      <span>{condition.name}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={condition.prevalence} className="h-2 w-20" />
                        <span className="text-sm font-medium w-12 text-right">{condition.prevalence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Care Gap Summary</CardTitle>
              <CardDescription>Overview of care gaps and closure rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-red-500">
                    {dashboard?.populationHealth.careGapsSummary.total.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Care Gaps</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-green-500">
                    {dashboard?.populationHealth.careGapsSummary.closed.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Gaps Closed</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-blue-500">
                    {dashboard?.populationHealth.careGapsSummary.closureRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">Closure Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Performance Summary</CardTitle>
              <CardDescription>Quality and efficiency metrics across provider network</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold">
                    {dashboard?.providerPerformance.totalProviders}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Providers</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-green-500">
                    {dashboard?.providerPerformance.topPerformers}
                  </div>
                  <div className="text-sm text-muted-foreground">Top Performers</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-yellow-500">
                    {dashboard?.providerPerformance.improvementNeeded}
                  </div>
                  <div className="text-sm text-muted-foreground">Need Improvement</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-3xl font-bold text-blue-500">
                    {dashboard?.providerPerformance.avgQualityScore}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Quality Score</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Overview</CardTitle>
                <CardDescription>Current compliance status and findings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center p-6">
                  <div className="relative">
                    <div className="text-5xl font-bold">{dashboard?.compliance.overallScore}%</div>
                    <div className="text-center text-muted-foreground mt-2">Overall Compliance</div>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-4 p-3 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span>{dashboard?.compliance.openFindings} open findings requiring attention</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
                <CardDescription>Compliance and reporting deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard?.compliance.upcomingDeadlines.map((deadline, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{deadline.item}</span>
                      </div>
                      <Badge variant="outline">{new Date(deadline.date).toLocaleDateString()}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Reports</CardTitle>
                <CardDescription>View, download, and manage generated reports</CardDescription>
              </div>
              <Button variant="outline" onClick={() => refetchReports()} data-testid="button-refresh-reports">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reports generated yet</p>
                  <p className="text-sm">Select a template above and click Generate Report to create your first report</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report: any) => (
                    <div key={report.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
                      <div className="flex-1">
                        <div className="font-medium">{report.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {report.type} • Generated {new Date(report.generatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                          {report.status}
                        </Badge>
                        {report.status === "completed" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportMutation.mutate({ reportId: report.id, format: "csv" })}
                              data-testid={`button-export-csv-${report.id}`}
                            >
                              <FileSpreadsheet className="h-4 w-4 mr-1" />
                              CSV
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => exportMutation.mutate({ reportId: report.id, format: "pdf" })}
                              data-testid={`button-export-pdf-${report.id}`}
                            >
                              <FileBadge className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground text-center">
            IMPORTANT: This dashboard is for INFORMATIONAL and ADMINISTRATIVE purposes only. 
            It does NOT constitute medical advice, diagnosis, or clinical decision support. 
            All healthcare decisions must be made by qualified healthcare providers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
