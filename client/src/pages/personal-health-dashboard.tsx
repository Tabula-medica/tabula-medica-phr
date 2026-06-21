import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  Heart,
  Activity,
  Pill,
  Target,
  Calendar,
  Beaker,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Droplet,
  Moon,
  Apple,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  RefreshCw,
  Settings,
  Share2,
  Download,
  Bell,
} from "lucide-react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { AIVisualizationInsights } from "@/components/ai-visualization-insights";
import { EducationRecommendationWidget } from "@/components/education-recommendation-widget";

interface VitalTrend {
  type: string;
  label: string;
  unit: string;
  current: number;
  target: number;
  status: "normal" | "attention" | "critical";
  trend: "improving" | "stable" | "declining";
  history: { date: string; value: number }[];
}

interface DashboardData {
  patientId: string;
  lastUpdated: string;
  healthScore: number;
  healthScoreTrend: "good" | "fair" | "needs_attention";
  healthFactors: {
    medicationAdherence: number;
    vitalStatus: number;
    goalsProgress: number;
    labNormalcy: number;
  };
  vitalTrends: VitalTrend[];
  medications: {
    active: number;
    total: number;
    adherenceRate: number;
    list: {
      id: string;
      name: string;
      dosage: string;
      frequency: string;
      nextDose: string;
    }[];
  };
  goals: {
    active: number;
    completed: number;
    list: {
      id: string;
      title: string;
      category: string;
      progress: number;
      target: number;
      unit: string;
      dueDate: string;
    }[];
  };
  labResults: {
    recent: number;
    abnormal: number;
    list: {
      id: string;
      testName: string;
      value: number;
      unit: string;
      referenceRange: string;
      isAbnormal: boolean;
      date: string;
    }[];
  };
  appointments: {
    upcoming: number;
    list: {
      id: string;
      title: string;
      provider: string;
      location: string;
      dateTime: string;
      type: string;
    }[];
  };
  wellnessMetrics: {
    category: string;
    score: number;
    target: number;
    unit: string;
    icon: string;
  }[];
  recentActivities: {
    type: string;
    description: string;
    timestamp: string;
    icon: string;
  }[];
  aiInsights: {
    type: string;
    title: string;
    message: string;
    priority: string;
  }[];
}

