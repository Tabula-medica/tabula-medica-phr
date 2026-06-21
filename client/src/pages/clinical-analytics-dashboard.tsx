import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  Activity,
  FileText,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Heart,
  Stethoscope,
  XCircle,
  Loader2,
  PieChart,
  Info
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  Tooltip as RechartsTooltip,
  Legend
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface KPIData {
  appointmentMetrics: {
    totalScheduled: number;
    completed: number;
    noShows: number;
    cancelled: number;
    noShowRate: number;
    noShowTrend: Array<{ date: string; rate: number; count: number }>;
  };
  patientOutcomes: {
    improved: number;
    stable: number;
    declined: number;
    improvementRate: number;
    outcomeTrend: Array<{ date: string; improved: number; stable: number; declined: number }>;
  };
  clinicianWorkload: {
    averagePatientsPerDay: number;
    averageAppointmentDuration: number;
    utilizationRate: number;
    workloadByClinic: Array<{ clinicianId: string; name: string; specialty: string; patientsToday: number; utilization: number }>;
    workloadTrend: Array<{ date: string; avgPatients: number; utilization: number }>;
  };
  summary: {
    totalPatients: number;
    activePatients: number;
    newPatientsThisMonth: number;
    averageSatisfaction: number;
  };
}

interface CohortData {
  patients: Array<{
    id: string;
    age: number;
    gender: string;
    condition: string;
    treatment: string;
    outcomeScore: number;
    riskLevel: string;
  }>;
  stats: {
    totalPatients: number;
    averageAge: number;
    averageOutcomeScore: number;
    riskDistribution: { low: number; medium: number; high: number };
    genderDistribution: { male: number; female: number };
    conditionBreakdown: Array<{ condition: string; count: number }>;
    treatmentBreakdown: Array<{ treatment: string; count: number }>;
  };
  availableFilters: {
    conditions: string[];
    treatments: string[];
    ageRanges: string[];
    genders: string[];
  };
}

interface ReportType {
  id: string;
  name: string;
  description: string;
}

interface Report {
  id: string;
  type: string;
  title: string;
  generatedAt: string;
  dateRange: string;
  generatedBy: string;
  sections: Array<{
    title: string;
    metrics?: Array<{ label: string; value: string | number; trend: string }>;
    data?: Array<Record<string, string | number>>;
  }>;
}

const RISK_COLORS = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444"];

