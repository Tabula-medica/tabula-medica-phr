import { useState } from "react";
import { CDSAlertsPanel } from "@/components/cds-alerts-panel";
import { AIFHIRInsightsPanel } from "@/components/ai-fhir-insights-panel";
import { AIProviderAutomationPanel } from "@/components/ai-provider-automation-panel";
import {
  MedicationAdherenceChart,
  MedicationTimelineChart,
  ConditionProgressionChart,
  EncounterFrequencyChart,
  VitalsLabChart,
  TimeframeFilter,
} from "@/components/enhanced-fhir-charts";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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
  ResponsiveContainer,
  Legend,
  Tooltip,
  ComposedChart,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Heart,
  Info,
  Pill,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  Users,
  FileText,
  Clock,
  Building,
} from "lucide-react";

const PATIENT_ID = "patient-001";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "hsl(var(--accent))",
  muted: "hsl(var(--muted))",
  destructive: "hsl(var(--destructive))",
  chart1: "#3b82f6",
  chart2: "#10b981",
  chart3: "#f59e0b",
  chart4: "#ef4444",
  chart5: "#8b5cf6",
  chart6: "#06b6d4",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

interface MedicationChartData {
  timeline: {
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
    status: string;
    category: string;
    adherenceRate?: number;
  }[];
  adherenceTrend: { date: string; value: number }[];
  categoryDistribution: { category: string; count: number; percentage: number }[];
  activeCount: number;
  totalPrescribed: number;
  averageAdherence: number;
  refillsNeeded: number;
  disclaimer: string;
}

interface ConditionChartData {
  conditions: {
    id: string;
    name: string;
    category: string;
    clinicalStatus: string;
    severity?: string;
    onsetDate?: string;
    progression: { date: string; status: string; note?: string }[];
  }[];
  severityDistribution: { severity: string; count: number }[];
  categoryBreakdown: { category: string; active: number; resolved: number }[];
  onsetTimeline: { date: string; value: number; label: string }[];
  activeConditions: number;
  resolvedConditions: number;
  chronicConditions: number;
  disclaimer: string;
}

interface EncounterChartData {
  encounters: {
    id: string;
    type: string;
    class: string;
    status: string;
    date: string;
    duration?: number;
    provider?: string;
    facility?: string;
    reason?: string;
  }[];
  frequencyByMonth: { date: string; value: number }[];
  typeDistribution: { type: string; count: number; percentage: number }[];
  providerBreakdown: { provider: string; encounters: number }[];
  averageDuration: number;
  totalEncounters: number;
  emergencyVisits: number;
  plannedVisits: number;
  disclaimer: string;
}

