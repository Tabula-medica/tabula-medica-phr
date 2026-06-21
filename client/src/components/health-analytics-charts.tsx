import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  Activity,
  Pill,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Target,
  Brain,
  Shield,
  Beaker,
  Sparkles,
} from "lucide-react";

interface LabChartData {
  testName: string;
  dataPoints: { date: string; value: number; unit: string; status: string }[];
  latestValue: number;
  latestStatus: string;
  trend: "up" | "down" | "stable";
}

interface VitalChartData {
  type: string;
  displayName: string;
  dataPoints: { date: string; value: number; unit: string; systolic?: number; diastolic?: number }[];
  latestValue: number | null;
  unit: string;
}

interface MedicationAdherenceData {
  overallAdherenceRate: number;
  totalActiveMedications: number;
  totalActivePrescriptions: number;
  byCategory: { category: string; taken: number; missed: number; adherenceRate: number }[];
  weeklyTrend: { day: string; adherenceRate: number }[];
}

interface RiskDistribution {
  category: string;
  riskLevel: string;
  score: number;
  title: string;
}

interface AppointmentChartData {
  monthlyHistory: { month: string; total: number; attended: number; missed: number; cancelled: number }[];
  upcomingAppointments: { id: string; title: string; date: string; provider: string; type: string }[];
  totalScheduled: number;
}

interface AIInsightsSummary {
  overallHealthScore: number;
  primaryFocus: string;
  keyInsights: string[];
  actionableRecommendations: string[];
  positiveNotes: string[];
}

interface HealthAnalyticsChartsProps {
  labTrends: LabChartData[];
  vitalSigns: VitalChartData[];
  medicationAdherence: MedicationAdherenceData;
  riskDistribution: RiskDistribution[];
  appointmentHistory: AppointmentChartData;
  aiInsightsSummary: AIInsightsSummary;
  isLoading?: boolean;
}

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  elevated: "#f97316",
  high: "#ef4444",
};

