import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Treemap,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  Users,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  Shield,
  Calendar,
  Stethoscope,
  Heart,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Pill,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  Layers,
  Zap,
  MapPin,
} from "lucide-react";

interface PopulationHealthData {
  totalPatients: number;
  activePatients: number;
  newPatientsThisMonth: number;
  avgAge: number;
  genderDistribution: { gender: string; count: number }[];
  ageDistribution: { range: string; count: number }[];
  riskStratification: {
    level: string;
    count: number;
    percentage: number;
    trend: "up" | "down" | "stable";
  }[];
  topConditions: { condition: string; count: number; percentage: number }[];
  qualityMetrics: {
    metric: string;
    current: number;
    target: number;
    trend: "improving" | "declining" | "stable";
  }[];
  careGaps: {
    type: string;
    patientsAffected: number;
    urgency: "high" | "medium" | "low";
    description: string;
  }[];
  appointmentMetrics: {
    scheduled: number;
    completed: number;
    noShows: number;
    cancelled: number;
    avgWaitTime: number;
  };
  medicationMetrics: {
    totalPrescriptions: number;
    avgAdherence: number;
    highRiskPatients: number;
    interactionAlerts: number;
  };
  trendsOverTime: {
    date: string;
    patients: number;
    encounters: number;
    admissions: number;
    readmissions: number;
  }[];
  aiInsights: {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    predictedTrends: { metric: string; prediction: string; confidence: number }[];
  };
}

interface PatientRiskItem {
  patientId: string;
  patientName: string;
  age: number;
  riskScore: number;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  primaryConditions: string[];
  lastVisit: string;
  upcomingActions: string[];
  trend: "improving" | "stable" | "worsening";
}

const RISK_COLORS = {
  low: "#22c55e",
  moderate: "#eab308",
  elevated: "#f97316",
  high: "#ef4444",
};

