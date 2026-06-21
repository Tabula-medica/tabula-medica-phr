import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "recharts";
import {
  Settings,
  LayoutGrid,
  Activity,
  Heart,
  Pill,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  Shield,
  Sparkles,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  ChevronRight,
  Beaker,
  Stethoscope,
  Thermometer,
  Droplets,
  Scale,
  Clock,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";

interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: typeof Heart;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
}

interface DashboardData {
  healthScore: number;
  healthScoreTrend: "improving" | "stable" | "declining";
  vitalTrends: {
    type: string;
    displayName: string;
    latestValue: number;
    unit: string;
    trend: "up" | "down" | "stable";
    isNormal: boolean;
    dataPoints: { date: string; value: number }[];
  }[];
  labResults: {
    testName: string;
    latestValue: number;
    unit: string;
    status: "normal" | "low" | "high" | "critical";
    trend: "up" | "down" | "stable";
    dataPoints: { date: string; value: number }[];
  }[];
  medicationAdherence: {
    overall: number;
    medications: {
      name: string;
      adherence: number;
      lastTaken: string;
      nextDue: string;
    }[];
  };
  riskAssessments: {
    category: string;
    score: number;
    level: "low" | "moderate" | "elevated" | "high";
    trend: "improving" | "stable" | "worsening";
    factors: string[];
  }[];
  appointments: {
    upcoming: { id: string; title: string; date: string; provider: string; type: string }[];
    missed: number;
    attended: number;
  };
  aiInsights: {
    summary: string;
    recommendations: string[];
    alerts: { severity: string; message: string }[];
    predictedRisks: { condition: string; probability: number; timeframe: string }[];
  };
}

const WIDGET_DEFINITIONS: Omit<WidgetConfig, "enabled" | "order">[] = [
  { id: "health-score", type: "health-score", title: "Health Score", description: "Overall health score and trend", icon: Heart, size: "medium" },
  { id: "vital-signs", type: "vital-signs", title: "Vital Signs", description: "Track blood pressure, heart rate, and more", icon: Activity, size: "large" },
  { id: "lab-results", type: "lab-results", title: "Lab Results", description: "Recent lab test results and trends", icon: Beaker, size: "large" },
  { id: "medications", type: "medications", title: "Medications", description: "Medication adherence tracking", icon: Pill, size: "medium" },
  { id: "risk-assessment", type: "risk-assessment", title: "Risk Assessment", description: "AI-powered health risk predictions", icon: Shield, size: "large" },
  { id: "appointments", type: "appointments", title: "Appointments", description: "Upcoming and past appointments", icon: Calendar, size: "medium" },
  { id: "ai-insights", type: "ai-insights", title: "AI Insights", description: "Personalized health recommendations", icon: Sparkles, size: "large" },
  { id: "predictive-risks", type: "predictive-risks", title: "Predictive Analytics", description: "Predicted health risks", icon: Brain, size: "medium" },
];

const RISK_COLORS = {
  low: "#22c55e",
  moderate: "#eab308",
  elevated: "#f97316",
  high: "#ef4444",
};

const STATUS_COLORS = {
  normal: "bg-green-500/10 text-green-600 border-green-500/20",
  low: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  critical: "bg-red-500/10 text-red-600 border-red-500/20",
};

function TrendIcon({ trend, className = "" }: { trend: string; className?: string }) {
  if (trend === "up" || trend === "improving") return <TrendingUp className={`h-4 w-4 text-green-500 ${className}`} />;
  if (trend === "down" || trend === "declining" || trend === "worsening") return <TrendingDown className={`h-4 w-4 text-red-500 ${className}`} />;
  return <Minus className={`h-4 w-4 text-muted-foreground ${className}`} />;
}