function HealthScoreCard({ score, trend, factors }: { 
  score: number; 
  trend: string;
  factors: DashboardData["healthFactors"];
}) {
  const scoreData = [{ name: "score", value: score, fill: score >= 75 ? "hsl(var(--primary))" : score >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }];
  
  return (
    <Card className="col-span-full md:col-span-1" data-testid="card-health-score">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Health Score
          </CardTitle>
          <Badge variant={trend === "good" ? "default" : trend === "fair" ? "secondary" : "destructive"}>
            {trend === "good" ? "Good" : trend === "fair" ? "Fair" : "Needs Attention"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="relative w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={scoreData} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={10} max={100} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold">{score}</span>
            </div>
          </div>
          <div className="flex-1 space-y-3 min-w-[200px]">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Medication Adherence</span>
                <span className="font-medium">{factors.medicationAdherence}%</span>
              </div>
              <Progress value={factors.medicationAdherence} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vital Signs</span>
                <span className="font-medium">{factors.vitalStatus}%</span>
              </div>
              <Progress value={factors.vitalStatus} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Goals Progress</span>
                <span className="font-medium">{factors.goalsProgress}%</span>
              </div>
              <Progress value={factors.goalsProgress} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VitalTrendCard({ vital }: { vital: VitalTrend }) {
  const TrendIcon = vital.trend === "improving" ? TrendingUp : vital.trend === "declining" ? TrendingDown : Minus;
  
  return (
    <Card data-testid={`card-vital-${vital.type}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium">{vital.label}</CardTitle>
          <Badge variant={vital.status === "normal" ? "secondary" : vital.status === "attention" ? "outline" : "destructive"}>
            <TrendIcon className="h-3 w-3 mr-1" />
            {vital.trend}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold">{vital.current}</span>
          <span className="text-sm text-muted-foreground">{vital.unit}</span>
          <span className="text-xs text-muted-foreground ml-auto">Target: {vital.target}</span>
        </div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={vital.history}>
              <defs>
                <linearGradient id={`gradient-${vital.type}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                fill={`url(#gradient-${vital.type})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationCard({ medications }: { medications: DashboardData["medications"] }) {
  return (
    <Card data-testid="card-medications">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-500" />
            Medications
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/medications">View All <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <CardDescription>{medications.active} active medications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Adherence Rate</span>
            <span className="text-sm font-medium">{medications.adherenceRate}%</span>
          </div>
          <Progress value={medications.adherenceRate} className="h-2" />
        </div>
        <ScrollArea className="h-40">
          <div className="space-y-3">
            {medications.list.map((med) => (
              <div key={med.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`medication-${med.id}`}>
                <div>
                  <p className="font-medium text-sm">{med.name}</p>
                  <p className="text-xs text-muted-foreground">{med.dosage} - {med.frequency}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {new Date(med.nextDose).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function GoalsCard({ goals }: { goals: DashboardData["goals"] }) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "weight": return <Activity className="h-4 w-4" />;
      case "exercise": return <Activity className="h-4 w-4" />;
      case "nutrition": return <Apple className="h-4 w-4" />;
      case "sleep": return <Moon className="h-4 w-4" />;
      case "mental_health": return <Brain className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <Card data-testid="card-goals">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            Health Goals
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/my-health-journey">View All <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <CardDescription>{goals.active} active, {goals.completed} completed</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-4">
            {goals.list.map((goal) => (
              <div key={goal.id} className="space-y-2" data-testid={`goal-${goal.id}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(goal.category)}
                    <span className="font-medium text-sm">{goal.title}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Target: {goal.target} {goal.unit}</span>
                  {goal.dueDate && <span>Due: {new Date(goal.dueDate).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AppointmentsCard({ appointments }: { appointments: DashboardData["appointments"] }) {
  return (
    <Card data-testid="card-appointments">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-500" />
            Upcoming Appointments
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/timeline">View All <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {appointments.list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming appointments</p>
        ) : (
          <div className="space-y-3">
            {appointments.list.slice(0, 3).map((apt) => (
              <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`appointment-${apt.id}`}>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{apt.title}</p>
                  <p className="text-xs text-muted-foreground">{apt.provider}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(apt.dateTime).toLocaleString([], { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">{apt.type}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabResultsCard({ labResults }: { labResults: DashboardData["labResults"] }) {
  return (
    <Card data-testid="card-lab-results">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-orange-500" />
            Recent Lab Results
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/documents">View All <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <CardDescription>
          {labResults.recent} recent results
          {labResults.abnormal > 0 && (
            <Badge variant="destructive" className="ml-2">{labResults.abnormal} abnormal</Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {labResults.list.slice(0, 4).map((lab) => (
            <div key={lab.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`lab-${lab.id}`}>
              <div>
                <p className="font-medium text-sm">{lab.testName}</p>
                <p className="text-xs text-muted-foreground">Ref: {lab.referenceRange}</p>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium ${lab.isAbnormal ? 'text-destructive' : ''}`}>
                  {lab.value} {lab.unit}
                </span>
                {lab.isAbnormal ? (
                  <AlertCircle className="h-4 w-4 text-destructive inline ml-1" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500 inline ml-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WellnessCard({ metrics }: { metrics: DashboardData["wellnessMetrics"] }) {
  const getIcon = (icon: string) => {
    switch (icon) {
      case "moon": return <Moon className="h-4 w-4" />;
      case "activity": return <Activity className="h-4 w-4" />;
      case "apple": return <Apple className="h-4 w-4" />;
      case "brain": return <Brain className="h-4 w-4" />;
      case "droplet": return <Droplet className="h-4 w-4" />;
      default: return <Heart className="h-4 w-4" />;
    }
  };

  return (
    <Card data-testid="card-wellness">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          Wellness Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {metrics.map((metric) => (
            <div key={metric.category} className="text-center p-3 rounded-lg bg-muted/50">
              <div className="flex justify-center mb-2 text-primary">
                {getIcon(metric.icon)}
              </div>
              <p className="text-xs text-muted-foreground mb-1">{metric.category}</p>
              <p className="text-lg font-bold">{metric.score}</p>
              <Progress value={(metric.score / metric.target) * 100} className="h-1 mt-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AIInsightsCard({ insights, vitalTrends }: { insights: DashboardData["aiInsights"]; vitalTrends?: DashboardData["vitalTrends"] }) {
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  
  const getInsightIcon = (type: string) => {
    switch (type) {
      case "positive": return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "reminder": return <Bell className="h-5 w-5 text-blue-500" />;
      case "suggestion": return <Sparkles className="h-5 w-5 text-yellow-500" />;
      case "warning": return <AlertCircle className="h-5 w-5 text-destructive" />;
      default: return <Brain className="h-5 w-5 text-primary" />;
    }
  };

  const primaryVital = vitalTrends?.[0];
  const dataPoints = primaryVital?.history.map(h => ({
    date: h.date,
    value: h.value,
    unit: primaryVital.unit
  })) || [];

  return (
    <Card data-testid="card-ai-insights">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Health Insights
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
            data-testid="btn-toggle-ai-analysis"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            {showAiAnalysis ? "Show Quick Insights" : "Deep Analysis"}
          </Button>
        </div>
        <CardDescription>Personalized recommendations for you</CardDescription>
      </CardHeader>
      <CardContent>
        {showAiAnalysis ? (
          primaryVital ? (
            <AIVisualizationInsights
              chartType="vital_trends"
              dataPoints={dataPoints}
              metricName={primaryVital.label}
              unit={primaryVital.unit}
              normalRange={{ min: primaryVital.target * 0.9, max: primaryVital.target * 1.1 }}
              compact={false}
              autoLoad={false}
            />
          ) : (
            <AIVisualizationInsights
              chartType="health_score"
              dataPoints={[]}
              metricName="Health Overview"
              compact={false}
              autoLoad={false}
            />
          )
        ) : (
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50" data-testid={`insight-${idx}`}>
                {getInsightIcon(insight.type)}
                <div className="flex-1">
                  <p className="font-medium text-sm">{insight.title}</p>
                  <p className="text-sm text-muted-foreground">{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({ activities }: { activities: DashboardData["recentActivities"] }) {
  const getActivityIcon = (icon: string) => {
    switch (icon) {
      case "pill": return <Pill className="h-4 w-4 text-blue-500" />;
      case "heart": return <Heart className="h-4 w-4 text-red-500" />;
      case "calendar": return <Calendar className="h-4 w-4 text-purple-500" />;
      case "target": return <Target className="h-4 w-4 text-green-500" />;
      case "flask": return <Beaker className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Card data-testid="card-recent-activity">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity, idx) => (
            <div key={idx} className="flex items-center gap-3" data-testid={`activity-${idx}`}>
              <div className="p-2 rounded-full bg-muted">
                {getActivityIcon(activity.icon)}
              </div>
              <div className="flex-1">
                <p className="text-sm">{activity.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(activity.timestamp).toLocaleString([], { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonalHealthDashboard() {
  useSEO({
    title: "Personal Health Dashboard - Tabula Medica",
    description: "View your comprehensive personal health dashboard with vitals, medications, goals, and AI insights.",
  });

  const [selectedTab, setSelectedTab] = useState("overview");

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["/api/personal-health/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6" data-testid="personal-health-dashboard-loading">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="p-4 md:p-6" data-testid="personal-health-dashboard-error">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to load dashboard</h3>
            <p className="text-muted-foreground mb-4">There was a problem loading your health dashboard.</p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="personal-health-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Heart className="h-7 w-7 text-primary" />
            My Health Dashboard
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="btn-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" data-testid="btn-share">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" data-testid="btn-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="ghost" size="icon" data-testid="btn-settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} data-testid="dashboard-tabs">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex" data-testid="dashboard-tabs-list">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
          <TabsTrigger value="wellness" data-testid="tab-wellness">Wellness</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6" data-testid="content-overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <HealthScoreCard 
              score={dashboardData.healthScore} 
              trend={dashboardData.healthScoreTrend}
              factors={dashboardData.healthFactors}
            />
            <MedicationCard medications={dashboardData.medications} />
            <GoalsCard goals={dashboardData.goals} />
            <AppointmentsCard appointments={dashboardData.appointments} />
            <LabResultsCard labResults={dashboardData.labResults} />
            <AIInsightsCard insights={dashboardData.aiInsights} vitalTrends={dashboardData.vitalTrends} />
            <EducationRecommendationWidget 
              patientId={dashboardData.patientId} 
              maxItems={3}
              showActions={true}
            />
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="mt-6" data-testid="content-vitals">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboardData.vitalTrends.map((vital) => (
              <VitalTrendCard key={vital.type} vital={vital} />
            ))}
          </div>
          <div className="mt-6">
            <RecentActivityCard activities={dashboardData.recentActivities} />
          </div>
        </TabsContent>

        <TabsContent value="wellness" className="mt-6" data-testid="content-wellness">
          <WellnessCard metrics={dashboardData.wellnessMetrics} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <AIInsightsCard insights={dashboardData.aiInsights} vitalTrends={dashboardData.vitalTrends} />
            <RecentActivityCard activities={dashboardData.recentActivities} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
