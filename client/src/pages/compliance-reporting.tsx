import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  BarChart3,
  Target,
  AlertCircle,
  Eye
} from "lucide-react";

type ReportType = "compliance" | "risk_assessment" | "remediation" | "trend_analysis" | "comprehensive";
type RiskLevel = "critical" | "high" | "medium" | "low";

interface ReportSummary {
  id: string;
  title: string;
  reportType: ReportType;
  generatedAt: string;
  dateRange: { startDate: string; endDate: string };
  overallRiskLevel: RiskLevel;
  overallComplianceScore: number;
  findingsCount: number;
}

interface ComplianceReport {
  id: string;
  title: string;
  reportType: ReportType;
  generatedAt: string;
  generatedBy: string;
  dateRange: { startDate: string; endDate: string };
  executiveSummary: {
    overview: string;
    keyFindings: string[];
    criticalActions: string[];
    overallRiskLevel: RiskLevel;
    overallComplianceScore: number;
    trendSummary: string;
  };
  riskAssessment: {
    overallRiskScore: number;
    previousRiskScore: number;
    trend: "improving" | "stable" | "declining";
    breakdown: Array<{
      category: string;
      score: number;
      maxScore: number;
      weight: number;
      findings: number;
      trend: string;
    }>;
    topRisks: Array<{
      id: string;
      title: string;
      severity: RiskLevel;
      likelihood: string;
      impact: string;
      mitigationStatus: string;
    }>;
  };
  findings: Array<{
    id: string;
    category: string;
    severity: RiskLevel;
    title: string;
    description: string;
    status: string;
    affectedSystems: string[];
    regulatoryReferences: string[];
  }>;
  remediationStatus: {
    totalItems: number;
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    completionRate: number;
    avgResolutionDays: number;
  };
  regulatoryCompliance: Array<{
    framework: string;
    complianceScore: number;
    totalControls: number;
    compliantControls: number;
    partialControls: number;
    nonCompliantControls: number;
    keyGaps: string[];
  }>;
  historicalTrends: Array<{
    period: string;
    overallRiskScore: number;
    complianceScore: number;
    findingsCount: number;
    remediationRate: number;
  }>;
  recommendations: Array<{
    id: string;
    priority: string;
    category: string;
    title: string;
    description: string;
    expectedBenefit: string;
    effort: string;
  }>;
  aiInsights: string[];
  metadata: {
    dataSourceCount: number;
    eventsAnalyzed: number;
    policiesEvaluated: number;
    generationTimeMs: number;
  };
}

