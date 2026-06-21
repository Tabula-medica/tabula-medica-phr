import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Heart,
  Pill,
  Stethoscope,
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  BarChart3,
  PieChartIcon,
  LineChartIcon,
  Gauge,
  Sparkles,
  Info,
} from "lucide-react";

const PATIENT_ID = "patient-1";

interface ChartRecommendation {
  id: string;
  chartType: "line" | "bar" | "pie" | "area" | "scatter" | "radar" | "gauge";
  title: string;
  description: string;
  dataSource: string;
  metrics: string[];
  priority: "high" | "medium" | "low";
  insight: string;
  reasoning: string;
}

interface VisualizationData {
  observations: {
    byCategory: { category: string; count: number; trend: string }[];
    vitalsTrend: { date: string; bloodPressureSystolic: number; bloodPressureDiastolic: number; heartRate: number; temperature: number; weight: number }[];
    labResults: { name: string; value: number; unit: string; status: string; date: string }[];
  };
  conditions: {
    byStatus: { status: string; count: number }[];
    byCategory: { category: string; count: number }[];
    timeline: { date: string; newConditions: number; resolvedConditions: number }[];
    list: { id: string; name: string; code: string; category: string; status: string; onsetDate: string; severity: string; relatedObservations: number }[];
  };
  medications: {
    byStatus: { status: string; count: number }[];
    adherence: { month: string; rate: number }[];
    interactions: { medication1: string; medication2: string; severity: string; description: string }[];
    list: { id: string; name: string; dosage: string; frequency: string; status: string; startDate: string; adherenceRate: number; refillsRemaining: number }[];
  };
  summary: {
    totalObservations: number;
    totalConditions: number;
    totalMedications: number;
    healthScore: number;
    riskLevel: "low" | "moderate" | "high";
    lastUpdated: string;
  };
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Resolved: "secondary",
  Inactive: "outline",
  active: "default",
  completed: "secondary",
  stopped: "destructive",
  normal: "default",
  borderline: "secondary",
  high: "destructive",
  low: "destructive",
};

const PRIORITY_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const CHART_ICONS: Record<string, typeof LineChartIcon> = {
  line: LineChartIcon,
  bar: BarChart3,
  pie: PieChartIcon,
  area: LineChartIcon,
  gauge: Gauge,
  scatter: Activity,
  radar: Activity,
};

export default function FhirInsightsDashboard() {

  const { data: vizData, isLoading: isLoadingData, refetch: refetchData } = useQuery<VisualizationData>({
    queryKey: ["/api/fhir-visualization/patient-data", PATIENT_ID],
  });

  const { data: recommendations, isLoading: isLoadingRecs, refetch: refetchRecs } = useQuery<ChartRecommendation[]>({
    queryKey: ["/api/fhir-visualization/ai-recommendations", PATIENT_ID],
  });

  const isLoading = isLoadingData || isLoadingRecs;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = vizData?.summary;
  const riskColor = summary?.riskLevel === "high" ? "text-red-500" : summary?.riskLevel === "moderate" ? "text-yellow-500" : "text-green-500";

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7" />
              FHIR Data Insights Dashboard
            </h1>
            <p className="text-muted-foreground">Interactive visualizations for Observations, Conditions, and Medications</p>
          </div>
          <Button onClick={() => { refetchData(); refetchRecs(); }} variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Health Score</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.healthScore || 0}/100</div>
              <Progress value={summary?.healthScore || 0} className="mt-2" />
              <p className={`text-xs mt-1 ${riskColor}`}>
                Risk Level: {summary?.riskLevel || "unknown"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Observations</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalObservations || 0}</div>
              <p className="text-xs text-muted-foreground">Across all categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Conditions</CardTitle>
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalConditions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {vizData?.conditions.list.filter(c => c.status === "active").length || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Medications</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalMedications || 0}</div>
              <p className="text-xs text-muted-foreground">
                {vizData?.medications.list.filter(m => m.status === "active").length || 0} active
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList data-testid="tabs-visualization">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="observations" data-testid="tab-observations">Observations</TabsTrigger>
            <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
            <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
            <TabsTrigger value="ai-insights" data-testid="tab-ai-insights">
              <Sparkles className="h-4 w-4 mr-1" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab vizData={vizData} />
          </TabsContent>

          <TabsContent value="observations" className="space-y-4">
            <ObservationsTab vizData={vizData} />
          </TabsContent>

          <TabsContent value="conditions" className="space-y-4">
            <ConditionsTab vizData={vizData} />
          </TabsContent>

          <TabsContent value="medications" className="space-y-4">
            <MedicationsTab vizData={vizData} />
          </TabsContent>

          <TabsContent value="ai-insights" className="space-y-4">
            <AIInsightsTab recommendations={recommendations} />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

