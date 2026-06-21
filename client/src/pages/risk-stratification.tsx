import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  Shield,
  Heart,
  Activity,
  Eye,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  Stethoscope,
  Pill,
  AlertCircle,
  CheckCircle,
  User,
  Calendar,
  Zap,
} from "lucide-react";

interface RiskFactor {
  id: string;
  category: string;
  name: string;
  description: string;
  contribution: number;
  severity: string;
  dataSource: string;
  lastUpdated: string;
  trend: string;
  modifiable: boolean;
  interventionPotential: string;
}

interface RiskPrediction {
  id: string;
  riskType: string;
  description: string;
  probability: number;
  timeframe: string;
  confidence: number;
  contributingFactors: string[];
  preventiveActions: string[];
}

interface PatientRiskProfile {
  patientId: string;
  patientName: string;
  overallRiskScore: number;
  riskLevel: string;
  riskTrend: string;
  lastAssessmentDate: string;
  nextReviewDate: string;
  riskFactors: RiskFactor[];
  predictions: RiskPrediction[];
  summary: string;
  clinicianNotes: string;
  priorityRank: number;
  careGaps: {
    id: string;
    type: string;
    description: string;
    urgency: string;
    dueDate: string;
  }[];
  recentChanges: {
    date: string;
    changeType: string;
    description: string;
    impact: string;
  }[];
}

interface RiskStratificationDashboard {
  totalPatients: number;
  criticalRiskCount: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
  avgRiskScore: number;
  riskDistribution: { level: string; count: number; percentage: number }[];
  topRiskFactors: { factor: string; patientCount: number; avgContribution: number }[];
  prioritizedPatients: PatientRiskProfile[];
  trends: { date: string; critical: number; high: number; moderate: number; low: number }[];
  insights: {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    affectedPatients: number;
  }[];
  generatedAt: string;
}

const RISK_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  moderate: "#eab308",
  low: "#22c55e"
};

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

function getRiskLevelColor(level: string): string {
  switch (level.toLowerCase()) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "moderate": return "secondary";
    case "low": return "default";
    default: return "secondary";
  }
}