const CATEGORY_ICONS: Record<string, typeof Heart> = {
  cardiovascular: Heart,
  diabetes: Activity,
  kidney: Beaker,
  liver: Beaker,
  respiratory: Activity,
  mental_health: Brain,
  medication_adherence: Pill,
  lifestyle: Target,
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function HealthScoreGauge({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative">
        <svg className="w-32 h-32 transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${(score / 100) * 352} 352`}
            className={getScoreColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge variant="secondary" className="mt-2">
        {getScoreLabel(score)}
      </Badge>
    </div>
  );
}

export function LabTrendsChart({ data }: { data: LabChartData[] }) {
  const [selectedTest, setSelectedTest] = useState(data[0]?.testName || "");

  if (data.length === 0) {
    return (
      <Card data-testid="card-lab-trends">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Beaker className="h-4 w-4" />
            Lab Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No lab data available</p>
        </CardContent>
      </Card>
    );
  }

  const selectedData = data.find(d => d.testName === selectedTest) || data[0];

  return (
    <Card data-testid="card-lab-trends">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Beaker className="h-4 w-4" />
          Lab Trends
        </CardTitle>
        <CardDescription>Track your lab results over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.slice(0, 5).map(lab => (
            <Button
              key={lab.testName}
              variant={selectedTest === lab.testName ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTest(lab.testName)}
              data-testid={`button-lab-${lab.testName.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {lab.testName}
              <TrendIcon trend={lab.trend} />
            </Button>
          ))}
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={selectedData.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="text-muted-foreground">Latest: {selectedData.latestValue} {selectedData.dataPoints[0]?.unit}</span>
          <Badge variant={selectedData.latestStatus === "normal" ? "secondary" : "destructive"}>
            {selectedData.latestStatus}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function VitalSignsChart({ data }: { data: VitalChartData[] }) {
  const [selectedVital, setSelectedVital] = useState(data[0]?.type || "");

  if (data.length === 0) {
    return (
      <Card data-testid="card-vital-signs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Activity className="h-4 w-4" />
            Vital Signs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">No vital sign data available</p>
        </CardContent>
      </Card>
    );
  }

  const selectedData = data.find(d => d.type === selectedVital) || data[0];

  return (
    <Card data-testid="card-vital-signs">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Activity className="h-4 w-4" />
          Vital Signs
        </CardTitle>
        <CardDescription>Monitor your vital measurements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.map(vital => (
            <Button
              key={vital.type}
              variant={selectedVital === vital.type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedVital(vital.type)}
              data-testid={`button-vital-${vital.type}`}
            >
              {vital.displayName}
            </Button>
          ))}
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={selectedData.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.2)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {selectedData.latestValue && (
          <div className="flex items-center justify-between mt-2 text-sm">
            <span className="text-muted-foreground">Latest: {selectedData.latestValue} {selectedData.unit}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MedicationAdherenceChart({ data }: { data: MedicationAdherenceData }) {
  return (
    <Card data-testid="card-medication-adherence">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Pill className="h-4 w-4" />
          Medication Adherence
        </CardTitle>
        <CardDescription>Track how well you're following your medication schedule</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-[120px]">
            <div className="text-3xl font-bold text-primary">{data.overallAdherenceRate}%</div>
            <p className="text-xs text-muted-foreground">Overall adherence</p>
          </div>
          <div className="flex-1 min-w-[120px]">
            <div className="text-xl font-semibold">{data.totalActiveMedications}</div>
            <p className="text-xs text-muted-foreground">Active medications</p>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Weekly Trend</p>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  formatter={(value) => [`${value}%`, "Adherence"]}
                />
                <Bar dataKey="adherenceRate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.byCategory.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">By Category</p>
            {data.byCategory.slice(0, 4).map((cat) => (
              <div key={cat.category} className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground capitalize flex-1 min-w-[80px]">{cat.category}</span>
                <Progress value={cat.adherenceRate} className="flex-1 min-w-[100px]" />
                <span className="text-xs font-medium w-10">{cat.adherenceRate}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskDistributionChart({ data }: { data: RiskDistribution[] }) {
  const chartData = data.map(r => ({
    name: r.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: r.score,
    riskLevel: r.riskLevel,
    title: r.title,
  }));

  return (
    <Card data-testid="card-risk-distribution">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Shield className="h-4 w-4" />
          Health Risk Overview
        </CardTitle>
        <CardDescription>Risk assessment across health categories</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No risk assessments available</p>
        ) : (
          <>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    formatter={(value, name, props) => [`${value}%`, props.payload.riskLevel]}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.riskLevel] || "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {Object.entries(RISK_COLORS).map(([level, color]) => (
                <div key={level} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs capitalize">{level}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AppointmentHistoryChart({ data }: { data: AppointmentChartData }) {
  return (
    <Card data-testid="card-appointment-history">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Calendar className="h-4 w-4" />
          Appointment History
        </CardTitle>
        <CardDescription>Track your appointment attendance</CardDescription>
      </CardHeader>
      <CardContent>
        {data.monthlyHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No appointment history available</p>
        ) : (
          <>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="attended" stackId="a" fill="#22c55e" name="Attended" />
                  <Bar dataKey="missed" stackId="a" fill="#ef4444" name="Missed" />
                  <Bar dataKey="cancelled" stackId="a" fill="#6b7280" name="Cancelled" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {data.upcomingAppointments.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Upcoming ({data.totalScheduled})</p>
                <div className="space-y-2">
                  {data.upcomingAppointments.slice(0, 3).map((apt) => (
                    <div key={apt.id} className="flex items-center gap-2 flex-wrap text-sm p-2 rounded-md bg-muted/50">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{apt.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(apt.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AIInsightsSummaryCard({ data }: { data: AIInsightsSummary }) {
  return (
    <Card data-testid="card-ai-insights-summary">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Health Insights
        </CardTitle>
        <CardDescription>Personalized analysis of your health data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[auto_1fr] gap-4">
          <HealthScoreGauge score={data.overallHealthScore} />
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Primary Focus</p>
              <p className="text-sm text-muted-foreground">{data.primaryFocus}</p>
            </div>
            
            {data.keyInsights.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Key Insights</p>
                <ul className="space-y-1">
                  {data.keyInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.actionableRecommendations.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recommendations</p>
                <ul className="space-y-1">
                  {data.actionableRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.positiveNotes.length > 0 && (
              <div className="bg-green-500/10 p-3 rounded-lg">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Positive Notes</p>
                {data.positiveNotes.map((note, i) => (
                  <p key={i} className="text-sm text-green-700 dark:text-green-300">{note}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HealthAnalyticsDashboard({ 
  labTrends, 
  vitalSigns, 
  medicationAdherence, 
  riskDistribution, 
  appointmentHistory,
  aiInsightsSummary,
  isLoading = false
}: HealthAnalyticsChartsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="health-analytics-dashboard">
      <AIInsightsSummaryCard data={aiInsightsSummary} />
      
      <Tabs defaultValue="labs" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="labs" data-testid="tab-labs">Labs</TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
          <TabsTrigger value="meds" data-testid="tab-meds">Medications</TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">Risks</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
        </TabsList>
        
        <TabsContent value="labs" className="mt-4">
          <LabTrendsChart data={labTrends} />
        </TabsContent>
        
        <TabsContent value="vitals" className="mt-4">
          <VitalSignsChart data={vitalSigns} />
        </TabsContent>
        
        <TabsContent value="meds" className="mt-4">
          <MedicationAdherenceChart data={medicationAdherence} />
        </TabsContent>
        
        <TabsContent value="risks" className="mt-4">
          <RiskDistributionChart data={riskDistribution} />
        </TabsContent>
        
        <TabsContent value="appointments" className="mt-4">
          <AppointmentHistoryChart data={appointmentHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default HealthAnalyticsDashboard;