export default function ClinicalAnalyticsDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("kpis");
  const [cohortFilters, setCohortFilters] = useState({
    condition: "all",
    ageRange: "all",
    treatment: "all",
    gender: "all"
  });
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [generatedReport, setGeneratedReport] = useState<Report | null>(null);

  const { data: kpiData, isLoading: kpiLoading, error: kpiError } = useQuery<KPIData>({
    queryKey: ["/api/clinical-analytics/kpis"],
  });

  const { data: cohortData, isLoading: cohortLoading, error: cohortError } = useQuery<CohortData>({
    queryKey: ["/api/clinical-analytics/cohorts", cohortFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(cohortFilters).forEach(([key, value]) => {
        if (value !== "all") params.append(key, value);
      });
      const res = await fetch(`/api/clinical-analytics/cohorts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch cohort data");
      return res.json();
    },
  });

  const { data: reportTypes, error: reportTypesError } = useQuery<ReportType[]>({
    queryKey: ["/api/clinical-analytics/reports/types"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async (reportType: string) => {
      return apiRequest("POST", "/api/clinical-analytics/reports/generate", {
        reportType,
        dateRange: "last-30-days"
      });
    },
    onSuccess: async (response) => {
      const report = await response.json();
      setGeneratedReport(report);
      toast({
        title: "Report Generated",
        description: `${report.title} has been generated successfully.`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive"
      });
    }
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="clinical-analytics-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clinical Analytics Dashboard</h1>
          <p className="text-muted-foreground">Performance insights and cohort analysis for clinicians and administrators</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Analytics are for operational purposes only and do not constitute clinical decision support.</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3" data-testid="analytics-tabs">
          <TabsTrigger value="kpis" data-testid="tab-kpis">
            <BarChart3 className="h-4 w-4 mr-2" />
            KPI Dashboard
          </TabsTrigger>
          <TabsTrigger value="cohorts" data-testid="tab-cohorts">
            <Users className="h-4 w-4 mr-2" />
            Cohort Analysis
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kpis" className="space-y-6">
          {kpiLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : kpiError ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-destructive" data-testid="error-kpis">
                  <XCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>Failed to load KPI data</p>
                </div>
              </CardContent>
            </Card>
          ) : kpiData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-total-patients">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Patients</CardDescription>
                    <CardTitle className="text-3xl">{kpiData.summary.totalPatients.toLocaleString()}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{kpiData.summary.activePatients.toLocaleString()} active</span>
                    </div>
                    <Badge variant="outline" className="mt-2">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      +{kpiData.summary.newPatientsThisMonth} this month
                    </Badge>
                  </CardContent>
                </Card>

                <Card data-testid="card-no-show-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>No-Show Rate</CardDescription>
                    <CardTitle className="text-3xl">{kpiData.appointmentMetrics.noShowRate}%</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{kpiData.appointmentMetrics.noShows} of {kpiData.appointmentMetrics.totalScheduled}</span>
                    </div>
                    <Progress value={100 - kpiData.appointmentMetrics.noShowRate} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card data-testid="card-improvement-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Patient Improvement</CardDescription>
                    <CardTitle className="text-3xl">{kpiData.patientOutcomes.improvementRate}%</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Heart className="h-4 w-4" />
                      <span>{kpiData.patientOutcomes.improved} patients improved</span>
                    </div>
                    <Badge variant="outline" className="mt-2 text-green-600 border-green-600">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Positive trend
                    </Badge>
                  </CardContent>
                </Card>

                <Card data-testid="card-utilization">
                  <CardHeader className="pb-2">
                    <CardDescription>Clinician Utilization</CardDescription>
                    <CardTitle className="text-3xl">{kpiData.clinicianWorkload.utilizationRate}%</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Stethoscope className="h-4 w-4" />
                      <span>Avg {kpiData.clinicianWorkload.averagePatientsPerDay} pts/day</span>
                    </div>
                    <Progress value={kpiData.clinicianWorkload.utilizationRate} className="mt-2 h-2" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>No-Show Rate Trend</CardTitle>
                    <CardDescription>Daily appointment no-show rates over the past 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]" data-testid="chart-noshow-trend">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={kpiData.appointmentMetrics.noShowTrend.slice(-14)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={formatDate}
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            tick={{ fontSize: 12 }}
                            className="text-muted-foreground"
                            tickFormatter={(v) => `${v}%`}
                          />
                          <RechartsTooltip 
                            labelFormatter={formatDate}
                            formatter={(value: number) => [`${value}%`, "No-Show Rate"]}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="rate" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary) / 0.2)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Patient Outcomes Trend</CardTitle>
                    <CardDescription>Daily patient outcome distributions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]" data-testid="chart-outcomes-trend">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpiData.patientOutcomes.outcomeTrend.slice(-14)}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tickFormatter={formatDate}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <RechartsTooltip labelFormatter={formatDate} />
                          <Legend />
                          <Bar dataKey="improved" name="Improved" fill="#22c55e" stackId="a" />
                          <Bar dataKey="stable" name="Stable" fill="#eab308" stackId="a" />
                          <Bar dataKey="declined" name="Declined" fill="#ef4444" stackId="a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Clinician Workload</CardTitle>
                  <CardDescription>Current workload distribution across clinicians</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {kpiData.clinicianWorkload.workloadByClinic.map(clinician => (
                      <div 
                        key={clinician.clinicianId} 
                        className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                        data-testid={`clinician-${clinician.clinicianId}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Stethoscope className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{clinician.name}</p>
                            <p className="text-sm text-muted-foreground">{clinician.specialty}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="font-medium">{clinician.patientsToday} patients</p>
                            <p className="text-xs text-muted-foreground">today</p>
                          </div>
                          <div className="w-24">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>Utilization</span>
                              <span>{clinician.utilization}%</span>
                            </div>
                            <Progress value={clinician.utilization} className="h-2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Patient Cohort Analysis</CardTitle>
                  <CardDescription>Filter and analyze patient populations by various criteria</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select 
                    value={cohortFilters.condition} 
                    onValueChange={(v) => setCohortFilters(prev => ({ ...prev, condition: v }))}
                  >
                    <SelectTrigger className="w-[160px]" data-testid="select-condition">
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      {cohortData?.availableFilters.conditions.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={cohortFilters.ageRange} 
                    onValueChange={(v) => setCohortFilters(prev => ({ ...prev, ageRange: v }))}
                  >
                    <SelectTrigger className="w-[140px]" data-testid="select-age">
                      <SelectValue placeholder="Age Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ages</SelectItem>
                      {cohortData?.availableFilters.ageRanges.map(a => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={cohortFilters.treatment} 
                    onValueChange={(v) => setCohortFilters(prev => ({ ...prev, treatment: v }))}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-treatment">
                      <SelectValue placeholder="Treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Treatments</SelectItem>
                      {cohortData?.availableFilters.treatments.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={cohortFilters.gender} 
                    onValueChange={(v) => setCohortFilters(prev => ({ ...prev, gender: v }))}
                  >
                    <SelectTrigger className="w-[120px]" data-testid="select-gender">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      {cohortData?.availableFilters.genders.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCohortFilters({ condition: "all", ageRange: "all", treatment: "all", gender: "all" })}
                    data-testid="button-clear-filters"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {cohortLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : cohortError ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-destructive" data-testid="error-cohorts">
                  <XCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>Failed to load cohort data</p>
                </div>
              </CardContent>
            </Card>
          ) : cohortData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card data-testid="card-cohort-size">
                  <CardHeader className="pb-2">
                    <CardDescription>Cohort Size</CardDescription>
                    <CardTitle className="text-3xl">{cohortData.stats.totalPatients}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Average age: {cohortData.stats.averageAge} years
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-avg-outcome">
                  <CardHeader className="pb-2">
                    <CardDescription>Avg Outcome Score</CardDescription>
                    <CardTitle className="text-3xl">{cohortData.stats.averageOutcomeScore}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={cohortData.stats.averageOutcomeScore} className="h-2" />
                  </CardContent>
                </Card>

                <Card data-testid="card-risk-distribution">
                  <CardHeader className="pb-2">
                    <CardDescription>Risk Distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Badge className={RISK_COLORS.low}>Low: {cohortData.stats.riskDistribution.low}</Badge>
                      <Badge className={RISK_COLORS.medium}>Med: {cohortData.stats.riskDistribution.medium}</Badge>
                      <Badge className={RISK_COLORS.high}>High: {cohortData.stats.riskDistribution.high}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Level Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]" data-testid="chart-risk-pie">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={[
                              { name: "Low Risk", value: cohortData.stats.riskDistribution.low },
                              { name: "Medium Risk", value: cohortData.stats.riskDistribution.medium },
                              { name: "High Risk", value: cohortData.stats.riskDistribution.high }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {PIE_COLORS.map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Condition Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cohortData.stats.conditionBreakdown.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <PieChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No data for current filters</p>
                      </div>
                    ) : (
                      <div className="h-[250px]" data-testid="chart-conditions">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={cohortData.stats.conditionBreakdown} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="condition" type="category" width={120} tick={{ fontSize: 11 }} />
                            <RechartsTooltip />
                            <Bar dataKey="count" fill="hsl(var(--primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Patient List</CardTitle>
                  <CardDescription>Filtered cohort members</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {cohortData.patients.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No patients match current filters</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cohortData.patients.map(patient => (
                          <div 
                            key={patient.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                            data-testid={`patient-${patient.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium">Patient {patient.id}</p>
                                <p className="text-sm text-muted-foreground">
                                  {patient.age}y, {patient.gender} | {patient.condition}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm">{patient.treatment}</p>
                                <p className="text-xs text-muted-foreground">Treatment</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{patient.outcomeScore}</p>
                                <p className="text-xs text-muted-foreground">Score</p>
                              </div>
                              <Badge className={RISK_COLORS[patient.riskLevel as keyof typeof RISK_COLORS]}>
                                {patient.riskLevel}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-md border">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>Reports are for operational and administrative purposes only. They do not provide clinical decision support or constitute medical advice. Always consult qualified healthcare professionals for clinical decisions.</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Report</CardTitle>
                <CardDescription>Select a report type to generate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                  <SelectTrigger data-testid="select-report-type">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes?.map(rt => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedReportType && reportTypes && (
                  <p className="text-sm text-muted-foreground">
                    {reportTypes.find(rt => rt.id === selectedReportType)?.description}
                  </p>
                )}

                <Button 
                  onClick={() => selectedReportType && generateReportMutation.mutate(selectedReportType)}
                  disabled={!selectedReportType || generateReportMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-report"
                >
                  {generateReportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Report Types</CardTitle>
              </CardHeader>
              <CardContent>
                {reportTypesError ? (
                  <div className="text-center py-6 text-destructive" data-testid="error-report-types">
                    <XCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Failed to load report types</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {reportTypes?.map(rt => (
                    <div 
                      key={rt.id}
                      className="p-3 rounded-lg border hover-elevate cursor-pointer"
                      onClick={() => setSelectedReportType(rt.id)}
                      data-testid={`report-type-${rt.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium">{rt.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{rt.description}</p>
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
          </div>

          {generatedReport && (
            <Card data-testid="generated-report">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{generatedReport.title}</CardTitle>
                    <CardDescription>
                      Generated on {new Date(generatedReport.generatedAt).toLocaleString()} | {generatedReport.dateRange}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-download-report">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {generatedReport.sections.map((section, idx) => (
                  <div key={idx} className="space-y-4">
                    <h3 className="font-semibold text-lg">{section.title}</h3>
                    
                    {section.metrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {section.metrics.map((metric, midx) => (
                          <div key={midx} className="p-3 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground">{metric.label}</p>
                            <p className="text-xl font-bold">{metric.value}</p>
                            <Badge variant="outline" className={metric.trend.startsWith('+') ? "text-green-600" : metric.trend.startsWith('-') ? "text-red-600" : ""}>
                              {metric.trend}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {section.data && (
                      <ScrollArea className="max-h-[200px]">
                        <div className="space-y-2">
                          {section.data.map((row, ridx) => (
                            <div key={ridx} className="flex items-center justify-between p-2 rounded border text-sm">
                              {Object.entries(row).map(([key, val], kidx) => (
                                <span key={kidx} className={kidx === 0 ? "font-medium" : "text-muted-foreground"}>
                                  {val}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                ))}

                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 inline mr-1" />
                  This report is for administrative and operational analysis only. It does not provide clinical decision support or medical recommendations.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
