import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Globe,
  Info,
  Map,
  PieChart,
  RefreshCw,
  Shield,
  Syringe,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";

interface DashboardMetrics {
  overallCoverage: number;
  weeklyVaccinations: number;
  monthlyVaccinations: number;
  yearlyVaccinations: number;
  topVaccineTypes: { name: string; count: number; percentage: number }[];
  ageGroupDistribution: { ageGroup: string; count: number; percentage: number }[];
  geographicDistribution: { region: string; count: number; percentage: number }[];
  monthlyTrends: { month: string; count: number; change: number }[];
  iisComplianceRate: number;
  pendingIISSubmissions: number;
}

interface Filters {
  vaccineTypes: string[];
  ageGroups: string[];
  states: string[];
  statuses: string[];
  facilities: { id: string; name: string }[];
}

interface ReportSummary {
  id: string;
  reportType: string;
  title: string;
  generatedAt: string;
  recordCount: number;
  summary: string;
}

export default function PublicHealthReporting() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedVaccineTypes, setSelectedVaccineTypes] = useState<string[]>([]);
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [reportType, setReportType] = useState<string>("comprehensive");
  const [reportTitle, setReportTitle] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [exportFormat, setExportFormat] = useState<string>("csv");
  const [deidentify, setDeidentify] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ metrics: DashboardMetrics; disclaimer: string }>({
    queryKey: ["/api/public-health/dashboard"],
  });

  const { data: filtersData } = useQuery<{ filters: Filters }>({
    queryKey: ["/api/public-health/filters"],
  });

  const { data: reportsData, refetch: refetchReports } = useQuery<{ reports: ReportSummary[] }>({
    queryKey: ["/api/public-health/reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const criteria: any = {};
      if (selectedVaccineTypes.length > 0) criteria.vaccineTypes = selectedVaccineTypes;
      if (selectedAgeGroups.length > 0) criteria.ageGroups = selectedAgeGroups;
      if (selectedStates.length > 0) criteria.states = selectedStates;
      if (dateRangeStart && dateRangeEnd) {
        criteria.dateRange = { startDate: dateRangeStart, endDate: dateRangeEnd };
      }

      const response = await apiRequest("POST", "/api/public-health/reports/generate", {
        reportType,
        criteria,
        title: reportTitle || undefined
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-health/reports"] });
      setSelectedReportId(data.report.id);
      toast({ title: "Report Generated", description: `${data.report.title} has been created` });
      setActiveTab("reports");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
    },
  });

  const exportReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await apiRequest("POST", `/api/public-health/reports/${reportId}/export`, {
        format: exportFormat,
        deidentify,
        includeMetadata: true,
        dateFormat: "iso"
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.format === "csv") {
        const blob = new Blob([data.data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (data.format === "fhir-bundle") {
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (data.format === "fhir-ndjson") {
        const blob = new Blob([data.data], { type: "application/ndjson" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: "Export Complete", description: `Report exported as ${data.format.toUpperCase()}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to export report", variant: "destructive" });
    },
  });

  const metrics = dashboardData?.metrics;
  const filters = filtersData?.filters;
  const reports = reportsData?.reports || [];

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return "text-green-600 dark:text-green-400";
    if (rate >= 80) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getComplianceIcon = (rate: number) => {
    if (rate >= 95) return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (rate >= 80) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <BarChart3 className="h-6 w-6 text-primary" />
              Public Health Reporting
            </h1>
            <p className="text-muted-foreground mt-1" data-testid="text-page-description">
              Immunization surveillance, analytics, and compliance reporting
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>

        <Alert className="mb-6 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" data-testid="alert-disclaimer">
          <Shield className="h-4 w-4" />
          <AlertTitle>Data Privacy Notice</AlertTitle>
          <AlertDescription className="text-sm" data-testid="text-disclaimer">
            {dashboardData?.disclaimer || "This report is for public health surveillance and administrative purposes only. It does NOT constitute clinical decision support or medical advice."}
          </AlertDescription>
        </Alert>

        {showFilters && filters && (
          <Card className="mb-6" data-testid="card-filters">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Report Filters</CardTitle>
              <CardDescription>Select criteria for report generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium">Vaccine Types</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {filters.vaccineTypes.map((vt) => (
                      <div key={vt} className="flex items-center gap-2">
                        <Checkbox
                          id={`vt-${vt}`}
                          checked={selectedVaccineTypes.includes(vt)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedVaccineTypes([...selectedVaccineTypes, vt]);
                            } else {
                              setSelectedVaccineTypes(selectedVaccineTypes.filter(v => v !== vt));
                            }
                          }}
                          data-testid={`checkbox-vaccine-${vt}`}
                        />
                        <Label htmlFor={`vt-${vt}`} className="text-sm">{vt}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Age Groups</Label>
                  <div className="mt-2 space-y-2">
                    {filters.ageGroups.map((ag) => (
                      <div key={ag} className="flex items-center gap-2">
                        <Checkbox
                          id={`ag-${ag}`}
                          checked={selectedAgeGroups.includes(ag)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAgeGroups([...selectedAgeGroups, ag]);
                            } else {
                              setSelectedAgeGroups(selectedAgeGroups.filter(a => a !== ag));
                            }
                          }}
                          data-testid={`checkbox-age-${ag}`}
                        />
                        <Label htmlFor={`ag-${ag}`} className="text-sm">{ag}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">States</Label>
                  <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                    {filters.states.slice(0, 10).map((st) => (
                      <div key={st} className="flex items-center gap-2">
                        <Checkbox
                          id={`st-${st}`}
                          checked={selectedStates.includes(st)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStates([...selectedStates, st]);
                            } else {
                              setSelectedStates(selectedStates.filter(s => s !== st));
                            }
                          }}
                          data-testid={`checkbox-state-${st}`}
                        />
                        <Label htmlFor={`st-${st}`} className="text-sm">{st}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date Range</Label>
                  <div className="mt-2 space-y-2">
                    <Input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      placeholder="Start Date"
                      data-testid="input-date-start"
                    />
                    <Input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      placeholder="End Date"
                      data-testid="input-date-end"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="tabs-main">
          <TabsList className="grid grid-cols-3 w-full max-w-md" data-testid="list-tabs">
            <TabsTrigger value="dashboard" data-testid="trigger-tab-dashboard">
              <PieChart className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="trigger-tab-reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="generate" data-testid="trigger-tab-generate">
              <Activity className="h-4 w-4 mr-2" />
              Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            {dashboardLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <Skeleton className="h-8 w-24 mb-2" />
                      <Skeleton className="h-6 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : metrics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card data-testid="card-metric-yearly">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Yearly Vaccinations</p>
                          <p className="text-2xl font-bold" data-testid="text-yearly-count">{metrics.yearlyVaccinations.toLocaleString()}</p>
                        </div>
                        <Syringe className="h-8 w-8 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-metric-monthly">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Vaccinations</p>
                          <p className="text-2xl font-bold" data-testid="text-monthly-count">{metrics.monthlyVaccinations.toLocaleString()}</p>
                        </div>
                        <Calendar className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-metric-compliance">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-muted-foreground">IIS Compliance</p>
                          <p className={`text-2xl font-bold ${getComplianceColor(metrics.iisComplianceRate)}`} data-testid="text-compliance-rate">
                            {metrics.iisComplianceRate.toFixed(1)}%
                          </p>
                        </div>
                        {getComplianceIcon(metrics.iisComplianceRate)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-metric-pending">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Pending IIS Submissions</p>
                          <p className="text-2xl font-bold text-orange-600" data-testid="text-pending-count">{metrics.pendingIISSubmissions}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-orange-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-vaccine-distribution">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PieChart className="h-5 w-5" />
                        Top Vaccine Types
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {metrics.topVaccineTypes.map((vt, idx) => (
                          <div key={vt.name} className="flex items-center gap-3" data-testid={`item-vaccine-${idx}`}>
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-medium text-sm" data-testid={`text-vaccine-name-${idx}`}>{vt.name}</span>
                                <span className="text-sm text-muted-foreground" data-testid={`text-vaccine-count-${idx}`}>{vt.count}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${vt.percentage}%` }}
                                />
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-vaccine-percent-${idx}`}>
                              {vt.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-age-distribution">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Age Group Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {metrics.ageGroupDistribution.map((ag, idx) => (
                          <div key={ag.ageGroup} className="flex items-center gap-3" data-testid={`item-age-${idx}`}>
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-medium text-sm" data-testid={`text-age-group-${idx}`}>{ag.ageGroup}</span>
                                <span className="text-sm text-muted-foreground" data-testid={`text-age-count-${idx}`}>{ag.count}</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ width: `${ag.percentage}%` }}
                                />
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-age-percent-${idx}`}>
                              {ag.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-geographic-distribution">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Map className="h-5 w-5" />
                        Geographic Distribution (Top 10 States)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {metrics.geographicDistribution.map((geo, idx) => (
                          <div key={geo.region} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded" data-testid={`item-geo-${idx}`}>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm" data-testid={`text-state-${idx}`}>{geo.region}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm" data-testid={`text-state-count-${idx}`}>{geo.count}</span>
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-state-percent-${idx}`}>
                                {geo.percentage.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-monthly-trends">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Monthly Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {metrics.monthlyTrends.slice(-6).map((trend, idx) => (
                          <div key={trend.month} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded" data-testid={`item-trend-${idx}`}>
                            <span className="font-medium text-sm" data-testid={`text-month-${idx}`}>{trend.month}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm" data-testid={`text-month-count-${idx}`}>{trend.count}</span>
                              {trend.change !== 0 && (
                                <Badge 
                                  variant={trend.change > 0 ? "default" : "secondary"} 
                                  className="text-xs flex items-center gap-1"
                                  data-testid={`badge-trend-change-${idx}`}
                                >
                                  {trend.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {Math.abs(trend.change).toFixed(1)}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <Card data-testid="card-reports-list">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg">Generated Reports</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => refetchReports()} data-testid="button-refresh-reports">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="text-no-reports">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No reports generated yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab("generate")}
                      data-testid="button-go-generate"
                    >
                      Generate First Report
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report, idx) => (
                      <div 
                        key={report.id} 
                        className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                        data-testid={`item-report-${idx}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-report-title-${idx}`}>{report.title}</span>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-report-type-${idx}`}>
                              {report.reportType}
                            </Badge>
                            <Badge 
                              variant={report.summary === "compliant" ? "default" : report.summary === "needs-attention" ? "secondary" : "destructive"} 
                              className="text-xs"
                              data-testid={`badge-report-status-${idx}`}
                            >
                              {report.summary}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`text-report-info-${idx}`}>
                            {new Date(report.generatedAt).toLocaleString()} • {report.recordCount} records
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedReportId(report.id)}
                                data-testid={`button-export-${idx}`}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Export
                              </Button>
                            </DialogTrigger>
                            <DialogContent data-testid="dialog-export">
                              <DialogHeader>
                                <DialogTitle>Export Report</DialogTitle>
                                <DialogDescription>
                                  Select export format and options
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Export Format</Label>
                                  <Select value={exportFormat} onValueChange={setExportFormat}>
                                    <SelectTrigger data-testid="trigger-export-format">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="csv">
                                        <div className="flex items-center gap-2">
                                          <FileSpreadsheet className="h-4 w-4" />
                                          CSV (Spreadsheet)
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="fhir-bundle">
                                        <div className="flex items-center gap-2">
                                          <FileJson className="h-4 w-4" />
                                          FHIR Bundle (JSON)
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="fhir-ndjson">
                                        <div className="flex items-center gap-2">
                                          <FileJson className="h-4 w-4" />
                                          FHIR NDJSON
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox 
                                    id="deidentify"
                                    checked={deidentify}
                                    onCheckedChange={(c) => setDeidentify(!!c)}
                                    data-testid="checkbox-deidentify"
                                  />
                                  <Label htmlFor="deidentify">De-identify patient data</Label>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  onClick={() => exportReportMutation.mutate(report.id)}
                                  disabled={exportReportMutation.isPending}
                                  data-testid="button-confirm-export"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="generate" className="mt-6">
            <Card data-testid="card-generate-report">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Generate New Report</CardTitle>
                <CardDescription>
                  Create a public health report based on immunization data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Report Type</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger data-testid="trigger-report-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                        <SelectItem value="coverage">Coverage Analysis</SelectItem>
                        <SelectItem value="distribution">Distribution</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="trend">Trend Analysis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Report Title (Optional)</Label>
                    <Input 
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="Enter custom title..."
                      data-testid="input-report-title"
                    />
                  </div>
                </div>

                <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Use the Filters panel above to select specific criteria for your report. 
                    If no filters are selected, the report will include all available data.
                  </AlertDescription>
                </Alert>

                {(selectedVaccineTypes.length > 0 || selectedAgeGroups.length > 0 || selectedStates.length > 0) && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="font-medium text-sm mb-2">Selected Filters:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedVaccineTypes.map(vt => (
                        <Badge key={vt} variant="secondary" className="text-xs">{vt}</Badge>
                      ))}
                      {selectedAgeGroups.map(ag => (
                        <Badge key={ag} variant="secondary" className="text-xs">{ag}</Badge>
                      ))}
                      {selectedStates.map(st => (
                        <Badge key={st} variant="secondary" className="text-xs">{st}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => generateReportMutation.mutate()}
                  disabled={generateReportMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-report"
                >
                  {generateReportMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