const URGENCY_COLORS = {
  high: "bg-red-500/10 text-red-600 border-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-green-500/10 text-green-600 border-green-500/20",
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up" || trend === "improving") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === "down" || trend === "declining" || trend === "worsening") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, color = "text-primary" }: { title: string; value: string | number; subtitle: string; icon: typeof Users; trend?: "up" | "down" | "stable"; trendValue?: string; color?: string }) {
  return (
    <Card data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {trend && trendValue && (
            <Badge variant={trend === "up" ? "default" : trend === "down" ? "destructive" : "secondary"} className="text-xs">
              {trend === "up" ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3 mr-0.5" /> : null}
              {trendValue}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskDistributionChart({ data }: { data: PopulationHealthData["riskStratification"] }) {
  const chartData = data.map((r) => ({ name: r.level.charAt(0).toUpperCase() + r.level.slice(1), value: r.count, percentage: r.percentage }));

  return (
    <Card data-testid="card-risk-distribution">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5" />
          Patient Risk Stratification
        </CardTitle>
        <CardDescription>Distribution of patients by risk level</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percentage }) => `${name}: ${percentage}%`}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={RISK_COLORS[entry.name.toLowerCase() as keyof typeof RISK_COLORS] || "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {data.map((item) => (
              <div key={item.level} className="flex items-center justify-between" data-testid={`risk-level-${item.level}`}>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_COLORS[item.level as keyof typeof RISK_COLORS] }} />
                  <span className="text-sm font-medium capitalize">{item.level} Risk</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{item.count} patients</span>
                  <TrendIcon trend={item.trend} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QualityMetricsChart({ data }: { data: PopulationHealthData["qualityMetrics"] }) {
  const chartData = data.map((m) => ({ name: m.metric.slice(0, 20), current: m.current, target: m.target }));

  return (
    <Card data-testid="card-quality-metrics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-5 w-5" />
          Quality Metrics
        </CardTitle>
        <CardDescription>Performance against quality targets</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} />
              <Legend />
              <Bar dataKey="current" name="Current" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="target" name="Target" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {data.map((metric, i) => (
            <div key={i} className="flex items-center justify-between text-sm" data-testid={`metric-${i}`}>
              <span className="text-muted-foreground">{metric.metric}</span>
              <div className="flex items-center gap-2">
                <span className={metric.current >= metric.target ? "text-green-500" : "text-orange-500"}>{metric.current}%</span>
                <span className="text-muted-foreground">/ {metric.target}%</span>
                <TrendIcon trend={metric.trend} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CareGapsCard({ data }: { data: PopulationHealthData["careGaps"] }) {
  return (
    <Card data-testid="card-care-gaps">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Care Gaps
        </CardTitle>
        <CardDescription>Identified gaps requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {data.map((gap, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border" data-testid={`care-gap-${i}`}>
                <Badge className={URGENCY_COLORS[gap.urgency]}>{gap.urgency}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{gap.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">{gap.description}</p>
                  <p className="text-xs mt-2">
                    <span className="font-medium">{gap.patientsAffected}</span> patients affected
                  </p>
                </div>
                <Button variant="ghost" size="sm" data-testid={`view-gap-${i}`}>
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TrendsChart({ data }: { data: PopulationHealthData["trendsOverTime"] }) {
  return (
    <Card data-testid="card-trends">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5" />
          Population Trends
        </CardTitle>
        <CardDescription>Key metrics over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short" })} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} />
              <Legend />
              <Area type="monotone" dataKey="patients" name="Patients" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.2)" />
              <Area type="monotone" dataKey="encounters" name="Encounters" stroke="#22c55e" fill="rgba(34, 197, 94, 0.2)" />
              <Area type="monotone" dataKey="admissions" name="Admissions" stroke="#f97316" fill="rgba(249, 115, 22, 0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function HighRiskPatientsTable({ patients }: { patients: PatientRiskItem[] }) {
  return (
    <Card data-testid="card-high-risk-patients">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          High-Risk Patients
        </CardTitle>
        <CardDescription>Patients requiring immediate attention</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {patients.map((patient) => (
              <div key={patient.patientId} className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`patient-${patient.patientId}`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-medium text-primary">{patient.patientName.split(" ").map((n) => n[0]).join("")}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{patient.patientName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Age {patient.age}</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-muted-foreground">{patient.primaryConditions.slice(0, 2).join(", ")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge style={{ backgroundColor: `${RISK_COLORS[patient.riskLevel]}20`, color: RISK_COLORS[patient.riskLevel] }}>{patient.riskScore}%</Badge>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <TrendIcon trend={patient.trend} />
                      <span className="text-xs capitalize text-muted-foreground">{patient.trend}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AIPopulationInsights({ insights }: { insights: PopulationHealthData["aiInsights"] }) {
  return (
    <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/10" data-testid="card-ai-insights">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-violet-500" />
          AI Population Insights
        </CardTitle>
        <CardDescription>AI-powered analysis of your patient population</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-background/50 p-4 rounded-lg">
          <p className="text-sm" data-testid="text-ai-summary">{insights.summary}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Key Findings
          </h4>
          <ul className="space-y-1">
            {insights.keyFindings.map((finding, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                {finding}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Recommendations
          </h4>
          <ul className="space-y-1">
            {insights.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Predicted Trends</h4>
          <div className="space-y-2">
            {insights.predictedTrends.map((trend, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-background/50" data-testid={`predicted-trend-${i}`}>
                <span className="text-sm">{trend.metric}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{trend.prediction}</span>
                  <Badge variant="outline">{trend.confidence}% confidence</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConditionsTreemap({ data }: { data: PopulationHealthData["topConditions"] }) {
  const treeData = data.map((c, i) => ({ name: c.condition, size: c.count, percentage: c.percentage, fill: `hsl(${(i * 40) % 360}, 70%, 60%)` }));

  return (
    <Card data-testid="card-conditions">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-5 w-5" />
          Top Conditions
        </CardTitle>
        <CardDescription>Most common conditions in patient population</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap data={treeData} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill="hsl(var(--primary))">
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} formatter={(value, name, props) => [`${value} patients (${props.payload.percentage}%)`, props.payload.name]} />
            </Treemap>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.slice(0, 6).map((condition, i) => (
            <div key={i} className="flex items-center justify-between text-sm" data-testid={`condition-${i}`}>
              <span className="truncate">{condition.condition}</span>
              <Badge variant="secondary">{condition.percentage}%</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderAnalytics() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("30d");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: populationData, isLoading, refetch } = useQuery<PopulationHealthData>({
    queryKey: ["/api/analytics/population"],
  });

  const { data: highRiskPatients } = useQuery<PatientRiskItem[]>({
    queryKey: ["/api/analytics/high-risk-patients"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/analytics/generate-report", { dateRange });
    },
    onSuccess: () => {
      toast({ title: "Report Generated", description: "Your population health report is ready for download." });
    },
  });

  if (isLoading || !populationData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[350px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-provider-analytics">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Population Health Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive analytics for your patient population</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[130px]" data-testid="select-date-range">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => generateReportMutation.mutate()} disabled={generateReportMutation.isPending} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Patients" value={populationData.totalPatients.toLocaleString()} subtitle={`${populationData.activePatients} active`} icon={Users} trend="up" trendValue={`+${populationData.newPatientsThisMonth} this month`} />
        <StatCard title="Avg Age" value={populationData.avgAge} subtitle="years old" icon={Calendar} color="text-blue-500" />
        <StatCard title="Avg Adherence" value={`${populationData.medicationMetrics.avgAdherence}%`} subtitle={`${populationData.medicationMetrics.highRiskPatients} high-risk`} icon={Pill} trend={populationData.medicationMetrics.avgAdherence >= 80 ? "up" : "down"} trendValue={populationData.medicationMetrics.avgAdherence >= 80 ? "On target" : "Below target"} color="text-orange-500" />
        <StatCard title="Appointments" value={populationData.appointmentMetrics.scheduled} subtitle={`${populationData.appointmentMetrics.noShows} no-shows`} icon={Stethoscope} trend={populationData.appointmentMetrics.noShows < 5 ? "up" : "down"} trendValue={`${Math.round((populationData.appointmentMetrics.completed / populationData.appointmentMetrics.scheduled) * 100)}% completion`} color="text-pink-500" />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">Risk Stratification</TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="patients" data-testid="tab-patients">High-Risk Patients</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <TrendsChart data={populationData.trendsOverTime} />
            <ConditionsTreemap data={populationData.topConditions} />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <RiskDistributionChart data={populationData.riskStratification} />
            <CareGapsCard data={populationData.careGaps} />
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <RiskDistributionChart data={populationData.riskStratification} />
            <Card data-testid="card-age-distribution">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  Age Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={populationData.ageDistribution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <QualityMetricsChart data={populationData.qualityMetrics} />
          <CareGapsCard data={populationData.careGaps} />
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search-patients" />
            </div>
            <Button variant="outline" size="sm" data-testid="button-filter">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
          {highRiskPatients && <HighRiskPatientsTable patients={highRiskPatients.filter((p) => searchQuery === "" || p.patientName.toLowerCase().includes(searchQuery.toLowerCase()))} />}
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <AIPopulationInsights insights={populationData.aiInsights} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