function OverviewTab({ vizData }: { vizData?: VisualizationData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Vital Signs Trend
          </CardTitle>
          <CardDescription>Blood pressure and heart rate over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vizData?.observations.vitalsTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="bloodPressureSystolic" stroke="hsl(var(--chart-1))" name="Systolic" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bloodPressureDiastolic" stroke="hsl(var(--chart-2))" name="Diastolic" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="heartRate" stroke="hsl(var(--chart-3))" name="Heart Rate" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Observations by Category
          </CardTitle>
          <CardDescription>Distribution of health observations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vizData?.observations.byCategory || []}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ category, count }) => `${category}: ${count}`}
                >
                  {(vizData?.observations.byCategory || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Conditions by Category
          </CardTitle>
          <CardDescription>Health conditions organized by type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vizData?.conditions.byCategory || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="category" type="category" width={100} className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Medication Adherence
          </CardTitle>
          <CardDescription>Monthly medication compliance rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vizData?.medications.adherence || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(value) => [`${value}%`, "Adherence"]} />
                <ReferenceLine y={80} stroke="hsl(var(--chart-2))" strokeDasharray="3 3" label={{ value: "Target 80%", position: "right", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Area type="monotone" dataKey="rate" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ObservationsTab({ vizData }: { vizData?: VisualizationData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Vital Signs Trend</CardTitle>
            <CardDescription>Track changes over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vizData?.observations.vitalsTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="bloodPressureSystolic" stroke="hsl(var(--chart-1))" name="Systolic" strokeWidth={2} />
                  <Line type="monotone" dataKey="bloodPressureDiastolic" stroke="hsl(var(--chart-2))" name="Diastolic" strokeWidth={2} />
                  <Line type="monotone" dataKey="heartRate" stroke="hsl(var(--chart-3))" name="Heart Rate" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lab Results</CardTitle>
            <CardDescription>Recent laboratory test results</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-lab-results">
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(vizData?.observations.labResults || []).slice(0, 6).map((lab, i) => (
                  <TableRow key={i} data-testid={`row-lab-result-${i}`}>
                    <TableCell className="font-medium">{lab.name}</TableCell>
                    <TableCell>{lab.value} {lab.unit}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[lab.status] || "outline"}>{lab.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lab.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Observations by Category</CardTitle>
          <CardDescription>Distribution and trends across observation types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vizData?.observations.byCategory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="category" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                  {(vizData?.observations.byCategory || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConditionsTab({ vizData }: { vizData?: VisualizationData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Conditions by Status</CardTitle>
            <CardDescription>Active, resolved, and inactive conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vizData?.conditions.byStatus || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    label
                  >
                    {(vizData?.conditions.byStatus || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condition Timeline</CardTitle>
            <CardDescription>New vs resolved conditions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vizData?.conditions.timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="newConditions" fill="hsl(var(--chart-1))" name="New" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolvedConditions" fill="hsl(var(--chart-2))" name="Resolved" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Conditions</CardTitle>
          <CardDescription>Current health conditions requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="table-conditions-list">
            <TableHeader>
              <TableRow>
                <TableHead>Condition</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Onset Date</TableHead>
                <TableHead>Related Observations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vizData?.conditions.list || []).map((condition) => (
                <TableRow key={condition.id} data-testid={`row-condition-${condition.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{condition.name}</div>
                      <div className="text-xs text-muted-foreground">{condition.code}</div>
                    </div>
                  </TableCell>
                  <TableCell>{condition.category}</TableCell>
                  <TableCell>
                    <Badge variant={condition.severity === "severe" ? "destructive" : condition.severity === "moderate" ? "default" : "secondary"}>
                      {condition.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{condition.onsetDate}</TableCell>
                  <TableCell>{condition.relatedObservations}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MedicationsTab({ vizData }: { vizData?: VisualizationData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Medications by Status</CardTitle>
            <CardDescription>Active, completed, and stopped medications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vizData?.medications.byStatus || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    label
                  >
                    {(vizData?.medications.byStatus || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medication Adherence Trend</CardTitle>
            <CardDescription>Monthly compliance rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={vizData?.medications.adherence || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(value) => [`${value}%`, "Adherence"]} />
                  <ReferenceLine y={80} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="rate" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {vizData?.medications.interactions && vizData.medications.interactions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Medication Interactions Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {vizData.medications.interactions.map((interaction, i) => (
                <li key={i}>
                  <strong>{interaction.medication1}</strong> + <strong>{interaction.medication2}</strong>: {interaction.description}
                  <Badge variant={interaction.severity === "high" ? "destructive" : "secondary"} className="ml-2">{interaction.severity}</Badge>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active Medications</CardTitle>
          <CardDescription>Current medication regimen with adherence tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="table-medications-list">
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Dosage</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Adherence</TableHead>
                <TableHead>Refills</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vizData?.medications.list || []).filter(m => m.status === "active").map((med) => (
                <TableRow key={med.id} data-testid={`row-medication-${med.id}`}>
                  <TableCell className="font-medium">{med.name}</TableCell>
                  <TableCell>{med.dosage}</TableCell>
                  <TableCell>{med.frequency}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={med.adherenceRate} className="w-16 h-2" />
                      <span className="text-sm">{med.adherenceRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={med.refillsRemaining <= 1 ? "destructive" : "outline"}>
                      {med.refillsRemaining} left
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AIInsightsTab({ recommendations }: { recommendations?: ChartRecommendation[] }) {
  return (
    <div className="space-y-4">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>AI-Powered Visualization Suggestions</AlertTitle>
        <AlertDescription>
          Based on your health data patterns, our AI recommends the following visualizations to help you understand your health better. 
          <span className="text-muted-foreground block mt-1 text-xs">
            Note: These suggestions are for informational purposes only and do not constitute medical advice.
          </span>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(recommendations || []).map((rec) => {
          const ChartIcon = CHART_ICONS[rec.chartType] || BarChart3;
          return (
            <Card key={rec.id} className="hover-elevate">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={PRIORITY_COLORS[rec.priority]}>{rec.priority} priority</Badge>
                  <ChartIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg mt-2">{rec.title}</CardTitle>
                <CardDescription>{rec.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Key Insight
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.insight}</p>
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-1">
                    <Info className="h-4 w-4" />
                    Why This Chart?
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{rec.chartType}</Badge>
                  <Badge variant="outline">{rec.dataSource}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(!recommendations || recommendations.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No AI recommendations available at this time.</p>
            <p className="text-sm">Check back after more health data has been recorded.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