export default function ComplianceReporting() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("reports");
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [newReportType, setNewReportType] = useState<ReportType>("comprehensive");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: reportsData, isLoading: reportsLoading } = useQuery<{ reports: ReportSummary[]; total: number }>({
    queryKey: ["/api/compliance-reporting/reports"]
  });

  const { data: summary } = useQuery<{
    totalReports: number;
    reportTypes: Record<string, number>;
    avgComplianceScore: number;
    riskLevelDistribution: Record<string, number>;
    lastReportDate: string | null;
  }>({
    queryKey: ["/api/compliance-reporting/summary"]
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { reportType: ReportType; dateRange: { startDate: string; endDate: string } }) => {
      const response = await apiRequest("POST", "/api/compliance-reporting/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Report Generated", description: "Compliance report created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-reporting/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-reporting/summary"] });
      setSelectedReport(data);
      setActiveTab("view");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    }
  });

  const viewReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/compliance-reporting/reports/${reportId}`);
      if (!response.ok) throw new Error("Failed to fetch report");
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedReport(data);
      setActiveTab("view");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to load report", variant: "destructive" });
    }
  });

  const downloadPdf = async (reportId: string) => {
    try {
      const response = await fetch(`/api/compliance-reporting/reports/${reportId}/export/pdf`);
      if (!response.ok) throw new Error("Failed to download PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-report-${reportId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "PDF report downloaded successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    }
  };

  const downloadCsv = async (reportId: string, section: string) => {
    try {
      const response = await fetch(`/api/compliance-reporting/reports/${reportId}/export/csv?section=${section}`);
      if (!response.ok) throw new Error("Failed to download CSV");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-${section}-${reportId}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `${section} CSV downloaded successfully` });
    } catch {
      toast({ title: "Error", description: "Failed to download CSV", variant: "destructive" });
    }
  };

  const getRiskBadge = (level: RiskLevel) => {
    const config: Record<RiskLevel, { variant: "destructive" | "default" | "secondary" | "outline"; icon: any }> = {
      critical: { variant: "destructive", icon: AlertTriangle },
      high: { variant: "destructive", icon: AlertCircle },
      medium: { variant: "default", icon: Clock },
      low: { variant: "secondary", icon: CheckCircle }
    };
    const { variant, icon: Icon } = config[level];
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "improving") return <TrendingDown className="h-4 w-4 text-green-500" />;
    if (trend === "declining") return <TrendingUp className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="h-6 w-6" />
            Compliance Reporting
          </h1>
          <p className="text-muted-foreground">AI-powered compliance and risk assessment reports</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-reports">{summary.totalReports}</p>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-avg-compliance">{summary.avgComplianceScore}%</p>
                  <p className="text-sm text-muted-foreground">Avg Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-critical-count">
                    {summary.riskLevelDistribution?.critical || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Critical Risks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium" data-testid="text-last-report">
                    {summary.lastReportDate 
                      ? new Date(summary.lastReportDate).toLocaleDateString() 
                      : "None"}
                  </p>
                  <p className="text-sm text-muted-foreground">Last Report</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">Generate New</TabsTrigger>
          {selectedReport && (
            <TabsTrigger value="view" data-testid="tab-view">View Report</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>View and export compliance reports</CardDescription>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : reportsData?.reports?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No reports generated yet</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setActiveTab("generate")}
                    data-testid="button-generate-first"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Generate First Report
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {reportsData?.reports?.map((report) => (
                      <Card key={report.id} className="hover-elevate cursor-pointer" data-testid={`card-report-${report.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-md bg-primary/10">
                                <BarChart3 className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{report.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(report.generatedAt).toLocaleString()} | 
                                  {report.dateRange.startDate} to {report.dateRange.endDate}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm font-medium">{report.overallComplianceScore}% Compliance</p>
                                <p className="text-xs text-muted-foreground">{report.findingsCount} findings</p>
                              </div>
                              {getRiskBadge(report.overallRiskLevel)}
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => viewReportMutation.mutate(report.id)}
                                  data-testid={`button-view-${report.id}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={() => downloadPdf(report.id)}
                                  data-testid={`button-pdf-${report.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate New Report</CardTitle>
              <CardDescription>Create an AI-powered compliance and risk assessment report</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select value={newReportType} onValueChange={(v) => setNewReportType(v as ReportType)}>
                    <SelectTrigger data-testid="select-report-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comprehensive">Comprehensive</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                      <SelectItem value="remediation">Remediation</SelectItem>
                      <SelectItem value="trend_analysis">Trend Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
              <Button 
                onClick={() => generateMutation.mutate({
                  reportType: newReportType,
                  dateRange: { startDate, endDate }
                })}
                disabled={generateMutation.isPending}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {selectedReport && (
          <TabsContent value="view" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedReport.title}</h2>
                <p className="text-muted-foreground">
                  Generated {new Date(selectedReport.generatedAt).toLocaleString()} | 
                  Period: {selectedReport.dateRange.startDate} to {selectedReport.dateRange.endDate}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => downloadPdf(selectedReport.id)} data-testid="button-export-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Select onValueChange={(section) => downloadCsv(selectedReport.id, section)}>
                  <SelectTrigger className="w-[140px]" data-testid="select-csv-section">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Export CSV" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="findings">Findings</SelectItem>
                    <SelectItem value="remediation">Remediation</SelectItem>
                    <SelectItem value="regulatory">Regulatory</SelectItem>
                    <SelectItem value="risks">Risks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Risk Level</p>
                    {getRiskBadge(selectedReport.executiveSummary.overallRiskLevel)}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Compliance Score</p>
                    <p className="text-2xl font-bold">{selectedReport.executiveSummary.overallComplianceScore}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Risk Score</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold">{selectedReport.riskAssessment.overallRiskScore}%</p>
                      {getTrendIcon(selectedReport.riskAssessment.trend)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Total Findings</p>
                    <p className="text-2xl font-bold">{selectedReport.findings.length}</p>
                  </div>
                </div>
                <p className="text-sm" data-testid="text-overview">{selectedReport.executiveSummary.overview}</p>
                
                {selectedReport.executiveSummary.keyFindings.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Key Findings</h4>
                    <ul className="space-y-1">
                      {selectedReport.executiveSummary.keyFindings.map((finding, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedReport.executiveSummary.criticalActions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-red-500">Critical Actions Required</h4>
                    <ul className="space-y-1">
                      {selectedReport.executiveSummary.criticalActions.map((action, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-500" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Risk Assessment Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {selectedReport.riskAssessment.breakdown.map((cat) => (
                        <div key={cat.category}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{cat.category}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{cat.score}%</span>
                              {getTrendIcon(cat.trend)}
                            </div>
                          </div>
                          <Progress value={cat.score} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Remediation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Completion Rate</span>
                      <span className="font-bold">{selectedReport.remediationStatus.completionRate}%</span>
                    </div>
                    <Progress value={selectedReport.remediationStatus.completionRate} className="h-3" />
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Completed: {selectedReport.remediationStatus.completed}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        In Progress: {selectedReport.remediationStatus.inProgress}
                      </div>
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-muted-foreground" />
                        Pending: {selectedReport.remediationStatus.pending}
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Overdue: {selectedReport.remediationStatus.overdue}
                      </div>
                    </div>
                    <Separator />
                    <p className="text-sm text-muted-foreground">
                      Avg Resolution: {selectedReport.remediationStatus.avgResolutionDays} days
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Regulatory Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {selectedReport.regulatoryCompliance.map((reg) => (
                    <Card key={reg.framework}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{reg.framework}</Badge>
                          <span className="text-lg font-bold">{reg.complianceScore}%</span>
                        </div>
                        <Progress value={reg.complianceScore} className="h-2 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {reg.compliantControls}/{reg.totalControls} controls compliant
                        </p>
                        {reg.keyGaps.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-red-500">Key Gaps:</p>
                            <ul className="text-xs text-muted-foreground">
                              {reg.keyGaps.slice(0, 2).map((gap, i) => (
                                <li key={i}>{gap}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedReport.aiInsights.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI-Generated Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {selectedReport.aiInsights.map((insight, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <Badge variant="secondary" className="mt-0.5">{i + 1}</Badge>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedReport.recommendations.map((rec) => (
                    <div key={rec.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{rec.title}</span>
                        <Badge variant={rec.priority === "immediate" ? "destructive" : rec.priority === "short_term" ? "default" : "secondary"}>
                          {rec.priority.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Benefit: {rec.expectedBenefit}</span>
                        <span>Effort: {rec.effort}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Report ID: {selectedReport.id}</span>
                  <span>Data Sources: {selectedReport.metadata.dataSourceCount}</span>
                  <span>Events Analyzed: {selectedReport.metadata.eventsAnalyzed.toLocaleString()}</span>
                  <span>Generated in: {selectedReport.metadata.generationTimeMs}ms</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