interface HealthTrendData {
  vitals: {
    bloodPressure: { date: string; value: number; metadata?: { diastolic: number } }[];
    heartRate: { date: string; value: number }[];
    weight: { date: string; value: number }[];
    temperature: { date: string; value: number }[];
  };
  labs: {
    glucose: { date: string; value: number }[];
    a1c: { date: string; value: number }[];
    cholesterol: { date: string; value: number }[];
    creatinine: { date: string; value: number }[];
  };
  disclaimer: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function FhirLongitudinalDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboardMode, setDashboardMode] = useState<"provider" | "patient">("provider");

  const { data: medicationData, isLoading: medLoading } = useQuery<MedicationChartData>({
    queryKey: ["/api/fhir-charts/medications", PATIENT_ID],
    queryFn: () => fetch(`/api/fhir-charts/medications/${PATIENT_ID}`).then((res) => res.json()),
  });

  const { data: conditionData, isLoading: condLoading } = useQuery<ConditionChartData>({
    queryKey: ["/api/fhir-charts/conditions", PATIENT_ID],
    queryFn: () => fetch(`/api/fhir-charts/conditions/${PATIENT_ID}`).then((res) => res.json()),
  });

  const { data: encounterData, isLoading: encLoading } = useQuery<EncounterChartData>({
    queryKey: ["/api/fhir-charts/encounters", PATIENT_ID],
    queryFn: () => fetch(`/api/fhir-charts/encounters/${PATIENT_ID}`).then((res) => res.json()),
  });

  const { data: healthTrends, isLoading: trendsLoading } = useQuery<HealthTrendData>({
    queryKey: ["/api/fhir-charts/health-trends", PATIENT_ID],
    queryFn: () => fetch(`/api/fhir-charts/health-trends/${PATIENT_ID}`).then((res) => res.json()),
  });

  const isLoading = medLoading || condLoading || encLoading || trendsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4" data-testid="loading-state">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const bpChartData = healthTrends?.vitals.bloodPressure.map((bp) => ({
    date: formatMonth(bp.date),
    systolic: bp.value,
    diastolic: bp.metadata?.diastolic || 80,
  })) || [];

  const heartRateData = healthTrends?.vitals.heartRate.map((hr) => ({
    date: formatMonth(hr.date),
    value: hr.value,
  })) || [];

  const weightData = healthTrends?.vitals.weight.map((w) => ({
    date: formatMonth(w.date),
    value: w.value,
  })) || [];

  const labsData = healthTrends?.labs.glucose.map((g, i) => ({
    date: formatMonth(g.date),
    glucose: g.value,
    a1c: healthTrends.labs.a1c[i]?.value || 0,
    cholesterol: healthTrends.labs.cholesterol[i]?.value || 0,
  })) || [];

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="fhir-longitudinal-dashboard">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800" data-testid="alert-disclaimer">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Informational Purposes Only</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          {medicationData?.disclaimer || "These visualizations are for informational purposes only and do not constitute medical advice."}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-dashboard">
            <TrendingUp className="w-8 h-8 text-primary" />
            FHIR Longitudinal Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Interactive health data visualizations over time</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={dashboardMode} onValueChange={(v) => setDashboardMode(v as "provider" | "patient")}>
            <SelectTrigger className="w-40" data-testid="select-dashboard-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provider">Provider View</SelectItem>
              <SelectItem value="patient">Patient View</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-medications">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Pill className="w-4 h-4" /> Medications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medicationData?.activeCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {medicationData?.averageAdherence || 0}% avg adherence
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-conditions">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Activity className="w-4 h-4" /> Conditions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conditionData?.activeConditions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {conditionData?.chronicConditions || 0} chronic
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-encounters">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Encounters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{encounterData?.totalEncounters || 0}</div>
            <p className="text-xs text-muted-foreground">
              {encounterData?.plannedVisits || 0} upcoming
            </p>
          </CardContent>
        </Card>

        <Card data-testid="stat-avg-duration">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> Avg Visit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{encounterData?.averageDuration || 0} min</div>
            <p className="text-xs text-muted-foreground">
              {encounterData?.emergencyVisits || 0} emergency visits
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-dashboard">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
          <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
          <TabsTrigger value="encounters" data-testid="tab-encounters">Encounters</TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals & Labs</TabsTrigger>
          <TabsTrigger value="ai-automation" data-testid="tab-ai-automation">AI Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4" data-testid="content-overview">
          {dashboardMode === "provider" && (
            <CDSAlertsPanel
              patientId={PATIENT_ID}
              hookType="patient-view"
              medications={medicationData?.timeline.map(m => ({ id: m.id, code: m.name, display: m.name, status: m.status })) || []}
              conditions={conditionData?.conditions.map(c => ({ id: c.id, code: c.name, display: c.name, clinicalStatus: c.clinicalStatus })) || []}
              labResults={[{ id: "glucose-1", code: "glucose", display: "Glucose", value: 105, unit: "mg/dL", effectiveDate: new Date().toISOString() }]}
              autoRefresh={false}
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Blood Pressure Trend
                </CardTitle>
                <CardDescription>Systolic and diastolic over 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Blood pressure trend chart showing systolic and diastolic values over 12 months">
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={bpChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[60, 160]} className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Area type="monotone" dataKey="systolic" name="Systolic" fill={CHART_COLORS.chart1} fillOpacity={0.3} stroke={CHART_COLORS.chart1} strokeWidth={2} />
                      <Area type="monotone" dataKey="diastolic" name="Diastolic" fill={CHART_COLORS.chart2} fillOpacity={0.3} stroke={CHART_COLORS.chart2} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="w-5 h-5 text-blue-500" />
                  Medication Adherence
                </CardTitle>
                <CardDescription>Monthly adherence rate percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Medication adherence trend chart showing monthly adherence percentage">
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={medicationData?.adherenceTrend.map((t) => ({ date: formatMonth(t.date), value: t.value })) || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={[0, 100]} className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Area type="monotone" dataKey="value" name="Adherence %" fill={CHART_COLORS.chart2} fillOpacity={0.4} stroke={CHART_COLORS.chart2} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  Encounter Frequency
                </CardTitle>
                <CardDescription>Healthcare visits by month</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Encounter frequency bar chart showing healthcare visits by month">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={encounterData?.frequencyByMonth.map((f) => ({ date: formatMonth(f.date), value: f.value })) || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="value" name="Encounters" fill={CHART_COLORS.chart5} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  Conditions by Category
                </CardTitle>
                <CardDescription>Active vs resolved by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Conditions by category chart showing active versus resolved conditions">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={conditionData?.categoryBreakdown || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="category" type="category" className="text-xs" width={100} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar dataKey="active" name="Active" fill={CHART_COLORS.chart1} stackId="a" />
                      <Bar dataKey="resolved" name="Resolved" fill={CHART_COLORS.chart2} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4 mt-4" data-testid="content-medications">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MedicationAdherenceChart
              data={medicationData?.adherenceTrend || []}
              height={300}
              showBrush={dashboardMode === "provider"}
              viewMode={dashboardMode}
            />
            <MedicationTimelineChart
              medications={medicationData?.timeline || []}
              height={300}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card data-testid="chart-medication-category">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="w-5 h-5" />
                  Category Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Pie chart showing medication distribution by therapeutic category">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={medicationData?.categoryDistribution || []}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percentage }) => `${category}: ${percentage}%`}
                        labelLine={false}
                      >
                        {medicationData?.categoryDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Medication Details</CardTitle>
                <CardDescription>Active and historical medications with adherence rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {medicationData?.timeline.map((med) => (
                    <div key={med.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate" data-testid={`med-${med.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${med.status === "active" ? "bg-green-500" : med.status === "completed" ? "bg-blue-500" : "bg-gray-400"}`} />
                        <div>
                          <p className="font-medium">{med.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {med.category} | Started {formatDate(med.startDate)}
                            {med.endDate && ` - Ended ${formatDate(med.endDate)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={med.status === "active" ? "default" : "secondary"}>{med.status}</Badge>
                        {med.adherenceRate !== undefined && (
                          <Badge variant="outline">{med.adherenceRate}% adherence</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <AIFHIRInsightsPanel
              patientId={PATIENT_ID}
              dataType="medications"
              data={medicationData?.timeline.map(m => ({ id: m.id, name: m.name, status: m.status })) || []}
              viewMode={dashboardMode}
              title="Medications"
            />
          </Card>
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4 mt-4" data-testid="content-conditions">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConditionProgressionChart
              conditions={conditionData?.conditions || []}
              height={300}
            />
            <Card data-testid="chart-condition-severity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Severity Distribution
                </CardTitle>
                <CardDescription>Conditions grouped by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Pie chart showing distribution of conditions by severity level">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={conditionData?.severityDistribution || []}
                        dataKey="count"
                        nameKey="severity"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ severity, count }) => `${severity}: ${count}`}
                      >
                        {conditionData?.severityDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Condition History & Details</CardTitle>
              <CardDescription>Detailed condition tracking with clinical status and notes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {conditionData?.conditions.map((cond) => (
                  <div key={cond.id} className="p-4 rounded-lg border hover-elevate" data-testid={`condition-${cond.id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{cond.name}</h4>
                        <p className="text-sm text-muted-foreground">{cond.category} | Onset: {cond.onsetDate ? formatDate(cond.onsetDate) : "Unknown"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={cond.clinicalStatus === "active" ? "default" : "secondary"}>{cond.clinicalStatus}</Badge>
                        {cond.severity && <Badge variant="outline">{cond.severity}</Badge>}
                      </div>
                    </div>
                    {cond.progression.length > 0 && (
                      <div className="ml-4 border-l-2 border-muted pl-4 space-y-2">
                        {cond.progression.slice(-3).map((prog, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">{formatDate(prog.date)}</span>
                            <span className="mx-2">-</span>
                            <Badge variant="outline" className="text-xs">{prog.status}</Badge>
                            {prog.note && <p className="text-muted-foreground mt-1">{prog.note}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <AIFHIRInsightsPanel
              patientId={PATIENT_ID}
              dataType="conditions"
              data={conditionData?.conditions.map(c => ({ id: c.id, name: c.name, status: c.clinicalStatus })) || []}
              viewMode={dashboardMode}
              title="Conditions"
            />
          </Card>
        </TabsContent>

        <TabsContent value="encounters" className="space-y-4 mt-4" data-testid="content-encounters">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EncounterFrequencyChart
              data={encounterData?.frequencyByMonth || []}
              height={300}
            />
            <Card data-testid="chart-encounter-types">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5" />
                  Encounter Types
                </CardTitle>
                <CardDescription>Distribution of visit types</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Pie chart showing breakdown of encounter types">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={encounterData?.typeDistribution || []}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ type, percentage }) => `${percentage}%`}
                      >
                        {encounterData?.typeDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-provider-activity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Provider Activity
                </CardTitle>
                <CardDescription>Encounters by healthcare provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Horizontal bar chart showing number of encounters per healthcare provider">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={encounterData?.providerBreakdown || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="provider" type="category" className="text-xs" width={150} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Bar dataKey="encounters" name="Encounters" fill={CHART_COLORS.chart6} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent & Upcoming Encounters</CardTitle>
                <CardDescription>Your latest healthcare visits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[250px] overflow-y-auto">
                  {encounterData?.encounters.slice(0, 6).map((enc) => (
                    <div key={enc.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate" data-testid={`encounter-${enc.id}`}>
                      <div className="flex items-center gap-3">
                        <Building className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{enc.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {enc.provider} | {enc.facility}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <div>
                          <p className="text-sm font-medium">{formatDate(enc.date)}</p>
                          {enc.duration && <p className="text-xs text-muted-foreground">{enc.duration} min</p>}
                        </div>
                        <Badge variant={enc.status === "planned" ? "default" : enc.class === "emergency" ? "destructive" : "secondary"}>
                          {enc.status === "planned" ? "Upcoming" : enc.class}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <AIFHIRInsightsPanel
              patientId={PATIENT_ID}
              dataType="encounters"
              data={encounterData?.encounters.map(e => ({ id: e.id, type: e.type, date: e.date, status: e.status })) || []}
              viewMode={dashboardMode}
              title="Encounters"
            />
          </Card>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-4 mt-4" data-testid="content-vitals">
          <VitalsLabChart
            vitalsData={{
              bloodPressure: healthTrends?.vitals.bloodPressure || [],
              heartRate: healthTrends?.vitals.heartRate || [],
              weight: healthTrends?.vitals.weight || [],
            }}
            labsData={{
              glucose: healthTrends?.labs.glucose || [],
              a1c: healthTrends?.labs.a1c || [],
              cholesterol: healthTrends?.labs.cholesterol || [],
            }}
            height={350}
            viewMode={dashboardMode}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="chart-lab-results">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  Lab Results Comparison
                </CardTitle>
                <CardDescription>Glucose, A1c, and Cholesterol side by side</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Combined chart showing glucose, cholesterol bars and A1c percentage line over quarterly intervals">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={labsData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" domain={[5, 10]} className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="glucose" name="Glucose (mg/dL)" fill={CHART_COLORS.chart3} />
                      <Bar yAxisId="left" dataKey="cholesterol" name="Cholesterol" fill={CHART_COLORS.chart5} />
                      <Line yAxisId="right" type="monotone" dataKey="a1c" name="A1c %" stroke={CHART_COLORS.chart4} strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="chart-weight-tracking">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Weight Tracking
                </CardTitle>
                <CardDescription>Body weight trend over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="Line chart showing body weight in pounds over 12 months">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={weightData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis domain={["dataMin - 5", "dataMax + 5"]} className="text-xs" />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="value" name="Weight (lbs)" stroke={CHART_COLORS.chart2} strokeWidth={2} dot={{ fill: CHART_COLORS.chart2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <AIFHIRInsightsPanel
              patientId={PATIENT_ID}
              dataType="labs"
              data={labsData.map((l, i) => ({ id: `lab-${i}`, name: 'Lab Panel', value: l.glucose, unit: 'mg/dL', date: l.date, abnormal: l.glucose > 125 || l.glucose < 70 }))}
              viewMode={dashboardMode}
              title="Vitals & Labs"
              showDisclaimer={true}
            />
          </Card>
        </TabsContent>

        <TabsContent value="ai-automation" className="space-y-4 mt-4" data-testid="content-ai-automation">
          {dashboardMode === "provider" ? (
            <AIProviderAutomationPanel
              patientId={PATIENT_ID}
              patientData={{
                demographics: {
                  id: PATIENT_ID,
                  name: "John Smith",
                  dateOfBirth: "1960-05-15",
                  gender: "Male",
                  age: 64,
                },
                medications: medicationData?.timeline.map(m => ({
                  name: m.name,
                  dosage: "As prescribed",
                  frequency: "Daily",
                  status: m.status,
                })) || [],
                conditions: conditionData?.conditions.map(c => ({
                  name: c.name,
                  code: c.id,
                  status: c.clinicalStatus,
                  severity: c.severity,
                  onsetDate: c.onsetDate,
                })) || [],
                encounters: encounterData?.encounters.map(e => ({
                  type: e.type,
                  date: e.date,
                  reason: e.reason,
                })) || [],
                allergies: [],
                vitals: (healthTrends?.vitals.bloodPressure || []).slice(-5).map(v => ({
                  type: "Blood Pressure",
                  value: v.value,
                  unit: "mmHg",
                  date: v.date,
                })),
                labResults: labsData.slice(-5).map(l => ({
                  name: "Glucose",
                  value: l.glucose,
                  unit: "mg/dL",
                  date: l.date,
                  abnormal: l.glucose > 125 || l.glucose < 70,
                })),
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-medium">Provider Feature</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  AI Provider Automation is only available in provider view mode.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