function getTrendIcon(trend: string) {
  if (trend.includes("downward")) {
    return <ArrowDownRight className="h-4 w-4 text-green-500" />;
  } else if (trend.includes("upward")) {
    return <ArrowUpRight className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-500" />;
}

function RiskScoreGauge({ score, size = "large" }: { score: number; size?: "small" | "large" }) {
  const getColor = () => {
    if (score >= 80) return "#ef4444";
    if (score >= 60) return "#f97316";
    if (score >= 40) return "#eab308";
    return "#22c55e";
  };

  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  const sizeClass = size === "large" ? "w-32 h-32" : "w-16 h-16";
  const textSize = size === "large" ? "text-3xl" : "text-lg";

  return (
    <div className={`relative ${sizeClass}`}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold ${textSize}`} style={{ color: getColor() }}>
          {score}
        </span>
      </div>
    </div>
  );
}

function PatientDetailDialog({ patient }: { patient: PatientRiskProfile }) {
  const { toast } = useToast();
  
  const assessMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/risk-stratification/patients/${patient.patientId}/assess`, {
        depth: "comprehensive",
        includeHistory: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk-stratification/dashboard"] });
      toast({ title: "Assessment Complete", description: "Patient assessment has been refreshed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assess patient.", variant: "destructive" });
    }
  });

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {patient.patientName}
          <Badge variant={getRiskLevelColor(patient.riskLevel) as any} className="ml-2">
            {patient.riskLevel.toUpperCase()}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          Priority Rank: #{patient.priorityRank} | Last Assessment: {new Date(patient.lastAssessmentDate).toLocaleDateString()}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center">
            <RiskScoreGauge score={patient.overallRiskScore} />
            <p className="text-sm text-muted-foreground mt-2">Overall Score</p>
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon(patient.riskTrend)}
              <span className="text-xs text-muted-foreground">{patient.riskTrend}</span>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="font-medium mb-2">Summary</h4>
            <p className="text-sm text-muted-foreground">{patient.summary}</p>
            <div className="flex gap-2 mt-4">
              <Button 
                size="sm" 
                onClick={() => assessMutation.mutate()}
                disabled={assessMutation.isPending}
                data-testid="button-reassess"
              >
                {assessMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Re-assess
              </Button>
              <Button size="sm" variant="outline" data-testid="button-view-record">
                <FileText className="h-4 w-4 mr-1" />
                View Record
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <Tabs defaultValue="factors">
          <TabsList>
            <TabsTrigger value="factors" data-testid="tab-factors">Contributing Factors</TabsTrigger>
            <TabsTrigger value="predictions" data-testid="tab-predictions">Predictions</TabsTrigger>
            <TabsTrigger value="gaps" data-testid="tab-gaps">Care Gaps</TabsTrigger>
            <TabsTrigger value="changes" data-testid="tab-changes">Recent Changes</TabsTrigger>
          </TabsList>

          <TabsContent value="factors" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {patient.riskFactors.length > 0 ? patient.riskFactors.map((factor) => (
                  <Card key={factor.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium">{factor.name}</h5>
                          <Badge variant={getRiskLevelColor(factor.severity) as any} className="text-xs">
                            {factor.severity}
                          </Badge>
                          {factor.modifiable && (
                            <Badge variant="outline" className="text-xs">Modifiable</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{factor.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Source: {factor.dataSource}</span>
                          <span className="flex items-center gap-1">
                            {getTrendIcon(factor.trend)} {factor.trend}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{factor.contribution}%</div>
                        <div className="text-xs text-muted-foreground">Contribution</div>
                      </div>
                    </div>
                  </Card>
                )) : (
                  <p className="text-muted-foreground text-center py-8">No detailed factors available</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="predictions" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {patient.predictions.length > 0 ? patient.predictions.map((pred) => (
                  <Card key={pred.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h5 className="font-medium">{pred.riskType}</h5>
                        <p className="text-sm text-muted-foreground">{pred.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-orange-500">{pred.probability}%</div>
                        <div className="text-xs text-muted-foreground">in {pred.timeframe}</div>
                      </div>
                    </div>
                    <Progress value={pred.probability} className="h-2 mb-2" />
                    <div className="text-xs text-muted-foreground">
                      Confidence: {pred.confidence}%
                    </div>
                    {pred.contributingFactors.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium">Contributing: </span>
                        {pred.contributingFactors.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-xs mr-1">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                )) : (
                  <p className="text-muted-foreground text-center py-8">No predictions available</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="gaps" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {patient.careGaps.length > 0 ? patient.careGaps.map((gap) => (
                  <Card key={gap.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium">{gap.type}</h5>
                          <Badge 
                            variant={gap.urgency === "immediate" ? "destructive" : gap.urgency === "soon" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {gap.urgency}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{gap.description}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due: {new Date(gap.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </Card>
                )) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                    No care gaps identified
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="changes" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {patient.recentChanges.length > 0 ? patient.recentChanges.map((change, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        change.impact === "positive" ? "bg-green-100 dark:bg-green-900" :
                        change.impact === "negative" ? "bg-red-100 dark:bg-red-900" :
                        "bg-gray-100 dark:bg-gray-800"
                      }`}>
                        {change.impact === "positive" ? (
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : change.impact === "negative" ? (
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium">{change.changeType}</h5>
                          <span className="text-xs text-muted-foreground">
                            {new Date(change.date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{change.description}</p>
                      </div>
                    </div>
                  </Card>
                )) : (
                  <p className="text-muted-foreground text-center py-8">No recent changes recorded</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </DialogContent>
  );
}

export default function RiskStratificationPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientRiskProfile | null>(null);
  const { toast } = useToast();

  const { data: dashboard, isLoading, refetch, isRefetching } = useQuery<RiskStratificationDashboard>({
    queryKey: ["/api/risk-stratification/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Unable to Load Dashboard</h2>
          <p className="text-muted-foreground mb-4">There was an error loading the stratification data.</p>
          <Button onClick={() => refetch()} data-testid="button-retry">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const criticalAndHigh = dashboard.prioritizedPatients.filter(
    p => p.riskLevel === "critical" || p.riskLevel === "high"
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            AI Patient Stratification
          </h1>
          <p className="text-muted-foreground">
            Analyze patient data to identify and prioritize high-need patients
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          disabled={isRefetching}
          data-testid="button-refresh-dashboard"
        >
          {isRefetching ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{dashboard.criticalRiskCount}</div>
            <p className="text-xs text-muted-foreground">patients need immediate attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              High
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{dashboard.highRiskCount}</div>
            <p className="text-xs text-muted-foreground">patients require close monitoring</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-yellow-500" />
              Moderate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{dashboard.moderateRiskCount}</div>
            <p className="text-xs text-muted-foreground">patients with routine needs</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              Low
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{dashboard.lowRiskCount}</div>
            <p className="text-xs text-muted-foreground">patients in good standing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Panel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard.totalPatients}</div>
            <p className="text-xs text-muted-foreground">avg score: {dashboard.avgRiskScore}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Prioritized Patients
            </CardTitle>
            <CardDescription>
              Patients ranked by score and clinical urgency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {criticalAndHigh.map((patient) => (
                  <Dialog key={patient.patientId}>
                    <DialogTrigger asChild>
                      <Card 
                        className="p-4 cursor-pointer hover-elevate transition-all"
                        onClick={() => setSelectedPatient(patient)}
                        data-testid={`card-patient-${patient.patientId}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-lg font-bold">
                            #{patient.priorityRank}
                          </div>
                          <RiskScoreGauge score={patient.overallRiskScore} size="small" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium truncate">{patient.patientName}</h4>
                              <Badge variant={getRiskLevelColor(patient.riskLevel) as any}>
                                {patient.riskLevel}
                              </Badge>
                              {getTrendIcon(patient.riskTrend)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{patient.summary}</p>
                            {patient.careGaps.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                <span className="text-xs text-yellow-600 dark:text-yellow-400">
                                  {patient.careGaps.length} care gap(s)
                                </span>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </Card>
                    </DialogTrigger>
                    <PatientDetailDialog patient={patient} />
                  </Dialog>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={dashboard.riskDistribution}
                    dataKey="count"
                    nameKey="level"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ level, percentage }) => `${level}: ${percentage.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {dashboard.riskDistribution.map((entry, index) => (
                      <Cell key={entry.level} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                7-Day Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={dashboard.trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { weekday: 'short' })}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="critical" stackId="1" fill={RISK_COLORS.critical} stroke={RISK_COLORS.critical} />
                  <Area type="monotone" dataKey="high" stackId="1" fill={RISK_COLORS.high} stroke={RISK_COLORS.high} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Top Contributing Factors
            </CardTitle>
            <CardDescription>
              Most common factors across patient population
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboard.topRiskFactors.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis 
                  type="category" 
                  dataKey="factor" 
                  width={150} 
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar dataKey="patientCount" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Insights
            </CardTitle>
            <CardDescription>
              Automated observations and alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {dashboard.insights.map((insight) => (
                  <Card key={insight.id} className={`p-3 border-l-4 ${
                    insight.priority === "high" ? "border-l-red-500" :
                    insight.priority === "medium" ? "border-l-yellow-500" :
                    "border-l-blue-500"
                  }`}>
                    <div className="flex items-start gap-2">
                      {insight.type === "alert" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                      ) : insight.type === "observation" ? (
                        <Eye className="h-4 w-4 text-blue-500 mt-0.5" />
                      ) : (
                        <Target className="h-4 w-4 text-green-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h5 className="font-medium text-sm">{insight.title}</h5>
                        <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {insight.affectedPatients} patients
                          </Badge>
                          <Badge 
                            variant={insight.priority === "high" ? "destructive" : "secondary"} 
                            className="text-xs"
                          >
                            {insight.priority} priority
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardFooter className="pt-4">
          <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(dashboard.generatedAt).toLocaleString()}
            </span>
            <span>
              Data sources: EHR, Labs, Claims, Patient-Reported
            </span>
          </div>
        </CardFooter>
      </Card>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-risk-stratification-disclaimer" />
    </div>
  );
}