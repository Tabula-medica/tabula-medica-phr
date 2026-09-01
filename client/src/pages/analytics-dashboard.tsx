import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared";
import type { 
  AnalyticsDashboardData, 
  PatientCohort, 
  TreatmentEfficacy, 
  AtRiskPatient 
} from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart3,
  Users,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Heart,
  Pill,
  FileText,
  Plus,
  RefreshCw,
  Download,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  Code,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const RISK_COLORS = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
  critical: "#7c2d12",
};

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

interface ReportOptions {
  reportTypes: { value: string; label: string }[];
  formats: { value: string; label: string; icon: string }[];
  cohorts: { value: string; label: string }[];
  conditions: string[];
  medications: string[];
  demographics: { value: string; label: string }[];
}

export default function AnalyticsDashboard() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [showCohortDialog, setShowCohortDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortDescription, setNewCohortDescription] = useState("");
  const [newCohortType, setNewCohortType] = useState("condition");
  const [cohortConditions, setCohortConditions] = useState("");
  
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState("comprehensive");
  const [reportFormat, setReportFormat] = useState("pdf");
  const [reportDescription, setReportDescription] = useState("");
  const [reportStartDate, setReportStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);

  const { data: dashboardData, isLoading, refetch } = useQuery<AnalyticsDashboardData>({
    queryKey: ["/api/analytics/dashboard", selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/dashboard?period=${selectedPeriod}`);
      if (!res.ok) throw new Error("Failed to fetch analytics dashboard");
      return res.json();
    },
  });

  const { data: treatmentEfficacy } = useQuery<TreatmentEfficacy[]>({
    queryKey: ["/api/analytics/treatment-efficacy"],
  });

  const { data: cohorts } = useQuery<PatientCohort[]>({
    queryKey: ["/api/analytics/cohorts"],
  });

  const { data: reportOptions } = useQuery<ReportOptions>({
    queryKey: ["/api/analytics/reports/options"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      description: string;
      dateRange: { start: string; end: string };
      format: string;
      cohortIds?: string[];
    }) => {
      const response = await fetch("/api/analytics/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate report");
      }
      
      const blob = await response.blob();
      const filename = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") 
        || `report.${data.format}`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true, filename };
    },
    onSuccess: (result) => {
      toast({
        title: "Report Generated",
        description: `Your report "${result.filename}" has been downloaded.`,
      });
      setShowReportDialog(false);
      resetReportForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetReportForm = () => {
    setReportName("");
    setReportType("comprehensive");
    setReportFormat("pdf");
    setReportDescription("");
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    setReportStartDate(date.toISOString().split("T")[0]);
    setReportEndDate(new Date().toISOString().split("T")[0]);
    setSelectedCohorts([]);
  };

  const handleGenerateReport = () => {
    if (!reportName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a report name.",
        variant: "destructive",
      });
      return;
    }
    
    generateReportMutation.mutate({
      name: reportName,
      type: reportType,
      description: reportDescription,
      dateRange: { start: reportStartDate, end: reportEndDate },
      format: reportFormat,
      cohortIds: selectedCohorts.length > 0 ? selectedCohorts : undefined,
    });
  };

  const createCohortMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; type: string; criteria: object }) => {
      return apiRequest("POST", "/api/analytics/cohorts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/cohorts"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/analytics/dashboard"
      });
      setShowCohortDialog(false);
      setNewCohortName("");
      setNewCohortDescription("");
      setCohortConditions("");
    },
  });

  const handleCreateCohort = () => {
    const conditions = cohortConditions.split(",").map(c => c.trim()).filter(Boolean);
    createCohortMutation.mutate({
      name: newCohortName,
      description: newCohortDescription,
      type: newCohortType,
      criteria: { conditions },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" data-testid="analytics-loading">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overview = dashboardData?.overview || {
    totalPatients: 0,
    activePatients: 0,
    atRiskPatients: 0,
    avgRiskScore: 0,
    telehealthSessions: 0,
    promCompletionRate: 0,
  };

  const riskData = dashboardData?.riskDistribution || [];
  const conditionData = dashboardData?.conditionPrevalence || [];
  const medicationData = dashboardData?.topMedications || [];
  const atRiskPatients = dashboardData?.atRiskPatients || [];
  const demographicData = dashboardData?.demographicBreakdown || [];
  const trendData = dashboardData?.recentTrends || [];

  return (
    <div className="flex flex-col h-full" data-testid="analytics-dashboard">
      <div className="border-b p-4 flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title="Population Health Analytics"
          subtitle="Real-time insights across your patient population"
        />
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh" aria-label="Refresh analytics">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
            <DialogTrigger asChild>
              <Button variant="default" data-testid="button-generate-report">
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Generate Analytics Report</DialogTitle>
                <DialogDescription>
                  Create detailed reports on population health trends, patient cohorts, 
                  treatment efficacy, and key health indicators in PDF, CSV, or JSON format.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-name">Report Name *</Label>
                    <Input
                      id="report-name"
                      placeholder="Monthly Population Health Report"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      data-testid="input-report-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="report-type">Report Type</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger id="report-type" data-testid="select-report-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(reportOptions?.reportTypes || [
                          { value: "comprehensive", label: "Comprehensive Report" },
                          { value: "population_health", label: "Population Health Trends" },
                          { value: "cohort_analysis", label: "Cohort Analysis" },
                          { value: "treatment_efficacy", label: "Treatment Efficacy" },
                          { value: "at_risk_patients", label: "At-Risk Patients" },
                          { value: "risk_assessment", label: "Risk Assessment" },
                          { value: "quality_metrics", label: "Quality Metrics" },
                        ]).map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-description">Description (Optional)</Label>
                  <Textarea
                    id="report-description"
                    placeholder="Brief description of the report's purpose..."
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    rows={2}
                    data-testid="input-report-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="report-start-date">Start Date</Label>
                    <Input
                      id="report-start-date"
                      type="date"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      data-testid="input-report-start-date"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="report-end-date">End Date</Label>
                    <Input
                      id="report-end-date"
                      type="date"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      data-testid="input-report-end-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldCaption>Export Format</FieldCaption>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={reportFormat === "pdf" ? "default" : "outline"}
                      onClick={() => setReportFormat("pdf")}
                      className="flex-1"
                      data-testid="button-format-pdf"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      type="button"
                      variant={reportFormat === "csv" ? "default" : "outline"}
                      onClick={() => setReportFormat("csv")}
                      className="flex-1"
                      data-testid="button-format-csv"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                    <Button
                      type="button"
                      variant={reportFormat === "json" ? "default" : "outline"}
                      onClick={() => setReportFormat("json")}
                      className="flex-1"
                      data-testid="button-format-json"
                    >
                      <Code className="h-4 w-4 mr-2" />
                      JSON
                    </Button>
                  </div>
                </div>

                {cohorts && cohorts.length > 0 && (
                  <div className="space-y-2">
                    <FieldCaption>Filter by Cohorts (Optional)</FieldCaption>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                      {cohorts.map((cohort) => (
                        <div key={cohort.id} className="flex items-center space-x-2">
                          <Checkbox aria-label="Filter by Cohorts (Optional)"
                            id={`cohort-${cohort.id}`}
                            checked={selectedCohorts.includes(cohort.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCohorts([...selectedCohorts, cohort.id]);
                              } else {
                                setSelectedCohorts(selectedCohorts.filter((id) => id !== cohort.id));
                              }
                            }}
                            data-testid={`checkbox-cohort-${cohort.id}`}
                          />
                          <label
                            htmlFor={`cohort-${cohort.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {cohort.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-sm mb-2">Report Preview</h4>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><span className="font-medium">Name:</span> {reportName || "Untitled Report"}</p>
                      <p><span className="font-medium">Type:</span> {reportOptions?.reportTypes?.find(t => t.value === reportType)?.label || reportType}</p>
                      <p><span className="font-medium">Format:</span> {reportFormat.toUpperCase()}</p>
                      <p><span className="font-medium">Date Range:</span> {reportStartDate} to {reportEndDate}</p>
                      {selectedCohorts.length > 0 && (
                        <p><span className="font-medium">Cohorts:</span> {selectedCohorts.length} selected</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowReportDialog(false);
                    resetReportForm();
                  }}
                  data-testid="button-cancel-report"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending || !reportName.trim()}
                  data-testid="button-download-report"
                >
                  {generateReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card data-testid="card-total-patients">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +5%
                  </Badge>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{overview.totalPatients}</p>
                  <p className="text-xs text-muted-foreground">Total Patients</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-patients">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Activity className="h-5 w-5 text-green-500" />
                  <Badge variant="secondary" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +12%
                  </Badge>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{overview.activePatients}</p>
                  <p className="text-xs text-muted-foreground">Active Patients</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-at-risk">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <Badge variant="destructive" className="text-xs">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    -3%
                  </Badge>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{overview.atRiskPatients}</p>
                  <p className="text-xs text-muted-foreground">At-Risk Patients</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-risk">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <Heart className="h-5 w-5 text-red-500" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{overview.avgRiskScore.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Avg Risk Score</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-telehealth">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{overview.telehealthSessions}</p>
                  <p className="text-xs text-muted-foreground">Telehealth Sessions</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-prom-completion">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold">{(overview.promCompletionRate * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">PROM Completion</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList data-testid="tabs-analytics">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="risk" data-testid="tab-risk">Risk Analysis</TabsTrigger>
              <TabsTrigger value="cohorts" data-testid="tab-cohorts">Cohorts</TabsTrigger>
              <TabsTrigger value="treatments" data-testid="tab-treatments">Treatment Efficacy</TabsTrigger>
              <TabsTrigger value="demographics" data-testid="tab-demographics">Demographics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card data-testid="card-risk-distribution">
                  <CardHeader>
                    <CardTitle className="text-lg">Risk Distribution</CardTitle>
                    <CardDescription>Patient population by risk level</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskData}
                            dataKey="count"
                            nameKey="level"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ level, percentage }) => `${level}: ${percentage.toFixed(0)}%`}
                          >
                            {riskData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={RISK_COLORS[entry.level as keyof typeof RISK_COLORS] || CHART_COLORS[index]} 
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-condition-prevalence">
                  <CardHeader>
                    <CardTitle className="text-lg">Condition Prevalence</CardTitle>
                    <CardDescription>Top conditions across population</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={conditionData.slice(0, 6)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="condition" type="category" width={100} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card data-testid="card-top-medications">
                  <CardHeader>
                    <CardTitle className="text-lg">Top Medications</CardTitle>
                    <CardDescription>Most prescribed with adherence rates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {medicationData.slice(0, 5).map((med, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Pill className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{med.medication}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{med.patientCount} patients</Badge>
                            <Badge 
                              variant={med.adherenceRate > 0.8 ? "default" : "secondary"}
                              className={med.adherenceRate > 0.8 ? "bg-green-600" : ""}
                            >
                              {(med.adherenceRate * 100).toFixed(0)}% adherence
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-trends">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Trends</CardTitle>
                    <CardDescription>Key metrics over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData[0]?.values || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis />
                          <Tooltip />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#3b82f6" 
                            fill="#3b82f6" 
                            fillOpacity={0.2} 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="risk" className="space-y-4">
              <Card data-testid="card-at-risk-patients">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">At-Risk Patients</CardTitle>
                      <CardDescription>Patients requiring attention, prioritized by risk</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" data-testid="button-view-all-risk">
                      View All <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {atRiskPatients.slice(0, 8).map((patient) => (
                      <div 
                        key={patient.patientId} 
                        className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                        data-testid={`patient-risk-${patient.patientId}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-10 rounded-full ${
                            patient.overallRiskLevel === "high" ? "bg-red-500" :
                            patient.overallRiskLevel === "moderate" ? "bg-orange-500" : "bg-green-500"
                          }`} />
                          <div>
                            <p className="font-medium">{patient.patientName}</p>
                            <p className="text-sm text-muted-foreground">
                              {patient.age}y, {patient.gender} | {patient.primaryConditions.slice(0, 2).join(", ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={patient.overallRiskLevel === "high" ? "destructive" : "secondary"}
                          >
                            {patient.overallRiskLevel} risk
                          </Badge>
                          {patient.openAlerts > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {patient.openAlerts}
                            </Badge>
                          )}
                          {patient.nextScheduledVisit && (
                            <Badge variant="outline" className="gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(patient.nextScheduledVisit).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cohorts" className="space-y-4">
              <Card data-testid="card-cohorts">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Patient Cohorts</CardTitle>
                      <CardDescription>Custom patient groupings for targeted analysis</CardDescription>
                    </div>
                    <Dialog open={showCohortDialog} onOpenChange={setShowCohortDialog}>
                      <DialogTrigger asChild>
                        <Button data-testid="button-new-cohort">
                          <Plus className="h-4 w-4 mr-2" />
                          New Cohort
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Patient Cohort</DialogTitle>
                          <DialogDescription>
                            Define criteria to group patients for analysis
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="cohort-name">Cohort Name</Label>
                            <Input
                              id="cohort-name"
                              value={newCohortName}
                              onChange={(e) => setNewCohortName(e.target.value)}
                              placeholder="e.g., Diabetic Patients Over 65"
                              data-testid="input-cohort-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cohort-description">Description</Label>
                            <Textarea
                              id="cohort-description"
                              value={newCohortDescription}
                              onChange={(e) => setNewCohortDescription(e.target.value)}
                              placeholder="Brief description of cohort purpose"
                              data-testid="input-cohort-description"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cohort-type">Cohort Type</Label>
                            <Select value={newCohortType} onValueChange={setNewCohortType}>
                              <SelectTrigger data-testid="select-cohort-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="condition">By Condition</SelectItem>
                                <SelectItem value="medication">By Medication</SelectItem>
                                <SelectItem value="risk_level">By Risk Level</SelectItem>
                                <SelectItem value="demographics">By Demographics</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cohort-conditions">Conditions (comma-separated)</Label>
                            <Input
                              id="cohort-conditions"
                              value={cohortConditions}
                              onChange={(e) => setCohortConditions(e.target.value)}
                              placeholder="e.g., Diabetes, Hypertension"
                              data-testid="input-cohort-conditions"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCohortDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleCreateCohort}
                            disabled={!newCohortName || createCohortMutation.isPending}
                            data-testid="button-create-cohort"
                          >
                            {createCohortMutation.isPending ? "Creating..." : "Create Cohort"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {(cohorts?.length || 0) === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No cohorts defined yet</p>
                      <p className="text-sm">Create your first cohort to start analyzing patient groups</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cohorts?.map((cohort) => (
                        <Card key={cohort.id} className="hover-elevate" data-testid={`cohort-${cohort.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{cohort.name}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {cohort.description || "No description"}
                                </p>
                              </div>
                              <Badge variant="outline">{cohort.type}</Badge>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <Badge>{cohort.patientCount} patients</Badge>
                              <Badge variant={cohort.isActive ? "default" : "secondary"}>
                                {cohort.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="treatments" className="space-y-4">
              <Card data-testid="card-treatment-efficacy">
                <CardHeader>
                  <CardTitle className="text-lg">Treatment Efficacy Analysis</CardTitle>
                  <CardDescription>Outcomes and effectiveness across patient demographics</CardDescription>
                </CardHeader>
                <CardContent>
                  {!treatmentEfficacy?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No treatment efficacy data available</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {treatmentEfficacy.slice(0, 4).map((treatment) => (
                        <div key={treatment.id} className="border rounded-lg p-4" data-testid={`treatment-${treatment.id}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-medium">{treatment.treatmentName}</h4>
                              <p className="text-sm text-muted-foreground">
                                Target: {treatment.targetCondition} | Sample: {treatment.sampleSize} patients
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline">
                                {(treatment.adherenceRate * 100).toFixed(0)}% adherence
                              </Badge>
                              <Badge variant="outline">
                                {treatment.timeToEffect}d avg effect
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-sm font-medium mb-2">Outcomes</h5>
                              <div className="space-y-2">
                                {treatment.outcomes.map((outcome, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{outcome.metric}</span>
                                    <div className="flex items-center gap-2">
                                      <span>{outcome.baseline.toFixed(1)} → {outcome.current.toFixed(1)}</span>
                                      <Badge 
                                        variant={outcome.improvement > 0 ? "default" : "destructive"}
                                        className={outcome.improvement > 0 ? "bg-green-600" : ""}
                                      >
                                        {outcome.improvement > 0 ? (
                                          <ArrowUpRight className="h-3 w-3 mr-1" />
                                        ) : (
                                          <ArrowDownRight className="h-3 w-3 mr-1" />
                                        )}
                                        {Math.abs(outcome.improvement).toFixed(0)}%
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="text-sm font-medium mb-2">Efficacy by Age Group</h5>
                              <div className="h-32">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={treatment.demographics[0]?.breakdown || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="value" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} tickFormatter={(v) => `${(v*100).toFixed(0)}%`} />
                                    <Tooltip formatter={(v: number) => `${(v*100).toFixed(0)}%`} />
                                    <Bar dataKey="efficacyRate" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="demographics" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {demographicData.map((group, idx) => (
                  <Card key={idx} data-testid={`card-demographics-${group.category}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{group.category} Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={group.data}
                              dataKey="count"
                              nameKey="value"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ value, count }) => `${value}: ${count}`}
                            >
                              {group.data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