function HealthScoreWidget({ data }: { data: DashboardData }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <Card className="h-full" data-testid="widget-health-score">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-5 w-5 text-red-500" />
          Overall Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" strokeDasharray={`${(data.healthScore / 100) * 251} 251`} className={getScoreColor(data.healthScore)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(data.healthScore)}`} data-testid="text-health-score">{data.healthScore}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendIcon trend={data.healthScoreTrend} />
              <span className="text-sm capitalize" data-testid="text-health-trend">{data.healthScoreTrend}</span>
            </div>
            <Progress value={data.healthScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {data.healthScore >= 80 ? "Excellent health status" : data.healthScore >= 60 ? "Good - room for improvement" : "Needs attention"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VitalSignsWidget({ data }: { data: DashboardData }) {
  const [selectedVital, setSelectedVital] = useState(data.vitalTrends[0]?.type || "");
  const selected = data.vitalTrends.find((v) => v.type === selectedVital) || data.vitalTrends[0];

  return (
    <Card className="h-full" data-testid="widget-vital-signs">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-blue-500" />
          Vital Signs
        </CardTitle>
        <CardDescription>Track your vital measurements over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.vitalTrends.map((vital) => (
            <Button
              key={vital.type}
              variant={selectedVital === vital.type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedVital(vital.type)}
              data-testid={`button-vital-${vital.type}`}
            >
              {vital.displayName}
              <Badge variant={vital.isNormal ? "secondary" : "destructive"} className="ml-2 text-xs">
                {vital.latestValue} {vital.unit}
              </Badge>
            </Button>
          ))}
        </div>
        {selected && (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selected.dataPoints}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} />
                <Area type="monotone" dataKey="value" stroke={selected.isNormal ? "#22c55e" : "#ef4444"} fill={selected.isNormal ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabResultsWidget({ data }: { data: DashboardData }) {
  const [selectedLab, setSelectedLab] = useState(data.labResults[0]?.testName || "");
  const selected = data.labResults.find((l) => l.testName === selectedLab) || data.labResults[0];

  return (
    <Card className="h-full" data-testid="widget-lab-results">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Beaker className="h-5 w-5 text-purple-500" />
          Lab Results
        </CardTitle>
        <CardDescription>Recent laboratory test results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.labResults.slice(0, 5).map((lab) => (
            <Button key={lab.testName} variant={selectedLab === lab.testName ? "default" : "outline"} size="sm" onClick={() => setSelectedLab(lab.testName)} data-testid={`button-lab-${lab.testName.replace(/\s+/g, "-").toLowerCase()}`}>
              {lab.testName}
              <TrendIcon trend={lab.trend} className="ml-1" />
            </Button>
          ))}
        </div>
        {selected && (
          <>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm">Latest: <strong>{selected.latestValue} {selected.unit}</strong></span>
              <Badge className={STATUS_COLORS[selected.status]}>{selected.status}</Badge>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MedicationsWidget({ data }: { data: DashboardData }) {
  return (
    <Card className="h-full" data-testid="widget-medications">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Pill className="h-5 w-5 text-orange-500" />
          Medication Adherence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-3xl font-bold text-primary" data-testid="text-adherence-overall">{data.medicationAdherence.overall}%</div>
          <div className="flex-1">
            <Progress value={data.medicationAdherence.overall} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{data.medicationAdherence.medications.length} active medications</p>
          </div>
        </div>
        <ScrollArea className="h-[120px]">
          <div className="space-y-2">
            {data.medicationAdherence.medications.map((med, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50" data-testid={`med-item-${i}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{med.name}</p>
                  <p className="text-xs text-muted-foreground">Next: {new Date(med.nextDue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <Badge variant={med.adherence >= 80 ? "secondary" : "destructive"}>{med.adherence}%</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RiskAssessmentWidget({ data }: { data: DashboardData }) {
  const radarData = data.riskAssessments.map((r) => ({
    category: r.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    score: r.score,
    fullMark: 100,
  }));

  return (
    <Card className="h-full" data-testid="widget-risk-assessment">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-cyan-500" />
          Health Risk Assessment
        </CardTitle>
        <CardDescription>AI-powered analysis of your health risks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                <Radar name="Risk Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.riskAssessments.map((risk, i) => (
              <div key={i} className="flex items-center justify-between" data-testid={`risk-${risk.category}`}>
                <span className="text-sm capitalize">{risk.category.replace(/_/g, " ")}</span>
                <div className="flex items-center gap-2">
                  <Badge style={{ backgroundColor: `${RISK_COLORS[risk.level]}20`, color: RISK_COLORS[risk.level] }}>{risk.score}%</Badge>
                  <TrendIcon trend={risk.trend} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentsWidget({ data }: { data: DashboardData }) {
  return (
    <Card className="h-full" data-testid="widget-appointments">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-pink-500" />
          Appointments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">{data.appointments.attended} attended</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm">{data.appointments.missed} missed</span>
          </div>
        </div>
        <ScrollArea className="h-[120px]">
          <div className="space-y-2">
            {data.appointments.upcoming.map((apt) => (
              <div key={apt.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50" data-testid={`appointment-${apt.id}`}>
                <div className="flex flex-col items-center justify-center rounded-md bg-primary/10 p-2 min-w-[45px]">
                  <span className="text-xs font-medium text-primary">{new Date(apt.date).toLocaleDateString("en-US", { month: "short" })}</span>
                  <span className="text-lg font-bold text-primary">{new Date(apt.date).getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{apt.title}</p>
                  <p className="text-xs text-muted-foreground">{apt.provider}</p>
                </div>
                <Badge variant="outline">{apt.type}</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AIInsightsWidget({ data }: { data: DashboardData }) {
  return (
    <Card className="h-full bg-gradient-to-br from-violet-500/5 to-indigo-500/10" data-testid="widget-ai-insights">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-violet-500" />
          AI Health Insights
        </CardTitle>
        <CardDescription>Personalized recommendations from your health data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-background/50 p-3 rounded-lg mb-4">
          <p className="text-sm" data-testid="text-ai-summary">{data.aiInsights.summary}</p>
        </div>
        {data.aiInsights.alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {data.aiInsights.alerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-md ${alert.severity === "high" ? "bg-red-500/10" : "bg-yellow-500/10"}`} data-testid={`alert-${i}`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.severity === "high" ? "text-red-500" : "text-yellow-500"}`} />
                <span className="text-sm">{alert.message}</span>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Recommendations
          </h4>
          <ul className="space-y-1">
            {data.aiInsights.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function PredictiveRisksWidget({ data }: { data: DashboardData }) {
  return (
    <Card className="h-full" data-testid="widget-predictive-risks">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-indigo-500" />
          Predictive Health Risks
        </CardTitle>
        <CardDescription>AI-predicted health risks based on your data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[160px] mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.aiInsights.predictedRisks} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="condition" tick={{ fontSize: 10 }} width={100} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }} />
              <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                {data.aiInsights.predictedRisks.map((entry, index) => (
                  <Cell key={index} fill={entry.probability >= 70 ? "#ef4444" : entry.probability >= 40 ? "#f97316" : "#22c55e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.aiInsights.predictedRisks.map((risk, i) => (
            <div key={i} className="flex items-center justify-between text-sm" data-testid={`predicted-risk-${i}`}>
              <span>{risk.condition}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{risk.timeframe}</Badge>
                <span className={risk.probability >= 70 ? "text-red-500" : risk.probability >= 40 ? "text-orange-500" : "text-green-500"}>{risk.probability}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WidgetSettingsDialog({ widgets, onSave }: { widgets: WidgetConfig[]; onSave: (widgets: WidgetConfig[]) => void }) {
  const [localWidgets, setLocalWidgets] = useState(widgets);

  const toggleWidget = (id: string) => {
    setLocalWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  };

  const handleSave = () => {
    onSave(localWidgets);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-customize">
          <Settings className="h-4 w-4 mr-2" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>Choose which widgets to display on your dashboard</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {localWidgets.map((widget) => {
              const IconComponent = widget.icon;
              return (
                <div key={widget.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`setting-${widget.id}`}>
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{widget.title}</p>
                      <p className="text-xs text-muted-foreground">{widget.description}</p>
                    </div>
                  </div>
                  <Switch checked={widget.enabled} onCheckedChange={() => toggleWidget(widget.id)} data-testid={`toggle-${widget.id}`} />
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={handleSave} data-testid="button-save-settings">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomizableDashboard() {
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const saved = localStorage.getItem("dashboard_widgets");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return WIDGET_DEFINITIONS.map((w, i) => ({ ...w, enabled: true, order: i }));
      }
    }
    return WIDGET_DEFINITIONS.map((w, i) => ({ ...w, enabled: true, order: i }));
  });

  const { data: dashboardData, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/analytics/dashboard"],
  });

  const saveWidgets = (newWidgets: WidgetConfig[]) => {
    setWidgets(newWidgets);
    localStorage.setItem("dashboard_widgets", JSON.stringify(newWidgets));
    toast({ title: "Dashboard Updated", description: "Your widget preferences have been saved." });
  };

  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);

  const renderWidget = (widget: WidgetConfig) => {
    if (!dashboardData) return null;
    switch (widget.type) {
      case "health-score":
        return <HealthScoreWidget data={dashboardData} />;
      case "vital-signs":
        return <VitalSignsWidget data={dashboardData} />;
      case "lab-results":
        return <LabResultsWidget data={dashboardData} />;
      case "medications":
        return <MedicationsWidget data={dashboardData} />;
      case "risk-assessment":
        return <RiskAssessmentWidget data={dashboardData} />;
      case "appointments":
        return <AppointmentsWidget data={dashboardData} />;
      case "ai-insights":
        return <AIInsightsWidget data={dashboardData} />;
      case "predictive-risks":
        return <PredictiveRisksWidget data={dashboardData} />;
      default:
        return null;
    }
  };

  const getWidgetClass = (widget: WidgetConfig) => {
    switch (widget.size) {
      case "small":
        return "md:col-span-1";
      case "large":
        return "md:col-span-2";
      default:
        return "md:col-span-1";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[300px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-customizable-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Health Dashboard</h1>
          <p className="text-muted-foreground">Personalized view of your health metrics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <WidgetSettingsDialog widgets={widgets} onSave={saveWidgets} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {enabledWidgets.map((widget) => (
          <div key={widget.id} className={getWidgetClass(widget)}>
            {renderWidget(widget)}
          </div>
        ))}
      </div>

      {enabledWidgets.length === 0 && (
        <Card className="p-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No widgets enabled</h3>
          <p className="text-muted-foreground mb-4">Customize your dashboard to add health tracking widgets</p>
          <WidgetSettingsDialog widgets={widgets} onSave={saveWidgets} />
        </Card>
      )}
    </div>
  );
}
